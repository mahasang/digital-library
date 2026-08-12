-- ============================================================================
-- Phase 20: Background Jobs — ย้ายงานประมวลผลหนัก (สแกนมัลแวร์, ดึงข้อความ PDF,
-- หมดอายุสิทธิ์เข้าถึง, แจ้งเตือนผู้ติดตามหมวดหมู่) ไปทำแบบ background job
-- แทนการรันแบบ synchronous ในคำขอเดียวกับการอัปโหลด/แก้ไข — แก้ปัญหาไฟล์ PDF
-- ขนาดใหญ่/provider สแกนช้าอาจทำให้คำขอติด Serverless timeout (ดู
-- docs/file-security.md หัวข้อ 7 และ docs/pdf-full-text-search.md หัวข้อ 8)
--
-- ออกแบบเป็น persistent queue ในฐานข้อมูลเดิม (ไม่เพิ่มบริการภายนอก/เสียเงิน)
-- ใช้ `for update skip locked` ของ Postgres เป็นกลไกล็อก/lease กัน worker
-- หลายตัวประมวลผล job เดียวกันซ้ำซ้อน (รูปแบบมาตรฐานสำหรับ job queue บน
-- PostgreSQL) ร่วมกับ partial unique index บน idempotency_key กันสร้าง job
-- ซ้ำซ้อนสำหรับงานเดียวกันขณะที่ยังมี job ที่ active (pending/processing) อยู่
-- ============================================================================

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (
    job_type in (
      'pdf_text_extraction',
      'file_security_rescan',
      'access_expiration',
      'category_notification'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),
  attempts int not null default 0,
  max_attempts int not null default 5,
  progress int not null default 0 check (progress between 0 and 100),
  -- ข้อความ error ที่ปลอดภัยแล้วเท่านั้น (ห้ามเก็บ stack trace/ข้อความ error
  -- ดิบจาก Postgres/Storage/provider ภายนอก) — ดู lib/jobs/queue.server.ts
  error_message text,
  -- กันสร้าง job ซ้ำสำหรับงานเดียวกัน (ดู partial unique index ด้านล่าง —
  -- บังคับเฉพาะตอน active เท่านั้น ปล่อยให้มีประวัติ completed/failed/cancelled
  -- ซ้ำ key เดิมได้ เพื่อเก็บเป็นประวัติการประมวลผลจริง)
  idempotency_key text not null,
  -- จัดกลุ่ม job ที่สร้างพร้อมกันจากการทำงานเป็นชุด (bulk backfill/rescan) เพื่อ
  -- คำนวณ progress ของทั้งชุดได้ง่ายที่หน้า Super Admin
  batch_id uuid,
  entity_type text,
  entity_id uuid,
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_background_jobs_idempotency_active
  on public.background_jobs (idempotency_key)
  where status in ('pending', 'processing');

create index idx_background_jobs_claim
  on public.background_jobs (status, run_after)
  where status in ('pending', 'processing');

create index idx_background_jobs_batch on public.background_jobs (batch_id) where batch_id is not null;
create index idx_background_jobs_entity on public.background_jobs (entity_type, entity_id) where entity_id is not null;
create index idx_background_jobs_created_at on public.background_jobs (created_at desc);

alter table public.background_jobs enable row level security;

-- service_role (worker/enqueue ฝั่งเซิร์ฟเวอร์) ทำได้ทุกอย่าง ข้าม RLS อยู่แล้ว
-- ตามธรรมชาติของ service role key แต่ grant ไว้ให้ชัดเจนตามธรรมเนียมโปรเจกต์
grant select, insert, update on public.background_jobs to service_role;

-- authenticated เห็นได้เฉพาะ Super Admin สำหรับหน้าจัดการ/ติดตามสถานะเท่านั้น
-- ไม่มีสิทธิ์ insert/update ตรง (ทุกการ enqueue/ประมวลผลผ่าน Server
-- Action/Worker ที่ใช้ service role เท่านั้น ตรงกับ RBAC สองชั้นของโปรเจกต์)
grant select on public.background_jobs to authenticated;

create policy background_jobs_select_super_admin on public.background_jobs
  for select to authenticated
  using (public.user_max_role_rank() >= 50);

create trigger trg_background_jobs_updated_at
  before update on public.background_jobs
  for each row execute function public.set_updated_at();

comment on table public.background_jobs is
  'Persistent job queue สำหรับงานประมวลผลหนัก (สแกนไฟล์/ดึงข้อความ PDF/หมดอายุสิทธิ์/แจ้งเตือนอีเมล) — ดู docs/background-jobs.md';

-- ----------------------------------------------------------------------------
-- claim_background_jobs(): ดึง job ที่พร้อมประมวลผล (pending ที่ถึงเวลาแล้ว
-- หรือ processing ที่ lease หมดอายุเพราะ worker ก่อนหน้าตายกลางคัน) มาล็อกให้
-- worker ที่เรียกแบบ atomic ด้วย `for update skip locked` — กัน worker/คำขอ
-- หลายตัวแย่ง job เดียวกันได้จริงระดับฐานข้อมูล ไม่ใช่แค่ตรวจในโค้ด (รูปแบบ
-- เดียวกับ acquire_extraction_lock() ของช่วงที่ 17 แต่ทั่วไปกว่าเพราะต้องรองรับ
-- หลาย job พร้อมกันในคำขอเดียว ไม่ใช่แค่ล็อกทีละแถว)
-- ----------------------------------------------------------------------------
create or replace function public.claim_background_jobs(
  p_worker_id text,
  p_limit int default 5,
  p_job_types text[] default null
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.background_jobs
  set status = 'processing',
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + interval '10 minutes',
      started_at = coalesce(started_at, now()),
      attempts = attempts + 1,
      updated_at = now()
  where id in (
    select bj.id
    from public.background_jobs bj
    where (
      (bj.status = 'pending' and bj.run_after <= now())
      or (bj.status = 'processing' and bj.lease_expires_at < now())
    )
    and (p_job_types is null or bj.job_type = any(p_job_types))
    order by bj.created_at
    limit p_limit
    for update skip locked
  )
  returning *;
end;
$$;

grant execute on function public.claim_background_jobs(text, int, text[]) to service_role;

-- ----------------------------------------------------------------------------
-- complete_background_job() / fail_background_job(): ปิดงาน job ที่ worker
-- ประมวลผลเสร็จแล้ว (สำเร็จ/ล้มเหลว) — fail_background_job คำนวณ retry แบบ
-- exponential backoff เอง (2^attempts นาที สูงสุด 60 นาที) และเปลี่ยนเป็น
-- 'failed' ถาวรเมื่อครบ max_attempts แล้วเท่านั้น
-- ----------------------------------------------------------------------------
create or replace function public.complete_background_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.background_jobs
  set status = 'completed',
      progress = 100,
      completed_at = now(),
      error_message = null,
      locked_by = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_job_id;
$$;

grant execute on function public.complete_background_job(uuid) to service_role;

create or replace function public.fail_background_job(p_job_id uuid, p_error_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_max_attempts int;
  v_backoff_minutes int;
begin
  select attempts, max_attempts into v_attempts, v_max_attempts
  from public.background_jobs
  where id = p_job_id
  for update;

  if not found then
    return;
  end if;

  if v_attempts >= v_max_attempts then
    update public.background_jobs
    set status = 'failed',
        error_message = p_error_message,
        locked_by = null,
        lease_expires_at = null,
        completed_at = now(),
        updated_at = now()
    where id = p_job_id;
  else
    v_backoff_minutes := least(60, power(2, v_attempts)::int);
    update public.background_jobs
    set status = 'pending',
        error_message = p_error_message,
        locked_by = null,
        lease_expires_at = null,
        run_after = now() + (v_backoff_minutes || ' minutes')::interval,
        updated_at = now()
    where id = p_job_id;
  end if;
end;
$$;

grant execute on function public.fail_background_job(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- cancel_active_jobs_for_entity(): ยกเลิก job ที่ยัง active (pending/processing)
-- ของ entity เดียวกันทั้งหมด — ใช้ตอนแทนที่ไฟล์ PDF (job เก่าที่อ้างไฟล์เดิม
-- กลายเป็นล้าสมัยทันที ต้องไม่ประมวลผลไฟล์เก่าซ้ำหลังมีไฟล์ใหม่แล้ว)
-- ----------------------------------------------------------------------------
create or replace function public.cancel_active_jobs_for_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_job_types text[] default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.background_jobs
  set status = 'cancelled',
      completed_at = now(),
      updated_at = now()
  where entity_type = p_entity_type
    and entity_id = p_entity_id
    and status in ('pending', 'processing')
    and (p_job_types is null or job_type = any(p_job_types));
$$;

grant execute on function public.cancel_active_jobs_for_entity(text, uuid, text[]) to service_role;

-- ============================================================================
-- ปรับ scan_status ให้รองรับสถานะ 'pending' (ยังไม่ได้สแกน — รอ background job)
-- เดิมมีแค่ clean/infected/error/skipped ซึ่งไม่มีสถานะ "ยังไม่ได้สแกน" เพราะ
-- เดิมสแกนแบบ synchronous ก่อน insert เสมอ (แถวจะเกิดขึ้นก็ต่อเมื่อสแกนผ่านแล้ว
-- เท่านั้น) — ตอนนี้แถวจะถูกสร้างก่อน แล้วสแกนทีหลังผ่าน background job จึง
-- ต้องมีสถานะกลางระหว่างรอคิว/กำลังสแกนอยู่
-- ============================================================================
alter table public.research_items drop constraint research_items_scan_status_check;
alter table public.research_items add constraint research_items_scan_status_check
  check (scan_status in ('pending', 'clean', 'infected', 'error', 'skipped'));

-- ปรับ prevent_publish_unscanned_file(): เดิมบล็อกเฉพาะตอน "เปลี่ยนเป็น
-- published" (old.status is distinct from 'published') และเฉพาะ infected/error
-- ตอนนี้ต้องบล็อกทุกครั้งที่ผลลัพธ์ของแถวจะเป็น published+ไม่ปลอดภัย ไม่ว่าจะมา
-- จาก INSERT ตรง (adminCreateResearchAction เผยแพร่ทันที) หรือ UPDATE ที่
-- สถานะเป็น published อยู่แล้วแต่เพิ่งแทนที่ไฟล์ PDF ใหม่ (scan_status กลับไป
-- เป็น 'pending' ทั้งที่ status ยังไม่เปลี่ยน) — เช็คแค่ผลลัพธ์สุดท้ายของแถว
-- (new.*) ตรงไปตรงมากว่าเช็คการเปลี่ยนผ่าน ครอบคลุมทุกกรณีโดยไม่ต้องแยก TG_OP
create or replace function public.prevent_publish_unscanned_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and new.scan_status in ('pending', 'infected', 'error') then
    raise exception 'ไม่สามารถเผยแพร่งานวิจัยนี้ได้ เนื่องจากไฟล์ยังไม่ผ่านการตรวจสอบความปลอดภัย'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_publish_unscanned_file on public.research_items;
create trigger trg_prevent_publish_unscanned_file
  before insert or update on public.research_items
  for each row execute function public.prevent_publish_unscanned_file();

-- ----------------------------------------------------------------------------
-- close_access_on_scan_failure(): เมื่อไฟล์ของงานวิจัยที่ "เผยแพร่อยู่แล้ว" ถูก
-- สแกนซ้ำ (bulk rescan หรือช่องทางอื่น) แล้วพบว่าติดมัลแวร์/สแกนไม่สำเร็จ ให้ปิด
-- การเข้าถึงทันทีโดยเปลี่ยนสถานะเป็น archived อัตโนมัติ (ตามนโยบายเดิมที่ห้าม
-- เผยแพร่ไฟล์ที่ไม่ผ่านการตรวจสอบ — ดู prevent_publish_unscanned_file ด้านบน)
-- ทำเป็น DB trigger เพื่อบังคับใช้จริงไม่ว่าจะเรียกจากช่องทางไหน ไม่พึ่งพา
-- เฉพาะ application code ฝั่งเดียว
-- ----------------------------------------------------------------------------
create or replace function public.close_access_on_scan_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scan_status in ('infected', 'error')
     and old.scan_status is distinct from new.scan_status
     and new.status = 'published' then
    new.status := 'archived';
  end if;
  return new;
end;
$$;

create trigger trg_close_access_on_scan_failure
  before update on public.research_items
  for each row execute function public.close_access_on_scan_failure();

comment on function public.close_access_on_scan_failure is
  'ปิดการเข้าถึง (เปลี่ยนเป็น archived) อัตโนมัติเมื่องานวิจัยที่เผยแพร่อยู่ถูกสแกนซ้ำแล้วพบว่าไม่ปลอดภัย — ดู docs/background-jobs.md หัวข้อ bulk rescan';

-- ----------------------------------------------------------------------------
-- job access_expiration (lib/jobs/handlers/access-expiration.server.ts) เรียก
-- expire_stale_access_requests() ผ่าน Service Role โดยเจตนา (ต้องการอัปเดตทุก
-- แถวที่หมดอายุทั้งระบบในครั้งเดียว ไม่ใช่แค่แถวของผู้ใช้คนใดคนหนึ่ง) — ฟังก์ชัน
-- นี้ตั้งใจไม่ใช้ security definer (ดู comment เดิมที่ประกาศไว้) จึงยังต้องพึ่ง
-- สิทธิ์ตารางจริงของผู้เรียก ซึ่ง service_role ไม่มีสิทธิ์ update ตารางนี้มาก่อน
-- (grant เดิมมีแค่ authenticated สำหรับ caller แบบ lazy-expire ของช่วงที่ 18)
-- ----------------------------------------------------------------------------
grant select, update on public.access_requests to service_role;

-- ----------------------------------------------------------------------------
-- job handler อื่นๆ (lib/jobs/handlers/) ก็เรียก Service Role ตรงไปที่ตาราง
-- เหล่านี้เป็นครั้งแรกเช่นกัน (สถาปัตยกรรมเดิมก่อนช่วงที่ 20 ไม่เคยต้องให้
-- Service Role แตะ research_items ตรงๆ เลย — validate-upload.server.ts เดิม
-- แตะแค่ Storage ไม่แตะตาราง, process-extraction.server.ts เดิมแตะแค่
-- research_document_texts ซึ่งมี grant ให้ service_role ไว้แล้วตั้งแต่ช่วงที่ 17)
--   - file_security_rescan: อ่าน/แก้ไข research_items, insert audit_logs,
--     อ่าน roles/user_roles เพื่อหารายชื่อผู้ดูแลที่จะแจ้งเตือน
--   - category_notification: อ่าน research_categories/category_subscriptions/
--     notification_preferences/profiles เพื่อหาอีเมลผู้ติดตามหมวดหมู่
-- ----------------------------------------------------------------------------
grant select, update on public.research_items to service_role;
grant insert on public.audit_logs to service_role;
grant select on public.roles to service_role;
grant select on public.user_roles to service_role;
grant select on public.research_categories to service_role;
grant select on public.category_subscriptions to service_role;
grant select on public.notification_preferences to service_role;
grant select on public.profiles to service_role;
