-- ============================================================================
-- Phase 23: ORCID OAuth (เชื่อมบัญชี ORCID ด้วยตนเองผ่านผู้วิจัยเอง) + OCR
-- สำหรับ PDF ที่เป็นเอกสารสแกน (background job แยกจาก extraction ปกติ)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. เชื่อม profiles <-> authors: authors.profile_id มีอยู่แล้วตั้งแต่ Phase 3
-- แต่ไม่เคยมี unique constraint (ป้องกันหนึ่งบัญชีผู้ใช้ผูกกับผู้วิจัยได้มากกว่า
-- หนึ่งคน) และไม่เคยมี UI ให้ตั้งค่าเลย — เพิ่ม unique index ให้ถูกต้อง ส่วนการ
-- ผูกจริงทำที่ /dashboard/authors/[id] (เจ้าหน้าที่ rank >= 30 เท่านั้น เพื่อกัน
-- ผู้วิจัยอ้างตัวเป็นคนอื่นเอง) — ดู app/dashboard/authors/actions.ts
-- ----------------------------------------------------------------------------
create unique index idx_authors_profile_id_unique on public.authors (profile_id)
  where profile_id is not null;

-- ----------------------------------------------------------------------------
-- 2. authors: เพิ่มสถานะยืนยันผ่าน ORCID OAuth จริง แยกจาก orcid_verified_at
-- เดิม (เจ้าหน้าที่ยืนยันด้วยตา) ตามคำแนะนำเดิมใน docs/orcid-integration.md
-- หัวข้อ 3.2 ข้อ 4 ทุกประการ — ทั้งสองสถานะแสดงแยกกันชัดเจนในหน้าเว็บเสมอ
-- ----------------------------------------------------------------------------
alter table public.authors add column orcid_oauth_verified_at timestamptz;

comment on column public.authors.orcid_oauth_verified_at is
  'วันเวลาที่ยืนยัน ORCID ผ่าน OAuth จริงด้วยตนเอง (ผู้วิจัยล็อกอิน ORCID เองแล้วอนุญาตให้ระบบเข้าถึง) — น่าเชื่อถือกว่า orcid_verified_at (เจ้าหน้าที่ยืนยันด้วยตา) เพราะยืนยันจาก ORCID.org จริง ล้างอัตโนมัติเมื่อ ORCID เปลี่ยน (เหมือน orcid_verified_at)';

-- ORCID callback (app/api/orcid/callback/route.ts) ต้องเขียน authors.orcid /
-- orcid_oauth_verified_at แทนผู้ใช้ที่อาจเป็นแค่ Member/Guest (ไม่ผ่าน RLS
-- policy "authors_update_staff_and_above" ที่บังคับ rank >= 20) จึงต้องใช้
-- Service Role ข้าม RLS เฉพาะจุดนี้ — authors ไม่เคย grant ให้ service_role มา
-- ก่อนเลย (select_all policy เดิมพอสำหรับ client ปกติแล้ว) จึงต้องเพิ่มที่นี่
grant select, update on public.authors to service_role;

-- ----------------------------------------------------------------------------
-- 3. orcid_oauth_states: เก็บ state แบบใช้ครั้งเดียวกัน CSRF ระหว่าง OAuth flow
-- อายุสั้น (10 นาที) ลบทิ้งทันทีที่ใช้แล้ว (consume-once) หรือหมดอายุ
-- ----------------------------------------------------------------------------
create table public.orcid_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

comment on table public.orcid_oauth_states is
  'state แบบใช้ครั้งเดียวสำหรับ ORCID OAuth flow (กัน CSRF) — ลบทิ้งทันทีที่ callback ใช้แล้วหรือหมดอายุ ไม่เก็บถาวร';

create index idx_orcid_oauth_states_expires on public.orcid_oauth_states (expires_at);

alter table public.orcid_oauth_states enable row level security;
-- ไม่ grant ให้ authenticated เลย — สร้าง/อ่าน/ลบผ่าน Service Role เท่านั้น
-- (Server Action/Route Handler ของ OAuth flow ทั้งหมดทำงานฝั่งเซิร์ฟเวอร์อยู่แล้ว
-- ไม่มีเหตุผลให้ client เห็น state ของคนอื่นหรือแม้แต่ของตัวเอง)
grant select, insert, delete on public.orcid_oauth_states to service_role;

-- ----------------------------------------------------------------------------
-- 4. orcid_oauth_tokens: เก็บ access/refresh token ของ ORCID แยกจากตาราง
-- authors โดยเจตนา (authors มี RLS เปิดให้ทุกคนอ่านได้ตามเดิม — ห้ามเก็บ token
-- ปนอยู่ในนั้นเด็ดขาด) ไม่ grant ให้ authenticated เลยแม้แต่เจ้าของเอง เข้าถึง
-- ได้เฉพาะ Service Role เท่านั้น (ผู้ใช้ไม่มีความจำเป็นต้องอ่าน token ตรงๆ —
-- หน้าเว็บแสดงแค่สถานะ "เชื่อมแล้ว/ยังไม่เชื่อม" ผ่าน authors.orcid_oauth_verified_at)
-- ----------------------------------------------------------------------------
create table public.orcid_oauth_tokens (
  author_id uuid primary key references public.authors (id) on delete cascade,
  orcid text not null,
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orcid_oauth_tokens is
  'access/refresh token ของ ORCID OAuth ต่อผู้วิจัยหนึ่งคน — ไม่ grant ให้ authenticated เด็ดขาด (ข้อมูลอ่อนไหว) เข้าถึงได้เฉพาะ Service Role';

create trigger trg_orcid_oauth_tokens_updated_at
  before update on public.orcid_oauth_tokens
  for each row execute function public.set_updated_at();

alter table public.orcid_oauth_tokens enable row level security;
grant select, insert, update, delete on public.orcid_oauth_tokens to service_role;

-- ----------------------------------------------------------------------------
-- 5. research_document_texts: เพิ่มคอลัมน์ OCR แยกจาก extracted_text เดิมทุก
-- ประการ (ไม่ปนกัน ไม่ overwrite กัน) — ใช้เมื่อ extraction_status ปกติได้
-- 'no_text_found' (เอกสารสแกน) เจ้าหน้าที่/Super Admin สั่ง OCR เพิ่มเติมได้
-- ----------------------------------------------------------------------------
alter table public.research_document_texts
  add column ocr_status text not null default 'not_required'
    check (ocr_status in ('not_required', 'pending', 'processing', 'completed', 'failed')),
  add column ocr_text text,
  add column ocr_text_normalized text,
  add column ocr_error_message text,
  add column ocr_provider text,
  add column ocr_language text,
  add column ocr_confidence real check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)),
  add column ocr_processed_at timestamptz;

comment on column public.research_document_texts.ocr_status is
  'not_required = ยังไม่มีเหตุให้ต้อง OCR (extraction ปกติสำเร็จ/ยังไม่เคยลอง), pending = เข้าคิวรอ OCR, processing = กำลัง OCR, completed = OCR สำเร็จมีข้อความ, failed = OCR ไม่สำเร็จ — ดู docs/ocr-operations.md';
comment on column public.research_document_texts.ocr_text is
  'ข้อความที่ได้จาก OCR — แยกจาก extracted_text เสมอ (อาจมีความคลาดเคลื่อนสูงกว่าข้อความที่คัดลอกได้จริง) ห้ามส่งค่านี้ทั้งก้อนไปยัง Client เด็ดขาดเช่นเดียวกับ extracted_text';
comment on column public.research_document_texts.ocr_confidence is
  'ความมั่นใจของผล OCR (0-1) หาก provider ให้ค่านี้มา — null หาก provider ไม่รองรับ';

-- GIN index สำหรับค้นหา OCR text แบบเดียวกับ extracted_text_normalized เดิม
create index idx_research_document_texts_ocr_text_trgm
  on public.research_document_texts using gin (ocr_text_normalized gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 6. acquire_ocr_lock(): ล็อกแบบ atomic ก่อนเริ่ม OCR เสมอ (กันประมวลผลไฟล์
-- เดียวกันซ้ำซ้อนพร้อมกัน) — ต่างจาก acquire_extraction_lock() เดิมตรงที่ไม่
-- ต้อง insert แถวใหม่ (แถว research_document_texts มีอยู่แล้วเสมอก่อนจะ OCR ได้
-- เพราะต้องผ่านการดึงข้อความปกติแล้วได้ no_text_found มาก่อน) จึงเป็นแค่
-- UPDATE แบบมีเงื่อนไขตรงๆ
-- ----------------------------------------------------------------------------
create or replace function public.acquire_ocr_lock(p_research_item_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  update public.research_document_texts
  set ocr_status = 'processing',
      ocr_error_message = null,
      updated_at = now()
  where research_item_id = p_research_item_id
    and ocr_status != 'processing'
  returning id;
$$;

grant execute on function public.acquire_ocr_lock(uuid) to service_role;

comment on function public.acquire_ocr_lock is
  'ล็อกแถวแบบ atomic ก่อนเริ่ม OCR เสมอ (เหมือน acquire_extraction_lock ของช่วงที่ 17) กันประมวลผลไฟล์เดียวกันซ้ำซ้อนพร้อมกัน';

-- ----------------------------------------------------------------------------
-- 7. background_jobs: เพิ่ม job type ใหม่ `ocr_processing`
-- ----------------------------------------------------------------------------
alter table public.background_jobs drop constraint background_jobs_job_type_check;
alter table public.background_jobs add constraint background_jobs_job_type_check
  check (
    job_type in (
      'pdf_text_extraction',
      'file_security_rescan',
      'access_expiration',
      'category_notification',
      'duplicate_scan',
      'ocr_processing'
    )
  );

-- service_role ต้อง select/update research_document_texts ได้ (job handler ของ
-- OCR ใช้ Service Role เขียนผลลัพธ์ — เดิมมีแค่ authenticated grant จากช่วงที่ 17
-- เพราะ processResearchDocumentExtraction() เดิมใช้ Service Role อยู่แล้วแต่
-- ผ่าน RPC acquire_extraction_lock (security definer) + query ตรงบางจุด ตรวจสอบ
-- แล้วว่ามี grant service_role ให้ตารางนี้อยู่แล้วจากช่วงที่ 17 — เพิ่มไว้ซ้ำแบบ
-- idempotent เผื่อกรณี fresh install ที่ยังไม่เคยมี)
grant select, insert, update on public.research_document_texts to service_role;
