-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 2: Core Schema
-- ตาราง, Foreign Keys, Constraints และ Index หลักทั้งหมด
-- อ้างอิงโครงสร้างข้อมูลจาก docs/project-spec.md
-- ============================================================================

-- เปิดใช้งาน pg_trgm สำหรับทำ Index รองรับการค้นหาแบบ ILIKE/Full-text บางส่วน
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- organizations: หน่วยงาน/คณะ/ภาควิชาเจ้าของผลงานวิจัย
-- ----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_th text not null,
  name_en text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'หน่วยงาน/คณะ/ภาควิชาเจ้าของผลงานวิจัย';

-- ----------------------------------------------------------------------------
-- categories: หมวดหมู่งานวิจัย (ตรงกับ data/categories.ts ฝั่งแอป)
-- ----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  description text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categories is 'หมวดหมู่งานวิจัย';

-- ----------------------------------------------------------------------------
-- roles: บทบาทผู้ใช้งาน (ไม่รวม guest ซึ่งหมายถึงผู้ที่ยังไม่เข้าสู่ระบบ)
-- rank ใช้เปรียบเทียบลำดับสิทธิ์ ยิ่งมากยิ่งมีสิทธิ์สูง
-- ----------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('member', 'staff', 'librarian', 'admin')),
  rank smallint not null unique,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.roles is 'บทบาทผู้ใช้งาน (member/staff/librarian/admin) — guest คือผู้ไม่เข้าสู่ระบบ ไม่มีแถวในตารางนี้';

-- ----------------------------------------------------------------------------
-- profiles: ข้อมูลผู้ใช้งานเพิ่มเติม ผูกกับ auth.users แบบ 1:1
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  organization_name text,
  organization_id uuid references public.organizations (id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'ข้อมูลผู้ใช้งานเพิ่มเติม ผูกกับ auth.users แบบ 1:1 ผ่าน trigger handle_new_user';

-- ----------------------------------------------------------------------------
-- user_roles: การกำหนดบทบาทให้ผู้ใช้ (ผู้ใช้หนึ่งคนมีได้หลายบทบาท)
-- ----------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

comment on table public.user_roles is 'การกำหนดบทบาทให้ผู้ใช้งานแต่ละคน';

-- ----------------------------------------------------------------------------
-- authors: รายชื่อผู้วิจัย (อาจไม่ใช่ผู้ใช้งานระบบก็ได้ เช่น ผู้วิจัยร่วมภายนอก)
-- ----------------------------------------------------------------------------
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_id uuid references public.organizations (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.authors is 'รายชื่อผู้วิจัย/ผู้แต่งงานวิจัย';

-- ----------------------------------------------------------------------------
-- research_items: งานวิจัยแต่ละรายการ (ตารางหลักของระบบ)
-- ----------------------------------------------------------------------------
create table public.research_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_th text not null,
  title_en text,
  organization_id uuid references public.organizations (id) on delete set null,
  year integer not null check (year between 2400 and 2700),
  abstract text not null,
  cover_image text,
  pdf_file text,
  page_count integer not null default 0 check (page_count >= 0),
  access_level text not null default 'public'
    check (access_level in ('public', 'member_only', 'staff_only', 'read_only', 'metadata_only')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'revision_requested', 'approved', 'published', 'rejected', 'archived')),
  views bigint not null default 0 check (views >= 0),
  downloads bigint not null default 0 check (downloads >= 0),
  submitted_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.research_items is 'งานวิจัย/เอกสาร eBook แต่ละรายการ (ตารางหลัก)';

-- ----------------------------------------------------------------------------
-- research_authors: ความสัมพันธ์ many-to-many ระหว่างงานวิจัยกับผู้วิจัย
-- ----------------------------------------------------------------------------
create table public.research_authors (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.research_items (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  author_order integer not null default 1 check (author_order > 0),
  unique (research_id, author_id)
);

-- ----------------------------------------------------------------------------
-- research_categories: ความสัมพันธ์ many-to-many ระหว่างงานวิจัยกับหมวดหมู่
-- ----------------------------------------------------------------------------
create table public.research_categories (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.research_items (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  unique (research_id, category_id)
);

-- ----------------------------------------------------------------------------
-- keywords / research_keywords: คำสำคัญของงานวิจัย
-- ----------------------------------------------------------------------------
create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  created_at timestamptz not null default now()
);

create table public.research_keywords (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.research_items (id) on delete cascade,
  keyword_id uuid not null references public.keywords (id) on delete cascade,
  unique (research_id, keyword_id)
);

-- ----------------------------------------------------------------------------
-- favorites: รายการโปรดของผู้ใช้ (Member ขึ้นไป)
-- ----------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  research_id uuid not null references public.research_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, research_id)
);

-- ----------------------------------------------------------------------------
-- reading_history: ประวัติการอ่านออนไลน์
-- ----------------------------------------------------------------------------
create table public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  research_id uuid not null references public.research_items (id) on delete cascade,
  read_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- download_logs: ประวัติการดาวน์โหลด (รองรับผู้ใช้ที่ไม่ได้เข้าสู่ระบบด้วย)
-- ----------------------------------------------------------------------------
create table public.download_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  research_id uuid not null references public.research_items (id) on delete cascade,
  downloaded_at timestamptz not null default now(),
  ip_address inet
);

-- ----------------------------------------------------------------------------
-- audit_logs: บันทึกการกระทำสำคัญในระบบ (สำหรับการตรวจสอบย้อนหลัง)
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index idx_profiles_organization_id on public.profiles (organization_id);

create index idx_user_roles_user_id on public.user_roles (user_id);
create index idx_user_roles_role_id on public.user_roles (role_id);

create index idx_authors_organization_id on public.authors (organization_id);
create index idx_authors_name_trgm on public.authors using gin (name gin_trgm_ops);

create index idx_research_items_status on public.research_items (status);
create index idx_research_items_access_level on public.research_items (access_level);
create index idx_research_items_organization_id on public.research_items (organization_id);
create index idx_research_items_year on public.research_items (year);
create index idx_research_items_submitted_by on public.research_items (submitted_by);
create index idx_research_items_published_at on public.research_items (published_at desc);
create index idx_research_items_status_access on public.research_items (status, access_level);
create index idx_research_items_title_th_trgm on public.research_items using gin (title_th gin_trgm_ops);
create index idx_research_items_title_en_trgm on public.research_items using gin (title_en gin_trgm_ops);
create index idx_research_items_abstract_trgm on public.research_items using gin (abstract gin_trgm_ops);

create index idx_research_authors_research_id on public.research_authors (research_id);
create index idx_research_authors_author_id on public.research_authors (author_id);

create index idx_research_categories_research_id on public.research_categories (research_id);
create index idx_research_categories_category_id on public.research_categories (category_id);

create index idx_research_keywords_research_id on public.research_keywords (research_id);
create index idx_research_keywords_keyword_id on public.research_keywords (keyword_id);
create index idx_keywords_keyword_trgm on public.keywords using gin (keyword gin_trgm_ops);

create index idx_favorites_user_id on public.favorites (user_id);
create index idx_favorites_research_id on public.favorites (research_id);

create index idx_reading_history_user_id on public.reading_history (user_id);
create index idx_reading_history_research_id on public.reading_history (research_id);

create index idx_download_logs_user_id on public.download_logs (user_id);
create index idx_download_logs_research_id on public.download_logs (research_id);

create index idx_audit_logs_actor_id on public.audit_logs (actor_id);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
