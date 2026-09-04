-- ============================================================================
-- แก้ get_comments() ที่ deploy จริงตอนนี้ (มาจาก mobile repo's migration
-- 20260828120000_ratings_and_comments.sql) — ไม่มีการตรวจสิทธิ์เข้าถึง
-- research_items เลยก่อน join profiles แบบ security definer เท่ากับว่าใครก็
-- เรียกดูความคิดเห็น + ชื่อ/รูปผู้แสดงความเห็นของงานวิจัยชิ้นไหนก็ได้ (รวมถึง
-- ชิ้นที่ควรถูกจำกัดสิทธิ์การเข้าถึง — member_only/staff_only/draft) เพียงแค่รู้
-- research_id เท่านั้น ไม่ต้องผ่านการตรวจสอบใดๆ
--
-- แก้เฉพาะ "ใครเรียกดูได้" — ไม่แตะ:
--   - โครงสร้างตาราง comments/ratings (content ยาวได้ถึง 1000 ตัวอักษร,
--     มี updated_at แล้ว — ค่าที่ deploy จริงตอนนี้ ไม่ใช่ค่าจาก migration
--     ไฟล์ใดไฟล์หนึ่งของทั้งสอง repo ตรงๆ ดูเหมือนถูกแก้เพิ่มเติมโดยตรงผ่าน
--     Supabase Dashboard หลัง migration ใดไฟล์หนึ่งรันไปแล้ว)
--   - ข้อความ fallback ชื่อผู้แสดงความเห็น ('ຜູ້ໃຊ້') หรือ LEFT JOIN แบบเดิม —
--     คงไว้ตามที่ deploy จริงเพราะ mobile app อาจพึ่งพฤติกรรมนี้อยู่แล้ว
--   - get_rating_stats()/get_favorites_count() — leak แค่ตัวเลขรวม ไม่ใช่
--     เนื้อหา/ตัวตนคนเขียนแบบ get_comments() จึงยังไม่ได้แก้ในรอบนี้
-- ============================================================================
create or replace function public.get_comments(p_research_id uuid, p_limit integer default 20)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  user_id uuid,
  author_name text,
  author_avatar_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- เงื่อนไขเดียวกับ research_items_select policy (20260731100200_rls_policies.sql)
  -- ต้อง copy มาตรงๆ เพราะ security definer ทำให้ RLS อัตโนมัติของ
  -- research_items ใช้ไม่ได้ — ถ้า policy นั้นเปลี่ยนในอนาคต ต้องแก้ตรงนี้ด้วย
  if not exists (
    select 1 from public.research_items ri
    where ri.id = p_research_id
      and (
        (
          ri.status = 'published'
          and (
            ri.access_level in ('public', 'read_only', 'metadata_only')
            or (ri.access_level = 'member_only' and public.user_max_role_rank() >= 10)
            or (ri.access_level = 'staff_only' and public.user_max_role_rank() >= 20)
          )
        )
        or ri.submitted_by = auth.uid()
        or public.user_max_role_rank() >= 30
      )
  ) then
    return;
  end if;

  return query
    select
      c.id, c.content, c.created_at, c.user_id,
      coalesce(p.full_name, p.email, 'ຜູ້ໃຊ້') as author_name,
      p.avatar_url as author_avatar_url
    from public.comments c
    left join public.profiles p on p.id = c.user_id
    where c.research_id = p_research_id
    order by c.created_at desc
    limit p_limit;
end;
$$;
