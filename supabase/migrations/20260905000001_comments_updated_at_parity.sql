-- Parity: comments.updated_at exists on production (added outside migrations).
-- Required by get_blog_comments() in 20260910000000_blog_comments.sql.
-- Mirrors production exactly: nullable, DEFAULT now(), no trigger.
-- Idempotent: no-op on production where the column already exists.
alter table public.comments
  add column if not exists updated_at timestamptz default now();
