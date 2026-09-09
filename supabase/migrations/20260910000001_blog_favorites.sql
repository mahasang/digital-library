-- Engagement Phase 2: Blog Like / Favorite
-- เพิ่ม blog_post_id ใน favorites table + RLS + RPC

-- 1. เพิ่ม blog_post_id ใน favorites
ALTER TABLE public.favorites
  ADD COLUMN IF NOT EXISTS blog_post_id uuid
    REFERENCES public.blog_posts(id) ON DELETE CASCADE;

-- 2. DROP NOT NULL บน research_id
ALTER TABLE public.favorites
  ALTER COLUMN research_id DROP NOT NULL;

-- 3. CHECK constraint — ต้องมีอย่างใดอย่างหนึ่ง
ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_target_check
  CHECK (
    (research_id IS NOT NULL AND blog_post_id IS NULL)
    OR
    (research_id IS NULL     AND blog_post_id IS NOT NULL)
  );

-- 4. UNIQUE constraint — user like blog post ได้ครั้งเดียว
-- หมายเหตุ: (user_id, research_id) unique constraint มีอยู่แล้ว (inline ใน
-- create table เดิม) — ไม่ต้องเพิ่มซ้ำ
ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_user_blog_unique
  UNIQUE (user_id, blog_post_id);

-- 5. Index สำหรับ blog_post_id
CREATE INDEX IF NOT EXISTS idx_favorites_blog_post_id
  ON public.favorites(blog_post_id)
  WHERE blog_post_id IS NOT NULL;

-- 6. RPC get_blog_favorites_count (SECURITY DEFINER — favorites RLS เห็นแค่ของตัวเอง)
CREATE OR REPLACE FUNCTION public.get_blog_favorites_count(p_blog_post_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.favorites
  WHERE blog_post_id = p_blog_post_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_blog_favorites_count(uuid)
  TO anon, authenticated;
