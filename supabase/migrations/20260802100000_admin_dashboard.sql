-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 4: ส่วนเจ้าหน้าที่/ผู้ดูแล
--
-- เพิ่ม:
--   1. profiles.is_active — เปิด/ปิดสถานะบัญชี (soft, ไม่ลบข้อมูล)
--   2. categories.parent_id/is_active — หมวดหมู่หลัก/ย่อย และปิดใช้งานได้
--   3. organizations.is_active — ปิดใช้งานได้โดยไม่ลบ
--   4. ตาราง settings — ตั้งค่าองค์กร/หน้าแรกแบบแถวเดียว (singleton)
--   5. RLS เพิ่มเติมให้ admin จัดการ profiles/settings ได้
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: เปิด/ปิดสถานะบัญชี
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column is_active boolean not null default true;

comment on column public.profiles.is_active is 'สถานะบัญชี — false = ถูกระงับโดยผู้ดูแลระบบ (soft, ไม่ลบข้อมูล) ต้องใช้คู่กับการ ban ผ่าน Supabase Auth Admin API เพื่อบล็อกการเข้าสู่ระบบจริง';

-- ----------------------------------------------------------------------------
-- categories: หมวดหมู่หลัก/ย่อย และปิดใช้งานได้โดยไม่ลบ
-- ----------------------------------------------------------------------------
alter table public.categories
  add column parent_id uuid references public.categories (id) on delete set null,
  add column is_active boolean not null default true;

comment on column public.categories.parent_id is 'หมวดหมู่หลัก (null = เป็นหมวดหมู่หลักเอง)';
comment on column public.categories.is_active is 'false = ปิดใช้งาน ไม่แสดงในหน้าเว็บสาธารณะ แต่ข้อมูลเดิมยังอยู่';

create index idx_categories_parent_id on public.categories (parent_id);

-- ----------------------------------------------------------------------------
-- organizations: ปิดใช้งานได้โดยไม่ลบ
-- ----------------------------------------------------------------------------
alter table public.organizations
  add column is_active boolean not null default true;

comment on column public.organizations.is_active is 'false = ปิดใช้งาน ไม่แสดงเป็นตัวเลือกในฟอร์มส่งงานวิจัย แต่ข้อมูลเดิมยังอยู่';

-- ----------------------------------------------------------------------------
-- settings: ตั้งค่าองค์กร/การแสดงผลหน้าแรก — เก็บเป็นแถวเดียว (singleton)
-- ----------------------------------------------------------------------------
create table public.settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  site_name text not null default 'ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร',
  logo_url text,
  contact_email text,
  contact_phone text,
  contact_address text,
  copyright_text text,
  homepage_latest_count smallint not null default 8 check (homepage_latest_count between 1 and 24),
  homepage_popular_count smallint not null default 8 check (homepage_popular_count between 1 and 24),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

comment on table public.settings is 'ตั้งค่าองค์กรและการแสดงผลหน้าแรก — มีแถวเดียวเสมอ (singleton บังคับด้วย constraint)';

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (id) values ('00000000-0000-0000-0000-000000000001'::uuid);

alter table public.settings enable row level security;

grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;

create policy "settings_select_all" on public.settings
  for select using (true);

create policy "settings_update_admin" on public.settings
  for update using (public.user_max_role_rank() >= 40)
  with check (public.user_max_role_rank() >= 40);

-- ----------------------------------------------------------------------------
-- profiles: เพิ่มสิทธิ์ admin แก้ไขโปรไฟล์ผู้อื่นได้ (สำหรับเปิด/ปิดบัญชี
-- และมอบหมายหน่วยงาน) — เดิมมีเฉพาะ "แก้ไขของตัวเอง"
-- ----------------------------------------------------------------------------
create policy "profiles_update_admin" on public.profiles
  for update using (public.user_max_role_rank() >= 40)
  with check (public.user_max_role_rank() >= 40);
