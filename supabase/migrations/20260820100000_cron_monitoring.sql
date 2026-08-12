-- ช่วงที่ 31: ตรวจสอบ Cron Job/Worker แบบอัตโนมัติ + แจ้งเตือนเมื่อผิดปกติ
--
-- เดิม (ช่วงที่ 30) /superadmin/jobs มีแค่ "queue health" แบบ snapshot ณ เวลาที่
-- โหลดหน้า ไม่มีประวัติว่า Cron ที่เรียก /api/jobs/process ทำงานตามรอบจริง
-- หรือไม่ — ถ้า Cron หยุดทำงานทั้งหมด (ตั้งค่าผิด, secret หมดอายุ, แพลตฟอร์ม
-- ล่ม) ไม่มีอะไรในแอปนี้ตรวจจับ/แจ้งเตือนได้เลย ช่วงนี้เพิ่ม:
--   1. cron_runs — ประวัติการทำงานของ cron/worker ที่สำคัญแต่ละครั้ง
--   2. cron_monitoring_settings — ความถี่ที่คาดหวัง + threshold ต่อ cron
--   3. cron_alert_state — กันแจ้งเตือนซ้ำด้วย cooldown window
--   4. job_type ใหม่ maintenance_cleanup — งานบำรุงรักษาจริง (ล้าง
--      rate_limit_events เก่า) เพราะเดิมไม่มีงานประเภทนี้เลยในระบบ

-- ----------------------------------------------------------------------------
-- 1. เพิ่ม job_type 'maintenance_cleanup' ให้ background_jobs/job_type_settings
-- ----------------------------------------------------------------------------
alter table public.background_jobs
  drop constraint background_jobs_job_type_check,
  add constraint background_jobs_job_type_check
    check (job_type in (
      'pdf_text_extraction', 'file_security_rescan', 'access_expiration',
      'category_notification', 'duplicate_scan', 'ocr_processing',
      'bulk_enqueue', 'maintenance_cleanup'
    ));

alter table public.job_type_settings
  drop constraint job_type_settings_job_type_check,
  add constraint job_type_settings_job_type_check
    check (job_type in (
      'pdf_text_extraction', 'file_security_rescan', 'access_expiration',
      'category_notification', 'duplicate_scan', 'ocr_processing',
      'bulk_enqueue', 'maintenance_cleanup'
    ));

insert into public.job_type_settings (job_type, concurrency, default_batch_size)
values ('maintenance_cleanup', 1, 100)
on conflict (job_type) do nothing;

-- ----------------------------------------------------------------------------
-- 2. cron_runs — ประวัติการทำงานของ cron/worker ที่สำคัญแต่ละครั้ง
-- ----------------------------------------------------------------------------
create table public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (job_name in (
    'queue_worker', 'access_expiration', 'notification_delivery',
    'maintenance_cleanup', 'health_monitoring'
  )),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  processed_count int not null default 0,
  failed_count int not null default 0,
  error_summary text,
  next_expected_run_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.cron_runs is
  'ประวัติการทำงานของ cron/worker ที่สำคัญแต่ละครั้ง (ช่วงที่ 31) — job_name ไม่ใช่ทั้งหมด map ตรงกับ background_jobs.job_type เสมอ (queue_worker/health_monitoring ไม่ใช่ job type ในคิว แต่เป็นชื่อของ invocation เอง)';
comment on column public.cron_runs.error_summary is
  'ข้อความสรุปแบบสั้นๆ ผ่านการ sanitize แล้วเท่านั้น (เช่น "3 งานล้มเหลว: ocr_processing x2") ห้ามมี stack trace/PostgreSQL error ดิบ/secret ใดๆ';
comment on column public.cron_runs.next_expected_run_at is
  'คำนวณจาก completed_at (หรือ started_at ถ้ายังไม่เสร็จ) + cron_monitoring_settings.expected_frequency_minutes ของ job_name นั้น — ใช้ตรวจว่า cron รอบถัดไป "เกินกำหนด" หรือยัง';

create index idx_cron_runs_job_name_started on public.cron_runs (job_name, started_at desc);

alter table public.cron_runs enable row level security;

create policy "cron_runs_select_super_admin" on public.cron_runs
  for select to authenticated
  using (user_max_role_rank() >= 50);

grant select, insert, update on public.cron_runs to service_role;
grant select on public.cron_runs to authenticated;

-- ----------------------------------------------------------------------------
-- 3. cron_monitoring_settings — ความถี่ที่คาดหวัง + threshold ต่อ cron
-- ----------------------------------------------------------------------------
create table public.cron_monitoring_settings (
  job_name text primary key check (job_name in (
    'queue_worker', 'access_expiration', 'notification_delivery',
    'maintenance_cleanup', 'health_monitoring'
  )),
  expected_frequency_minutes int not null check (expected_frequency_minutes between 1 and 1440),
  failure_threshold int not null check (failure_threshold >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

comment on table public.cron_monitoring_settings is
  'ความถี่ที่คาดหวัง (นาที) + threshold จำนวนงานล้มเหลวต่อ cron/worker หนึ่งชื่อ (ช่วงที่ 31) — Super Admin ปรับได้ที่ /superadmin/cron-monitoring';
comment on column public.cron_monitoring_settings.expected_frequency_minutes is
  'access_expiration/notification_delivery ไม่มี Cron แยกของตัวเอง — ทำงานตามจังหวะที่ queue_worker (/api/jobs/process) ถูกเรียกจริง ค่านี้จึงควรตั้งให้เท่ากับหรือมากกว่าความถี่ Cron ของ queue_worker เสมอ ไม่งั้นจะเห็น "เกินกำหนด" ปลอมทั้งที่ queue_worker ทำงานปกติ';

insert into public.cron_monitoring_settings (job_name, expected_frequency_minutes, failure_threshold) values
  ('queue_worker', 15, 5),
  ('access_expiration', 60, 3),
  ('notification_delivery', 15, 3),
  ('maintenance_cleanup', 1440, 3),
  ('health_monitoring', 15, 3)
on conflict (job_name) do nothing;

alter table public.cron_monitoring_settings enable row level security;

create policy "cron_monitoring_settings_select_super_admin" on public.cron_monitoring_settings
  for select to authenticated
  using (user_max_role_rank() >= 50);

grant select, insert, update on public.cron_monitoring_settings to service_role;
grant select on public.cron_monitoring_settings to authenticated;

-- ----------------------------------------------------------------------------
-- 4. cron_alert_state — กันแจ้งเตือนซ้ำด้วย cooldown window (bookkeeping ภายใน
--    เท่านั้น ไม่มี UI ใดอ่านตรงๆ จึงไม่มี CHECK enum ตายตัวสำหรับ check_name —
--    โค้ด TS เป็นผู้ควบคุมชุดค่าที่ถูกต้อง เหมือน rate_limit_events.rate_key)
-- ----------------------------------------------------------------------------
create table public.cron_alert_state (
  check_name text primary key,
  last_alerted_at timestamptz not null default now()
);

comment on table public.cron_alert_state is
  'Cooldown state กันแจ้งเตือนซ้ำของแต่ละเงื่อนไข (ช่วงที่ 31) — service_role เท่านั้นที่แตะตารางนี้ได้ ไม่มี UI ใดอ่านตรงๆ';

alter table public.cron_alert_state enable row level security;

grant select, insert, update on public.cron_alert_state to service_role;

-- ----------------------------------------------------------------------------
-- 5. expire_stale_access_requests()/expire_stale_access_grants() ต้องคืนจำนวน
--    แถวที่กระทบ เพื่อให้ handleAccessExpirationJob() บันทึก processed_count
--    ของ cron_runs ได้ (เดิม returns void) — ต้อง drop ก่อนเพราะ Postgres ไม่
--    ยอมให้ CREATE OR REPLACE เปลี่ยน return type
-- ----------------------------------------------------------------------------
drop function if exists public.expire_stale_access_requests();

create function public.expire_stale_access_requests()
returns int
language sql
as $$
  with updated as (
    update public.access_requests
    set status = 'expired'
    where status = 'approved'
      and access_expires_at is not null
      and access_expires_at < now()
    returning 1
  )
  select count(*)::int from updated;
$$;

drop function if exists public.expire_stale_access_grants();

create function public.expire_stale_access_grants()
returns int
language sql
as $$
  with updated as (
    update public.document_access_grants
    set revoked_at = now(),
        revoke_reason = 'ระบบปิดอัตโนมัติ: สิทธิ์หมดอายุตามกำหนดเวลา'
    where revoked_at is null
      and expires_at is not null
      and expires_at < now()
    returning 1
  )
  select count(*)::int from updated;
$$;

grant execute on function public.expire_stale_access_requests() to service_role;
grant execute on function public.expire_stale_access_grants() to service_role;

-- ----------------------------------------------------------------------------
-- 6. cleanup_old_rate_limit_events() — ใช้โดย job maintenance_cleanup ใหม่
--    rate_limit_events ไม่มี grant ให้ service_role เข้าถึงตรงๆ เลย (เขียน/อ่าน
--    ผ่าน check_rate_limit() ซึ่งเป็น security definer เท่านั้นมาตั้งแต่ต้น) —
--    ทำตามรูปแบบเดียวกัน: ฟังก์ชัน security definer เฉพาะงานนี้ แทนการ grant
--    DELETE ตรงบนตาราง (least privilege)
-- ----------------------------------------------------------------------------
create function public.cleanup_old_rate_limit_events(p_retention_days int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.rate_limit_events
  where created_at < now() - (p_retention_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.cleanup_old_rate_limit_events(int) is
  'ลบแถว rate_limit_events ที่เก่ากว่า p_retention_days วัน คืนจำนวนแถวที่ลบ — ใช้โดย handleMaintenanceCleanupJob() (ช่วงที่ 31)';

grant execute on function public.cleanup_old_rate_limit_events(int) to service_role;
