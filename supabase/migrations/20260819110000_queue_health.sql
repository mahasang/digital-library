-- ช่วงที่ 30: ข้อมูล queue health สำหรับหน้า /superadmin/jobs — จำนวน
-- worker/job ที่กำลังทำงานจริงต่อประเภทงาน, job ที่ lease หมดอายุแล้วแต่ยังค้าง
-- สถานะ processing (บ่งชี้ worker ที่ตายกลางคัน — self-heal เองรอบ claim ถัดไป
-- แต่ถ้าเกิดซ้ำบ่อยควรตรวจสอบ), job ที่ pending นานผิดปกติ (เกิน 15 นาที เป็นค่า
-- คงที่ ไม่ใช่ Setting) และจำนวน job ต่อสถานะโดยรวม — ทุกฟังก์ชันเป็น `security
-- definer`/`stable`, grant ให้ service_role เท่านั้น (เรียกจาก
-- lib/data/queue-health.server.ts ผ่าน Service Role client เหมือนฟังก์ชันอ่าน
-- ข้อมูลอื่นของหน้า Super Admin)

create index if not exists idx_background_jobs_status
  on public.background_jobs (status);

comment on index idx_background_jobs_status is
  'สำหรับนับจำนวนงานต่อสถานะโดยรวม (get_background_job_status_counts, ช่วงที่ 30) — คนละวัตถุประสงค์กับ idx_background_jobs_claim ที่กรองเฉพาะ pending/processing สำหรับ claim';

create or replace function public.get_background_job_status_counts()
returns table (status text, job_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select status, count(*) as job_count
  from public.background_jobs
  group by status;
$$;

comment on function public.get_background_job_status_counts() is
  'จำนวนงานทั้งหมดต่อสถานะ (ทุกประเภทงานรวมกัน) — ใช้แสดงที่หน้า /superadmin/jobs หัวข้อ queue health (ช่วงที่ 30)';

grant execute on function public.get_background_job_status_counts() to service_role;

create or replace function public.get_queue_health()
returns table (
  job_type text,
  concurrency_limit int,
  processing_count bigint,
  active_worker_count bigint,
  expired_lease_count bigint,
  pending_count bigint,
  stuck_pending_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jts.job_type,
    jts.concurrency as concurrency_limit,
    coalesce(p.processing_count, 0) as processing_count,
    coalesce(p.active_worker_count, 0) as active_worker_count,
    coalesce(el.expired_lease_count, 0) as expired_lease_count,
    coalesce(pd.pending_count, 0) as pending_count,
    coalesce(sp.stuck_pending_count, 0) as stuck_pending_count
  from public.job_type_settings jts
  left join (
    select job_type, count(*) as processing_count, count(distinct locked_by) as active_worker_count
    from public.background_jobs
    where status = 'processing' and lease_expires_at >= now()
    group by job_type
  ) p on p.job_type = jts.job_type
  left join (
    select job_type, count(*) as expired_lease_count
    from public.background_jobs
    where status = 'processing' and lease_expires_at < now()
    group by job_type
  ) el on el.job_type = jts.job_type
  left join (
    select job_type, count(*) as pending_count
    from public.background_jobs
    where status = 'pending'
    group by job_type
  ) pd on pd.job_type = jts.job_type
  left join (
    select job_type, count(*) as stuck_pending_count
    from public.background_jobs
    where status = 'pending' and run_after < now() - interval '15 minutes'
    group by job_type
  ) sp on sp.job_type = jts.job_type
  order by jts.job_type;
$$;

comment on function public.get_queue_health() is
  'สรุปสถานะ queue ต่อประเภทงาน (จำนวน worker ที่ active จริง, งานที่ lease หมดอายุค้างอยู่, งานที่รอคิวนานผิดปกติ, เทียบกับ concurrency limit ปัจจุบัน) สำหรับหน้า /superadmin/jobs (ช่วงที่ 30) — เกณฑ์ "รอนานผิดปกติ" คงที่ 15 นาที ไม่ใช่ Setting';

grant execute on function public.get_queue_health() to service_role;
