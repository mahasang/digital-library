-- ============================================================================
-- Phase 29: รองรับ OCR provider แบบ async (submit + poll) และ progress ระดับ
-- หน้าจริง — เพิ่มคอลัมน์ progress บน background_jobs (คอลัมน์ progress เดิม
-- ตั้งแต่ช่วงที่ 20 ไม่เคยถูกเขียนค่าจริงเลย ใช้ต่อแทนการเพิ่มคอลัมน์ซ้ำ
-- ความหมาย) และเพิ่มสถานะ 'blocked' ให้ ocr_status (แยกจาก 'failed' — "ไม่ได้
-- ลองทำเลยเพราะปัญหาการตั้งค่า/นโยบาย" ต่างจาก "ลองแล้วแต่ provider ตอบผิดพลาด
-- จริง")
-- ============================================================================

alter table public.background_jobs
  add column current_page int,
  add column total_pages int,
  add column progress_message text;

comment on column public.background_jobs.current_page is
  'หน้าปัจจุบันที่ OCR provider กำลังประมวลผล (เฉพาะ provider แบบ async ที่รายงานได้จริงเท่านั้น — ไม่เคยเป็นค่าจำลอง) null เมื่อไม่ทราบ/ไม่เกี่ยวข้อง (job type อื่นที่ไม่ใช่ ocr_processing)';
comment on column public.background_jobs.total_pages is
  'จำนวนหน้าทั้งหมดของเอกสารที่ OCR provider รายงาน (อาจต่างจาก research_items.page_count ที่คำนวณเองฝั่งแอปเล็กน้อยได้ในทางทฤษฎี) null เมื่อไม่ทราบ';
comment on column public.background_jobs.progress_message is
  'ข้อความสถานะที่ provider ไม่รายงานหมายเลขหน้าให้ (เช่น "กำลังประมวลผลโดย OCR provider") ใช้เมื่อ current_page/total_pages เป็น null เท่านั้น ไม่เคยแสดงตัวเลข progress ปลอม';
comment on column public.background_jobs.progress is
  '(ช่วงที่ 20, เพิ่งเริ่มมี handler เขียนค่าจริงตั้งแต่ช่วงที่ 29) 0-100 — คำนวณจาก current_page/total_pages เมื่อทราบทั้งคู่เท่านั้น ไม่เคยเป็นค่าประมาณ/ปลอม';

alter table public.research_document_texts
  drop constraint research_document_texts_ocr_status_check,
  add constraint research_document_texts_ocr_status_check
    check (ocr_status in ('not_required', 'pending', 'processing', 'completed', 'failed', 'blocked'));

comment on column public.research_document_texts.ocr_status is
  'not_required | pending | processing | completed | failed | blocked — blocked (ช่วงที่ 29) หมายถึงไม่ได้ลองทำ OCR เลยเพราะปัญหาการตั้งค่า/นโยบาย (ยังไม่ได้ตั้งค่า provider, ยังไม่อนุมัติส่งออก, หรือถูกปิดใช้งานผ่าน Settings) แยกจาก failed ที่หมายถึงลองแล้วแต่ provider ตอบกลับผิดพลาดจริง — ทั้งสองสถานะยังใช้กลไก retry/backoff/DLQ ระดับ background_jobs เดิมทุกประการ ไม่มีการเปลี่ยนแปลง';
