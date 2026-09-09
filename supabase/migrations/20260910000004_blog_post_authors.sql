-- Blog multiple authors: blog_post_authors junction table + RLS + index

CREATE TABLE IF NOT EXISTS public.blog_post_authors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id   uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_order  int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blog_post_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_authors_blog_post_id
  ON public.blog_post_authors(blog_post_id);

CREATE INDEX IF NOT EXISTS idx_blog_post_authors_profile_id
  ON public.blog_post_authors(profile_id);

ALTER TABLE public.blog_post_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_post_authors_select_public"
  ON public.blog_post_authors FOR SELECT
  USING (true);

CREATE POLICY "blog_post_authors_write_librarian"
  ON public.blog_post_authors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.rank >= 30
    )
  );

CREATE POLICY "blog_post_authors_delete_librarian"
  ON public.blog_post_authors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.rank >= 30
    )
  );
