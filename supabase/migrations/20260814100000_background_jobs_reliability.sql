-- ============================================================================
-- Phase 25: ความเสถียรของ Background Job Queue — Dead-letter Queue (DLQ),
-- แจ้งเตือนเมื่อ job ล้มเหลวถาวร, bulk processing เกิน 500 รายการผ่าน
-- master/child job (job_batches + job_type 'bulk_enqueue'), และ concurrency
-- ที่ปรับได้ต่อประเภทงาน (job_type_settings) — ต่อยอด background_jobs เดิม
-- จากช่วงที่ 20 ทั้งหมด ไม่มีการลบ/เปลี่ยนความหมายคอลัมน์เดิมแม้แต่คอลัมน์เดียว
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Dead-letter queue: status='failed' (ครบ max_attempts แล้ว) เป็นสถานะ
-- ล้มเหลวถาวรอยู่แล้วโดยธรรมชาติ (ดู fail_background_job เดิม) — ไม่เพิ่มสถานะ
-- ใหม่ แค่เพิ่มคอลัมน์สำหรับ "แก้ปัญหาแล้ว" (resolved) และกันแจ้งเตือนซ้ำ
-- ----------------------------------------------------------------------------
alter table public.background_jobs
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles (id) on delete set null,
  add column resolution_note text,
  add column dead_letter_notified_at timestamptz;

comment on column public.background_jobs.resolved_at is
  'เวลาที่เจ้าหน้าที่ทำเครื่องหมายว่า "แก้ไขแล้ว" หรือ "ยกเลิก" งานที่ล้มเหลวถาวร — สถานะ (status) ยังคงเป็น failed/cancelled เดิมเพื่อเก็บประวัติ resolved_at เท่านั้นที่บอกว่าไม่ต้องสนใจแถวนี้ในรายการ DLQ ที่ยัง active แล้ว';
comment on column public.background_jobs.dead_letter_notified_at is
  'เวลาที่ส่งแจ้งเตือน (in-app/email) ให้ Super Admin ครั้งแรกหลัง job นี้ล้มเหลวถาวร — ป้องกันแจ้งซ้ำ ถูกล้างกลับเป็น null เมื่อสั่ง "ลองใหม่" (retryFailedJob) เพื่อให้รอบล้มเหลวถัดไปแจ้งเตือนใหม่ได้';

-- รายการ DLQ ที่ "ยัง active" (ยังไม่ resolved) — ใช้เป็น default view ที่หน้า
-- /superadmin/jobs แยกจากประวัติที่ resolved แล้วโดยไม่ต้องตารางแยก
create index idx_background_jobs_dead_letter
  on public.background_jobs (created_at desc)
  where status = 'failed' and resolved_at is null;

-- ----------------------------------------------------------------------------
-- 2. เพิ่ม job_type ใหม่ 'bulk_enqueue' (ดูหัวข้อ 4) — รูปแบบเดียวกับตอนเพิ่ม
-- duplicate_scan/ocr_processing ในช่วงก่อนหน้า (drop + recreate constraint)
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
      'ocr_processing',
      'bulk_enqueue'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. fail_background_job(): ขยายให้ (ก) คืนค่า boolean บอกว่ารอบนี้เป็นรอบที่
-- ทำให้ job "เข้า DLQ ครั้งแรก" หรือไม่ (ข) เมื่อเข้า DLQ ครั้งแรก ให้แจ้งเตือน
-- Super Admin ทุกคนแบบ in-app ทันทีในธุรกรรมเดียวกัน (atomic) — กันแจ้งซ้ำด้วย
-- dead_letter_notified_at is null (การ select ... for update ที่มีอยู่เดิม
-- ท้ายฟังก์ชันนี้ serialize การเรียกซ้อนกันของ job เดียวกันอยู่แล้ว จึงถือว่า
-- guard นี้เป็น defense-in-depth ไม่ใช่กลไกหลักที่ป้องกัน race condition)
--
-- แจ้งเฉพาะ Super Admin (rank >= 50) เท่านั้น ไม่ใช่ Admin (rank >= 40) เหมือน
-- precedent เดิมของ file_security_rescan เพราะหน้า /superadmin/jobs และตาราง
-- background_jobs เองก็จำกัดสิทธิ์อ่านไว้แค่ rank >= 50 อยู่แล้ว — แจ้ง Admin
-- ที่เข้าหน้านั้นไม่ได้จะสร้างความสับสนเปล่าๆ
--
-- ใช้ type='warning' เดิม (ไม่เพิ่มค่า enum ใหม่ให้ notifications.type เพราะ
-- ต้องแก้ 3 จุดพร้อมกัน: CHECK constraint นี้ + AppNotification TS union +
-- NotificationBell.tsx TYPE_DOT map — ไม่คุ้มสำหรับสถานะที่สื่อความหมายใกล้กับ
-- warning อยู่แล้ว)
-- ----------------------------------------------------------------------------
-- ต้อง drop ก่อนเพราะ Postgres ไม่ยอมให้ create or replace เปลี่ยน return type
-- (เดิม void ตอนนี้เป็น boolean) — service_role grant เดิมหายไปพร้อม drop
-- ต้อง grant execute ใหม่ท้ายบล็อกนี้เสมอ
drop function if exists public.fail_background_job(uuid, text);

create function public.fail_background_job(p_job_id uuid, p_error_message text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_max_attempts int;
  v_job_type text;
  v_entity_type text;
  v_entity_id uuid;
  v_backoff_minutes int;
  v_notified boolean := false;
  v_job_type_label text;
  v_entity_title text;
  v_message text;
begin
  select attempts, max_attempts, job_type, entity_type, entity_id
  into v_attempts, v_max_attempts, v_job_type, v_entity_type, v_entity_id
  from public.background_jobs
  where id = p_job_id
  for update;

  if not found then
    return false;
  end if;

  if v_attempts >= v_max_attempts then
    update public.background_jobs
    set status = 'failed',
        error_message = p_error_message,
        locked_by = null,
        lease_expires_at = null,
        completed_at = now(),
        updated_at = now(),
        dead_letter_notified_at = case when dead_letter_notified_at is null then now() else dead_letter_notified_at end
    where id = p_job_id
      and dead_letter_notified_at is null
    returning true into v_notified;

    if v_notified then
      v_job_type_label := case v_job_type
        when 'pdf_text_extraction' then 'ดึงข้อความ PDF'
        when 'file_security_rescan' then 'ตรวจสอบความปลอดภัยไฟล์'
        when 'access_expiration' then 'ตรวจสอบสิทธิ์หมดอายุ'
        when 'category_notification' then 'แจ้งเตือนผู้ติดตามหมวดหมู่'
        when 'duplicate_scan' then 'ตรวจสอบงานวิจัยซ้ำ'
        when 'ocr_processing' then 'OCR เอกสารสแกน'
        when 'bulk_enqueue' then 'สร้างงานเป็นชุด'
        else v_job_type
      end;

      v_entity_title := null;
      if v_entity_type = 'research_items' and v_entity_id is not null then
        select title_th into v_entity_title from public.research_items where id = v_entity_id;
      end if;

      v_message := 'งาน "' || v_job_type_label || '"'
        || (case when v_entity_title is not null then ' ของ "' || v_entity_title || '"' else '' end)
        || ' ล้มเหลวถาวรหลังลองซ้ำครบ ' || v_max_attempts || ' ครั้งแล้ว — '
        || 'ไปที่ /superadmin/jobs เพื่อตรวจสอบและลองใหม่';

      insert into public.notifications (user_id, title, message, type, research_id)
      select ur.user_id, 'งานพื้นหลังล้มเหลวถาวร', v_message, 'warning',
             case when v_entity_type = 'research_items' then v_entity_id else null end
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where r.rank >= 50;

      insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (
        null,
        'background_job_dead_letter',
        'background_jobs',
        p_job_id,
        jsonb_build_object('job_type', v_job_type, 'attempts', v_attempts, 'max_attempts', v_max_attempts)
      );
    end if;
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

  return coalesce(v_notified, false);
end;
$$;

grant execute on function public.fail_background_job(uuid, text) to service_role;
grant insert on public.notifications to service_role;

-- ----------------------------------------------------------------------------
-- 4. job_batches: ข้อมูลของ "คำขอประมวลผลเป็นชุด" หนึ่งครั้ง (ต่างจาก
-- background_jobs.batch_id เดิมที่แค่ใช้ "จัดกลุ่ม" job ลูกที่สร้างพร้อมกัน —
-- ตารางนี้คือตัวแทนของคำขอทั้งก้อน รวมถึงตอนที่ยังสร้าง job ลูกไม่ครบ)
--
-- ใช้คู่กับ job_type ใหม่ 'bulk_enqueue': เมื่อ Super Admin สั่ง "ประมวลผล
-- ทั้งหมดตามตัวกรอง" (เกิน 500 รายการ) ระบบสร้างแถว job_batches หนึ่งแถว
-- (id ของแถวนี้ถูกใช้เป็น background_jobs.batch_id ของ job ลูกทุกตัวที่สร้าง
-- ขึ้นจากคำขอนี้ — เข้ากับกลไก getRecentJobBatches เดิมได้ทันทีโดยไม่ต้องแก้)
-- แล้ว enqueue job 'bulk_enqueue' หนึ่งงานที่ทยอยสร้าง job ลูกทีละ chunk
-- (ค่าเริ่มต้น 100 รายการต่อรอบ worker) จนครบ total_items — ไม่โหลดรายการที่
-- ตรงเงื่อนไขทั้งหมดเข้าหน่วยความจำในคำขอเดียว และ resume ได้เองถ้า worker
-- หยุดกลางคัน (lease หมดอายุแล้ว claim_background_jobs เดิมจะดึงกลับมาทำต่อจาก
-- cursor ล่าสุดที่ commit ไว้)
-- ----------------------------------------------------------------------------
create table public.job_batches (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  filter_snapshot jsonb not null default '{}'::jsonb,
  total_items int,
  enqueued_items int not null default 0,
  cursor_after_id uuid,
  cursor_after_updated_at timestamptz,
  status text not null default 'enqueueing' check (status in ('enqueueing', 'ready', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.job_batches is
  'คำขอประมวลผลเป็นชุดขนาดใหญ่ (เกิน 500 รายการ) หนึ่งคำขอ — id ของแถวนี้ถูกใช้เป็น background_jobs.batch_id ของ job ลูกทุกตัว ดู docs/background-jobs.md';

create index idx_job_batches_created_at on public.job_batches (created_at desc);

alter table public.job_batches enable row level security;

grant select, insert, update on public.job_batches to service_role;
grant select on public.job_batches to authenticated;

create policy job_batches_select_super_admin on public.job_batches
  for select to authenticated
  using (public.user_max_role_rank() >= 50);

create trigger trg_job_batches_updated_at
  before update on public.job_batches
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. job_type_settings: concurrency ที่ปรับได้ต่อประเภทงาน (Super Admin ตั้งค่า
-- ที่ /superadmin/jobs) — แยกเป็นตารางเล็กๆ คีย์ด้วย job_type แทนการเพิ่ม 7
-- คอลัมน์แยกในตาราง settings เดิม (ตาราง settings เดิมออกแบบมาสำหรับค่าคงที่
-- ระดับเว็บไซต์ ไม่ใช่ค่าที่ต้องมีหนึ่งแถวต่อหนึ่งประเภทงาน)
-- ----------------------------------------------------------------------------
create table public.job_type_settings (
  job_type text primary key check (
    job_type in (
      'pdf_text_extraction',
      'file_security_rescan',
      'access_expiration',
      'category_notification',
      'duplicate_scan',
      'ocr_processing',
      'bulk_enqueue'
    )
  ),
  concurrency smallint not null default 1 check (concurrency between 1 and 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.job_type_settings is
  'จำนวนงานสูงสุดที่ worker ประมวลผลพร้อมกันได้ต่อประเภทงานหนึ่ง (concurrency) — ปรับได้ที่ /superadmin/jobs ดู docs/background-jobs.md';

-- ค่าเริ่มต้น: OCR ต่ำสุด (พึ่งพา provider ภายนอกที่อาจจำกัด rate limit มากที่สุด
-- ตามคำแนะนำในโจทย์) ดึงข้อความ PDF สูงสุด (ใช้แค่ CPU/IO ไม่มี provider
-- ภายนอก) ส่วน access_expiration/bulk_enqueue เป็นงานที่ออกแบบให้มีอยู่แค่
-- ชุดเดียวต่อขอบเขตอยู่แล้ว (idempotency key / self-resuming) จึงไม่ได้ประโยชน์
-- จากการรันมากกว่า 1 พร้อมกัน
insert into public.job_type_settings (job_type, concurrency) values
  ('pdf_text_extraction', 4),
  ('ocr_processing', 1),
  ('file_security_rescan', 3),
  ('duplicate_scan', 3),
  ('category_notification', 5),
  ('access_expiration', 1),
  ('bulk_enqueue', 1);

alter table public.job_type_settings enable row level security;

grant select, update on public.job_type_settings to service_role;
grant select on public.job_type_settings to authenticated;

create policy job_type_settings_select_super_admin on public.job_type_settings
  for select to authenticated
  using (public.user_max_role_rank() >= 50);
