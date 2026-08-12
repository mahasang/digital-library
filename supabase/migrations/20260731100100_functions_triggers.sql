-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 2: Functions & Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- set_updated_at(): trigger function สำหรับอัปเดตคอลัมน์ updated_at อัตโนมัติ
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_authors_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

create trigger trg_research_items_updated_at
  before update on public.research_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- research_items: ตั้ง published_at อัตโนมัติเมื่อสถานะเปลี่ยนเป็น published
-- ----------------------------------------------------------------------------
create or replace function public.set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger trg_research_items_published_at
  before update on public.research_items
  for each row execute function public.set_published_at();

-- ----------------------------------------------------------------------------
-- handle_new_user(): สร้างแถว profiles + กำหนดบทบาทเริ่มต้นเป็น member
-- โดยอัตโนมัติทันทีที่มีผู้สมัครสมาชิกใหม่ผ่าน Supabase Auth
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_role_id uuid;
begin
  insert into public.profiles (id, full_name, email, organization_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'organization'
  )
  on conflict (id) do nothing;

  select id into member_role_id from public.roles where name = 'member';

  if member_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, member_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- user_max_role_rank(): rank สูงสุดของบทบาทผู้ใช้ที่ระบุ (0 หากไม่มีบทบาทใดเลย)
-- ใช้เป็นแกนหลักของ RLS Policies ทั้งหมด
-- ----------------------------------------------------------------------------
create or replace function public.user_max_role_rank(uid uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(r.rank), 0)::integer
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = uid;
$$;

-- ----------------------------------------------------------------------------
-- increment_research_views(): เพิ่มยอดเข้าชม ผ่าน SECURITY DEFINER function
-- เพื่อไม่ต้องเปิดสิทธิ์ UPDATE ตรงบนตาราง research_items ให้ผู้ใช้ทั่วไป
-- ----------------------------------------------------------------------------
create or replace function public.increment_research_views(p_research_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.research_items
  set views = views + 1
  where id = p_research_id and status = 'published';
end;
$$;

-- ----------------------------------------------------------------------------
-- log_research_download(): เพิ่มยอดดาวน์โหลด + บันทึกลง download_logs
-- รับ slug แทน uuid เนื่องจากฝั่ง client เห็นเฉพาะ slug (id ที่ใช้ใน URL)
-- ----------------------------------------------------------------------------
create or replace function public.log_research_download(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_research_id uuid;
begin
  select id into v_research_id
  from public.research_items
  where slug = p_slug
    and status = 'published'
    and access_level not in ('read_only', 'metadata_only');

  if v_research_id is null then
    return;
  end if;

  update public.research_items
  set downloads = downloads + 1
  where id = v_research_id;

  insert into public.download_logs (research_id, user_id)
  values (v_research_id, auth.uid());
end;
$$;

-- ----------------------------------------------------------------------------
-- log_reading_history(): บันทึกประวัติการอ่านออนไลน์ (เฉพาะผู้ใช้ที่เข้าสู่ระบบ)
-- ----------------------------------------------------------------------------
create or replace function public.log_reading_history(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_research_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  select id into v_research_id
  from public.research_items
  where slug = p_slug and status = 'published';

  if v_research_id is null then
    return;
  end if;

  insert into public.reading_history (research_id, user_id)
  values (v_research_id, auth.uid());
end;
$$;
