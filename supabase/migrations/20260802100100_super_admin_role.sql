-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 6: บทบาท Super Admin
--
-- เพิ่มบทบาทสูงสุดใหม่ "super_admin" (rank 50) เหนือ admin (rank 40)
--
-- แนวคิดสำคัญ: RLS Policy เดิมเกือบทั้งหมดในระบบเปรียบเทียบสิทธิ์ด้วย
-- `user_max_role_rank() >= N` (ไม่ใช่ `= N`) ดังนั้น super_admin (rank 50)
-- จึงได้สิทธิ์ทุกอย่างที่ admin/librarian/staff/member มีอยู่แล้วโดยอัตโนมัติ
-- ทันทีที่เพิ่มแถวในตาราง roles — ไม่ต้องแก้ policy เดิมแม้แต่ตัวเดียว
--
-- สิ่งที่ต้องเพิ่มจริงมีเพียง 2 จุดที่เป็น "ช่องโหว่การยกระดับสิทธิ์" ใหม่ที่
-- เกิดขึ้นเฉพาะเพราะมี super_admin เท่านั้น:
--   1. ตาราง roles เอง (นิยามลำดับชั้นสิทธิ์ทั้งหมด) — เดิม admin (rank>=40)
--      แก้ไข/ลบแถวใดก็ได้ รวมถึงแถว super_admin เอง จึงต้องจำกัดเฉพาะ
--      super_admin (rank>=50) เท่านั้นที่จัดการตาราง roles ได้
--   2. การกำหนด/ถอดถอนบทบาท super_admin ให้ผู้ใช้ (user_roles) — เดิม admin
--      (rank>=40) เพิ่ม/ลบแถว user_roles ของใครก็ได้ รวมถึงมอบบทบาท
--      super_admin ให้ตัวเองหรือคนอื่นได้ จึงต้องจำกัดว่าการเพิ่ม/ลบแถวที่
--      role_id ชี้ไปที่ super_admin ต้องทำโดย super_admin (rank>=50) เท่านั้น
--      ส่วนบทบาทอื่น (member/staff/librarian/admin) admin ยังจัดการได้เหมือนเดิม
--      ทุกประการ — ไม่มีสิทธิ์เดิมใดถูกริบ
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. เพิ่ม 'super_admin' เข้า check constraint ของ roles.name แล้วเพิ่มแถวใหม่
-- ----------------------------------------------------------------------------
alter table public.roles drop constraint roles_name_check;
alter table public.roles add constraint roles_name_check
  check (name in ('member', 'staff', 'librarian', 'admin', 'super_admin'));

insert into public.roles (name, rank, description) values
  ('super_admin', 50, 'ผู้ดูแลระบบสูงสุด มีสิทธิ์ทุกอย่างของ admin บวกกับสิทธิ์จัดการ '
    || 'ลำดับชั้นบทบาท (ตาราง roles) และมอบ/ถอดถอนบทบาท super_admin เอง — '
    || 'เข้าถึงหน้า /superadmin ได้เฉพาะบทบาทนี้เท่านั้น')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 2. ตาราง roles: จำกัดการจัดการ (insert/update/delete) ให้ super_admin เท่านั้น
--    (เดิม rank >= 40 คือ admin ก็จัดการได้ — เข้มงวดขึ้นเพราะตารางนี้นิยาม
--    ลำดับชั้นสิทธิ์ทั้งระบบ ไม่ควรให้ admin ทั่วไปแก้ไข/ลบนิยาม super_admin เองได้
--    หมายเหตุ: แอปปัจจุบันไม่มีหน้า UI ให้ admin จัดการตาราง roles อยู่แล้ว
--    (ASSIGNABLE_ROLES ใน dashboard/users เป็น hardcode) จึงไม่กระทบฟีเจอร์เดิม)
-- ----------------------------------------------------------------------------
drop policy if exists "roles_manage_admin" on public.roles;
create policy "roles_manage_super_admin" on public.roles
  for all using (public.user_max_role_rank() >= 50)
  with check (public.user_max_role_rank() >= 50);

-- ----------------------------------------------------------------------------
-- 3. ตาราง user_roles: การมอบ/ถอดถอนบทบาท "super_admin" โดยเฉพาะ ต้องทำโดย
--    ผู้ใช้ที่มี rank >= 50 เท่านั้น — บทบาทอื่นยังคงให้ admin (rank >= 40)
--    จัดการได้เหมือนเดิมทุกประการ (สิทธิ์เดิมไม่เปลี่ยน)
-- ----------------------------------------------------------------------------
drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert" on public.user_roles
  for insert with check (
    public.user_max_role_rank() >= 40
    and (
      public.user_max_role_rank() >= 50
      or not exists (
        select 1 from public.roles r where r.id = role_id and r.name = 'super_admin'
      )
    )
  );

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles
  for delete using (
    public.user_max_role_rank() >= 40
    and (
      public.user_max_role_rank() >= 50
      or not exists (
        select 1 from public.roles r where r.id = role_id and r.name = 'super_admin'
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. ป้องกันการถอดถอนสิทธิ์ super_admin คนสุดท้ายของระบบ (ต้องมี super_admin
--    เหลืออย่างน้อย 1 คนเสมอ) — บังคับที่ระดับฐานข้อมูลผ่าน trigger เพื่อให้
--    ครอบคลุมทุกเส้นทาง ไม่ว่าจะลบผ่านแอป, SQL ตรง, หรือ cascade delete จาก
--    auth.users ก็ตาม (BEFORE DELETE trigger ยังทำงานแม้เป็นการลบแบบ cascade)
-- ----------------------------------------------------------------------------
create or replace function public.prevent_last_super_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super_admin boolean;
  v_remaining integer;
begin
  select (r.name = 'super_admin') into v_is_super_admin
  from public.roles r
  where r.id = old.role_id;

  if v_is_super_admin then
    select count(*) into v_remaining
    from public.user_roles ur
    where ur.role_id = old.role_id and ur.id <> old.id;

    if v_remaining = 0 then
      raise exception
        'ไม่สามารถถอดถอนสิทธิ์ Super Admin คนสุดท้ายในระบบได้ ต้องมี Super Admin เหลืออย่างน้อย 1 คนเสมอ'
        using errcode = 'P0001';
    end if;
  end if;

  return old;
end;
$$;

comment on function public.prevent_last_super_admin_removal is
  'ป้องกันการลบแถว user_roles สุดท้ายที่มีบทบาท super_admin — ต้องมี super_admin เหลืออย่างน้อย 1 คนเสมอ';

drop trigger if exists trg_prevent_last_super_admin_removal on public.user_roles;
create trigger trg_prevent_last_super_admin_removal
  before delete on public.user_roles
  for each row execute function public.prevent_last_super_admin_removal();

-- ----------------------------------------------------------------------------
-- 5. superadmin_storage_usage(): พื้นที่ Storage ที่ใช้ต่อ bucket สำหรับหน้า
--    /superadmin/overview — ต้อง security definer เพราะ storage.objects อยู่
--    นอก schema public และ client ปกติ query ข้าม schema ตรงๆ ไม่ได้ ข้อมูล
--    เป็นแค่ผลรวมขนาดไฟล์ ไม่มีชื่อไฟล์/เจ้าของ จึงความเสี่ยงต่ำแม้ถูกเรียกตรง
--    (หน้าเว็บเองถูกจำกัดด้วย rank >= 50 อยู่แล้วทั้ง middleware และ layout)
-- ----------------------------------------------------------------------------
create or replace function public.superadmin_storage_usage()
returns table (bucket_id text, total_bytes bigint, object_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id as bucket_id,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as total_bytes,
    count(o.id) as object_count
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.id;
$$;

grant execute on function public.superadmin_storage_usage() to authenticated;
