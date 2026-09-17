-- Reading History for Blog
-- ขยาย reading_history ให้รองรับ blog_posts นอกเหนือจาก research_items
-- ใช้ pattern เดียวกับ 20260910000001_blog_favorites.sql (favorites table)

-- 1. เพิ่ม column ใหม่
ALTER TABLE public.reading_history
  ADD COLUMN IF NOT EXISTS blog_post_id uuid
    REFERENCES public.blog_posts(id) ON DELETE CASCADE;

-- 2. ปลด NOT NULL บน research_id
ALTER TABLE public.reading_history
  ALTER COLUMN research_id DROP NOT NULL;

-- 3. CHECK constraint (XOR — ต้องมีอย่างใดอย่างหนึ่งเท่านั้น)
ALTER TABLE public.reading_history
  ADD CONSTRAINT reading_history_target_check
  CHECK (
    (research_id IS NOT NULL AND blog_post_id IS NULL)
    OR
    (research_id IS NULL AND blog_post_id IS NOT NULL)
  );

-- 4. Unique constraint (user อ่าน blog post เดียวกันซ้ำ = upsert read_at แทนการเพิ่มแถวใหม่)
ALTER TABLE public.reading_history
  ADD CONSTRAINT reading_history_user_blog_unique
    UNIQUE (user_id, blog_post_id);

-- 5. Partial index สำหรับ blog_post_id (ตาม pattern idx_favorites_blog_post_id เดิม)
CREATE INDEX IF NOT EXISTS idx_reading_history_blog_post_id
  ON public.reading_history(blog_post_id)
  WHERE blog_post_id IS NOT NULL;

-- 6. RPC ใหม่สำหรับ blog (แยกจาก log_reading_history เดิมที่ query research_items เท่านั้น)
-- หมายเหตุ: blog_posts ไม่มี column "is_published" — ใช้ status = 'published'
-- ตาม schema จริง (เดียวกับที่ getPublishedBlogPostBySlug() ใช้ใน lib/data/blog.server.ts)
CREATE OR REPLACE FUNCTION public.log_blog_reading_history(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blog_post_id uuid;
BEGIN
  -- return เงียบถ้าไม่ได้ login (เหมือน log_reading_history เดิม)
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- หา blog post จาก slug (เฉพาะที่เผยแพร่แล้วเท่านั้น)
  SELECT id INTO v_blog_post_id
  FROM public.blog_posts
  WHERE slug = p_slug
    AND status = 'published'
  LIMIT 1;

  -- return เงียบถ้าหาไม่เจอ
  IF v_blog_post_id IS NULL THEN
    RETURN;
  END IF;

  -- upsert (update read_at ถ้าอ่านซ้ำ แทนการสร้างแถวใหม่ทุกครั้ง)
  INSERT INTO public.reading_history (user_id, blog_post_id, read_at)
  VALUES (auth.uid(), v_blog_post_id, now())
  ON CONFLICT (user_id, blog_post_id)
  DO UPDATE SET read_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_blog_reading_history(text) TO authenticated;

-- 7. RLS: policy เดิม (reading_history_select_own_or_staff / reading_history_insert_own)
-- ใช้ WHERE/CHECK user_id = auth.uid() เท่านั้น ไม่ได้อ้างอิง research_id เลย
-- จึงครอบคลุมแถวที่มี blog_post_id ได้ทันทีโดยไม่ต้องแก้ policy ใดๆ
