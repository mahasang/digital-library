-- ============================================================================
-- Phase 26: ตั้งค่าการแจ้งเตือนก่อนสิทธิ์หมดอายุแบบไดนามิก (แทนค่าคงที่เดิม
-- NEAR_EXPIRY_WARNING_WINDOW_DAYS ใน lib/jobs/handlers/access-expiration.server.ts)
-- + เพิ่มช่องทางอีเมลที่ไม่เคยมีมาก่อนสำหรับฟีเจอร์นี้โดยเฉพาะ — ไม่มีการเปลี่ยน
-- กลไกตรวจสอบ expires_at ตอนสร้าง Signed URL แม้แต่บรรทัดเดียว (คนละกลไกกัน
-- โดยสิ้นเชิง ดู lib/data/access-grants.server.ts)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. settings: เพิ่มค่าที่ Super Admin ปรับได้ 3 ค่า — รูปแบบเดียวกับ
-- homepage_latest_count/max_pdf_size_mb/rate_limit_register_max เดิมทุกประการ
-- (smallint + check ช่วงค่า) toggle ทั้งสองเป็น "ชั้นเพิ่มเติม" ที่ทำงานร่วมกับ
-- (ไม่ใช่แทนที่) มาสเตอร์สวิตช์รวม notifications_in_app_enabled/
-- notifications_email_enabled เดิม — รูปแบบเดียวกับที่ notification_preferences
-- (ต่อผู้ใช้) ทำงานร่วมกับมาสเตอร์สวิตช์เดิมสำหรับฟีเจอร์ขอสิทธิ์เข้าถึงเอกสาร
-- ----------------------------------------------------------------------------
alter table public.settings
  add column access_expiration_warning_days smallint not null default 3
    check (access_expiration_warning_days between 1 and 30),
  add column access_expiration_warning_in_app_enabled boolean not null default true,
  add column access_expiration_warning_email_enabled boolean not null default false;

comment on column public.settings.access_expiration_warning_days is
  'จำนวนวันล่วงหน้าก่อนสิทธิ์เข้าถึงเอกสารหมดอายุที่จะเริ่มแจ้งเตือน (1-30, ค่าเริ่มต้น 3) — อ่านค่านี้แบบไดนามิกใน lib/jobs/handlers/access-expiration.server.ts แทนค่าคงที่เดิม หากอ่านค่าไม่ได้ (Supabase ยังไม่ได้ตั้งค่า) ให้ fallback เป็น 3 เสมอ';
comment on column public.settings.access_expiration_warning_in_app_enabled is
  'เปิด/ปิดการแจ้งเตือนใกล้หมดอายุแบบ in-app เฉพาะฟีเจอร์นี้ — เป็นชั้นเพิ่มเติมจาก notifications_in_app_enabled (มาสเตอร์สวิตช์รวม) ต้องเปิดพร้อมกันทั้งคู่จึงจะแจ้งจริง';
comment on column public.settings.access_expiration_warning_email_enabled is
  'เปิด/ปิดอีเมลแจ้งใกล้หมดอายุเฉพาะฟีเจอร์นี้ — เดิมไม่มีช่องทางอีเมลสำหรับฟีเจอร์นี้เลย ต้องเปิดพร้อมกับ notifications_email_enabled (มาสเตอร์สวิตช์รวม) และผู้ใช้ต้องไม่ปิด notification_preferences.access_request_email_enabled ของตัวเองด้วย (ใช้ preference เดิมร่วมกับคำขอเข้าถึงเอกสาร ไม่เพิ่มคอลัมน์ preference ใหม่)';

-- ----------------------------------------------------------------------------
-- 2. protect_superadmin_settings_columns(): ต้องเพิ่มคอลัมน์ใหม่ทั้ง 3 เข้าไป
-- ในรายการที่ตรวจสอบด้วย มิฉะนั้น Admin (rank 40, ผ่าน RLS settings_update_admin
-- เดิมอยู่แล้ว) จะแก้ไขคอลัมน์ใหม่เหล่านี้ได้โดยไม่ต้องมีสิทธิ์ Super Admin ทั้งที่
-- ตั้งใจให้เป็นการตั้งค่าระดับ Super Admin เท่านั้น — คัดลอกเงื่อนไขเดิมทั้งหมด
-- มาครบ ไม่มีการตัดออกแม้แต่ข้อเดียว (return type เดิมเป็น trigger ไม่เปลี่ยน
-- จึงใช้ create or replace ได้ตรงๆ ไม่ต้อง drop function ก่อน)
-- ----------------------------------------------------------------------------
create or replace function public.protect_superadmin_settings_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_max_role_rank() < 50 and (
    new.favicon_url is distinct from old.favicon_url or
    new.social_facebook is distinct from old.social_facebook or
    new.social_twitter is distinct from old.social_twitter or
    new.social_line is distinct from old.social_line or
    new.registration_enabled is distinct from old.registration_enabled or
    new.submission_enabled is distinct from old.submission_enabled or
    new.default_research_status is distinct from old.default_research_status or
    new.captcha_enabled is distinct from old.captcha_enabled or
    new.notifications_in_app_enabled is distinct from old.notifications_in_app_enabled or
    new.notifications_email_enabled is distinct from old.notifications_email_enabled or
    new.max_pdf_size_mb is distinct from old.max_pdf_size_mb or
    new.max_cover_size_mb is distinct from old.max_cover_size_mb or
    new.max_attachment_size_mb is distinct from old.max_attachment_size_mb or
    new.rate_limit_register_max is distinct from old.rate_limit_register_max or
    new.rate_limit_register_window_sec is distinct from old.rate_limit_register_window_sec or
    new.rate_limit_submit_max is distinct from old.rate_limit_submit_max or
    new.rate_limit_submit_window_sec is distinct from old.rate_limit_submit_window_sec or
    new.access_expiration_warning_days is distinct from old.access_expiration_warning_days or
    new.access_expiration_warning_in_app_enabled is distinct from old.access_expiration_warning_in_app_enabled or
    new.access_expiration_warning_email_enabled is distinct from old.access_expiration_warning_email_enabled
  ) then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะแก้ไขการตั้งค่านี้ได้' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. warn_expiring_access_grants(): เปลี่ยน return type จาก void เป็น
-- TABLE(...) เพื่อให้ TypeScript รู้ว่ามีสิทธิ์ใดที่เพิ่งถูกแจ้งเตือนในรอบนี้บ้าง
-- (ใช้ส่งอีเมลต่อ — เดิมไม่มีช่องทางอีเมลสำหรับฟีเจอร์นี้เลย) ต้อง drop ก่อน
-- เพราะ Postgres ไม่ยอมให้ create or replace เปลี่ยน return type
--
-- กลไก dedup เดิมยังคงเหมือนเดิมทุกประการ (UPDATE ... WHERE expiry_warned_at
-- IS NULL แบบ atomic) — in-app และอีเมลใช้ผลลัพธ์ "due" ชุดเดียวกันจาก RPC
-- เรียกครั้งเดียว จึงกันแจ้งซ้ำให้ทั้งสองช่องทางพร้อมกันโดยธรรมชาติ ไม่ต้องเพิ่ม
-- คอลัมน์ dedup แยกสำหรับอีเมล
-- ----------------------------------------------------------------------------
drop function if exists public.warn_expiring_access_grants(int);

create function public.warn_expiring_access_grants(p_window_days int default 3)
returns table (
  grant_id uuid,
  user_id uuid,
  research_item_id uuid,
  access_type text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_enabled boolean;
  v_feature_in_app_enabled boolean;
begin
  select coalesce(notifications_in_app_enabled, true), coalesce(access_expiration_warning_in_app_enabled, true)
  into v_notify_enabled, v_feature_in_app_enabled
  from public.settings
  limit 1;

  -- หมายเหตุสำคัญ: ต้อง qualify ทุกคอลัมน์ด้วย alias เสมอในฟังก์ชันนี้ (dag.xxx
  -- ไม่ใช่ xxx เฉยๆ) เพราะ RETURNS TABLE ด้านบนสร้างตัวแปรโดยนัย (grant_id,
  -- user_id, research_item_id, access_type, expires_at) ที่ชื่อชนกับคอลัมน์จริง
  -- ของ document_access_grants พอดี — ถ้าไม่ qualify Postgres จะ error
  -- "column reference is ambiguous" เพราะแยกไม่ออกว่าหมายถึงตัวแปร OUT
  -- parameter หรือคอลัมน์จริงของตาราง (ยืนยันจากการทดสอบจริง)
  return query
  with due as (
    update public.document_access_grants dag
    set expiry_warned_at = now()
    where dag.revoked_at is null
      and dag.expires_at is not null
      and dag.expires_at > now()
      and dag.expires_at <= now() + (p_window_days || ' days')::interval
      and dag.expiry_warned_at is null
    returning dag.id, dag.user_id, dag.research_item_id, dag.access_type, dag.expires_at
  ),
  ins as (
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
    where coalesce(v_notify_enabled, true)
      and coalesce(v_feature_in_app_enabled, true)
      and coalesce(np.access_request_in_app_enabled, true)
    returning 1
  )
  select d.id, d.user_id, d.research_item_id, d.access_type, d.expires_at
  from due d;
end;
$$;

grant execute on function public.warn_expiring_access_grants(int) to service_role;

comment on function public.warn_expiring_access_grants is
  'แจ้งเตือนล่วงหน้าก่อนสิทธิ์เข้าถึงเอกสารหมดอายุ — p_window_days ควรมาจาก settings.access_expiration_warning_days ที่อ่านฝั่ง TypeScript (lib/jobs/handlers/access-expiration.server.ts) ไม่ใช่ค่าคงที่ กันแจ้งซ้ำด้วย document_access_grants.expiry_warned_at แบบ atomic คืนค่าแถวที่เพิ่งแจ้งในรอบนี้เพื่อให้ TypeScript ส่งอีเมลต่อได้ (ดู lib/notifications/access-request-email.server.ts::notifyExpiringAccessGrantsByEmail) — ไม่กระทบการตรวจสอบ expires_at ตอนสร้าง Signed URL เลย (คนละกลไกกัน ดู lib/data/access-grants.server.ts)';
