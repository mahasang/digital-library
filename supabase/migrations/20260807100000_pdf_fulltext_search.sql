-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 17: ค้นหาข้อความภายใน PDF
--
-- เพิ่มตาราง research_document_texts เก็บข้อความที่ดึงจาก PDF แยกออกจาก
-- research_items โดยสิ้นเชิง (1 แถวต่องานวิจัย 1 รายการ) — การดึงข้อความจริง
-- เกิดขึ้นฝั่งเซิร์ฟเวอร์เท่านั้น (lib/pdf/) หลังไฟล์ผ่านการตรวจ magic-byte และ
-- สแกนมัลแวร์ (lib/security/validate-upload.server.ts) แล้วเสมอ — ดูรายละเอียด
-- สถาปัตยกรรมเต็มที่ docs/pdf-full-text-search.md
--
-- เลือก pg_trgm (ตรวจสอบว่าเปิดใช้งานแล้วตั้งแต่ 20260731100000_schema.sql)
-- แทน PostgreSQL Full-text Search (tsvector/tsquery) โดยเจตนา เนื่องจาก FTS
-- ไม่มี dictionary ภาษาไทยในตัว (การตัดคำภาษาไทยด้วย 'simple' config จะไม่
-- ตัดคำถูกต้อง) — pg_trgm ทำงานระดับตัวอักษร (trigram) จึงค้นหาได้ทั้งไทยและ
-- อังกฤษโดยไม่ต้องพึ่งการตัดคำเลย แลกกับการไม่มี stemming/ranking แบบ FTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- research_document_texts
-- ----------------------------------------------------------------------------
create table public.research_document_texts (
  id uuid primary key default gen_random_uuid(),
  research_item_id uuid not null references public.research_items (id) on delete cascade,
  extracted_text text,
  extracted_text_normalized text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'completed', 'no_text_found', 'failed')),
  extraction_error_message text,
  extracted_at timestamptz,
  source_file_path text,
  source_file_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (research_item_id)
);

comment on table public.research_document_texts is
  'ข้อความที่ดึงจากไฟล์ PDF ของงานวิจัยแต่ละรายการ (1 แถวต่องานวิจัย) สำหรับค้นหาเนื้อหาภายในเอกสาร';
comment on column public.research_document_texts.extracted_text is
  'ข้อความดิบที่ดึงได้จริง — ห้ามส่งค่านี้ทั้งก้อนไปยัง Client เด็ดขาด ใช้สำหรับสร้าง snippet ฝั่งเซิร์ฟเวอร์เท่านั้น';
comment on column public.research_document_texts.extracted_text_normalized is
  'ข้อความเดียวกับ extracted_text แต่แปลงเป็นตัวพิมพ์เล็กและยุบช่องว่างซ้ำ ใช้เทียบค้นหาแบบ substring/trigram ให้สม่ำเสมอ';
comment on column public.research_document_texts.extraction_status is
  'pending = รอประมวลผล, processing = กำลังประมวลผล (กันประมวลผลซ้ำพร้อมกัน), completed = สำเร็จมีข้อความ, no_text_found = เปิดไฟล์ได้แต่ไม่มีข้อความ (มักเป็นเอกสารสแกน), failed = ดึงข้อความไม่สำเร็จ';
comment on column public.research_document_texts.extraction_error_message is
  'ข้อความ error ที่ sanitize แล้วเท่านั้น (ไม่มี stack trace/query/secret) — สำหรับแสดงในหน้าผู้ดูแล';
comment on column public.research_document_texts.source_file_path is
  'พาธไฟล์ใน Storage ที่ใช้ดึงข้อความชุดนี้ — เทียบกับ research_items.pdf_file ปัจจุบันเพื่อตรวจว่าข้อความยังตรงกับไฟล์เวอร์ชันล่าสุดหรือไม่';
comment on column public.research_document_texts.source_file_hash is
  'SHA-256 ของเนื้อไฟล์ตอนดึงข้อความ — ใช้ยืนยันความถูกต้องของไฟล์เพิ่มอีกชั้นนอกเหนือจาก path';

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------

-- gin_trgm_ops: รองรับทั้ง ILIKE '%คำค้น%' (substring) และ similarity()/% operator
-- (fuzzy ranking) แบบเดียวกัน ไม่ขึ้นกับภาษา/การตัดคำ — ต้นทุนคือขนาด index
-- ค่อนข้างใหญ่กว่า btree ทั่วไปและ write ช้าลงเล็กน้อยตอน insert/update (ยอมรับ
-- ได้เพราะตารางนี้ไม่ได้ insert/update บ่อย เขียนเฉพาะตอนอัปโหลด/แทนที่ไฟล์)
create index idx_research_document_texts_normalized_trgm
  on public.research_document_texts using gin (extracted_text_normalized gin_trgm_ops);

-- สำหรับหน้าผู้ดูแลกรอง/นับตามสถานะ และค้นหาแถวที่ต้อง retry (failed/no_text_found)
create index idx_research_document_texts_status
  on public.research_document_texts (extraction_status);

create trigger trg_research_document_texts_updated_at
  before update on public.research_document_texts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: มองเห็นข้อความได้ก็ต่อเมื่อมองเห็น/มีสิทธิ์อ่าน research_items แถวนั้น
-- จริงเท่านั้น (กฎเดียวกับ research_items_select ใน 20260731100200_rls_policies.sql
-- บวกเงื่อนไขเพิ่มว่า access_level ต้องไม่ใช่ metadata_only สำหรับผู้อ่านทั่วไป
-- — metadata_only แปลว่าไม่มีสิทธิ์เข้าถึงเนื้อไฟล์เลยไม่ว่าจะเป็นใครก็ตาม
-- ยกเว้นเจ้าของงาน/librarian ขึ้นไปที่ต้องดูได้เพื่อตรวจสอบเสมอ)
--
-- ไม่ grant insert/update/delete ให้ anon/authenticated เลย — การเขียนข้อมูล
-- ในตารางนี้ (ตอนดึงข้อความ/สั่งประมวลผลใหม่) ทำผ่าน Service Role จาก
-- Server Action เท่านั้น (lib/pdf/process-extraction.server.ts) ซึ่งข้าม RLS
-- โดยธรรมชาติ — สอดคล้องกับรูปแบบเดียวกับตาราง notifications
-- ============================================================================
alter table public.research_document_texts enable row level security;

grant select on public.research_document_texts to anon, authenticated;

-- service_role มี BYPASSRLS แต่ยังต้องมี table-level GRANT ตามปกติของ Postgres
-- เสมอ (บทเรียนจากตาราง notifications ใน Phase 15 — BYPASSRLS ไม่ได้แปลว่า
-- ข้าม GRANT ไปด้วย) การเขียนข้อมูลจริงทั้งหมดทำผ่าน Service Role client จาก
-- lib/pdf/process-extraction.server.ts เท่านั้น
grant select, insert, update on public.research_document_texts to service_role;

create policy "research_document_texts_select" on public.research_document_texts
  for select using (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_item_id
        and (
          (
            ri.status = 'published'
            and ri.access_level != 'metadata_only'
            and (
              ri.access_level in ('public', 'read_only')
              or (ri.access_level = 'member_only' and public.user_max_role_rank() >= 10)
              or (ri.access_level = 'staff_only' and public.user_max_role_rank() >= 20)
            )
          )
          or ri.submitted_by = auth.uid()
          or public.user_max_role_rank() >= 30
        )
    )
  );

-- ----------------------------------------------------------------------------
-- acquire_extraction_lock(): ล็อกแถวแบบ atomic ก่อนเริ่มดึงข้อความเสมอ กัน
-- การประมวลผลไฟล์เดียวกันซ้ำซ้อนพร้อมกัน (เช่น กดปุ่ม "ประมวลผลใหม่" ซ้ำเร็วๆ
-- หรืออัปโหลดซ้ำระหว่างที่รอบเดิมยังไม่เสร็จ) — insert แถวใหม่สถานะ
-- 'processing' ทันทีถ้ายังไม่มี หรือเปลี่ยนเป็น 'processing' ถ้าแถวเดิมมีอยู่
-- และไม่ได้กำลัง processing อยู่ก่อนแล้ว คืนค่า id ถ้าได้ล็อกจริง คืน null ถ้า
-- มีคนอื่นถือล็อกอยู่ก่อนแล้ว (ต้อง atomic เพราะ WHERE ใน DO UPDATE ป้องกัน
-- race condition ระดับแถวเดียวกันได้จริงจาก Postgres เอง ไม่ใช่แค่ตรวจในโค้ด)
-- ----------------------------------------------------------------------------
create or replace function public.acquire_extraction_lock(
  p_research_item_id uuid,
  p_source_file_path text
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.research_document_texts (research_item_id, extraction_status, source_file_path)
  values (p_research_item_id, 'processing', p_source_file_path)
  on conflict (research_item_id) do update
    set extraction_status = 'processing',
        source_file_path = excluded.source_file_path,
        extraction_error_message = null,
        updated_at = now()
    where public.research_document_texts.extraction_status != 'processing'
  returning id;
$$;

grant execute on function public.acquire_extraction_lock(uuid, text) to service_role;
