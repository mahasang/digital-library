-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 7: Super Admin ส่วนที่ 2
-- Users / Roles / System Settings / Security / Storage / Notifications
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ขยายตาราง settings — ฟิลด์ใหม่ทั้งหมดในหมวดนี้แก้ไขได้เฉพาะ super_admin
--    (rank >= 50) เท่านั้น ผ่าน trigger ด้านล่าง (คอลัมน์เดิม site_name/
--    logo_url/contact_*/copyright_text/homepage_*_count ยังแก้ไขได้โดย admin
--    rank >= 40 เหมือนเดิมทุกประการผ่าน /dashboard/settings — ไม่มีสิทธิ์เดิม
--    ถูกริบ)
-- ----------------------------------------------------------------------------
alter table public.settings
  add column favicon_url text,
  add column social_facebook text,
  add column social_twitter text,
  add column social_line text,
  add column registration_enabled boolean not null default true,
  add column submission_enabled boolean not null default true,
  add column default_research_status text not null default 'draft'
    check (default_research_status in ('draft', 'pending_review')),
  add column captcha_enabled boolean not null default false,
  add column notifications_in_app_enabled boolean not null default true,
  add column notifications_email_enabled boolean not null default false,
  add column max_pdf_size_mb smallint not null default 50 check (max_pdf_size_mb between 1 and 200),
  add column max_cover_size_mb smallint not null default 5 check (max_cover_size_mb between 1 and 20),
  add column max_attachment_size_mb smallint not null default 20 check (max_attachment_size_mb between 1 and 100),
  add column rate_limit_register_max smallint not null default 5 check (rate_limit_register_max between 1 and 100),
  add column rate_limit_register_window_sec integer not null default 600 check (rate_limit_register_window_sec between 60 and 86400),
  add column rate_limit_submit_max smallint not null default 10 check (rate_limit_submit_max between 1 and 100),
  add column rate_limit_submit_window_sec integer not null default 600 check (rate_limit_submit_window_sec between 60 and 86400);

comment on column public.settings.registration_enabled is 'ปิดไว้ = ปิดรับสมัครสมาชิกใหม่ทั้งระบบ (registerAction ตรวจสอบก่อนเสมอ)';
comment on column public.settings.submission_enabled is 'ปิดไว้ = ปิดรับส่งงานวิจัยใหม่ทั้งระบบ (submitResearchAction ตรวจสอบก่อนเสมอ)';
comment on column public.settings.default_research_status is 'สถานะเริ่มต้นเมื่อ intent ที่ส่งมาไม่ถูกต้อง/ไม่ระบุ (draft หรือ pending_review เท่านั้น)';
comment on column public.settings.max_pdf_size_mb is 'ขนาดสูงสุดของไฟล์ PDF (MB) — เมื่อบันทึกจะอัปเดต storage.buckets.file_size_limit ของ research-documents ด้วย';

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
    new.rate_limit_submit_window_sec is distinct from old.rate_limit_submit_window_sec
  ) then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะแก้ไขการตั้งค่านี้ได้' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_superadmin_settings_columns on public.settings;
create trigger trg_protect_superadmin_settings_columns
  before update on public.settings
  for each row execute function public.protect_superadmin_settings_columns();

-- ----------------------------------------------------------------------------
-- 2. Bucket ใหม่สำหรับโลโก้/favicon — public, เขียนได้เฉพาะ super_admin
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets', 'site-assets', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "site_assets_select_all" on storage.objects
  for select using (bucket_id = 'site-assets');

create policy "site_assets_manage_super_admin" on storage.objects
  for all using (bucket_id = 'site-assets' and public.user_max_role_rank() >= 50)
  with check (bucket_id = 'site-assets' and public.user_max_role_rank() >= 50);

-- ----------------------------------------------------------------------------
-- 3. Rate limiting แบบ DB-backed (ไม่ต้องพึ่งบริการภายนอกที่มีค่าใช้จ่าย)
--    เข้าถึงได้เฉพาะผ่านฟังก์ชัน security definer เท่านั้น ไม่เปิด grant
--    ตารางตรงให้ anon/authenticated
-- ----------------------------------------------------------------------------
create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_events_key_created on public.rate_limit_events (rate_key, created_at desc);
alter table public.rate_limit_events enable row level security;
-- ไม่มี policy ใดๆ ให้ anon/authenticated โดยเจตนา — เข้าถึงได้ผ่าน
-- check_rate_limit() (security definer) เท่านั้น ป้องกันการอ่าน/แก้ไขตรง

create or replace function public.check_rate_limit(p_key text, p_max_attempts int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_events
  where rate_key = p_key and created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count from public.rate_limit_events
  where rate_key = p_key and created_at >= now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_max_attempts then
    return false;
  end if;

  insert into public.rate_limit_events (rate_key) values (p_key);
  return true;
end;
$$;

comment on function public.check_rate_limit is
  'true = อนุญาตให้ทำต่อ, false = เกินขีดจำกัด — เรียกก่อนดำเนินการจริงเสมอ (fail-open ถ้า error เพื่อไม่ให้ rate limiter เองกลายเป็นจุดล่มของฟีเจอร์หลัก)';

grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. การแจ้งเตือนในระบบ (in-app notifications) — insert ได้เฉพาะผ่าน trigger
--    (log_research_status_change ด้านล่าง) ผู้ใช้อ่าน/ทำเครื่องหมายอ่านแล้ว
--    เฉพาะของตัวเอง
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning')),
  research_id uuid references public.research_items (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. ขยาย log_research_status_change() ให้สร้าง in-app notification ให้ผู้ส่ง
--    ทุกครั้งที่สถานะเปลี่ยน (ใช้ trigger เดิมที่ผูกไว้แล้วตั้งแต่ Phase 3 —
--    ไม่ต้องสร้าง trigger ใหม่) เคารพการตั้งค่า notifications_in_app_enabled
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 6. superadmin_orphaned_storage_objects(): หาไฟล์ใน Storage ที่ไม่มีแถวใด
--    ในฐานข้อมูลอ้างอิงถึงอีกต่อไป (ไฟล์เก่าที่ถูกแทนที่ตอนแก้ไข หรือ
--    อัปโหลดค้างไว้ไม่เคยบันทึกสำเร็จ) — security definer เพราะ storage.objects
--    อยู่นอก schema public
-- ----------------------------------------------------------------------------
create or replace function public.superadmin_orphaned_storage_objects(p_bucket_id text)
returns table (name text, size_bytes bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_bucket_id = 'research-documents' then
    return query
      select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
      from storage.objects o
      where o.bucket_id = p_bucket_id
        and o.name not in (
          select pdf_file from public.research_items where pdf_file is not null
        );
  elsif p_bucket_id = 'submission-attachments' then
    return query
      select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
      from storage.objects o
      where o.bucket_id = p_bucket_id
        and o.name not in (
          select attachment_file from public.research_items where attachment_file is not null
        );
  elsif p_bucket_id = 'research-covers' then
    return query
      select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
      from storage.objects o
      where o.bucket_id = p_bucket_id
        and not exists (
          select 1 from public.research_items ri
          where ri.cover_image is not null and ri.cover_image like '%' || o.name
        );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. superadmin_update_bucket_limit(): ปรับ file_size_limit ของ Storage bucket
--    ให้ตรงกับค่าที่ตั้งในหน้า System Settings — security definer เพราะ
--    storage.buckets แก้ไขได้เฉพาะผ่าน service role/superuser ตามปกติ
--    ตรวจสอบ rank ภายในฟังก์ชันเอง (ต่างจากฟังก์ชันอ่านอย่างเดียวด้านบน)
--    เพราะเป็นการเขียนข้อมูลที่กระทบผู้ใช้ทั้งระบบ
-- ----------------------------------------------------------------------------
create or replace function public.superadmin_update_bucket_limit(
  p_bucket_id text, p_size_limit_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะแก้ไขขีดจำกัดของ Storage bucket ได้'
      using errcode = 'P0001';
  end if;

  if p_bucket_id not in ('research-documents', 'research-covers', 'submission-attachments') then
    raise exception 'ไม่รู้จัก bucket นี้';
  end if;

  update storage.buckets set file_size_limit = p_size_limit_bytes where id = p_bucket_id;
end;
$$;

grant execute on function public.superadmin_update_bucket_limit(text, bigint) to authenticated;

comment on function public.superadmin_orphaned_storage_objects is
  'หาไฟล์ที่ไม่มีการอ้างอิงในฐานข้อมูลอีกต่อไป — เป็นเครื่องมือประมาณการ (best-effort) '
  'ไม่ใช่การรับประกันความถูกต้อง 100% โดยเฉพาะ research-covers ที่เทียบจาก URL แบบ suffix match';

grant execute on function public.superadmin_orphaned_storage_objects(text) to authenticated;
