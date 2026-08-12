-- ============================================================================
-- Phase 21: หมดอายุสิทธิ์เข้าถึงตรงเวลา (scheduled job แทน lazy-expire เดิม) +
-- รวมจุดแจ้งเตือนการเผยแพร่งานวิจัยเป็นจุดเดียว (publish event)
--
-- ส่วนที่ 1: document_access_grants ไม่เคยมี job ประมวลผลมาก่อนเลย (แค่ตรวจ
-- expires_at ตรงตอนสร้าง Signed URL — ยังคงพฤติกรรมนี้ไว้ทุกประการ ไม่แตะเลย)
-- ตอนนี้เพิ่ม scheduled sweep ให้: (1) ปิด grant ที่หมดอายุแล้วอย่างชัดเจน
-- (revoked_at) แทนที่จะปล่อยให้ "หมดอายุแบบเงียบๆ" ไม่มีร่องรอย (2) แจ้งเตือน
-- ล่วงหน้าก่อนหมดอายุจริง
--
-- ส่วนที่ 2: ขยาย trigger เดิม 2 ตัว (set_published_at, log_research_status_change)
-- ให้ทำงานตอน INSERT ด้วย ไม่ใช่แค่ UPDATE — ปิดช่องโหว่ทางทฤษฎีที่แถวใหม่ถูก
-- insert มาพร้อม status='published' ตรงๆ จะไม่มี published_at/แจ้งเตือนผู้
-- ติดตามหมวดหมู่เลย (ปัจจุบันปิดไปแล้วทางปฏิบัติจาก adminCreateResearchAction
-- ที่ลดสถานะเป็น pending_review เสมอเมื่อไฟล์ยังไม่ผ่านสแกน — แต่ trigger ควร
-- ถูกต้องในตัวเองไม่พึ่งพาแค่ query ฝั่ง TypeScript ชั้นเดียว)
-- ============================================================================

alter table public.document_access_grants
  add column expiry_warned_at timestamptz;

comment on column public.document_access_grants.expiry_warned_at is
  'เวลาที่แจ้งเตือน "ใกล้หมดอายุ" ไปแล้ว — กันแจ้งซ้ำทุกรอบที่ scheduled job ทำงาน (ดู warn_expiring_access_grants)';

grant select, update on public.document_access_grants to service_role;

-- ----------------------------------------------------------------------------
-- expire_stale_access_grants(): ปิด grant ที่หมดอายุแล้วจริงอย่างชัดเจน โดยตั้ง
-- revoked_at + revoke_reason เป็นข้อความมาตรฐานที่ trigger
-- notify_access_grant_revoked() ด้านล่างจะตรวจพบและใช้ถ้อยคำ "หมดอายุ" แทน
-- "ถูกเพิกถอน" ให้ถูกต้อง — idempotent โดยธรรมชาติ (where revoked_at is null
-- ทำให้รันซ้ำกี่ครั้งก็ไม่ประมวลผลแถวเดิมซ้ำ ไม่ส่งแจ้งเตือนซ้ำ)
--
-- **ไม่ใช่ด่านความปลอดภัยหลัก** — lib/storage/signed-url.server.ts และ
-- lib/data/access-grants.server.ts ตรวจ expires_at/revoked_at ของแถวจริงตรงๆ
-- เสมอไม่ว่า job นี้จะรันหรือยัง (เหมือนหลักการเดิมของ
-- expire_stale_access_requests ในช่วงที่ 18/20) ฟังก์ชันนี้แค่ทำให้สถานะที่
-- แสดงผล/แจ้งเตือนตรงกับความเป็นจริงเท่านั้น
-- ----------------------------------------------------------------------------
create or replace function public.expire_stale_access_grants()
returns void
language sql
as $$
  update public.document_access_grants
  set revoked_at = now(),
      revoke_reason = 'ระบบปิดอัตโนมัติ: สิทธิ์หมดอายุตามกำหนดเวลา'
  where revoked_at is null
    and expires_at is not null
    and expires_at < now();
$$;

grant execute on function public.expire_stale_access_grants() to service_role;

comment on function public.expire_stale_access_grants is
  'ปิด grant ที่หมดอายุแล้วอย่างชัดเจน (revoked_at) — idempotent, ไม่ใช่ด่านความปลอดภัยหลัก (ดู docs/document-access-requests.md)';

-- ----------------------------------------------------------------------------
-- warn_expiring_access_grants(): แจ้งเตือนล่วงหน้าก่อนสิทธิ์หมดอายุจริง
-- (ค่าเริ่มต้น 3 วัน) — security definer เพราะต้อง insert notifications ให้
-- ผู้ใช้คนอื่นได้ (เหมือนรูปแบบ notify_* triggers เดิมของช่วงที่ 18) update
-- expiry_warned_at ในคำสั่งเดียวกับ insert notification ผ่าน CTE เพื่อกัน
-- race condition ระหว่าง 2 worker ที่อาจรันพร้อมกัน (atomic ในระดับ statement)
-- idempotent เพราะ WHERE ... and expiry_warned_at is null ทำให้แถวที่แจ้งแล้ว
-- ไม่ถูกเลือกซ้ำในรอบถัดไป
-- ----------------------------------------------------------------------------
create or replace function public.warn_expiring_access_grants(p_window_days int default 3)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
begin
  select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
  from public.settings limit 1;

  if not coalesce(v_notify_enabled, true) then
    return;
  end if;

  with due as (
    update public.document_access_grants
    set expiry_warned_at = now()
    where revoked_at is null
      and expires_at is not null
      and expires_at > now()
      and expires_at <= now() + (p_window_days || ' days')::interval
      and expiry_warned_at is null
    returning id, user_id, research_item_id, access_type, expires_at
  )
  insert into public.notifications (user_id, title, message, type, research_id)
  select
    d.user_id,
    'สิทธิ์เข้าถึงเอกสารใกล้หมดอายุ',
    format(
      'สิทธิ์%sเอกสาร "%s" ของคุณจะหมดอายุในวันที่ %s กรุณาขอสิทธิ์ใหม่ล่วงหน้าหากยังต้องการเข้าถึงต่อ',
      case when d.access_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end,
      coalesce(ri.title_th, 'เอกสาร'),
      to_char(d.expires_at, 'DD/MM/YYYY')
    ),
    'warning',
    d.research_item_id
  from due d
  left join public.research_items ri on ri.id = d.research_item_id
  left join public.notification_preferences np on np.user_id = d.user_id
  where coalesce(np.access_request_in_app_enabled, true);
end;
$$;

grant execute on function public.warn_expiring_access_grants(int) to service_role;

comment on function public.warn_expiring_access_grants is
  'แจ้งเตือนล่วงหน้าก่อนสิทธิ์เข้าถึงเอกสารหมดอายุ (ค่าเริ่มต้น 3 วัน) — idempotent ด้วย expiry_warned_at';

-- ----------------------------------------------------------------------------
-- ปรับ notify_access_grant_revoked(): แยกถ้อยคำระหว่าง "ถูกเพิกถอนโดยเจ้าหน้าที่"
-- กับ "หมดอายุอัตโนมัติตามกำหนดเวลา" (ตรวจจาก revoke_reason ที่
-- expire_stale_access_grants ตั้งไว้เป็นข้อความมาตรฐาน) — ยัง idempotent เท่า
-- เดิม (ทำงานตอน revoked_at เปลี่ยนจาก null เป็นไม่ null ครั้งแรกเท่านั้น)
-- ----------------------------------------------------------------------------
create or replace function public.notify_access_grant_revoked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
  v_pref_enabled boolean;
  v_title text;
  v_is_auto_expired boolean;
begin
  if tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
    from public.settings limit 1;

    select coalesce(access_request_in_app_enabled, true) into v_pref_enabled
    from public.notification_preferences where user_id = new.user_id;

    if coalesce(v_notify_enabled, true) and coalesce(v_pref_enabled, true) then
      select title_th into v_title from public.research_items where id = new.research_item_id;
      v_is_auto_expired := new.revoke_reason = 'ระบบปิดอัตโนมัติ: สิทธิ์หมดอายุตามกำหนดเวลา';

      insert into public.notifications (user_id, title, message, type, research_id)
      values (
        new.user_id,
        case when v_is_auto_expired then 'สิทธิ์เข้าถึงเอกสารหมดอายุแล้ว' else 'สิทธิ์เข้าถึงเอกสารถูกเพิกถอน' end,
        case
          when v_is_auto_expired then
            format('สิทธิ์%sเอกสาร "%s" ของคุณหมดอายุตามกำหนดเวลาแล้ว',
              case when new.access_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end, v_title)
          else
            format('สิทธิ์%sเอกสาร "%s" ของคุณถูกเพิกถอนแล้ว%s',
              case when new.access_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end,
              v_title,
              case when new.revoke_reason is not null and new.revoke_reason != ''
                then format(' (เหตุผล: %s)', new.revoke_reason) else '' end
            )
        end,
        'warning',
        new.research_item_id
      );
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- ขยาย set_published_at() และ log_research_status_change() ให้ทำงานตอน INSERT
-- ด้วย (เดิมทั้งคู่เป็น "before/after update" เท่านั้น) — ครอบคลุมกรณี insert
-- แถวใหม่มาพร้อม status='published' ตรงๆ ให้ถูกต้องในระดับฐานข้อมูลเอง ไม่
-- พึ่งพา TypeScript ฝั่งเดียว (ปัจจุบัน adminCreateResearchAction ลดสถานะเป็น
-- pending_review เสมอเมื่อไฟล์ยังไม่ผ่านสแกน ทำให้กรณีนี้ไม่เกิดขึ้นจริงในทาง
-- ปฏิบัติแล้ว — แต่ trigger ควรถูกต้องในตัวเองเผื่ออนาคต)
-- ============================================================================
create or replace function public.set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  end if;

  -- ล้าง category_notified_at เมื่อออกจากสถานะ published (เช่น archived) —
  -- ทำให้ "เผยแพร่ซ้ำหลังปิดเผยแพร่" ในอนาคตแจ้งผู้ติดตามหมวดหมู่ใหม่ได้ถูกต้อง
  -- แทนที่จะถูก guard กันซ้ำของ notify_category_subscribers_published() บล็อก
  -- ถาวรจากการแจ้งครั้งแรกที่เคยเกิดขึ้น
  if tg_op = 'UPDATE' and old.status = 'published' and new.status is distinct from 'published' then
    new.category_notified_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_research_items_published_at on public.research_items;
create trigger trg_research_items_published_at
  before insert or update on public.research_items
  for each row execute function public.set_published_at();

-- หมายเหตุสำคัญ: **ไม่ย้าย branch "แจ้งผู้ติดตามหมวดหมู่" มาไว้ใน trigger นี้
-- แม้จะขยายให้ทำงานตอน INSERT ก็ตาม** เพราะ research_categories (ตารางเชื่อม
-- หมวดหมู่) ถูกเขียนใน replaceResearchRelations() ซึ่งเป็นคำสั่งแยกที่รันหลัง
-- insert/update หลักเสมอ (ดู app/dashboard/research/new/actions.ts,
-- app/dashboard/research/[id]/edit/actions.ts) — ถ้า trigger นี้ยิงตอน
-- insert/update หลัก ตารางเชื่อมหมวดหมู่ของ "เอกสารนี้" ยังไม่ถูกเขียนเลย (ของ
-- แถวใหม่) หรืออาจยังเป็นค่าเก่าก่อนแก้ไข (ของแถวที่แก้ไข) ทำให้แจ้งผิดคน/ไม่
-- แจ้งเลย — ย้ายไปเป็นฟังก์ชันแยก notify_category_subscribers_published() ที่
-- lib/publishing/publish-event.server.ts (Server Action ฝั่งแอป) เรียกเองทีหลัง
-- "หลังจาก" replaceResearchRelations() เสร็จแล้วเสมอ เป็นจุดเดียวที่แน่ใจได้ว่า
-- หมวดหมู่ของเอกสารถูกต้องครบถ้วนแล้วจริง — ดู docs/document-access-requests.md
create or replace function public.log_research_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.approval_logs (research_id, actor_id, from_status, to_status, note)
    values (new.id, auth.uid(), old.status, new.status, new.review_note);

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'research_status_change',
      'research_items',
      new.id,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'note', new.review_note
      )
    );

    select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
    from public.settings limit 1;

    if coalesce(v_notify_enabled, true) and new.submitted_by is not null then
      insert into public.notifications (user_id, title, message, type, research_id)
      values (
        new.submitted_by,
        'สถานะงานวิจัยเปลี่ยนแปลง',
        format('งานวิจัย "%s" เปลี่ยนสถานะเป็น "%s"', new.title_th, new.status),
        case
          when new.status = 'rejected' then 'warning'
          when new.status in ('published', 'approved') then 'success'
          else 'info'
        end,
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

-- ยังคง "after update" เท่าเดิม (ไม่ขยายเป็น insert) — audit_logs/approval_logs
-- เป็น log การ "เปลี่ยนผ่าน" สถานะโดยธรรมชาติ ไม่มีความหมายสำหรับแถวที่เพิ่ง
-- insert ใหม่ (ไม่มี from_status ให้เทียบ) adminCreateResearchAction มี
-- logAudit ของตัวเองอยู่แล้วสำหรับกรณีนี้ (action: "research_create")

-- ----------------------------------------------------------------------------
-- notify_category_subscribers_published(): แจ้งผู้ติดตามหมวดหมู่ (in-app) ว่ามี
-- งานวิจัยใหม่เผยแพร่ — แยกออกจาก trigger ข้างต้นโดยเจตนา (ดูหมายเหตุด้านบน)
-- เรียกจาก TypeScript ฝั่งแอปเท่านั้น (lib/publishing/publish-event.server.ts)
-- หลังจาก research_categories ของเอกสารถูกต้องครบถ้วนแล้วเสมอ — เป็นจุดเดียว
-- ที่สร้าง in-app notification ประเภทนี้ทั้งระบบ (ไม่มี trigger คู่ขนานแล้ว
-- กันแจ้งซ้ำเมื่อเอกสารอยู่หลายหมวดหมู่ด้วย insert ... select distinct เหมือน
-- เดิมทุกประการ)
-- ----------------------------------------------------------------------------
alter table public.research_items add column category_notified_at timestamptz;

comment on column public.research_items.category_notified_at is
  'เวลาที่แจ้งผู้ติดตามหมวดหมู่ไปแล้ว (in-app+enqueue email) — กันแจ้งซ้ำหากถูกเรียกซ้ำโดยไม่ตั้งใจ (ดู notify_category_subscribers_published)';

create or replace function public.notify_category_subscribers_published(p_research_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
  v_title text;
  v_submitted_by uuid;
begin
  -- กันแจ้งซ้ำระดับฐานข้อมูล (atomic — เช็คและ mark ในคำสั่งเดียว) แม้ผู้เรียก
  -- ฝั่งแอปจะเรียกซ้ำโดยไม่ตั้งใจ (เช่น retry/double-submit) ก็ไม่แจ้งซ้ำ —
  -- flag นี้ถูกล้างอัตโนมัติทุกครั้งที่สถานะออกจาก published (ดู
  -- set_published_at ด้านล่าง) จึง "เผยแพร่ซ้ำหลังปิดเผยแพร่" แจ้งเตือนใหม่ได้
  -- ถูกต้อง ไม่ใช่ flag ที่ค้างตลอดไป — คืนค่า true ก็ต่อเมื่อรอบนี้เป็นครั้งแรก
  -- จริง (ผู้เรียกฝั่งแอปใช้ค่านี้ตัดสินว่าจะ enqueue email ต่อหรือไม่ ใช้
  -- guard เดียวกันสำหรับทั้ง in-app และ email — ดู
  -- lib/publishing/publish-event.server.ts)
  update public.research_items
  set category_notified_at = now()
  where id = p_research_item_id and category_notified_at is null
  returning title_th, submitted_by into v_title, v_submitted_by;

  if not found then
    return false;
  end if;

  select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
  from public.settings limit 1;

  if coalesce(v_notify_enabled, true) then
    insert into public.notifications (user_id, title, message, type, research_id)
    select distinct
      cs.user_id,
      'มีงานวิจัยใหม่ในหมวดหมู่ที่คุณติดตาม',
      format('งานวิจัยใหม่ "%s" เผยแพร่แล้วในหมวดหมู่ที่คุณติดตาม', v_title),
      'info',
      p_research_item_id
    from public.category_subscriptions cs
    join public.research_categories rc on rc.category_id = cs.category_id
    left join public.notification_preferences np on np.user_id = cs.user_id
    where rc.research_id = p_research_item_id
      and coalesce(np.new_research_in_app_enabled, true)
      and cs.user_id is distinct from v_submitted_by;
  end if;

  return true;
end;
$$;

grant execute on function public.notify_category_subscribers_published(uuid) to authenticated, service_role;

comment on function public.notify_category_subscribers_published is
  'แจ้งผู้ติดตามหมวดหมู่ (in-app) เมื่อมีงานวิจัยใหม่เผยแพร่ — เรียกจาก lib/publishing/publish-event.server.ts เท่านั้น (จุดเดียวสำหรับทุกเส้นทางที่เผยแพร่งานวิจัย) ดู docs/document-access-requests.md';
