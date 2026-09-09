-- Blog schedule publish
-- แก้ status CHECK constraint เพิ่ม 'scheduled', 'archived'
-- แก้ RLS SELECT เพิ่ม published_at <= now()
-- เพิ่ม index (scheduled_at column มีอยู่แล้วใน DB)

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_status_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'published', 'archived'));

DROP POLICY IF EXISTS "anyone can read published blog posts" ON public.blog_posts;

CREATE POLICY "anyone can read published blog posts"
  ON public.blog_posts FOR SELECT
  USING (
    (
      status = 'published'
      AND published_at <= now()
    )
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.rank >= (SELECT rank FROM roles WHERE name = 'staff')
    )
  );

CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled
  ON public.blog_posts (published_at)
  WHERE status = 'scheduled';
