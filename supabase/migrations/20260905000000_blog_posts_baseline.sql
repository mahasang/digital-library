-- Baseline for public.blog_posts.
-- The table was created directly on production (never via migration), so local
-- `migration up` failed at 20260910000000. Reconstructed from the production
-- catalog (2026-09-29) MINUS what the later backlog adds:
--   seo_title / seo_description / og_image + their length CHECKs  (20260910000002)
--   idx_blog_posts_scheduled                                      (20260910000003)
--   FKs from blog_post_authors / comments / favorites / reading_history (backlog)
-- Guard: if blog_posts already exists (production), the whole file is a no-op.

do $$
begin
  if to_regclass('public.blog_posts') is not null then
    raise notice 'blog_posts exists - baseline skipped';
    return;
  end if;

  create table public.blog_posts (
    id           uuid        not null default gen_random_uuid(),
    slug         text        not null,
    title_lo     text        not null default ''::text,
    title_th     text        not null default ''::text,
    title_en     text        not null default ''::text,
    title_vi     text        not null default ''::text,
    content_lo   text        not null default ''::text,
    content_th   text        not null default ''::text,
    content_en   text        not null default ''::text,
    content_vi   text        not null default ''::text,
    excerpt_lo   text        not null default ''::text,
    excerpt_th   text        not null default ''::text,
    excerpt_en   text        not null default ''::text,
    excerpt_vi   text        not null default ''::text,
    cover_image  text,
    status       text        not null default 'draft'::text,
    author_id    uuid,
    published_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    tags         text[]      not null default '{}'::text[],
    scheduled_at timestamptz,
    constraint blog_posts_pkey primary key (id),
    constraint blog_posts_slug_key unique (slug),
    constraint blog_posts_author_id_fkey foreign key (author_id)
      references auth.users(id) on delete set null,
    constraint blog_posts_status_check
      check (status = any (array['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text]))
  );

  create index blog_posts_tags_idx on public.blog_posts using gin (tags);
  create index blog_posts_title_search_idx on public.blog_posts using gin (
    to_tsvector('simple'::regconfig,
      coalesce(title_lo, '') || ' ' || coalesce(title_th, '') || ' ' ||
      coalesce(title_en, '') || ' ' || coalesce(title_vi, ''))
  );

  alter table public.blog_posts enable row level security;

  create policy "anyone can read published blog posts"
    on public.blog_posts for select
    using (
      (status = 'published' and published_at <= now())
      or exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and r.rank >= (select roles.rank from public.roles where roles.name = 'staff')
      )
    );

  create policy "librarian and above can insert blog posts"
    on public.blog_posts for insert
    with check (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and r.rank >= (select roles.rank from public.roles where roles.name = 'librarian')
      )
    );

  -- UPDATE has no WITH CHECK on production; mirrored as-is.
  create policy "librarian and above can update blog posts"
    on public.blog_posts for update
    using (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and r.rank >= (select roles.rank from public.roles where roles.name = 'librarian')
      )
    );

  create policy "librarian and above can delete blog posts"
    on public.blog_posts for delete
    using (
      exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and r.rank >= (select roles.rank from public.roles where roles.name = 'librarian')
      )
    );

  create or replace function public.set_blog_posts_updated_at()
  returns trigger
  language plpgsql
  as $fn$
  begin
    new.updated_at = now();
    return new;
  end;
  $fn$;

  create trigger blog_posts_updated_at
    before update on public.blog_posts
    for each row execute function public.set_blog_posts_updated_at();
end
$$;
