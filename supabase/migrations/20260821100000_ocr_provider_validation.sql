-- ช่วงที่ 32: OCR Provider Readiness, Controlled Testing และ Production Validation
--
-- เพิ่ม job_type ใหม่ 'ocr_test_run' สำหรับ Controlled OCR Test (Super Admin
-- เท่านั้น ทดสอบด้วยไฟล์ fixture ที่ไม่เป็นความลับ ไม่ใช่เอกสารงานวิจัยจริง) —
-- ใช้โครงสร้างคิวเดิมทั้งหมด (claim/complete/fail/requeue/DLQ/concurrency) แต่
-- เขียนผลลง ocr_test_runs ตารางใหม่แยกต่างหาก **ไม่แตะ research_document_texts
-- เลย** เพื่อไม่ให้ผลทดสอบมีทางรั่วไปปรากฏในคลังงานวิจัยสาธารณะ/ผลค้นหาได้

-- ----------------------------------------------------------------------------
-- 1. เพิ่ม job_type 'ocr_test_run' ให้ background_jobs/job_type_settings
--    (รูปแบบเดียวกับ maintenance_cleanup ของช่วงที่ 31)
-- ----------------------------------------------------------------------------
alter table public.background_jobs
  drop constraint background_jobs_job_type_check,
  add constraint background_jobs_job_type_check
    check (job_type in (
      'pdf_text_extraction', 'file_security_rescan', 'access_expiration',
      'category_notification', 'duplicate_scan', 'ocr_processing',
      'bulk_enqueue', 'maintenance_cleanup', 'ocr_test_run'
    ));

alter table public.job_type_settings
  drop constraint job_type_settings_job_type_check,
  add constraint job_type_settings_job_type_check
    check (job_type in (
      'pdf_text_extraction', 'file_security_rescan', 'access_expiration',
      'category_notification', 'duplicate_scan', 'ocr_processing',
      'bulk_enqueue', 'maintenance_cleanup', 'ocr_test_run'
    ));

insert into public.job_type_settings (job_type, concurrency, default_batch_size)
values ('ocr_test_run', 1, 100)
on conflict (job_type) do nothing;

-- ----------------------------------------------------------------------------
-- 2. cron_runs.job_name — Controlled Test ไม่ใช่ cron/worker ที่ต้อง monitor
--    heartbeat แบบช่วงที่ 31 (สั่งทีละครั้งโดย Super Admin ไม่ใช่ทำงานตามรอบ)
--    จึงไม่เพิ่ม job_name ใหม่ให้ cron_runs — ใช้แค่ background_jobs/
--    ocr_test_runs เท่านั้น
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 3. ocr_test_runs — ผลการทดสอบ Controlled OCR Test แยกจาก research_document_texts
--    โดยสิ้นเชิง (ไม่มี FK ไปยัง research_items/research_document_texts เลย)
-- ----------------------------------------------------------------------------
create table public.ocr_test_runs (
  id uuid primary key default gen_random_uuid(),
  fixture_name text not null,
  background_job_id uuid references public.background_jobs(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  page_count int,
  extracted_char_count int,
  current_page int,
  total_pages int,
  progress_message text,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.ocr_test_runs is
  'ผลการทดสอบ Controlled OCR Test (ช่วงที่ 32) — ใช้ไฟล์ fixture ที่ไม่เป็นความลับเท่านั้น แยกจาก research_document_texts โดยสิ้นเชิง ไม่ปรากฏในคลังงานวิจัยสาธารณะ/ผลค้นหาใดๆ';
comment on column public.ocr_test_runs.error_summary is
  'ข้อความสรุปแบบสั้นๆ ผ่านการ sanitize แล้วเท่านั้น ห้ามมี stack trace/PostgreSQL error ดิบ/secret ใดๆ';

create index idx_ocr_test_runs_created_at on public.ocr_test_runs (created_at desc);

alter table public.ocr_test_runs enable row level security;

create policy "ocr_test_runs_select_super_admin" on public.ocr_test_runs
  for select to authenticated
  using (user_max_role_rank() >= 50);

grant select, insert, update on public.ocr_test_runs to service_role;
grant select on public.ocr_test_runs to authenticated;
