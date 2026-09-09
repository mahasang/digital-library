-- Engagement Phase 1: Blog Comments
-- Replaces all existing comments RLS policies with a clean set
-- covering both research_comments_* and blog_comments_*

DROP POLICY IF EXISTS "anyone can read comments"          ON public.comments;
DROP POLICY IF EXISTS "comments_select_all"               ON public.comments;
DROP POLICY IF EXISTS "users can comment"                 ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own"               ON public.comments;
DROP POLICY IF EXISTS "users can delete own comment"      ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own_or_staff"      ON public.comments;
DROP POLICY IF EXISTS "users can edit own comment"        ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"               ON public.comments;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS blog_post_id uuid
    REFERENCES public.blog_posts(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  ALTER COLUMN research_id DROP NOT NULL;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_target_check
  CHECK (
    (research_id IS NOT NULL AND blog_post_id IS NULL)
    OR
    (research_id IS NULL     AND blog_post_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_comments_blog_post_id
  ON public.comments(blog_post_id)
  WHERE blog_post_id IS NOT NULL;

CREATE POLICY "research_comments_select_public"
  ON public.comments FOR SELECT
  USING (research_id IS NOT NULL);

CREATE POLICY "research_comments_insert_authenticated"
  ON public.comments FOR INSERT
  WITH CHECK (
    research_id IS NOT NULL
    AND user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "research_comments_delete_own_or_staff"
  ON public.comments FOR DELETE
  USING (
    research_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.rank >= 20
      )
    )
  );

CREATE POLICY "research_comments_update_own"
  ON public.comments FOR UPDATE
  USING (research_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (research_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "blog_comments_select_public"
  ON public.comments FOR SELECT
  USING (
    blog_post_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.blog_posts bp
      WHERE bp.id = comments.blog_post_id
        AND bp.status = 'published'
    )
  );

CREATE POLICY "blog_comments_insert_member"
  ON public.comments FOR INSERT
  WITH CHECK (
    blog_post_id IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.rank >= 10
    )
  );

CREATE POLICY "blog_comments_delete_own_or_staff"
  ON public.comments FOR DELETE
  USING (
    blog_post_id IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.rank >= 20
      )
    )
  );

CREATE POLICY "blog_comments_update_own"
  ON public.comments FOR UPDATE
  USING (blog_post_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (blog_post_id IS NOT NULL AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_blog_comments(
  p_blog_post_id uuid,
  p_limit        int DEFAULT 50
)
RETURNS TABLE (
  id                uuid,
  content           text,
  created_at        timestamptz,
  updated_at        timestamptz,
  user_id           uuid,
  author_name       text,
  author_avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.content,
    c.created_at,
    c.updated_at,
    c.user_id,
    COALESCE(p.full_name, p.email, 'ຜູ້ໃຊ້') AS author_name,
    p.avatar_url                              AS author_avatar_url
  FROM   public.comments c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE  c.blog_post_id = p_blog_post_id
  ORDER BY c.created_at ASC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_blog_comments(uuid, int)
  TO anon, authenticated;
