-- ============================================================================
-- Profile enhancement: phone, date_of_birth, address + avatar upload bucket
-- ============================================================================

-- เพิ่ม columns ใหม่ใน profiles table — ทั้งหมด nullable/optional เหมือนกับ
-- full_name/organization_name เดิม ไม่บังคับกรอก จึงไม่กระทบผู้ใช้เดิมที่ยังไม่มี
-- ข้อมูลเหล่านี้เลย RLS เดิม (profiles_update_own: id = auth.uid()) ครอบคลุม
-- column ใหม่ทั้งหมดโดยอัตโนมัติอยู่แล้ว เพราะ RLS ทำงานระดับแถวไม่ใช่ระดับ column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS address text;

COMMENT ON COLUMN public.profiles.phone IS 'เบอร์โทรศัพท์ (ไม่บังคับ)';
COMMENT ON COLUMN public.profiles.date_of_birth IS 'วันเกิด (ไม่บังคับ)';
COMMENT ON COLUMN public.profiles.address IS 'ที่อยู่ (ไม่บังคับ)';

-- ----------------------------------------------------------------------------
-- handle_new_user(): เพิ่มการดึง phone จาก raw_user_meta_data ด้วย (ผู้ใช้กรอก
-- ตอนสมัครสมาชิกแบบไม่บังคับ — ดู RegisterForm.tsx) ส่วน full_name/email/
-- organization_name เดิมคงพฤติกรรมเดิมทุกประการ — แก้เฉพาะเพิ่ม field เดียว
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
  insert into public.profiles (id, full_name, email, organization_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'organization',
    new.raw_user_meta_data ->> 'phone'
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

-- ----------------------------------------------------------------------------
-- avatars (public): รูปโปรไฟล์ผู้ใช้ — คนละเรื่องกับ research-covers/
-- site-assets ที่มีอยู่แล้ว พาธไฟล์คงที่ {auth.uid()}/avatar.{ext} ต่อคนเดียว
-- เท่านั้น (upsert:true แทนที่ของเดิมเสมอ ไม่สะสมไฟล์เก่า) จึงต้องมี policy
-- "update" เพิ่มจากที่ bucket อื่นไม่มี (bucket อื่นใช้ upsert:false มาตลอด)
--
-- ไม่มีเงื่อนไข rank เหมือน research-covers (ที่บังคับ rank >= 20 เพราะเป็น
-- การอัปโหลดปกงานวิจัยซึ่งเป็นสิทธิ์ staff ขึ้นไป) — avatar เป็นของส่วนตัวของ
-- ผู้ใช้ทุกคนไม่ว่าจะมีบทบาทใด ตรวจแค่ความเป็นเจ้าของไฟล์ (auth.uid()) เท่านั้น
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select_all" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
