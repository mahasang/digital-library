-- ============================================================================
-- Web Phase 2: Ratings + Comments บนหน้า research detail
--
-- ทั้งสองตารางผูกกับ research_items แบบ many-to-one — การมองเห็นแถวอิงตาม
-- "งานวิจัยชิ้นนี้ผู้ใช้ปัจจุบันมีสิทธิ์เห็นหรือไม่" เงื่อนไขเดียวกับ
-- research_items_select policy ทุกประการ (ดู 20260731100200_rls_policies.sql)
-- ============================================================================

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.research_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (research_id, user_id)
);

comment on table public.ratings is 'คะแนนให้ดาว (1-5) ต่องานวิจัย — 1 คนให้ได้ 1 คะแนนต่อชิ้น (upsert เมื่อให้ซ้ำ)';

create index idx_ratings_research_id on public.ratings (research_id);
create index idx_ratings_user_id on public.ratings (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.research_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) <= 500 and char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.comments is 'ความคิดเห็นต่องานวิจัย — จำกัด 500 ตัวอักษร ยังไม่มี edit/delete ในเฟสนี้';

create index idx_comments_research_id_created_at on public.comments (research_id, created_at desc);
create index idx_comments_user_id on public.comments (user_id);

alter table public.ratings enable row level security;
alter table public.comments enable row level security;

-- ----------------------------------------------------------------------------
-- GRANTS — ตามแนวทางเดิมของโปรเจกต์ (GRANT กว้าง + RLS จำกัดจริงระดับแถว)
-- SELECT ให้ anon ด้วย เพราะ guest ต้องเห็นคะแนนเฉลี่ย/ความคิดเห็นของงานวิจัย
-- สาธารณะได้เหมือนเนื้อหาอื่นของ research_items — เขียนได้เฉพาะสมาชิกที่
-- login แล้วเท่านั้น (เหมือน favorites/reading_history)
-- ----------------------------------------------------------------------------
grant select on public.ratings, public.comments to anon, authenticated;
grant insert, update on public.ratings to authenticated;
grant insert on public.comments to authenticated;

-- SELECT: มองเห็นแถวได้ก็ต่อเมื่อ "เห็นงานวิจัยชิ้นนั้นได้" เท่านั้น — ใช้
-- subquery อ้าง research_items ตรงๆ (ไม่ใช่ copy เงื่อนไขมาเขียนซ้ำ) เพราะ
-- research_items มี RLS ของตัวเองอยู่แล้ว Postgres จะ apply policy ของ
-- research_items ให้เองตาม role ผู้เรียกจริงเสมอเมื่อ query ผ่าน subquery แบบนี้
-- จึงไม่มีวันเห็นต่างจาก research_items_select แม้ policy นั้นจะถูกแก้ในอนาคต
create policy "ratings_select_visible_research" on public.ratings
  for select using (
    exists (select 1 from public.research_items ri where ri.id = ratings.research_id)
  );

create policy "ratings_insert_own" on public.ratings
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.research_items ri where ri.id = ratings.research_id)
  );

create policy "ratings_update_own" on public.ratings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "comments_select_visible_research" on public.comments
  for select using (
    exists (select 1 from public.research_items ri where ri.id = comments.research_id)
  );

create policy "comments_insert_own" on public.comments
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.research_items ri where ri.id = comments.research_id)
  );

-- ----------------------------------------------------------------------------
-- get_rating_stats(): security invoker (ค่าเริ่มต้น) เพียงพอ — อ่านจาก
-- ratings ตรงๆ ซึ่ง RLS ของ ratings เองก็ผูกกับการมองเห็น research_items
-- อยู่แล้ว จึงไม่มีความเสี่ยงข้อมูลรั่วแม้ไม่ bypass RLS
-- ----------------------------------------------------------------------------
create or replace function public.get_rating_stats(p_research_id uuid)
returns table (avg_score numeric, rating_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(avg(score), 0)::numeric as avg_score,
    count(*)::integer as rating_count
  from public.ratings
  where research_id = p_research_id;
$$;

grant execute on function public.get_rating_stats(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_comments(): security definer — ต่างจาก get_rating_stats เพราะต้อง
-- join profiles เพื่อเอาชื่อ/avatar ของ "คนอื่น" มาแสดง ซึ่ง
-- profiles_select_own_or_staff policy ปกติให้เห็นเฉพาะโปรไฟล์ตัวเองหรือ
-- staff เท่านั้น (ดู 20260731100200_rls_policies.sql) จึงต้อง bypass RLS
-- ของ profiles ผ่าน security definer แล้วตรวจสิทธิ์เข้าถึง research_items
-- **ในฟังก์ชันเองแทน** (คัดลอกเงื่อนไขจาก research_items_select ตรงๆ เพราะ
-- security definer ทำให้ RLS อัตโนมัติของ research_items ใช้ไม่ได้อีกต่อไป —
-- ถ้าแก้ research_items_select ในอนาคต ต้องแก้ตรงนี้ให้ตรงกันด้วย)
-- ----------------------------------------------------------------------------
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

  -- author_name คืน null ได้ถ้า full_name ว่าง — ปล่อยให้ฝั่ง client
  -- (CommentSection.tsx) เป็นผู้ใส่ข้อความ fallback ตาม locale ของผู้อ่านเอง
  -- แทนที่จะ hardcode ภาษาใดภาษาหนึ่งไว้ใน SQL ตรงนี้
  return query
    select
      c.id,
      c.content,
      c.created_at,
      c.user_id,
      p.full_name as author_name,
      p.avatar_url as author_avatar_url
    from public.comments c
    join public.profiles p on p.id = c.user_id
    where c.research_id = p_research_id
    order by c.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.get_comments(uuid, integer) to anon, authenticated;
