-- ============================================================================
-- Phase 28: ขยาย job_batches ให้รองรับ pause/resume/cancel, ตัวนับ progress
-- แบบ O(1) (ไม่ต้องโหลด background_jobs ทั้งชุดมา group ใน JS), batch_size ที่
-- ปรับได้ต่อคำขอ (แทนค่าคงที่ CHUNK_SIZE เดิม), และการป้องกันสร้าง master job
-- ซ้ำซ้อนโดยไม่ตั้งใจ (idempotent creation ผ่าน partial unique index)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. job_batches: เพิ่มสถานะ paused/completed/failed (เดิมมีแค่
-- enqueueing/ready/cancelled) — 'ready' ยังคงความหมายเดิม ("สร้าง job ลูกครบ
-- แล้ว แต่ job ลูกอาจยังทำงานไม่เสร็จ") ส่วน 'completed'/'failed' เป็นสถานะใหม่
-- ที่หมายถึง "job ลูกทุกตัวถึงสถานะสุดท้ายแล้ว" ตั้งโดย
-- finalize_job_batch_if_drained() เท่านั้น ไม่เคยตั้งโดย coordinator ตรงๆ
-- ----------------------------------------------------------------------------
alter table public.job_batches
  drop constraint job_batches_status_check,
  add constraint job_batches_status_check
    check (status in ('enqueueing', 'ready', 'paused', 'cancelled', 'completed', 'failed'));

alter table public.job_batches
  add column batch_size int not null default 100 check (batch_size between 1 and 500),
  add column filter_hash text,
  add column started_at timestamptz,
  add column paused_at timestamptz,
  add column cancelled_at timestamptz,
  add column completed_at timestamptz,
  add column completed_items int not null default 0,
  add column failed_items int not null default 0,
  add column cancelled_items int not null default 0,
  add column skipped_items int not null default 0,
  add column completed_notified_at timestamptz,
  add column failed_notified_at timestamptz,
  add column dlq_notified_at timestamptz;

comment on column public.job_batches.batch_size is
  'จำนวนรายการต่อ chunk ที่ coordinator (handleBulkEnqueueJob) ดึง/สร้าง job ลูกในแต่ละรอบ — แทนค่าคงที่ CHUNK_SIZE=100 เดิม ค่าเริ่มต้นมาจาก job_type_settings.default_batch_size ตอนสร้าง master job แต่ปรับต่อคำขอได้ผ่านกล่องยืนยันก่อนสั่งงาน';
comment on column public.job_batches.filter_hash is
  'md5(filter_snapshot::text) คำนวณฝั่ง SQL เสมอ (jsonb::text ของ Postgres จัดเรียง key แบบ normalize ให้อัตโนมัติ จึง stable ไม่ว่าฝั่ง JS จะสร้าง object ด้วยลำดับ key ใด) ใช้คู่กับ idx_job_batches_active_filter กันสร้าง master job ซ้ำซ้อนสำหรับ job_type+filter เดียวกัน';
comment on column public.job_batches.completed_items is
  'จำนวน job ลูกที่ completed แล้ว — เพิ่มทีละ 1 แบบ O(1) จาก complete_background_job() ทุกครั้งที่ job ลูกของ batch นี้เสร็จ ไม่ใช่การนับสดจาก background_jobs ทั้งตาราง';
comment on column public.job_batches.failed_items is
  'จำนวน job ลูกที่ล้มเหลวถาวร (เข้า DLQ แล้ว ไม่ใช่แค่ล้มเหลวรอบเดียวแล้วจะ retry อัตโนมัติ) — เพิ่มจาก fail_background_job() เฉพาะตอนที่ job เข้า DLQ ครั้งแรกเท่านั้น (v_notified=true)';
comment on column public.job_batches.cancelled_items is
  'จำนวน job ลูกที่ถูกยกเลิกเพราะ Super Admin สั่งยกเลิก master job ทั้งชุด (เฉพาะที่ยัง pending อยู่ตอนยกเลิก — job ที่กำลัง processing/เสร็จแล้วไม่ถูกแตะ)';
comment on column public.job_batches.skipped_items is
  'จำนวนรายการที่ coordinator ข้ามไปโดยไม่สร้าง job ลูกเลย (เช่น เอกสารเกินขีดจำกัด OCR ตาม checkOcrEligibility) — คนละความหมายกับ failed_items ซึ่งหมายถึง job ที่สร้างแล้วแต่ทำไม่สำเร็จ';

-- ป้องกันสร้าง master job ซ้ำซ้อนสำหรับ job_type+filter เดียวกันขณะที่ยังมีงาน
-- ที่ active (enqueueing/ready/paused) อยู่แล้ว — ใช้คู่กับ
-- create_job_batch_if_not_exists() (migration ถัดไป)
create unique index idx_job_batches_active_filter
  on public.job_batches (job_type, filter_hash)
  where status in ('enqueueing', 'ready', 'paused');

-- เร่งความเร็วการ query "ชุดงานล่าสุดของ job_type นี้" ที่ getRecentJobBatches ใช้
create index idx_job_batches_job_type_created_at
  on public.job_batches (job_type, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. job_type_settings: เพิ่ม default_batch_size — คนละมิติกับ concurrency เดิม
-- (concurrency ควบคุมว่า worker รัน job ลูกพร้อมกันได้กี่งาน, default_batch_size
-- ควบคุมว่า coordinator ดึง/สร้าง job ลูกครั้งละกี่รายการต่อรอบ) เก็บในตาราง
-- เดียวกันเพราะคีย์ด้วย job_type เหมือนกันอยู่แล้ว และมีหน้า Super Admin
-- (/superadmin/jobs) ที่แก้ไขได้อยู่แล้วโดยไม่ต้องสร้างหน้าใหม่
-- ----------------------------------------------------------------------------
alter table public.job_type_settings
  add column default_batch_size smallint not null default 100
    check (default_batch_size between 1 and 500);

comment on column public.job_type_settings.default_batch_size is
  'ค่าเริ่มต้นของ job_batches.batch_size เมื่อสร้าง master job ใหม่สำหรับ job_type นี้ (คนละมิติกับ concurrency — นี่คือขนาด chunk ที่ coordinator ดึง/สร้าง job ลูกต่อรอบ ไม่ใช่จำนวนที่ worker รันพร้อมกัน) ปรับได้ที่ /superadmin/jobs';

-- ----------------------------------------------------------------------------
-- 3. background_jobs.batch_id: เดิมเป็น uuid เปล่าไม่มี FK — ปิดช่องโหว่ความ
-- ถูกต้องของข้อมูลนี้ไปพร้อมกัน (safe, additive, ไม่กระทบพฤติกรรมเดิม เพราะ
-- ทุกแถวที่มี batch_id อยู่แล้วต้องอ้างถึง job_batches.id ที่มีอยู่จริงเสมออยู่
-- แล้วในทางปฏิบัติ — validate แยกขั้นตอนกันคำสั่งนี้ค้างนานถ้ามีข้อมูลจำนวนมาก)
-- ----------------------------------------------------------------------------
alter table public.background_jobs
  add constraint background_jobs_batch_id_fkey
    foreign key (batch_id) references public.job_batches (id) on delete set null
    not valid;
alter table public.background_jobs validate constraint background_jobs_batch_id_fkey;
