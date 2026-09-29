-- Bibliographic metadata for externally sourced / open-access works.
-- All nullable: existing rows unaffected. RLS is row-level and unchanged.

alter table public.research_items
  add column if not exists license      text,
  add column if not exists license_url  text,
  add column if not exists source_url   text,
  add column if not exists publisher    text,
  add column if not exists language     text;

-- URLs are rendered as href in the UI: allow http(s) only (blocks javascript:/data:)
alter table public.research_items
  add constraint research_items_license_url_http
    check (license_url is null or license_url ~* '^https?://[^\s]+$'),
  add constraint research_items_source_url_http
    check (source_url is null or source_url ~* '^https?://[^\s]+$'),
  add constraint research_items_language_code
    check (language is null or language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  add constraint research_items_license_len
    check (license is null or char_length(license) <= 100),
  add constraint research_items_publisher_len
    check (publisher is null or char_length(publisher) <= 300);

comment on column public.research_items.license     is 'License of the work, e.g. "CC BY 4.0", "Public Domain"';
comment on column public.research_items.license_url is 'Canonical license URL (http/https only)';
comment on column public.research_items.source_url  is 'Original source / landing page (http/https only)';
comment on column public.research_items.publisher   is 'Publisher of the original work (not the internal organization)';
comment on column public.research_items.language    is 'ISO 639 language code of the work, e.g. en, lo, th';

-- New category: history
insert into public.categories (slug, name_th, name_en, description, icon)
values ('history', 'ประวัติศาสตร์', 'History',
        'ประวัติศาสตร์ บันทึกการเดินทาง และเอกสารทางประวัติศาสตร์', 'Landmark')
on conflict (slug) do nothing;
