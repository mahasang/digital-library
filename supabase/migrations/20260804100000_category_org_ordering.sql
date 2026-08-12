-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 12: จัดลำดับหมวดหมู่/
-- หน่วยงานแบบลากวาง (drag-and-drop) สำหรับ Super Admin
--
-- เพิ่ม:
--   1. categories.sort_order / organizations.sort_order — ลำดับการแสดงผล
--      (categories เรียงภายในกลุ่มเดียวกัน คือ parent_id เดียวกัน)
--   2. backfill ค่าเริ่มต้นให้ข้อมูลเดิมตามลำดับ created_at เดิม (ไม่กระทบ
--      ลำดับที่แสดงผลอยู่ในปัจจุบัน เพราะหน้าเว็บเดิมเรียงตาม name_th ไม่ใช่
--      created_at — แต่การ backfill ตาม created_at เป็นค่าเริ่มต้นที่สมเหตุสมผล
--      และปลอดภัยที่สุดสำหรับข้อมูลที่ยังไม่เคยมีแนวคิด "ลำดับ" มาก่อน)
--   3. trigger ป้องกันการสร้างความสัมพันธ์ parent-child แบบวนซ้ำใน categories
--      (ทำงานทั้งจาก /dashboard/categories เดิมและ /superadmin/categories ใหม่
--      เพราะเป็น trigger ระดับตาราง ไม่ผูกกับ entry point ใดจุดหนึ่ง)
--   4. trigger จำกัดการแก้ไข sort_order ให้เฉพาะ Super Admin (rank >= 50)
--      เท่านั้น — คอลัมน์อื่นของ categories/organizations ยังแก้ไขได้โดย
--      librarian/admin (rank >= 30) เหมือนเดิมทุกประการ ไม่กระทบสิทธิ์เดิม
--   5. trigger กำหนด sort_order อัตโนมัติให้แถวใหม่ (ต่อท้ายกลุ่มเดิมเสมอ) —
--      ทำให้ createCategoryAction/createOrganizationAction เดิมไม่ต้องแก้โค้ด
--      เลยแม้แต่บรรทัดเดียว
--   6. ฟังก์ชัน RPC สำหรับจัดลำดับ/ย้ายหมวดหมู่ (security definer, ตรวจสอบ
--      rank >= 50 เอง, ทำงานเป็น transaction เดียวจบในตัว)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. เพิ่มคอลัมน์ sort_order
-- ----------------------------------------------------------------------------
alter table public.categories
  add column sort_order integer not null default 0;
alter table public.organizations
  add column sort_order integer not null default 0;

comment on column public.categories.sort_order is 'ลำดับการแสดงผล เรียงภายในกลุ่ม parent_id เดียวกัน — แก้ไขได้เฉพาะ Super Admin (บังคับด้วย trigger)';
comment on column public.organizations.sort_order is 'ลำดับการแสดงผล — แก้ไขได้เฉพาะ Super Admin (บังคับด้วย trigger)';

-- ----------------------------------------------------------------------------
-- 2. Backfill ค่าเริ่มต้นให้ข้อมูลเดิมตามลำดับ created_at (ต้องทำก่อนสร้าง
--    trigger ป้องกันการแก้ไข sort_order ด้านล่าง เพราะ migration รันในบริบทที่
--    ไม่มี auth.uid() — user_max_role_rank() จะคืนค่า 0 เสมอ ถ้า trigger มีผล
--    อยู่แล้วตอนนี้จะบล็อกการ backfill ของ migration เอง)
-- ----------------------------------------------------------------------------
with ranked as (
  select id, row_number() over (partition by parent_id order by created_at) - 1 as rn
  from public.categories
)
update public.categories c set sort_order = ranked.rn
from ranked where ranked.id = c.id;

with ranked as (
  select id, row_number() over (order by created_at) - 1 as rn
  from public.organizations
)
update public.organizations o set sort_order = ranked.rn
from ranked where ranked.id = o.id;

-- ----------------------------------------------------------------------------
-- 3. Index สำหรับเรียงลำดับ
-- ----------------------------------------------------------------------------
create index idx_categories_sort_order on public.categories (parent_id, sort_order);
create index idx_organizations_sort_order on public.organizations (sort_order);

-- ----------------------------------------------------------------------------
-- 4. ป้องกันการสร้างความสัมพันธ์ parent-child แบบวนซ้ำ (circular reference)
--    ทำงานเป็น trigger ระดับตาราง — ครอบคลุมทั้งการแก้ไขผ่าน
--    /dashboard/categories (dropdown เดิม, rank >= 30) และการย้ายผ่าน
--    /superadmin/categories (ลากวางใหม่, rank >= 50) ด้วยจุดเดียว
-- ----------------------------------------------------------------------------
create or replace function public.prevent_category_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid;
  v_depth integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'หมวดหมู่ไม่สามารถเป็นหมวดหมู่หลักของตัวเองได้' using errcode = 'P0001';
  end if;

  v_current := new.parent_id;
  while v_current is not null and v_depth < 100 loop
    if v_current = new.id then
      raise exception 'ไม่สามารถกำหนดหมวดหมู่หลักแบบวนกลับมาที่ตัวเองได้ (circular reference)' using errcode = 'P0001';
    end if;
    select parent_id into v_current from public.categories where id = v_current;
    v_depth := v_depth + 1;
  end loop;

  return new;
end;
$$;

comment on function public.prevent_category_cycle is
  'ป้องกันไม่ให้ categories.parent_id สร้าง cycle (เช่น A เป็นหลักของ B, B เป็นหลักของ A) ทำงานทุกเส้นทางที่แก้ไข parent_id';

drop trigger if exists trg_prevent_category_cycle on public.categories;
create trigger trg_prevent_category_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.prevent_category_cycle();

-- ----------------------------------------------------------------------------
-- 5. จำกัดการแก้ไข sort_order ให้เฉพาะ Super Admin (rank >= 50) — คอลัมน์อื่น
--    ของ categories/organizations ยังแก้ไขได้โดย librarian/admin (rank >= 30)
--    ผ่าน RLS Policy เดิมทุกประการ ไม่กระทบสิทธิ์เดิมแต่อย่างใด (ใช้ trigger
--    แบบ "before update of sort_order" จึงทำงานเฉพาะตอนมีการแก้ไขคอลัมน์นี้
--    จริงเท่านั้น ไม่กระทบการแก้ไขฟิลด์อื่นของ /dashboard/categories เดิม)
-- ----------------------------------------------------------------------------
create or replace function public.protect_superadmin_sort_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sort_order is distinct from old.sort_order and public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะจัดลำดับได้' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.protect_superadmin_sort_order is
  'จำกัดการแก้ไขคอลัมน์ sort_order ของ categories/organizations ให้เฉพาะ Super Admin (rank >= 50)';

drop trigger if exists trg_categories_protect_sort_order on public.categories;
create trigger trg_categories_protect_sort_order
  before update of sort_order on public.categories
  for each row execute function public.protect_superadmin_sort_order();

drop trigger if exists trg_organizations_protect_sort_order on public.organizations;
create trigger trg_organizations_protect_sort_order
  before update of sort_order on public.organizations
  for each row execute function public.protect_superadmin_sort_order();

-- ----------------------------------------------------------------------------
-- 6. กำหนด sort_order อัตโนมัติให้แถวใหม่ (ต่อท้ายกลุ่มเดิมเสมอ) — ทำให้
--    createCategoryAction/createOrganizationAction เดิมไม่ต้องแก้โค้ดเลย
-- ----------------------------------------------------------------------------
create or replace function public.assign_next_sort_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if tg_table_name = 'categories' then
    select coalesce(max(sort_order), -1) + 1 into v_next
    from public.categories
    where parent_id is not distinct from new.parent_id;
  else
    select coalesce(max(sort_order), -1) + 1 into v_next
    from public.organizations;
  end if;

  new.sort_order := v_next;
  return new;
end;
$$;

comment on function public.assign_next_sort_order is
  'กำหนด sort_order ให้แถวใหม่ต่อท้ายกลุ่มเดิมโดยอัตโนมัติ (categories: ภายใน parent_id เดียวกัน, organizations: ต่อท้ายทั้งหมด)';

drop trigger if exists trg_categories_assign_sort_order on public.categories;
create trigger trg_categories_assign_sort_order
  before insert on public.categories
  for each row execute function public.assign_next_sort_order();

drop trigger if exists trg_organizations_assign_sort_order on public.organizations;
create trigger trg_organizations_assign_sort_order
  before insert on public.organizations
  for each row execute function public.assign_next_sort_order();

-- ----------------------------------------------------------------------------
-- 7. RPC สำหรับจัดลำดับ/ย้ายหมวดหมู่ — security definer, ตรวจสอบ rank >= 50
--    เอง, ทำงานเป็น transaction เดียวจบในตัว (การเรียกฟังก์ชันหนึ่งครั้งคือ
--    หนึ่ง transaction ใน Postgres โดยธรรมชาติ — ถ้า statement ใดใน loop ล้มเหลว
--    ทุก statement ก่อนหน้าใน call เดียวกันจะ rollback ทั้งหมด)
-- ----------------------------------------------------------------------------
create or replace function public.superadmin_reorder_categories(
  p_parent_id uuid, p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx integer := 0;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะจัดลำดับหมวดหมู่ได้' using errcode = 'P0001';
  end if;

  foreach v_id in array p_ordered_ids loop
    update public.categories
    set sort_order = v_idx
    where id = v_id and parent_id is not distinct from p_parent_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

comment on function public.superadmin_reorder_categories is
  'จัดลำดับหมวดหมู่ภายในกลุ่ม parent เดียวกัน (ไม่เปลี่ยน parent_id) — Super Admin เท่านั้น';

grant execute on function public.superadmin_reorder_categories(uuid, uuid[]) to authenticated;

create or replace function public.superadmin_move_category(
  p_category_id uuid, p_new_parent_id uuid, p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx integer := 0;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะย้ายหมวดหมู่ได้' using errcode = 'P0001';
  end if;

  update public.categories set parent_id = p_new_parent_id where id = p_category_id;

  foreach v_id in array p_ordered_ids loop
    update public.categories set sort_order = v_idx where id = v_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

comment on function public.superadmin_move_category is
  'ย้ายหมวดหมู่ไปยัง parent ใหม่ พร้อมจัดลำดับกลุ่มปลายทางในคราวเดียว (p_ordered_ids ต้องเป็นรายการ id ทั้งหมดในกลุ่มปลายทางหลังย้าย รวม p_category_id ด้วย) — Super Admin เท่านั้น ป้องกัน circular reference ด้วย trigger prevent_category_cycle';

grant execute on function public.superadmin_move_category(uuid, uuid, uuid[]) to authenticated;

create or replace function public.superadmin_reorder_organizations(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx integer := 0;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะจัดลำดับหน่วยงานได้' using errcode = 'P0001';
  end if;

  foreach v_id in array p_ordered_ids loop
    update public.organizations set sort_order = v_idx where id = v_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

comment on function public.superadmin_reorder_organizations is
  'จัดลำดับหน่วยงานทั้งหมด — Super Admin เท่านั้น';

grant execute on function public.superadmin_reorder_organizations(uuid[]) to authenticated;
