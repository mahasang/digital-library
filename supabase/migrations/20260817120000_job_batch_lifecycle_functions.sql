-- ============================================================================
-- Phase 28: วงจรชีวิตของ master job (job_batches) — สร้างแบบ idempotent,
-- pause/resume/cancel, ตัวนับ progress แบบ O(1) (ต่อยอด complete_background_job/
-- fail_background_job เดิมจากช่วงที่ 20/25 โดยไม่แก้พฤติกรรมเดิมแม้แต่บรรทัด
-- เดียว แค่เพิ่มขั้นตอนอัปเดต job_batches ต่อท้าย), retry เฉพาะรายการที่ล้มเหลว
-- ในชุด, และแจ้งเตือน Super Admin เมื่อ master job เสร็จ/ล้มเหลว/มี DLQ
-- (รูปแบบเดียวกับการแจ้งเตือน DLQ รายตัวเดิมทุกประการ — atomic dedup ผ่านคอลัมน์
-- *_notified_at)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. create_job_batch_if_not_exists(): สร้าง master job แบบ idempotent — คำนวณ
-- filter_hash ฝั่ง SQL เอง (md5(jsonb::text) เสถียรเพราะ Postgres normalize
-- ลำดับ key ของ jsonb เองอยู่แล้ว ไม่ต้องพึ่ง stable-stringify ฝั่ง JS) แล้ว
-- INSERT ... ON CONFLICT ... DO NOTHING กับ partial unique index
-- idx_job_batches_active_filter (migration ก่อนหน้า) — atomic ภายใต้การกดปุ่ม
-- ซ้ำพร้อมกันจริง ถ้าชนกัน คืน batch เดิมที่มีอยู่แล้วแทน (is_new=false) ให้
-- ผู้เรียกไม่ต้อง enqueue coordinator job ซ้ำ
-- ----------------------------------------------------------------------------
create or replace function public.create_job_batch_if_not_exists(
  p_job_type text,
  p_filter_snapshot jsonb,
  p_batch_size int,
  p_total_items int,
  p_created_by uuid
) returns table (batch_id uuid, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filter_hash text := md5(p_filter_snapshot::text);
  v_id uuid;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะสร้างงานประมวลผลเป็นชุดได้' using errcode = 'P0001';
  end if;

  insert into public.job_batches
    (job_type, filter_snapshot, filter_hash, batch_size, total_items, created_by, status)
  values
    (p_job_type, p_filter_snapshot, v_filter_hash, p_batch_size, p_total_items, p_created_by, 'enqueueing')
  on conflict (job_type, filter_hash) where status in ('enqueueing', 'ready', 'paused')
  do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id, true;
  else
    return query
      select jb.id, false
      from public.job_batches jb
      where jb.job_type = p_job_type
        and jb.filter_hash = v_filter_hash
        and jb.status in ('enqueueing', 'ready', 'paused')
      order by jb.created_at desc
      limit 1;
  end if;
end;
$$;

grant execute on function
  public.create_job_batch_if_not_exists(text, jsonb, int, int, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. set_job_batch_status(): pause/resume(=กลับเป็น ready)/cancel แบบ atomic
-- state-guarded UPDATE เดียว — cancel เพิ่มเติมด้วยการยกเลิก job ลูกที่ยัง
-- pending อยู่ (ไม่แตะ processing/เสร็จแล้ว เพื่อรักษาผลงานที่ทำสำเร็จไปแล้ว
-- ตามข้อกำหนด) พร้อมนับเข้า cancelled_items ทันที
-- ----------------------------------------------------------------------------
create or replace function public.set_job_batch_status(
  p_batch_id uuid,
  p_new_status text,
  p_actor_id uuid
) returns public.job_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.job_batches;
  v_cancelled_count int;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะควบคุมงานประมวลผลเป็นชุดได้' using errcode = 'P0001';
  end if;

  if p_new_status not in ('paused', 'ready', 'cancelled') then
    raise exception 'สถานะเป้าหมายไม่ถูกต้อง: %', p_new_status using errcode = 'P0001';
  end if;

  update public.job_batches
  set status = p_new_status,
      paused_at = case when p_new_status = 'paused' then now() else paused_at end,
      cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
      updated_at = now()
  where id = p_batch_id
    and (
      (p_new_status = 'paused' and status in ('enqueueing', 'ready'))
      or (p_new_status = 'ready' and status = 'paused')
      or (p_new_status = 'cancelled' and status in ('enqueueing', 'ready', 'paused'))
    )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ไม่สามารถเปลี่ยนสถานะงานชุดนี้เป็น % จากสถานะปัจจุบันได้' , p_new_status using errcode = 'P0001';
  end if;

  if p_new_status = 'cancelled' then
    update public.background_jobs
    set status = 'cancelled', completed_at = now(), updated_at = now()
    where batch_id = p_batch_id and status = 'pending';
    get diagnostics v_cancelled_count = row_count;

    if v_cancelled_count > 0 then
      update public.job_batches
      set cancelled_items = cancelled_items + v_cancelled_count
      where id = p_batch_id
      returning * into v_row;
    end if;

    perform public.finalize_job_batch_if_drained(p_batch_id);
    select * into v_row from public.job_batches where id = p_batch_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_job_batch_status(uuid, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. retry_failed_jobs_in_batch(): "ลองใหม่เฉพาะที่ล้มเหลว" ระดับทั้งชุด —
-- รีเซ็ตฟิลด์เดียวกับ retryFailedJob() รายตัวเดิมทุกประการ (attempts=0,
-- run_after=now(), ล้าง DLQ state ทั้งหมดรวม dead_letter_notified_at เพื่อให้
-- รอบล้มเหลวถัดไป (ถ้ามี) แจ้งเตือนใหม่ได้) แล้วปรับ failed_items/สถานะของ
-- job_batches กลับให้สอดคล้อง พร้อมล้าง *_notified_at ของ batch เองด้วย
-- (ไม่งั้นถ้า retry แล้วสำเร็จหมด batch จะไม่แจ้งเตือน "เสร็จแล้ว" อีกครั้ง
-- เพราะ guard เดิมยังติดค้างจากรอบก่อน)
-- ----------------------------------------------------------------------------
create or replace function public.retry_failed_jobs_in_batch(p_batch_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะสั่งลองใหม่ได้' using errcode = 'P0001';
  end if;

  update public.background_jobs
  set status = 'pending',
      run_after = now(),
      error_message = null,
      attempts = 0,
      resolved_at = null,
      resolved_by = null,
      resolution_note = null,
      dead_letter_notified_at = null,
      updated_at = now()
  where batch_id = p_batch_id and status = 'failed';
  get diagnostics v_count = row_count;

  if v_count > 0 then
    update public.job_batches
    set failed_items = greatest(0, failed_items - v_count),
        status = case when status in ('failed', 'completed') then 'ready' else status end,
        completed_notified_at = null,
        failed_notified_at = null,
        completed_at = null,
        updated_at = now()
    where id = p_batch_id;
  end if;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.retry_failed_jobs_in_batch(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. get_job_batch_progress(): แจกแจงสถานะ job ลูกแบบละเอียด (pending vs
-- processing) ด้วย GROUP BY จริง — ใช้เฉพาะตอนเปิดดูรายละเอียด batch เดียว
-- (JobBatchDetailDrawer) ไม่ใช่ตอน poll รายการทั้งหมดทุก 5 วินาที (รายการใช้
-- ตัวนับที่เก็บไว้ใน job_batches โดยตรง ไม่มีต้นทุนต่อการ poll เลย)
-- ----------------------------------------------------------------------------
create or replace function public.get_job_batch_progress(p_batch_id uuid)
returns table (status text, item_count bigint)
language sql stable security invoker set search_path = public as $$
  select bj.status, count(*)::bigint
  from public.background_jobs bj
  where bj.batch_id = p_batch_id
  group by bj.status;
$$;

grant execute on function public.get_job_batch_progress(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 5. notify_job_batch_finished(): แจ้งเตือน Super Admin ทุกคนแบบ in-app เมื่อ
-- master job เสร็จ/ล้มเหลว/มีรายการเข้า DLQ — รูปแบบเดียวกับการแจ้งเตือน DLQ
-- รายตัวใน fail_background_job ทุกประการ (dedup ผ่านคอลัมน์ *_notified_at,
-- หาผู้รับผ่าน user_roles join roles ไม่ใช่ profiles.rank ซึ่งไม่มีคอลัมน์นี้อยู่
-- จริง, ใช้ type='success'/'warning' เดิมจาก CHECK constraint ที่มีแค่
-- info/success/warning ไม่เพิ่มค่าใหม่)
-- ----------------------------------------------------------------------------
create or replace function public.notify_job_batch_finished(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.job_batches;
  v_dlq_count bigint;
  v_job_type_label text;
begin
  select * into v_batch from public.job_batches where id = p_batch_id for update;
  if not found then
    return;
  end if;

  v_job_type_label := case v_batch.job_type
    when 'pdf_text_extraction' then 'ดึงข้อความ PDF'
    when 'file_security_rescan' then 'ตรวจสอบความปลอดภัยไฟล์'
    when 'duplicate_scan' then 'ตรวจสอบงานวิจัยซ้ำ'
    when 'ocr_processing' then 'OCR เอกสารสแกน'
    else v_batch.job_type
  end;

  select count(*) into v_dlq_count
  from public.background_jobs
  where batch_id = p_batch_id and status = 'failed' and attempts >= max_attempts;

  if v_batch.status = 'completed' and v_batch.completed_notified_at is null then
    update public.job_batches set completed_notified_at = now() where id = p_batch_id;

    insert into public.notifications (user_id, title, message, type)
    select ur.user_id, 'งานประมวลผลเป็นชุดเสร็จสมบูรณ์',
           format('งาน "%s" เสร็จแล้ว — สำเร็จ %s, ล้มเหลว %s, ข้าม %s รายการ',
                  v_job_type_label, v_batch.completed_items, v_batch.failed_items, v_batch.skipped_items),
           'success'
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.rank >= 50;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_batch.created_by, 'bulk_batch_completed', 'job_batches', p_batch_id,
            jsonb_build_object('completed', v_batch.completed_items, 'failed', v_batch.failed_items,
                                'skipped', v_batch.skipped_items));
  end if;

  if v_batch.status = 'failed' and v_batch.failed_notified_at is null then
    update public.job_batches set failed_notified_at = now() where id = p_batch_id;

    insert into public.notifications (user_id, title, message, type)
    select ur.user_id, 'งานประมวลผลเป็นชุดล้มเหลว',
           format('งาน "%s" ล้มเหลวทั้งหมด %s รายการ — ไปที่หน้าที่เกี่ยวข้องเพื่อตรวจสอบและลองใหม่',
                  v_job_type_label, v_batch.failed_items),
           'warning'
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.rank >= 50;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_batch.created_by, 'bulk_batch_failed', 'job_batches', p_batch_id,
            jsonb_build_object('failed', v_batch.failed_items));
  end if;

  if v_dlq_count > 0 and v_batch.dlq_notified_at is null then
    update public.job_batches set dlq_notified_at = now() where id = p_batch_id;

    insert into public.notifications (user_id, title, message, type)
    select ur.user_id, 'งานประมวลผลเป็นชุดมีรายการล้มเหลวถาวร',
           format('งาน "%s" มี %s รายการล้มเหลวถาวรเข้าคิว DLQ แล้ว — ไปที่ /superadmin/jobs',
                  v_job_type_label, v_dlq_count),
           'warning'
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.rank >= 50;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_batch.created_by, 'bulk_batch_dlq', 'job_batches', p_batch_id,
            jsonb_build_object('dlq_count', v_dlq_count));
  end if;
end;
$$;

grant execute on function public.notify_job_batch_finished(uuid) to service_role;
grant insert on public.notifications to service_role;

-- ----------------------------------------------------------------------------
-- 6. finalize_job_batch_if_drained(): เปลี่ยนสถานะ job_batches จาก 'ready' เป็น
-- 'completed'/'failed' เมื่อ job ลูกทุกตัวถึงสถานะสุดท้ายแล้ว (นับรวม
-- skipped_items ด้วย เพราะรายการที่ถูกข้ามไม่เคยสร้าง job ลูกเลย แต่ก็ถือว่า
-- "จบแล้ว" สำหรับรายการนั้น) — batch ที่ไม่มีรายการตรงตัวกรองเลย
-- (enqueued_items=0) ถือว่า completed ทันทีที่ตรวจสอบ (ไม่มีอะไรต้องทำ)
-- ----------------------------------------------------------------------------
create or replace function public.finalize_job_batch_if_drained(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.job_batches;
begin
  select * into v_batch from public.job_batches where id = p_batch_id for update;
  if not found or v_batch.status is distinct from 'ready' then
    return;
  end if;

  if v_batch.enqueued_items = 0
     or (v_batch.completed_items + v_batch.failed_items + v_batch.cancelled_items + v_batch.skipped_items)
        >= v_batch.enqueued_items
  then
    update public.job_batches
    set status = case
                    when v_batch.enqueued_items > 0
                         and v_batch.failed_items > 0
                         and v_batch.failed_items
                             = (v_batch.enqueued_items - v_batch.skipped_items - v_batch.cancelled_items)
                    then 'failed'
                    else 'completed'
                  end,
        completed_at = now()
    where id = p_batch_id;

    perform public.notify_job_batch_finished(p_batch_id);
  end if;
end;
$$;

grant execute on function public.finalize_job_batch_if_drained(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 7. complete_background_job(): ต่อยอดเดิม (เดิม language sql, เปลี่ยนเป็น
-- plpgsql เพื่อเพิ่มขั้นตอนแบบมีเงื่อนไข) — พฤติกรรมเดิมทุกบรรทัดคงเดิมทั้งหมด
-- เพิ่มแค่ "ถ้า job นี้มี batch_id ให้เพิ่ม completed_items ของ batch แล้วตรวจ
-- ว่า batch นั้นเสร็จหมดหรือยัง"
-- ----------------------------------------------------------------------------
create or replace function public.complete_background_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  update public.background_jobs
  set status = 'completed',
      progress = 100,
      completed_at = now(),
      error_message = null,
      locked_by = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_job_id
  returning batch_id into v_batch_id;

  if v_batch_id is not null then
    update public.job_batches
    set completed_items = completed_items + 1, updated_at = now()
    where id = v_batch_id;

    perform public.finalize_job_batch_if_drained(v_batch_id);
  end if;
end;
$$;

grant execute on function public.complete_background_job(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 8. fail_background_job(): ต่อยอดเดิมจาก migration 20260814100000 (คงทุก
-- บรรทัดเดิมไว้ครบ รวมการแจ้งเตือน DLQ รายตัวเดิม) เพิ่มแค่ "ถ้ารอบนี้เป็นรอบที่
-- ทำให้ job เข้า DLQ ครั้งแรกจริง (v_notified) และ job นี้มี batch_id ให้เพิ่ม
-- failed_items ของ batch แล้วตรวจว่า batch เสร็จหมดหรือยัง" — ไม่แตะ branch
-- retry อัตโนมัติ (attempts < max_attempts) เลย เพราะยังไม่ถือว่า "ล้มเหลวถาวร"
-- ----------------------------------------------------------------------------
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
  v_batch_id uuid;
  v_backoff_minutes int;
  v_notified boolean := false;
  v_job_type_label text;
  v_entity_title text;
  v_message text;
begin
  select attempts, max_attempts, job_type, entity_type, entity_id, batch_id
  into v_attempts, v_max_attempts, v_job_type, v_entity_type, v_entity_id, v_batch_id
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

      if v_batch_id is not null then
        update public.job_batches
        set failed_items = failed_items + 1, updated_at = now()
        where id = v_batch_id;

        perform public.finalize_job_batch_if_drained(v_batch_id);
      end if;
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
