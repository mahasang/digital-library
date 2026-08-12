-- ============================================================================
-- Phase 22: ตรวจงานวิจัยซ้ำย้อนหลังทั้งระบบ (background job แบบ batch) +
-- เกณฑ์ตรวจข้อมูลซ้ำที่ปรับน้ำหนักได้ (versioned) + MFA Overview สำหรับ
-- Super Admin — ไม่มีการรวมข้อมูล (merge) อัตโนมัติที่ไหนเพิ่มขึ้นเลย ทุกการ
-- ตรวจสอบยังคงเป็นแค่การ "แจ้งเตือน/บันทึกคู่ที่น่าสงสัย" เหมือนเดิมทุกประการ
-- (ดู supabase/migrations/20260809100000_data_quality_authority_control.sql)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. duplicate_detection_rules: เกณฑ์การให้คะแนนงานวิจัยซ้ำแบบ versioned —
--    แต่ละแถวคือหนึ่งเวอร์ชัน (append-only ไม่ update ทับ) มีแค่แถวเดียวที่
--    is_active = true ในแต่ละครั้ง — บันทึกไว้ที่ duplicate_research_reviews.
--    rule_version_id เพื่อตรวจสอบย้อนหลังได้เสมอว่าผลลัพธ์คู่ใดเกิดจากเกณฑ์ใด
-- ----------------------------------------------------------------------------
create table public.duplicate_detection_rules (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  weight_title numeric not null check (weight_title >= 0 and weight_title <= 100),
  weight_author numeric not null check (weight_author >= 0 and weight_author <= 100),
  weight_year numeric not null check (weight_year >= 0 and weight_year <= 100),
  weight_identifier numeric not null check (weight_identifier >= 0 and weight_identifier <= 100),
  weight_file_hash numeric not null check (weight_file_hash >= 0 and weight_file_hash <= 100),
  threshold_low numeric not null check (threshold_low >= 0 and threshold_low <= 100),
  threshold_medium numeric not null check (threshold_medium >= 0 and threshold_medium <= 100),
  threshold_high numeric not null check (threshold_high >= 0 and threshold_high <= 100),
  is_active boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (weight_title + weight_author + weight_year + weight_identifier + weight_file_hash = 100),
  check (threshold_low <= threshold_medium and threshold_medium <= threshold_high)
);

comment on table public.duplicate_detection_rules is
  'เกณฑ์การให้คะแนนงานวิจัยซ้ำแบบ versioned — Super Admin ปรับได้ที่ /superadmin/data-quality/settings แต่ละการแก้ไขสร้างแถวใหม่เสมอ (ไม่ update ทับ) เพื่อตรวจสอบย้อนหลังได้ว่าผลลัพธ์เกิดจากเกณฑ์เวอร์ชันใด';

create unique index idx_duplicate_detection_rules_version on public.duplicate_detection_rules (version);
-- มีได้แค่แถวเดียวที่ active ในแต่ละครั้ง (partial unique index บนค่าคงที่ true)
create unique index idx_duplicate_detection_rules_one_active on public.duplicate_detection_rules ((true))
  where is_active;

alter table public.duplicate_detection_rules enable row level security;

-- อ่านได้ทั้ง authenticated (rank >= 20 เท่ากับสิทธิ์ตรวจซ้ำเดิม — ต้องอ่าน
-- เกณฑ์ที่ active เพื่อคำนวณคะแนนตอนส่ง/แก้ไขงานวิจัย) และ service_role (job
-- handler ของ bulk scan) เขียนได้เฉพาะ Super Admin (rank >= 50) เท่านั้น
grant select, insert, update on public.duplicate_detection_rules to authenticated;
grant select, insert, update on public.duplicate_detection_rules to service_role;

create policy "duplicate_detection_rules_select_staff" on public.duplicate_detection_rules
  for select using (public.user_max_role_rank() >= 20);

-- ป้องกันชั้น RLS เผื่อมีใครพยายามเขียนตรงโดยไม่ผ่านฟังก์ชัน
-- create_duplicate_detection_rule_version() ด้านล่าง (ฟังก์ชันนั้นเป็น
-- security definer ตรวจ rank เองอีกชั้นอยู่แล้ว ไม่ได้พึ่ง policy นี้เพียง
-- อย่างเดียว — RBAC สองชั้นตามธรรมเนียมเดิมของโปรเจกต์)
create policy "duplicate_detection_rules_manage_super_admin" on public.duplicate_detection_rules
  for insert to authenticated
  with check (public.user_max_role_rank() >= 50);

create policy "duplicate_detection_rules_deactivate_super_admin" on public.duplicate_detection_rules
  for update to authenticated
  using (public.user_max_role_rank() >= 50)
  with check (public.user_max_role_rank() >= 50);

-- ค่าเริ่มต้น (version 1, active) — ใกล้เคียงน้ำหนักเดิมที่เคยตายตัวในโค้ด
-- (ชื่อเรื่อง 0.5, ปี 0.1, ผู้วิจัยหลัก 0.2 — ส่วนที่เหลือ 0.2 เดิมให้คะแนนเต็ม
-- ทันทีเมื่อ ISBN/DOI/PDF hash ตรงกัน ตอนนี้แยกเป็นน้ำหนักของตัวเอง) threshold
-- ต่ำสุดตรงกับ MIN_SCORE_TO_RECORD เดิม (0.35 = 35)
insert into public.duplicate_detection_rules (
  version, weight_title, weight_author, weight_year, weight_identifier, weight_file_hash,
  threshold_low, threshold_medium, threshold_high, is_active
) values (1, 50, 20, 10, 15, 5, 35, 60, 85, true);

-- ----------------------------------------------------------------------------
-- create_duplicate_detection_rule_version(): สร้างเกณฑ์เวอร์ชันใหม่แบบ atomic
-- (ปิดใช้งานเวอร์ชันเดิม + สร้างเวอร์ชันใหม่ในธุรกรรมเดียว) — ต้องทำใน SQL
-- function เดียวกันเพราะ partial unique index บน is_active อนุญาตแค่แถวเดียว
-- ที่ active พร้อมกัน ทำสอง statement แยกจาก TypeScript เสี่ยง race condition
-- ระหว่าง Super Admin สองคนแก้พร้อมกัน (เหมือนเหตุผลที่ merge_authors/
-- merge_organizations/merge_research_items ของช่วงที่ 19 เป็น SQL function
-- ไม่ใช่ TypeScript หลายคำสั่งต่อกัน) ตรวจสอบสิทธิ์ rank >= 50 ในตัวเองเสมอ
-- (RBAC สองชั้น ไม่เชื่อว่า Server Action ตรวจแล้วชั้นเดียว)
-- ----------------------------------------------------------------------------
create or replace function public.create_duplicate_detection_rule_version(
  p_weight_title numeric,
  p_weight_author numeric,
  p_weight_year numeric,
  p_weight_identifier numeric,
  p_weight_file_hash numeric,
  p_threshold_low numeric,
  p_threshold_medium numeric,
  p_threshold_high numeric
)
returns public.duplicate_detection_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_version int;
  v_result public.duplicate_detection_rules;
begin
  if public.user_max_role_rank() < 50 then
    raise exception 'ต้องเป็น Super Admin เท่านั้นจึงจะปรับเกณฑ์ตรวจข้อมูลซ้ำได้'
      using errcode = 'P0001';
  end if;

  update public.duplicate_detection_rules set is_active = false where is_active;

  select coalesce(max(version), 0) + 1 into v_new_version from public.duplicate_detection_rules;

  insert into public.duplicate_detection_rules (
    version, weight_title, weight_author, weight_year, weight_identifier, weight_file_hash,
    threshold_low, threshold_medium, threshold_high, is_active, created_by
  ) values (
    v_new_version, p_weight_title, p_weight_author, p_weight_year, p_weight_identifier, p_weight_file_hash,
    p_threshold_low, p_threshold_medium, p_threshold_high, true, auth.uid()
  )
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_duplicate_detection_rule_version(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;

comment on function public.create_duplicate_detection_rule_version is
  'สร้างเกณฑ์ตรวจข้อมูลซ้ำเวอร์ชันใหม่แบบ atomic (ปิดเวอร์ชันเดิม + สร้างใหม่) — ดู docs/data-quality.md';

-- ----------------------------------------------------------------------------
-- 2. duplicate_research_reviews: เพิ่มคอลัมน์อ้างอิงเกณฑ์ที่ใช้ตอนตรวจพบคู่นี้
-- ----------------------------------------------------------------------------
alter table public.duplicate_research_reviews
  add column rule_version_id uuid references public.duplicate_detection_rules (id) on delete set null;

comment on column public.duplicate_research_reviews.rule_version_id is
  'เกณฑ์ (duplicate_detection_rules) ที่ active ตอนตรวจพบคู่นี้ — null สำหรับแถวเก่าก่อนช่วงที่ 22 ที่ยังใช้ค่าคงที่ในโค้ดเดิม';

-- grant service_role สำหรับ job handler ของ bulk scan (เดิมมีแค่ authenticated
-- — validateSubmissionFiles/detectDuplicatesForResearchItem เดิมเรียกผ่าน
-- client ของผู้ส่ง/แก้ไขงานวิจัยเองเท่านั้น ไม่เคยผ่าน service role มาก่อน)
grant select, insert, update on public.duplicate_research_reviews to service_role;

-- ----------------------------------------------------------------------------
-- 3. background_jobs: เพิ่ม job type ใหม่ `duplicate_scan` สำหรับตรวจงานวิจัย
--    ซ้ำย้อนหลังทั้งระบบแบบ batch (หนึ่ง job ต่อหนึ่งงานวิจัย เหมือนรูปแบบ
--    pdf_text_extraction/file_security_rescan ของช่วงที่ 20 ทุกประการ)
-- ----------------------------------------------------------------------------
alter table public.background_jobs drop constraint background_jobs_job_type_check;
alter table public.background_jobs add constraint background_jobs_job_type_check
  check (
    job_type in (
      'pdf_text_extraction',
      'file_security_rescan',
      'access_expiration',
      'category_notification',
      'duplicate_scan'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. find_similar_research_items(): เดิมตรวจสิทธิ์ผ่าน user_max_role_rank()
--    ซึ่งอ่าน auth.uid() ของผู้เรียก — เมื่อเรียกผ่าน Service Role (ไม่มี
--    auth.uid() เป็นของผู้ใช้คนใดคนหนึ่ง) จะได้ rank = 0 เสมอ ทำให้ฟังก์ชันคืน
--    ค่าว่างทุกครั้ง เพิ่มเงื่อนไขให้ข้ามการตรวจ rank เมื่อผู้เรียกคือ
--    service_role โดยตรง (auth.role() = 'service_role' เป็นค่ามาตรฐานจาก JWT
--    ของ Supabase ไม่ใช่ค่าที่ผู้ใช้ทั่วไปปลอมแปลงได้) — ใช้เฉพาะ job handler
--    ฝั่งเซิร์ฟเวอร์ที่เชื่อถือได้เท่านั้น (ป้องกันด้วย SUPABASE_SERVICE_ROLE_KEY
--    อยู่แล้ว) ไม่กระทบการตรวจสอบสิทธิ์ของผู้ใช้ทั่วไปเลยแม้แต่จุดเดียว —
--    logic การหาแคนดิเดตภายในฟังก์ชันไม่เปลี่ยนแปลง
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
  if public.user_max_role_rank() < 20 and auth.role() <> 'service_role' then
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
