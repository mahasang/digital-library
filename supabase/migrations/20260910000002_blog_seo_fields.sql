-- Blog SEO fields: seo_title, seo_description, og_image
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_title       text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image        text;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_seo_title_length
    CHECK (seo_title IS NULL OR char_length(seo_title) <= 60),
  ADD CONSTRAINT blog_posts_seo_description_length
    CHECK (seo_description IS NULL OR char_length(seo_description) <= 160);
