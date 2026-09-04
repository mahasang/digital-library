-- ============================================================================
-- Web: Delete Account feature
--
-- "comments/ratings ถูกเก็บไว้แบบ anonymous" ต้องการเปลี่ยน FK จาก
-- ON DELETE CASCADE เป็น ON DELETE SET NULL — ตรงกับ pattern ที่ใช้อยู่แล้ว
-- ทั้งระบบสำหรับคอลัมน์ "ผู้ทำ" ที่ต้องการเก็บเนื้อหาไว้แม้เจ้าของจะลบบัญชีไป
-- แล้ว (เทียบ research_items.submitted_by, approval_logs.actor_id,
-- access_requests.reviewer_id ฯลฯ ที่ใช้ on delete set null แบบเดียวกันมา
-- ตั้งแต่ schema เดิม 20260731100000_schema.sql) — ต่างจาก favorites/
-- reading_history/notification_preferences ที่ยังคง cascade ต่อไปเพราะเป็น
-- ข้อมูลส่วนตัวแท้ๆ ที่ไม่มีความหมายอีกต่อไปเมื่อเจ้าของบัญชีหายไป
--
-- หมายเหตุ: local dev DB นี้สร้างจาก 20260901090000_ratings_comments.sql
-- ของ repo นี้เอง ซึ่ง comments/ratings.user_id references public.profiles
-- ตรงๆ — production ที่ deploy จริง (ตรวจสอบแล้วผ่าน db dump) กลับ reference
-- auth.users(id) ตรงๆ แทน (ข้ามชั้น profiles ไปเลย) เป็นอีกจุดหนึ่งของ schema
-- drift ที่ยังไม่ได้ reconcile — migration นี้แก้ตาม schema ของ local (ผ่าน
-- profiles) เพราะนั่นคือของจริงที่ repo นี้ใช้ทดสอบอยู่
-- ============================================================================

alter table public.comments alter column user_id drop not null;
alter table public.comments drop constraint comments_user_id_fkey;
alter table public.comments add constraint comments_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.ratings alter column user_id drop not null;
alter table public.ratings drop constraint ratings_user_id_fkey;
alter table public.ratings add constraint ratings_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

-- ----------------------------------------------------------------------------
-- delete_own_account(): ลบบัญชีผู้ใช้ปัจจุบันแบบถาวร (ไม่ใช่ soft-delete)
--
-- security definer จำเป็นเพราะการลบแถวออกจาก auth.users ต้องใช้สิทธิ์ที่
-- authenticated role ธรรมดาไม่มี (Supabase สงวน auth schema ไว้ให้เฉพาะ
-- postgres/service_role) — นี่คือ pattern มาตรฐานที่ Supabase เองแนะนำสำหรับ
-- ฟีเจอร์ "ผู้ใช้ลบบัญชีตัวเอง"
--
-- ไม่รับ parameter ใดๆ เลย ใช้ auth.uid() ของผู้เรียกเท่านั้นเสมอ — ป้องกัน
-- privilege escalation โดยเนื้อแท้ (ไม่มีทางเรียกให้ลบบัญชีคนอื่นได้ไม่ว่า
-- กรณีใด ต่างจากถ้าออกแบบให้รับ user_id เป็น parameter)
--
-- ลบแค่ auth.users แถวเดียว — profiles (on delete cascade เดิม) และทุกอย่างที่
-- โยงกับ profiles ต่อเป็นทอดๆ (favorites/reading_history/notification_
-- preferences/access_requests ฯลฯ = cascade ลบตาม, research_items.submitted_by/
-- comments.user_id/ratings.user_id = set null ตาม FK ที่มีอยู่แล้ว) จะตามมา
-- เองทั้งหมดโดยอัตโนมัติจาก FK constraints ที่มีอยู่แล้ว ไม่ต้องเขียน logic
-- ลบ/ย้ายข้อมูลอะไรเพิ่มในฟังก์ชันนี้เองเลย
-- ----------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
