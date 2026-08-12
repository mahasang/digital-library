-- ช่วงที่ 30: Worker หลาย process/หลาย instance อย่างปลอดภัย
--
-- claim_background_jobs() เดิม (ช่วงที่ 20) จำกัดจำนวนที่ claim ได้แค่ "ต่อการ
-- เรียกหนึ่งครั้ง" (p_limit) เท่านั้น — ไม่ได้ตรวจว่ามีงานประเภทเดียวกันกำลัง
-- processing อยู่แล้วกี่งานจาก worker/invocation อื่นที่ทำงานพร้อมกัน ทำให้ค่า
-- concurrency ที่ Super Admin ตั้งไว้ (job_type_settings.concurrency) เป็นแค่
-- เพดานต่อการเรียกหนึ่งครั้ง ไม่ใช่เพดานรวมจริงข้าม process/instance — ถ้า worker
-- สองตัวเรียกพร้อมกัน (Cron ทับซ้อนกัน, กดปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ระหว่างที่
-- Cron กำลังรันอยู่ หรือรัน worker หลาย instance จริงใน production) อาจได้งาน
-- ประเภทเดียวกัน processing พร้อมกันเกินค่าที่ตั้งไว้จริง (เช่น OCR concurrency=1
-- อาจกลายเป็น 2 งานพร้อมกันจริง)
--
-- แก้ด้วยฟังก์ชันใหม่ claim_background_jobs_with_concurrency() ที่ใช้
-- pg_advisory_xact_lock() คีย์ตาม job_type บังคับให้ขั้นตอน "นับงานที่กำลัง
-- processing อยู่ แล้วค่อย claim" รันแบบ serial ต่อประเภทงานข้าม transaction/
-- worker/instance ทั้งหมด (ปลดล็อกอัตโนมัติเมื่อจบ transaction) — งานประเภทอื่น
-- ยัง claim พร้อมกันได้ตามปกติเพราะคีย์ lock ต่างกันตามประเภทงาน ไม่กระทบ
-- claim_background_jobs() เดิม (คงไว้ไม่แก้ไข ยังใช้ได้ตามเดิมถ้ามีผู้เรียกอื่น)

create index if not exists idx_background_jobs_processing_by_type
  on public.background_jobs (job_type)
  where status = 'processing';

comment on index idx_background_jobs_processing_by_type is
  'ช่วยให้นับจำนวนงาน processing ต่อประเภทงานเร็วขึ้น (ใช้โดย claim_background_jobs_with_concurrency() เพื่อบังคับ concurrency แบบ global ข้าม worker/instance — ช่วงที่ 30)';

create or replace function public.claim_background_jobs_with_concurrency(
  p_worker_id text,
  p_job_type text,
  p_limit int,
  p_concurrency int
)
returns setof background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count int;
  v_remaining int;
begin
  -- serialize count-then-claim ต่อประเภทงานเดียวกันข้าม transaction ทั้งหมด
  -- (คีย์ต่างกันตามประเภทงาน จึงไม่บล็อกการ claim ประเภทอื่นพร้อมกัน)
  perform pg_advisory_xact_lock(hashtext('bg_claim:' || p_job_type));

  select count(*) into v_active_count
  from public.background_jobs
  where job_type = p_job_type
    and status = 'processing'
    and lease_expires_at >= now();

  v_remaining := greatest(0, p_concurrency - v_active_count);
  if v_remaining <= 0 then
    return;
  end if;

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
    where bj.job_type = p_job_type
      and (
        (bj.status = 'pending' and bj.run_after <= now())
        or (bj.status = 'processing' and bj.lease_expires_at < now())
      )
    order by bj.created_at
    limit least(p_limit, v_remaining)
    for update skip locked
  )
  returning *;
end;
$$;

comment on function public.claim_background_jobs_with_concurrency(text, text, int, int) is
  'เหมือน claim_background_jobs() แต่บังคับ concurrency แบบ global ข้าม worker/instance ด้วย pg_advisory_xact_lock ต่อประเภทงาน (ช่วงที่ 30) — ใช้แทน claim_background_jobs() ที่ processJobQueue() ทุกจุดเรียก';

grant execute on function public.claim_background_jobs_with_concurrency(text, text, int, int) to service_role;
