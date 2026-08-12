-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — ช่วงที่ 18
-- "ขอสิทธิ์เข้าถึงเอกสาร" (Document Access Requests) และ
-- "แจ้งงานวิจัยใหม่ตามหมวดหมู่" (Category Subscriptions)
--
-- แนวคิดหลัก: document_access_grants เป็น "ชั้นสิทธิ์เสริม" (override layer)
-- ที่ทำงานคู่ขนานกับระบบ access_level เดิม (public/member_only/staff_only/
-- read_only/metadata_only) ไม่ได้แทนที่ — การอนุมัติคำขอของผู้ใช้คนหนึ่งจะ
-- "เพิ่ม" สิทธิ์อ่าน/ดาวน์โหลดให้เฉพาะผู้ใช้คนนั้น โดยไม่แก้ไข access_level
-- หลักของเอกสารเลย (ตามข้อกำหนด "ห้ามเปลี่ยน access_level หลักของเอกสารเพียง
-- เพราะอนุมัติให้ผู้ใช้คนหนึ่ง") จุดตรวจสอบสิทธิ์จริง (lib/storage/
-- signed-url.server.ts) จะตรวจ "canReadOnline/canDownload(access_level) OR
-- มี grant ที่ยัง active" เสมอ — ไม่แตะ RLS การมองเห็นแถว research_items เดิม
-- แม้แต่น้อย (แถวที่มองไม่เห็นอยู่แล้ววันนี้ เช่น member_only/staff_only ที่
-- rank ไม่ถึง ยังคงมองไม่เห็นเหมือนเดิมทุกประการ — สอดคล้องกับข้อกำหนด "ห้ามทำ
-- ให้ระบบสิทธิ์เดิมเสีย" เนื่องจากในทางปฏิบัติ ถ้าแถวมองเห็นได้ผ่าน rank อยู่
-- แล้ว ผู้ใช้จะมีสิทธิ์อ่าน/ดาวน์โหลดเต็มอยู่แล้วตาม canReadOnline/canDownload
-- เดิม ไม่มีช่องว่างให้ต้องขอสิทธิ์เพิ่ม — ระบบคำขอจึงมีผลจริงกับเอกสาร
-- read_only/metadata_only เป็นหลัก ซึ่งเป็นระดับที่ "มองเห็นแถวได้ทุกคน" แต่
-- เนื้อหาถูกจำกัดแบบเดียวกันสำหรับทุกคนโดยไม่สนใจ rank)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. access_requests: คำขอเข้าถึงเอกสาร (อ่าน/ดาวน์โหลด)
-- ----------------------------------------------------------------------------
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  research_item_id uuid not null references public.research_items (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  request_type text not null check (request_type in ('read', 'download')),
  purpose text not null,
  requester_note text,
  status text not null default 'pending' check (
    status in (
      'pending', 'under_review', 'approved', 'rejected',
      'more_information_required', 'cancelled', 'expired'
    )
  ),
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_note text,
  access_granted_at timestamptz,
  access_expires_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.access_requests is 'คำขอเข้าถึง/ดาวน์โหลดเอกสารที่ผู้ใช้ไม่มีสิทธิ์ปกติ — ไม่ใช่การเปลี่ยน access_level ของเอกสาร';
comment on column public.access_requests.purpose is 'วัตถุประสงค์การใช้งาน (บังคับกรอก)';

create index idx_access_requests_research_item on public.access_requests (research_item_id);
create index idx_access_requests_requester on public.access_requests (requester_id, created_at desc);
create index idx_access_requests_status on public.access_requests (status);

-- กันคำขอซ้ำสำหรับเอกสาร+ประเภทสิทธิ์เดียวกัน ขณะที่คำขอเดิมยัง pending/under_review
create unique index idx_access_requests_active_unique on public.access_requests
  (research_item_id, requester_id, request_type)
  where status in ('pending', 'under_review');

create trigger trg_access_requests_updated_at
  before update on public.access_requests
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. document_access_grants: สิทธิ์ที่อนุมัติแล้ว (ถาวรหรือมีวันหมดอายุ)
-- ----------------------------------------------------------------------------
create table public.document_access_grants (
  id uuid primary key default gen_random_uuid(),
  research_item_id uuid not null references public.research_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  access_type text not null check (access_type in ('read', 'download')),
  granted_by uuid references public.profiles (id) on delete set null,
  source_request_id uuid references public.access_requests (id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.document_access_grants is 'สิทธิ์เข้าถึงเอกสารรายบุคคลที่อนุมัติแล้ว — expires_at เป็น null หมายถึงถาวร ตรวจสอบ revoked_at/expires_at ทุกครั้งก่อนออก Signed URL';

create index idx_document_access_grants_research_item on public.document_access_grants (research_item_id);
create index idx_document_access_grants_user on public.document_access_grants (user_id);

-- กันมี active grant ซ้ำซ้อนสำหรับเอกสาร+ผู้ใช้+ประเภทสิทธิ์เดียวกัน
create unique index idx_document_access_grants_active_unique on public.document_access_grants
  (research_item_id, user_id, access_type)
  where revoked_at is null;

create trigger trg_document_access_grants_updated_at
  before update on public.document_access_grants
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. notification_preferences: การตั้งค่าการแจ้งเตือนต่อผู้ใช้ (แถวเดียวต่อคน)
-- ----------------------------------------------------------------------------
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  new_research_in_app_enabled boolean not null default true,
  new_research_email_enabled boolean not null default false,
  access_request_in_app_enabled boolean not null default true,
  access_request_email_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is 'การตั้งค่าการแจ้งเตือนรายผู้ใช้ — ไม่มีแถวหมายถึงใช้ค่าเริ่มต้นทั้งหมด (in-app เปิด, email ปิด)';

create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. category_subscriptions: การติดตามหมวดหมู่เพื่อรับแจ้งงานวิจัยใหม่
-- ----------------------------------------------------------------------------
create table public.category_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index idx_category_subscriptions_user on public.category_subscriptions (user_id);
create index idx_category_subscriptions_category on public.category_subscriptions (category_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.access_requests enable row level security;
alter table public.document_access_grants enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.category_subscriptions enable row level security;

grant select, insert, update on public.access_requests to authenticated;
grant select, insert, update on public.document_access_grants to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, delete on public.category_subscriptions to authenticated;

-- access_requests: เจ้าของคำขอเห็น/สร้างของตัวเอง, librarian/admin ขึ้นไปเห็น
-- ทั้งหมดและจัดการได้ ผู้ใช้ทั่วไปยกเลิกได้เฉพาะคำขอที่ยัง pending ของตัวเอง
-- เท่านั้น (ห้ามแก้ไขสถานะการอนุมัติเอง)
create policy "access_requests_select_own_or_staff" on public.access_requests
  for select using (
    requester_id = auth.uid() or public.user_max_role_rank() >= 30
  );

create policy "access_requests_insert_own" on public.access_requests
  for insert with check (requester_id = auth.uid());

create policy "access_requests_cancel_own" on public.access_requests
  for update using (requester_id = auth.uid() and status = 'pending')
  with check (requester_id = auth.uid() and status = 'cancelled');

-- อนุญาตให้เจ้าของคำขอ "หมดอายุ" คำขอของตัวเองได้ (เฉพาะกรณีที่หมดอายุจริง
-- ตามเวลา) — จำเป็นสำหรับกลไก lazy-expire (expire_stale_access_requests) ที่
-- ไม่ใช่ security definer จึงรันภายใต้สิทธิ์ของผู้เรียกเสมอ ถ้าไม่มี policy นี้
-- สมาชิกทั่วไปที่เข้าหน้า /access-requests เองจะไม่มีสิทธิ์อัปเดตแถวของตัวเอง
-- จาก approved -> expired เลย (ต่างจากเจ้าหน้าที่ที่ผ่าน rank >= 30 อยู่แล้ว)
create policy "access_requests_self_expire" on public.access_requests
  for update using (
    requester_id = auth.uid() and status = 'approved' and access_expires_at < now()
  )
  with check (requester_id = auth.uid() and status = 'expired');

create policy "access_requests_manage_staff" on public.access_requests
  for update using (public.user_max_role_rank() >= 30)
  with check (public.user_max_role_rank() >= 30);

-- document_access_grants: เจ้าของสิทธิ์เห็นของตัวเอง (ใช้ตรวจสอบก่อนออก Signed
-- URL) librarian/admin ขึ้นไปเห็นทั้งหมดและเป็นผู้ออก/เพิกถอนสิทธิ์เท่านั้น —
-- ผู้ใช้ทั่วไปห้าม insert/update สิทธิ์ของตัวเองหรือใครเลย
create policy "document_access_grants_select_own_or_staff" on public.document_access_grants
  for select using (
    user_id = auth.uid() or public.user_max_role_rank() >= 30
  );

create policy "document_access_grants_manage_staff" on public.document_access_grants
  for insert with check (public.user_max_role_rank() >= 30);

create policy "document_access_grants_update_staff" on public.document_access_grants
  for update using (public.user_max_role_rank() >= 30)
  with check (public.user_max_role_rank() >= 30);

-- notification_preferences: เจ้าของจัดการของตัวเองเท่านั้น librarian/admin
-- ขึ้นไป "เห็น" ได้ทั้งหมด (ใช้คำนวณรายชื่อผู้รับอีเมลตอนเผยแพร่งานวิจัยใหม่)
-- แต่แก้ไขของผู้อื่นไม่ได้
create policy "notification_preferences_select_own_or_staff" on public.notification_preferences
  for select using (
    user_id = auth.uid() or public.user_max_role_rank() >= 30
  );

create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert with check (user_id = auth.uid());

create policy "notification_preferences_update_own" on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- category_subscriptions: เจ้าของจัดการของตัวเองเท่านั้น librarian/admin ขึ้น
-- ไป "เห็น" ได้ทั้งหมด (ใช้หารายชื่อผู้ติดตามตอนเผยแพร่งานวิจัยใหม่)
create policy "category_subscriptions_select_own_or_staff" on public.category_subscriptions
  for select using (
    user_id = auth.uid() or public.user_max_role_rank() >= 30
  );

create policy "category_subscriptions_insert_own" on public.category_subscriptions
  for insert with check (user_id = auth.uid());

create policy "category_subscriptions_delete_own" on public.category_subscriptions
  for delete using (user_id = auth.uid());

-- ============================================================================
-- Trigger: แจ้งเตือนผู้ขอเมื่อสถานะคำขอเปลี่ยน (อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม/
-- หมดอายุ) — insert เข้า notifications ได้เฉพาะทางนี้เท่านั้น (security
-- definer) เหมือนรูปแบบเดิมของ log_research_status_change สำหรับ research_items
-- ============================================================================
create or replace function public.notify_access_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
  v_pref_enabled boolean;
  v_title text;
  v_message text;
  v_type text;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status
     and new.status in ('approved', 'rejected', 'more_information_required', 'expired')
  then
    select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
    from public.settings limit 1;

    select coalesce(access_request_in_app_enabled, true) into v_pref_enabled
    from public.notification_preferences where user_id = new.requester_id;

    if coalesce(v_notify_enabled, true) and coalesce(v_pref_enabled, true) then
      select title_th into v_title from public.research_items where id = new.research_item_id;

      v_type := case
        when new.status = 'approved' then 'success'
        when new.status = 'rejected' then 'warning'
        else 'info'
      end;

      v_message := case
        when new.status = 'approved' then
          format('คำขอสิทธิ์%sเอกสาร "%s" ได้รับการอนุมัติแล้ว',
            case when new.request_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end, v_title)
        when new.status = 'rejected' then
          format('คำขอสิทธิ์%sเอกสาร "%s" ถูกปฏิเสธ',
            case when new.request_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end, v_title)
        when new.status = 'more_information_required' then
          format('เจ้าหน้าที่ขอข้อมูลเพิ่มเติมสำหรับคำขอเข้าถึงเอกสาร "%s"', v_title)
        else
          format('สิทธิ์เข้าถึงเอกสาร "%s" ที่เคยอนุมัติหมดอายุแล้ว', v_title)
      end;

      insert into public.notifications (user_id, title, message, type, research_id)
      values (new.requester_id, 'อัปเดตคำขอเข้าถึงเอกสาร', v_message, v_type, new.research_item_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_access_requests_notify
  after update on public.access_requests
  for each row execute function public.notify_access_request_status_change();

-- ============================================================================
-- Trigger: แจ้งเตือนเจ้าหน้าที่ (librarian/admin/super_admin) ทุกครั้งที่มี
-- คำขอเข้าถึงเอกสารใหม่เข้ามา (in-app เท่านั้น — สเปกไม่ได้กำหนดให้ส่งอีเมลแจ้ง
-- เจ้าหน้าที่ทุกคนต่อคำขอหนึ่งครั้ง ต่างจากการแจ้งผู้ขอตอนอนุมัติ/ปฏิเสธที่ส่ง
-- อีเมลได้เพราะมีผู้รับแค่คนเดียว)
-- ============================================================================
create or replace function public.notify_staff_new_access_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
  v_title text;
begin
  select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
  from public.settings limit 1;

  if coalesce(v_notify_enabled, true) then
    select title_th into v_title from public.research_items where id = new.research_item_id;

    insert into public.notifications (user_id, title, message, type, research_id)
    select distinct
      ur.user_id,
      'มีคำขอเข้าถึงเอกสารใหม่',
      format('มีคำขอสิทธิ์%sเอกสาร "%s" รอตรวจสอบ',
        case when new.request_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end, v_title),
      'info',
      new.research_item_id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join public.notification_preferences np on np.user_id = ur.user_id
    where r.rank >= 30
      and coalesce(np.access_request_in_app_enabled, true);
  end if;
  return new;
end;
$$;

create trigger trg_access_requests_notify_staff
  after insert on public.access_requests
  for each row execute function public.notify_staff_new_access_request();

-- ============================================================================
-- Trigger: แจ้งเตือนผู้ใช้เมื่อสิทธิ์ที่เคยได้รับถูกเจ้าหน้าที่เพิกถอน (in-app)
-- ============================================================================
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
begin
  if tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    select coalesce(notifications_in_app_enabled, true) into v_notify_enabled
    from public.settings limit 1;

    select coalesce(access_request_in_app_enabled, true) into v_pref_enabled
    from public.notification_preferences where user_id = new.user_id;

    if coalesce(v_notify_enabled, true) and coalesce(v_pref_enabled, true) then
      select title_th into v_title from public.research_items where id = new.research_item_id;

      insert into public.notifications (user_id, title, message, type, research_id)
      values (
        new.user_id,
        'สิทธิ์เข้าถึงเอกสารถูกเพิกถอน',
        format('สิทธิ์%sเอกสาร "%s" ของคุณถูกเพิกถอนแล้ว%s',
          case when new.access_type = 'read' then 'อ่าน' else 'ดาวน์โหลด' end,
          v_title,
          case when new.revoke_reason is not null and new.revoke_reason != ''
            then format(' (เหตุผล: %s)', new.revoke_reason) else '' end
        ),
        'warning',
        new.research_item_id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_document_access_grants_notify_revoke
  after update on public.document_access_grants
  for each row execute function public.notify_access_grant_revoked();

-- ============================================================================
-- ขยาย log_research_status_change() ให้แจ้งเตือนผู้ติดตามหมวดหมู่ (in-app)
-- ทุกครั้งที่งานวิจัยเปลี่ยนสถานะเป็น "published" (ใช้ trigger เดิมที่ผูกไว้
-- แล้วบน research_items ตั้งแต่ Phase 3 — ไม่สร้าง trigger ใหม่) หลีกเลี่ยงแจ้ง
-- ซ้ำด้วย "insert ... select distinct" เนื่องจากเอกสารหนึ่งอาจอยู่หลายหมวดหมู่
-- ส่วนอีเมลส่งจากฝั่งแอปพลิเคชัน (Server Action) เนื่องจาก trigger เรียก HTTP
-- ไม่ได้ — ดู lib/notifications/category-subscribers.server.ts
-- ============================================================================
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

    if coalesce(v_notify_enabled, true) and new.status = 'published' then
      insert into public.notifications (user_id, title, message, type, research_id)
      select distinct
        cs.user_id,
        'มีงานวิจัยใหม่ในหมวดหมู่ที่คุณติดตาม',
        format('งานวิจัยใหม่ "%s" เผยแพร่แล้วในหมวดหมู่ที่คุณติดตาม', new.title_th),
        'info',
        new.id
      from public.category_subscriptions cs
      join public.research_categories rc on rc.category_id = cs.category_id
      left join public.notification_preferences np on np.user_id = cs.user_id
      where rc.research_id = new.id
        and coalesce(np.new_research_in_app_enabled, true)
        and cs.user_id is distinct from new.submitted_by;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- expire_stale_access_requests(): เปลี่ยนคำขอที่ approved แต่สิทธิ์หมดอายุแล้ว
-- ให้เป็น expired — ไม่มีโครงสร้าง job queue/cron ในโปรเจกต์นี้ จึงเรียกฟังก์ชัน
-- นี้แบบ "lazy" ทุกครั้งที่มีการอ่านรายการคำขอ (ทั้งฝั่งสมาชิกและเจ้าหน้าที่)
-- RLS ของ access_requests_cancel_own/access_requests_manage_staff ยังคุมสิทธิ์
-- การ update อยู่ตามปกติ ฟังก์ชันนี้แค่รวมเงื่อนไข "หมดอายุจริง" ไว้ที่เดียว
-- ============================================================================
create or replace function public.expire_stale_access_requests()
returns void
language sql
as $$
  update public.access_requests
  set status = 'expired'
  where status = 'approved'
    and access_expires_at is not null
    and access_expires_at < now();
$$;

grant execute on function public.expire_stale_access_requests() to authenticated;

comment on function public.expire_stale_access_requests is
  'เปลี่ยนคำขอที่อนุมัติแล้วแต่สิทธิ์หมดอายุให้เป็น expired — RLS ของ access_requests เดิมจำกัดว่าแต่ละคนแก้ไขแถวไหนได้จริง ฟังก์ชันนี้ไม่ได้ security definer จึงยังถูก RLS บังคับตามผู้เรียกเสมอ';
