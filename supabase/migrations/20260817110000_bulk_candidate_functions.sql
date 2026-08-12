-- ============================================================================
-- Phase 28: ฟังก์ชันนับ/แบ่งหน้ารายการที่ตรงตัวกรองสำหรับ "ประมวลผลทั้งหมดตาม
-- ตัวกรอง" ของทั้ง 3 โดเมน (pdf-processing/ocr, duplicate-scan, file-security)
-- เขียนเป็น SQL function แทนการ query ผ่าน PostgREST/Supabase-js เพราะตัวกรอง
-- บางตัว (no_text/never_attempted, replaced, category, never-scanned) ต้องใช้
-- LEFT JOIN ตรวจการไม่มีแถว หรือเทียบคอลัมน์ข้ามตารางกัน ซึ่ง PostgREST query
-- builder ฝั่ง JS แสดงออกไม่ได้ (เดิม getPdfProcessingCandidatesCount คืน null
-- สำหรับ filter เหล่านี้เพราะเหตุนี้ — หน้าเว็บซ่อนปุ่ม "ประมวลผลทั้งหมด" ไว้)
--
-- ทุกฟังก์ชัน security invoker (ไม่ security definer) เพราะเรียกผ่าน Service
-- Role client เท่านั้น (เหมือน getXxxCandidatesPage เดิมทุกฟังก์ชัน) — service
-- role ข้าม RLS อยู่แล้วโดยธรรมชาติ ไม่ต้องยกระดับสิทธิ์เพิ่ม grant ให้
-- service_role เท่านั้น ไม่ grant ให้ authenticated (ไม่เคยเรียกจาก client โดยตรง)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PDF processing / OCR (ใช้ตารางร่วมกัน — research_items LEFT JOIN
-- research_document_texts) — สองมิติตัวกรองอิสระที่ AND กัน:
--   p_extraction_state: สถานะการดึงข้อความปกติ (รวม never_attempted/replaced
--     ที่เดิมนับไม่ได้) ใช้ทั้งหน้า pdf-processing และ ocr (OCR ใช้ตัวกรองนี้
--     สำหรับ "การดึงข้อความปกติไม่พบข้อความ" ซึ่งเป็นเงื่อนไขเดิมของ candidate)
--   p_ocr_status: สถานะ OCR เอง (ocr_status) — มิติใหม่ที่เพิ่งเปิดให้กรองได้
--     ในเส้นทาง "ประมวลผลทั้งหมด" (เดิมกรองได้แค่ผ่าน per-job retry เท่านั้น)
-- ----------------------------------------------------------------------------
create or replace function public.count_pdf_processing_candidates(
  p_extraction_state text default null,
  p_ocr_status text default null,
  p_year int default null,
  p_category_id uuid default null,
  p_publish_status text default null
) returns bigint
language sql stable security invoker set search_path = public as $$
  select count(*)::bigint
  from public.research_items ri
  left join public.research_document_texts t on t.research_item_id = ri.id
  where ri.pdf_file is not null
    and (p_year is null or ri.year = p_year)
    and (p_publish_status is null or ri.status = p_publish_status)
    and (p_category_id is null or exists (
          select 1 from public.research_categories rc
          where rc.research_id = ri.id and rc.category_id = p_category_id))
    and (
      p_extraction_state is null
      or (p_extraction_state = 'never_attempted' and t.id is null)
      or (p_extraction_state = 'replaced' and t.id is not null
            and t.source_file_path is distinct from ri.pdf_file)
      or (p_extraction_state not in ('never_attempted', 'replaced')
            and t.extraction_status = p_extraction_state)
    )
    and (p_ocr_status is null or t.ocr_status = p_ocr_status);
$$;

create or replace function public.page_pdf_processing_candidates(
  p_extraction_state text default null,
  p_ocr_status text default null,
  p_year int default null,
  p_category_id uuid default null,
  p_publish_status text default null,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 100
) returns table (
  id uuid,
  pdf_file text,
  attachment_file text,
  access_level text,
  page_count int,
  updated_at timestamptz
)
language sql stable security invoker set search_path = public as $$
  select ri.id, ri.pdf_file, ri.attachment_file, ri.access_level, ri.page_count, ri.updated_at
  from public.research_items ri
  left join public.research_document_texts t on t.research_item_id = ri.id
  where ri.pdf_file is not null
    and (p_year is null or ri.year = p_year)
    and (p_publish_status is null or ri.status = p_publish_status)
    and (p_category_id is null or exists (
          select 1 from public.research_categories rc
          where rc.research_id = ri.id and rc.category_id = p_category_id))
    and (
      p_extraction_state is null
      or (p_extraction_state = 'never_attempted' and t.id is null)
      or (p_extraction_state = 'replaced' and t.id is not null
            and t.source_file_path is distinct from ri.pdf_file)
      or (p_extraction_state not in ('never_attempted', 'replaced')
            and t.extraction_status = p_extraction_state)
    )
    and (p_ocr_status is null or t.ocr_status = p_ocr_status)
    and (p_after_updated_at is null
         or (ri.updated_at, ri.id) < (p_after_updated_at, p_after_id))
  order by ri.updated_at desc, ri.id desc
  limit greatest(p_limit, 1);
$$;

-- ----------------------------------------------------------------------------
-- 2. Duplicate scan — เพิ่ม category (พร้อม count จริง ไม่ใช่ null เหมือนเดิม)
-- และ never_scanned_only (ไม่เคยเป็นคู่ในผลตรวจซ้ำมาก่อนเลย ไม่ว่าฝั่งใดของคู่)
-- p_edited_after ขยาย recentlyEditedOnly เดิม (fixed 30 วัน) ให้รับช่วงเวลาใดก็
-- ได้ — ผู้เรียกส่ง now()-interval '30 days' เพื่อพฤติกรรมเดิมทุกประการ
-- ----------------------------------------------------------------------------
create or replace function public.count_duplicate_scan_candidates(
  p_year int default null,
  p_category_id uuid default null,
  p_status text default null,
  p_edited_after timestamptz default null,
  p_never_scanned_only boolean default false
) returns bigint
language sql stable security invoker set search_path = public as $$
  select count(*)::bigint
  from public.research_items ri
  where ri.status is distinct from 'merged'
    and (p_year is null or ri.year = p_year)
    and (p_status is null or ri.status = p_status)
    and (p_edited_after is null or ri.updated_at >= p_edited_after)
    and (p_category_id is null or exists (
          select 1 from public.research_categories rc
          where rc.research_id = ri.id and rc.category_id = p_category_id))
    and (not p_never_scanned_only or not exists (
          select 1 from public.duplicate_research_reviews d
          where d.research_item_id = ri.id or d.candidate_research_item_id = ri.id));
$$;

create or replace function public.page_duplicate_scan_candidates(
  p_year int default null,
  p_category_id uuid default null,
  p_status text default null,
  p_edited_after timestamptz default null,
  p_never_scanned_only boolean default false,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 100
) returns table (id uuid, updated_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select ri.id, ri.updated_at
  from public.research_items ri
  where ri.status is distinct from 'merged'
    and (p_year is null or ri.year = p_year)
    and (p_status is null or ri.status = p_status)
    and (p_edited_after is null or ri.updated_at >= p_edited_after)
    and (p_category_id is null or exists (
          select 1 from public.research_categories rc
          where rc.research_id = ri.id and rc.category_id = p_category_id))
    and (not p_never_scanned_only or not exists (
          select 1 from public.duplicate_research_reviews d
          where d.research_item_id = ri.id or d.candidate_research_item_id = ri.id))
    and (p_after_updated_at is null
         or (ri.updated_at, ri.id) < (p_after_updated_at, p_after_id))
  order by ri.updated_at desc, ri.id desc
  limit greatest(p_limit, 1);
$$;

-- ----------------------------------------------------------------------------
-- 3. File security — เพิ่ม file_kind (ไม่มีคอลัมน์ประเภทไฟล์จริง จึงอนุมานจาก
-- การมี pdf_file/attachment_file), ช่วงวันที่อัปโหลด (created_at), และ
-- never_scanned_only (scanned_at is null — คนละความหมายกับ scan_status='pending'
-- ซึ่งอาจถูกตั้งไว้แล้วระหว่างรอคิวโดยที่ยังไม่เคยสแกนจริงเลยก็ได้)
-- ----------------------------------------------------------------------------
create or replace function public.count_file_security_candidates(
  p_scan_status text default null,
  p_never_scanned_only boolean default false,
  p_file_kind text default null,
  p_created_after timestamptz default null,
  p_created_before timestamptz default null
) returns bigint
language sql stable security invoker set search_path = public as $$
  select count(*)::bigint
  from public.research_items ri
  where (ri.pdf_file is not null or ri.attachment_file is not null)
    and (p_file_kind is null or p_file_kind = 'either'
         or (p_file_kind = 'pdf' and ri.pdf_file is not null)
         or (p_file_kind = 'attachment' and ri.attachment_file is not null))
    and (p_scan_status is null or ri.scan_status = p_scan_status)
    and (not p_never_scanned_only or ri.scanned_at is null)
    and (p_created_after is null or ri.created_at >= p_created_after)
    and (p_created_before is null or ri.created_at < p_created_before);
$$;

create or replace function public.page_file_security_candidates(
  p_scan_status text default null,
  p_never_scanned_only boolean default false,
  p_file_kind text default null,
  p_created_after timestamptz default null,
  p_created_before timestamptz default null,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 100
) returns table (id uuid, pdf_file text, attachment_file text, updated_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select ri.id, ri.pdf_file, ri.attachment_file, ri.updated_at
  from public.research_items ri
  where (ri.pdf_file is not null or ri.attachment_file is not null)
    and (p_file_kind is null or p_file_kind = 'either'
         or (p_file_kind = 'pdf' and ri.pdf_file is not null)
         or (p_file_kind = 'attachment' and ri.attachment_file is not null))
    and (p_scan_status is null or ri.scan_status = p_scan_status)
    and (not p_never_scanned_only or ri.scanned_at is null)
    and (p_created_after is null or ri.created_at >= p_created_after)
    and (p_created_before is null or ri.created_at < p_created_before)
    and (p_after_updated_at is null
         or (ri.updated_at, ri.id) < (p_after_updated_at, p_after_id))
  order by ri.updated_at desc, ri.id desc
  limit greatest(p_limit, 1);
$$;

grant execute on function
  public.count_pdf_processing_candidates(text, text, int, uuid, text),
  public.page_pdf_processing_candidates(text, text, int, uuid, text, timestamptz, uuid, int),
  public.count_duplicate_scan_candidates(int, uuid, text, timestamptz, boolean),
  public.page_duplicate_scan_candidates(int, uuid, text, timestamptz, boolean, timestamptz, uuid, int),
  public.count_file_security_candidates(text, boolean, text, timestamptz, timestamptz),
  public.page_file_security_candidates(text, boolean, text, timestamptz, timestamptz, timestamptz, uuid, int)
  to service_role;
