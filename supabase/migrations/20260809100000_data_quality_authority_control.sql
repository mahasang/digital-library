-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — ช่วงที่ 19
-- "คุณภาพข้อมูลและข้อมูลมาตรฐาน" (Data Quality / Authority Control)
--
-- ครอบคลุม: ผู้วิจัยมาตรฐาน (authors), หน่วยงานมาตรฐาน (organizations) พร้อม
-- โครงสร้างหลัก/ย่อย, ORCID, ตรวจสอบงานวิจัยซ้ำ, และกลไกรวมข้อมูล (merge) ที่
-- ปลอดภัยสำหรับผู้วิจัย/หน่วยงาน/งานวิจัย — ไม่มีการรวมข้อมูลอัตโนมัติที่ไหน
-- เลยในไฟล์นี้ ทุกฟังก์ชัน merge_* ต้องถูกเรียกโดยเจ้าหน้าที่ผ่าน UI เท่านั้น
-- (ตรวจสอบสิทธิ์ซ้ำในตัวฟังก์ชันเองด้วยเสมอ แม้จะเรียกผ่าน Server Action ที่
-- ตรวจ rank มาแล้วชั้นหนึ่งก็ตาม — รูปแบบ "RBAC สองชั้น" เดิมของโปรเจกต์)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. ฟังก์ชัน normalize ข้อความที่ใช้ร่วมกัน (immutable — ใช้ทำ index/trigger ได้)
-- ----------------------------------------------------------------------------
create or replace function public.normalize_text_for_matching(p_text text)
returns text
language sql
immutable
as $$
  select case
    when p_text is null or btrim(p_text) = '' then null
    else lower(btrim(regexp_replace(p_text, '\s+', ' ', 'g')))
  end;
$$;

comment on function public.normalize_text_for_matching is
  'ตัดช่องว่างซ้ำ/หัวท้าย และแปลงเป็นตัวพิมพ์เล็ก — ใช้เตรียมข้อความสำหรับเปรียบเทียบความคล้าย (ชื่อเรื่อง) เท่านั้น ไม่ตัดคำนำหน้า';

create or replace function public.normalize_person_name(p_text text)
returns text
language sql
immutable
as $$
  select case
    when p_text is null or btrim(p_text) = '' then null
    else lower(btrim(regexp_replace(
      regexp_replace(btrim(p_text), '\s+', ' ', 'g'),
      '^(ดร\.?|ศาสตราจารย์|รองศาสตราจารย์|ผู้ช่วยศาสตราจารย์|ศ\.|รศ\.|ผศ\.|นาย|นาง|นางสาว|น\.ส\.|Dr\.?|Prof\.?|Assoc\.?\s*Prof\.?|Asst\.?\s*Prof\.?|Mr\.?|Mrs\.?|Ms\.?)\s*',
      '', 'i'
    )))
  end;
$$;

comment on function public.normalize_person_name is
  'ตัดช่องว่างซ้ำและคำนำหน้าชื่อที่พบบ่อย (ไทย/อังกฤษ) แล้วแปลงเป็นตัวพิมพ์เล็ก — เป็นการปรับรูปแบบแบบ heuristic เพื่อช่วยการเปรียบเทียบความคล้ายเท่านั้น ห้ามใช้เป็นเกณฑ์ตัดสินว่าเป็นคนเดียวกันโดยอัตโนมัติ (ดู docs/data-quality.md)';

-- ----------------------------------------------------------------------------
-- 1. authors: เพิ่มคอลัมน์สำหรับผู้วิจัยมาตรฐาน + ORCID
--    หมายเหตุ: คอลัมน์ `name` เดิมยังคงใช้เป็น "ชื่อแสดงผลภาษาไทย" ตามเดิมทุก
--    ประการ (โค้ดเดิมทั้งหมดอ้างอิง authors.name อยู่แล้ว) — ไม่เพิ่มคอลัมน์
--    display_name_th ซ้ำซ้อนกับ name ตามข้อกำหนด "ห้ามสร้างคอลัมน์ซ้ำ" มีแต่
--    เพิ่ม display_name_en ใหม่สำหรับชื่ออังกฤษเท่านั้น
-- ----------------------------------------------------------------------------
alter table public.authors
  add column display_name_en text,
  add column normalized_name_th text,
  add column normalized_name_en text,
  add column title_prefix_th text,
  add column title_prefix_en text,
  add column orcid text,
  add column orcid_verified_at timestamptz,
  add column biography text,
  add column is_active boolean not null default true,
  add column merged_into_author_id uuid references public.authors (id) on delete set null;

comment on column public.authors.name is 'ชื่อแสดงผลภาษาไทย (ธรรมเนียมเดิมของระบบ) — เทียบเท่า display_name_th ตามข้อกำหนดใหม่';
comment on column public.authors.display_name_en is 'ชื่อแสดงผลภาษาอังกฤษ (ไม่บังคับ)';
comment on column public.authors.orcid is 'รูปแบบมาตรฐาน 0000-0000-0000-000X ตรวจ checksum ฝั่งแอปพลิเคชันก่อนบันทึกเสมอ (ดู lib/validation/orcid.ts)';
comment on column public.authors.orcid_verified_at is 'วันเวลาที่เจ้าหน้าที่ยืนยันว่าตรวจสอบ ORCID นี้แล้ว — ไม่ได้แปลว่ายืนยันจาก ORCID API จริง เว้นแต่จะเชื่อมต่อ OAuth ในอนาคต (ดู docs/orcid-integration.md)';
comment on column public.authors.merged_into_author_id is 'ชี้ไปยังผู้วิจัยหลักเมื่อถูกรวมข้อมูลแล้ว — แถวนี้จะไม่ถูกลบและยังอ้างอิงได้เสมอ (ห้าม hard delete ผู้วิจัยที่มีงานวิจัยอ้างอิง)';

-- รูปแบบ ORCID ระดับฐานข้อมูล (ตรวจแค่รูปแบบ ไม่ตรวจ checksum — checksum ตรวจ
-- ฝั่งแอปพลิเคชันเสมอก่อนถึงชั้นนี้ ดู lib/validation/orcid.ts)
alter table public.authors
  add constraint authors_orcid_format check (
    orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$'
  );

-- ORCID ห้ามซ้ำกัน ยกเว้นแถวที่ถูก merge แล้ว (merged_into_author_id not null)
-- หรือปิดใช้งานแล้ว — อนุญาตให้ผู้วิจัยที่ถูกรวมเก็บค่า ORCID เดิมไว้เป็น
-- ประวัติได้โดยไม่ชนกับผู้วิจัยหลักที่มี ORCID เดียวกัน
create unique index idx_authors_orcid_unique_active on public.authors (orcid)
  where orcid is not null and merged_into_author_id is null and is_active = true;

create index idx_authors_normalized_name_th_trgm on public.authors
  using gin (normalized_name_th gin_trgm_ops);
create index idx_authors_normalized_name_en_trgm on public.authors
  using gin (normalized_name_en gin_trgm_ops) where normalized_name_en is not null;
create index idx_authors_merged_into on public.authors (merged_into_author_id)
  where merged_into_author_id is not null;

create or replace function public.authors_set_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name_th := public.normalize_person_name(new.name);
  new.normalized_name_en := public.normalize_person_name(new.display_name_en);
  return new;
end;
$$;

create trigger trg_authors_set_normalized_name
  before insert or update of name, display_name_en on public.authors
  for each row execute function public.authors_set_normalized_name();

-- backfill แถวเดิมที่มีอยู่ก่อน migration นี้
update public.authors set name = name;

-- ----------------------------------------------------------------------------
-- 2. organizations: เพิ่มโครงสร้างหลัก/ย่อย + normalize + merge
--    ใช้ชื่อคอลัมน์ parent_id (ไม่ใช่ parent_organization_id) ให้สอดคล้องกับ
--    รูปแบบ categories.parent_id เดิมที่มีอยู่แล้วในระบบ (Phase 12)
-- ----------------------------------------------------------------------------
alter table public.organizations
  add column normalized_name_th text,
  add column normalized_name_en text,
  add column parent_id uuid references public.organizations (id) on delete set null,
  add column organization_code text,
  add column website_url text,
  add column merged_into_organization_id uuid references public.organizations (id) on delete set null;

comment on column public.organizations.parent_id is 'หน่วยงานหลัก (เทียบเท่า parent_organization_id ตามข้อกำหนด — ใช้ชื่อคอลัมน์เดียวกับ categories.parent_id เพื่อความสอดคล้องของโครงสร้างเดิม)';
comment on column public.organizations.merged_into_organization_id is 'ชี้ไปยังหน่วยงานหลักเมื่อถูกรวมข้อมูลแล้ว — ห้าม hard delete หน่วยงานที่มีการอ้างอิงอยู่';

create index idx_organizations_normalized_name_th_trgm on public.organizations
  using gin (normalized_name_th gin_trgm_ops);
create index idx_organizations_parent_id on public.organizations (parent_id);
create index idx_organizations_merged_into on public.organizations (merged_into_organization_id)
  where merged_into_organization_id is not null;

create or replace function public.organizations_set_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name_th := public.normalize_text_for_matching(new.name_th);
  new.normalized_name_en := public.normalize_text_for_matching(new.name_en);
  return new;
end;
$$;

create trigger trg_organizations_set_normalized_name
  before insert or update of name_th, name_en on public.organizations
  for each row execute function public.organizations_set_normalized_name();

update public.organizations set name_th = name_th;

-- ป้องกัน parent_id วนซ้ำ — โครงสร้างเดียวกับ prevent_category_cycle() (Phase 12)
create or replace function public.prevent_organization_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid;
  v_depth integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'หน่วยงานไม่สามารถเป็นหน่วยงานหลักของตัวเองได้' using errcode = 'P0001';
  end if;

  v_current := new.parent_id;
  while v_current is not null and v_depth < 100 loop
    if v_current = new.id then
      raise exception 'ไม่สามารถกำหนดหน่วยงานหลักแบบวนกลับมาที่ตัวเองได้ (circular reference)' using errcode = 'P0001';
    end if;
    select parent_id into v_current from public.organizations where id = v_current;
    v_depth := v_depth + 1;
  end loop;

  return new;
end;
$$;

create trigger trg_prevent_organization_cycle
  before insert or update of parent_id on public.organizations
  for each row execute function public.prevent_organization_cycle();

-- ----------------------------------------------------------------------------
-- 3. research_authors: เพิ่มบทบาทผู้วิจัย (ผู้วิจัยหลัก/ผู้ร่วมวิจัย)
-- ----------------------------------------------------------------------------
alter table public.research_authors
  add column author_role text not null default 'co_investigator'
    check (author_role in ('principal_investigator', 'co_investigator'));

comment on column public.research_authors.author_role is 'บทบาทของผู้วิจัยต่องานวิจัยนี้ — principal_investigator (ผู้วิจัยหลัก) หรือ co_investigator (ผู้ร่วมวิจัย)';

-- งานวิจัยเดิมทั้งหมด: ตั้งผู้วิจัยลำดับที่ 1 เป็นผู้วิจัยหลักโดยอัตโนมัติ (ค่า
-- เริ่มต้นที่สมเหตุสมผลที่สุดจากข้อมูลเดิม — เจ้าหน้าที่แก้ไขภายหลังได้ตามจริง)
update public.research_authors set author_role = 'principal_investigator' where author_order = 1;

-- ----------------------------------------------------------------------------
-- 4. research_items: ISBN/DOI + ชื่อเรื่องแบบ normalize (สำหรับตรวจซ้ำ) +
--    การรวมงานวิจัย (merge) — ขยาย status ให้รองรับค่า 'merged' ใหม่
-- ----------------------------------------------------------------------------
alter table public.research_items
  add column isbn text,
  add column doi text,
  add column normalized_title_th text,
  add column normalized_title_en text,
  add column merged_into_research_item_id uuid references public.research_items (id) on delete set null;

comment on column public.research_items.merged_into_research_item_id is 'ชี้ไปยังงานวิจัยหลักเมื่อถูกรวมข้อมูลแล้ว (status จะเป็น merged) — หน้ารายละเอียด/อ่านจะ redirect ไปยังรายการหลักแทน';

alter table public.research_items drop constraint research_items_status_check;
alter table public.research_items add constraint research_items_status_check
  check (status in (
    'draft', 'pending_review', 'revision_requested', 'approved',
    'published', 'rejected', 'archived', 'merged'
  ));

create index idx_research_items_normalized_title_th_trgm on public.research_items
  using gin (normalized_title_th gin_trgm_ops);
create index idx_research_items_normalized_title_en_trgm on public.research_items
  using gin (normalized_title_en gin_trgm_ops) where normalized_title_en is not null;
create index idx_research_items_isbn on public.research_items (isbn) where isbn is not null;
create index idx_research_items_doi on public.research_items (doi) where doi is not null;
create index idx_research_items_merged_into on public.research_items (merged_into_research_item_id)
  where merged_into_research_item_id is not null;

create or replace function public.research_items_set_normalized_title()
returns trigger
language plpgsql
as $$
begin
  new.normalized_title_th := public.normalize_text_for_matching(new.title_th);
  new.normalized_title_en := public.normalize_text_for_matching(new.title_en);
  return new;
end;
$$;

create trigger trg_research_items_set_normalized_title
  before insert or update of title_th, title_en on public.research_items
  for each row execute function public.research_items_set_normalized_title();

update public.research_items set title_th = title_th;

-- ----------------------------------------------------------------------------
-- 5. duplicate_research_reviews: คิวตรวจสอบงานวิจัยที่อาจซ้ำ
--    เก็บคู่แบบ canonical เสมอ (research_item_id < candidate_research_item_id
--    ตามลำดับ uuid) กันแถวซ้ำซ้อนสำหรับคู่เดียวกัน
-- ----------------------------------------------------------------------------
create table public.duplicate_research_reviews (
  id uuid primary key default gen_random_uuid(),
  research_item_id uuid not null references public.research_items (id) on delete cascade,
  candidate_research_item_id uuid not null references public.research_items (id) on delete cascade,
  similarity_score real not null check (similarity_score >= 0 and similarity_score <= 1),
  similarity_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed_duplicate', 'not_duplicate', 'merged')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (research_item_id < candidate_research_item_id)
);

comment on table public.duplicate_research_reviews is 'คู่งานวิจัยที่ระบบตรวจพบว่าอาจซ้ำกัน — สร้างอัตโนมัติเมื่อเพิ่ม/แก้ไขงานวิจัย (ดู find_similar_research_items) ไม่เคยบล็อกการบันทึกงานวิจัยเอง เป็นแค่คำเตือนให้เจ้าหน้าที่ตรวจสอบ';

create unique index idx_duplicate_research_reviews_pair on public.duplicate_research_reviews
  (research_item_id, candidate_research_item_id);
create index idx_duplicate_research_reviews_status on public.duplicate_research_reviews (status);

create trigger trg_duplicate_research_reviews_updated_at
  before update on public.duplicate_research_reviews
  for each row execute function public.set_updated_at();

alter table public.duplicate_research_reviews enable row level security;
grant select, insert, update on public.duplicate_research_reviews to authenticated;

-- select/ตัดสินสถานะ (confirm/dismiss/merge) สงวนไว้เฉพาะเจ้าหน้าที่ (rank >=
-- 30) เท่านั้น ตรงกับหน้า /dashboard/duplicate-reviews
create policy "duplicate_research_reviews_select_staff" on public.duplicate_research_reviews
  for select using (public.user_max_role_rank() >= 30);
create policy "duplicate_research_reviews_review_staff" on public.duplicate_research_reviews
  for update using (public.user_max_role_rank() >= 30)
  with check (public.user_max_role_rank() >= 30);

-- insert/upsert อัตโนมัติจาก detectDuplicatesForResearchItem() รันด้วย client
-- ของผู้ส่ง/แก้ไขงานวิจัยเอง (rank >= 20 เท่ากับสิทธิ์ส่งงานวิจัยขั้นต่ำเดิม
-- ตรงกับเงื่อนไขภายใน find_similar_research_items) — แยกจาก policy ตัดสิน
-- สถานะด้านบนซึ่งสงวนไว้ที่ rank >= 30 เท่านั้น การ upsert (insert ... on
-- conflict do update) ของระบบต้องมีทั้งสิทธิ์ insert และ update จึงต้องมี
-- policy update สำหรับ rank >= 20 แยกต่างหากด้วย (จำกัดเฉพาะตอนแถวยัง pending
-- เท่านั้น — กันไม่ให้ rank ต่ำกว่าเจ้าหน้าที่ไปแก้ไขผลตัดสินที่ยืนยันแล้ว)
create policy "duplicate_research_reviews_insert_system" on public.duplicate_research_reviews
  for insert with check (public.user_max_role_rank() >= 20);
create policy "duplicate_research_reviews_refresh_system" on public.duplicate_research_reviews
  for update using (public.user_max_role_rank() >= 20 and status = 'pending')
  with check (public.user_max_role_rank() >= 20 and status = 'pending');

-- ----------------------------------------------------------------------------
-- 6. find_similar_research_items(): หาแคนดิเดตที่อาจซ้ำกับงานวิจัยที่ระบุ —
--    security definer (ต้องเทียบกับงานวิจัยทุกสถานะ ไม่ใช่แค่ที่มองเห็นผ่าน
--    RLS ปกติ) จึงตรวจสิทธิ์ในตัวฟังก์ชันเอง (rank >= 20 เท่ากับสิทธิ์ส่งงาน
--    วิจัยขั้นต่ำเดิม) กัน Member/Guest ใช้สำรวจหางานวิจัยที่ยังไม่เผยแพร่ของ
--    คนอื่นผ่านช่องทางนี้
-- ----------------------------------------------------------------------------
create or replace function public.find_similar_research_items(p_research_item_id uuid)
returns table (
  candidate_id uuid,
  title_similarity_th real,
  title_similarity_en real,
  same_year boolean,
  same_isbn boolean,
  same_doi boolean,
  same_pdf_hash boolean,
  same_principal_author boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.user_max_role_rank() < 20 then
    return;
  end if;

  return query
  select
    ri2.id,
    similarity(coalesce(ri1.normalized_title_th, ''), coalesce(ri2.normalized_title_th, '')),
    case
      when ri1.normalized_title_en is null or ri2.normalized_title_en is null then 0::real
      else similarity(ri1.normalized_title_en, ri2.normalized_title_en)
    end,
    ri1.year = ri2.year,
    (ri1.isbn is not null and ri1.isbn = ri2.isbn),
    (ri1.doi is not null and ri1.doi = ri2.doi),
    exists (
      select 1 from public.research_document_texts t1
      join public.research_document_texts t2
        on t2.source_file_hash = t1.source_file_hash
      where t1.research_item_id = ri1.id
        and t2.research_item_id = ri2.id
        and t1.source_file_hash is not null
    ),
    exists (
      select 1 from public.research_authors ra1
      join public.research_authors ra2 on ra2.author_id = ra1.author_id
      where ra1.research_id = ri1.id and ra1.author_role = 'principal_investigator'
        and ra2.research_id = ri2.id and ra2.author_role = 'principal_investigator'
    )
  from public.research_items ri1
  join public.research_items ri2 on ri2.id != ri1.id
  where ri1.id = p_research_item_id
    and ri2.status not in ('archived', 'rejected', 'merged')
    and ri2.merged_into_research_item_id is null
    and (
      similarity(coalesce(ri1.normalized_title_th, ''), coalesce(ri2.normalized_title_th, '')) > 0.3
      or (
        ri1.normalized_title_en is not null and ri2.normalized_title_en is not null
        and similarity(ri1.normalized_title_en, ri2.normalized_title_en) > 0.3
      )
      or (ri1.isbn is not null and ri1.isbn = ri2.isbn)
      or (ri1.doi is not null and ri1.doi = ri2.doi)
    )
  order by similarity(coalesce(ri1.normalized_title_th, ''), coalesce(ri2.normalized_title_th, '')) desc
  limit 20;
end;
$$;

grant execute on function public.find_similar_research_items(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. merge_authors(): รวมผู้วิจัย — ย้าย research_authors ไปยังผู้วิจัยหลัก
--    อย่างปลอดภัย (กันชนกับ unique(research_id, author_id) เดิม) ไม่ hard
--    delete ผู้วิจัยที่ถูกรวม แค่ตั้ง is_active=false + merged_into_author_id
-- ----------------------------------------------------------------------------
create or replace function public.merge_authors(
  p_source_id uuid,
  p_target_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_name text;
  v_target_name text;
begin
  if public.user_max_role_rank() < 30 then
    raise exception 'ต้องมีสิทธิ์บรรณารักษ์ขึ้นไปจึงจะรวมข้อมูลผู้วิจัยได้' using errcode = 'P0001';
  end if;

  if p_source_id = p_target_id then
    raise exception 'ไม่สามารถรวมผู้วิจัยเข้ากับตัวเองได้' using errcode = 'P0001';
  end if;

  select name into v_source_name from public.authors where id = p_source_id and merged_into_author_id is null;
  select name into v_target_name from public.authors where id = p_target_id and merged_into_author_id is null;

  if v_source_name is null or v_target_name is null then
    raise exception 'ไม่พบผู้วิจัยที่ระบุ หรือผู้วิจัยถูกรวมข้อมูลไปแล้ว' using errcode = 'P0001';
  end if;

  -- ลบความสัมพันธ์ของผู้วิจัยต้นทางที่ชนกับผู้วิจัยหลัก (งานวิจัยเดียวกันมีทั้งคู่อยู่แล้ว)
  delete from public.research_authors ra1
  where ra1.author_id = p_source_id
    and exists (
      select 1 from public.research_authors ra2
      where ra2.author_id = p_target_id and ra2.research_id = ra1.research_id
    );

  -- ย้ายความสัมพันธ์ที่เหลือไปยังผู้วิจัยหลัก
  update public.research_authors set author_id = p_target_id where author_id = p_source_id;

  update public.authors
  set merged_into_author_id = p_target_id, is_active = false
  where id = p_source_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'author_merge', 'authors', p_source_id,
    jsonb_build_object(
      'source_name', v_source_name, 'target_id', p_target_id,
      'target_name', v_target_name, 'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.merge_authors(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. merge_organizations(): รวมหน่วยงาน — ย้าย authors.organization_id,
--    research_items.organization_id และ parent_id ของหน่วยงานย่อยที่ผูกกับ
--    ต้นทางไปยังหน่วยงานหลัก
-- ----------------------------------------------------------------------------
create or replace function public.merge_organizations(
  p_source_id uuid,
  p_target_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_name text;
  v_target_name text;
begin
  if public.user_max_role_rank() < 30 then
    raise exception 'ต้องมีสิทธิ์บรรณารักษ์ขึ้นไปจึงจะรวมข้อมูลหน่วยงานได้' using errcode = 'P0001';
  end if;

  if p_source_id = p_target_id then
    raise exception 'ไม่สามารถรวมหน่วยงานเข้ากับตัวเองได้' using errcode = 'P0001';
  end if;

  select name_th into v_source_name from public.organizations where id = p_source_id and merged_into_organization_id is null;
  select name_th into v_target_name from public.organizations where id = p_target_id and merged_into_organization_id is null;

  if v_source_name is null or v_target_name is null then
    raise exception 'ไม่พบหน่วยงานที่ระบุ หรือหน่วยงานถูกรวมข้อมูลไปแล้ว' using errcode = 'P0001';
  end if;

  update public.authors set organization_id = p_target_id where organization_id = p_source_id;
  update public.research_items set organization_id = p_target_id where organization_id = p_source_id;
  -- หน่วยงานย่อยของต้นทาง ย้ายไปเป็นหน่วยงานย่อยของหน่วยงานหลักแทน
  update public.organizations set parent_id = p_target_id
    where parent_id = p_source_id and id != p_target_id;

  update public.organizations
  set merged_into_organization_id = p_target_id, is_active = false, parent_id = null
  where id = p_source_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'organization_merge', 'organizations', p_source_id,
    jsonb_build_object(
      'source_name', v_source_name, 'target_id', p_target_id,
      'target_name', v_target_name, 'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.merge_organizations(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. merge_research_items(): รวมงานวิจัย — ย้ายความสัมพันธ์ทั้งหมดอย่าง
--    ปลอดภัย (favorites/reading_history/download_logs/research_authors/
--    research_categories/research_keywords/access_requests/
--    document_access_grants/research_document_texts) แล้วตั้ง
--    merged_into_research_item_id + status='merged' บนรายการต้นทาง — สิทธิ์
--    Admin/Super Admin เท่านั้น (rank >= 40) เพราะกระทบความสัมพันธ์กว้างกว่า
--    การรวมผู้วิจัย/หน่วยงานมาก
-- ----------------------------------------------------------------------------
create or replace function public.merge_research_items(
  p_source_id uuid,
  p_target_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_title text;
  v_target_title text;
begin
  if public.user_max_role_rank() < 40 then
    raise exception 'ต้องมีสิทธิ์ผู้ดูแลระบบขึ้นไปจึงจะรวมงานวิจัยได้' using errcode = 'P0001';
  end if;

  if p_source_id = p_target_id then
    raise exception 'ไม่สามารถรวมงานวิจัยเข้ากับตัวเองได้' using errcode = 'P0001';
  end if;

  select title_th into v_source_title from public.research_items
    where id = p_source_id and merged_into_research_item_id is null;
  select title_th into v_target_title from public.research_items
    where id = p_target_id and merged_into_research_item_id is null;

  if v_source_title is null or v_target_title is null then
    raise exception 'ไม่พบงานวิจัยที่ระบุ หรืองานวิจัยถูกรวมไปแล้ว' using errcode = 'P0001';
  end if;

  -- favorites: unique(user_id, research_id) — ลบของต้นทางที่ผู้ใช้เดียวกันมีปลายทางอยู่แล้ว
  delete from public.favorites f1
  where f1.research_id = p_source_id
    and exists (select 1 from public.favorites f2 where f2.research_id = p_target_id and f2.user_id = f1.user_id);
  update public.favorites set research_id = p_target_id where research_id = p_source_id;

  -- reading_history / download_logs: ไม่มี unique constraint ย้ายได้ตรงๆ
  update public.reading_history set research_id = p_target_id where research_id = p_source_id;
  update public.download_logs set research_id = p_target_id where research_id = p_source_id;

  -- research_authors: unique(research_id, author_id)
  delete from public.research_authors ra1
  where ra1.research_id = p_source_id
    and exists (select 1 from public.research_authors ra2 where ra2.research_id = p_target_id and ra2.author_id = ra1.author_id);
  update public.research_authors set research_id = p_target_id where research_id = p_source_id;

  -- research_categories: unique(research_id, category_id)
  delete from public.research_categories rc1
  where rc1.research_id = p_source_id
    and exists (select 1 from public.research_categories rc2 where rc2.research_id = p_target_id and rc2.category_id = rc1.category_id);
  update public.research_categories set research_id = p_target_id where research_id = p_source_id;

  -- research_keywords: unique(research_id, keyword_id)
  delete from public.research_keywords rk1
  where rk1.research_id = p_source_id
    and exists (select 1 from public.research_keywords rk2 where rk2.research_id = p_target_id and rk2.keyword_id = rk1.keyword_id);
  update public.research_keywords set research_id = p_target_id where research_id = p_source_id;

  -- access_requests: partial unique(research_item_id, requester_id, request_type) where status in (pending, under_review)
  delete from public.access_requests ar1
  where ar1.research_item_id = p_source_id
    and ar1.status in ('pending', 'under_review')
    and exists (
      select 1 from public.access_requests ar2
      where ar2.research_item_id = p_target_id and ar2.requester_id = ar1.requester_id
        and ar2.request_type = ar1.request_type and ar2.status in ('pending', 'under_review')
    );
  update public.access_requests set research_item_id = p_target_id where research_item_id = p_source_id;

  -- document_access_grants: partial unique(research_item_id, user_id, access_type) where revoked_at is null
  delete from public.document_access_grants g1
  where g1.research_item_id = p_source_id
    and g1.revoked_at is null
    and exists (
      select 1 from public.document_access_grants g2
      where g2.research_item_id = p_target_id and g2.user_id = g1.user_id
        and g2.access_type = g1.access_type and g2.revoked_at is null
    );
  update public.document_access_grants set research_item_id = p_target_id where research_item_id = p_source_id;

  -- research_document_texts: unique(research_item_id) — เก็บของปลายทางไว้ถ้ามีอยู่แล้ว
  delete from public.research_document_texts t1
  where t1.research_item_id = p_source_id
    and exists (select 1 from public.research_document_texts t2 where t2.research_item_id = p_target_id);
  update public.research_document_texts set research_item_id = p_target_id where research_item_id = p_source_id;

  -- duplicate_research_reviews: ลบคู่ที่เกี่ยวข้องกับต้นทาง (ไม่มีความหมายอีกต่อไป)
  delete from public.duplicate_research_reviews
  where research_item_id = p_source_id or candidate_research_item_id = p_source_id;

  update public.research_items
  set status = 'merged', merged_into_research_item_id = p_target_id
  where id = p_source_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'research_merge', 'research_items', p_source_id,
    jsonb_build_object(
      'source_title', v_source_title, 'target_id', p_target_id,
      'target_title', v_target_title, 'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.merge_research_items(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. find_similar_authors_by_name() / find_similar_organizations_by_name():
--     หาชื่อผู้วิจัย/หน่วยงานที่คล้ายกัน (คำเตือนในหน้าเพิ่ม/แก้ไข) — rank >=
--     20 เท่านั้น (เท่ากับสิทธิ์ส่งงานวิจัยขั้นต่ำเดิม เนื่องจากใช้ตอนเพิ่ม
--     ผู้วิจัย/หน่วยงานใหม่ซึ่งอย่างน้อยต้องเป็น staff อยู่แล้ว)
-- ----------------------------------------------------------------------------
create or replace function public.find_similar_authors_by_name(p_name_th text, p_exclude_id uuid default null)
returns table (id uuid, name text, sim real)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.user_max_role_rank() < 20 then
    return;
  end if;

  return query
  select a.id, a.name, similarity(public.normalize_person_name(p_name_th), coalesce(a.normalized_name_th, ''))
  from public.authors a
  where a.merged_into_author_id is null
    and (p_exclude_id is null or a.id != p_exclude_id)
    and similarity(public.normalize_person_name(p_name_th), coalesce(a.normalized_name_th, '')) > 0.4
  order by 3 desc
  limit 10;
end;
$$;

grant execute on function public.find_similar_authors_by_name(text, uuid) to authenticated;

create or replace function public.find_similar_organizations_by_name(p_name_th text, p_exclude_id uuid default null)
returns table (id uuid, name_th text, sim real)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.user_max_role_rank() < 20 then
    return;
  end if;

  return query
  select o.id, o.name_th, similarity(public.normalize_text_for_matching(p_name_th), coalesce(o.normalized_name_th, ''))
  from public.organizations o
  where o.merged_into_organization_id is null
    and (p_exclude_id is null or o.id != p_exclude_id)
    and similarity(public.normalize_text_for_matching(p_name_th), coalesce(o.normalized_name_th, '')) > 0.4
  order by 3 desc
  limit 10;
end;
$$;

grant execute on function public.find_similar_organizations_by_name(text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 11. ขยาย research_items_select ให้มองเห็นแถวที่ status='merged' ได้ทุกคน —
--     เฉพาะเพื่อให้หน้าเว็บสาธารณะ redirect จาก URL เดิมไปยังรายการหลักได้
--     (เห็นแค่ metadata/merged_into_research_item_id ไม่ได้เปิดให้อ่าน/
--     ดาวน์โหลดไฟล์เพิ่มขึ้นแต่อย่างใด — สิทธิ์ไฟล์ยังคุมที่ access_level +
--     grant ของรายการหลักตามปกติทุกประการ) ไม่กระทบ policy เดิมของสถานะอื่น
--     เลยแม้แต่จุดเดียว เป็นการเพิ่ม branch OR ใหม่เท่านั้น
-- ----------------------------------------------------------------------------
drop policy "research_items_select" on public.research_items;
create policy "research_items_select" on public.research_items
  for select using (
    (
      status = 'published'
      and (
        access_level in ('public', 'read_only', 'metadata_only')
        or (access_level = 'member_only' and public.user_max_role_rank() >= 10)
        or (access_level = 'staff_only' and public.user_max_role_rank() >= 20)
      )
    )
    or status = 'merged'
    or submitted_by = auth.uid()
    or public.user_max_role_rank() >= 30
  );
