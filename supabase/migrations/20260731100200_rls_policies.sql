-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 2: RLS Policies
--
-- แนวคิด: Supabase อาศัยทั้ง GRANT (สิทธิ์ระดับตาราง) และ RLS Policy
-- (สิทธิ์ระดับแถว) ร่วมกัน — เราเปิด GRANT แบบกว้างให้ anon/authenticated
-- แล้วให้ RLS เป็นตัวจำกัดสิทธิ์จริงในระดับแถว
--
-- Role rank: member=10, staff=20, librarian=30, admin=40 (guest = ไม่มี rank)
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.categories enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.authors enable row level security;
alter table public.research_items enable row level security;
alter table public.research_authors enable row level security;
alter table public.research_categories enable row level security;
alter table public.keywords enable row level security;
alter table public.research_keywords enable row level security;
alter table public.favorites enable row level security;
alter table public.reading_history enable row level security;
alter table public.download_logs enable row level security;
alter table public.audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- GRANTS: เปิดสิทธิ์ระดับตารางแบบกว้าง แล้วให้ RLS policy จำกัดแถวจริง
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on
  public.organizations, public.categories, public.roles,
  public.authors, public.research_items, public.research_authors,
  public.research_categories, public.keywords, public.research_keywords
to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.favorites, public.reading_history, public.download_logs
to authenticated;

grant select on public.user_roles, public.audit_logs to authenticated;

grant insert, update, delete on
  public.organizations, public.categories, public.authors,
  public.research_items, public.research_authors, public.research_categories,
  public.keywords, public.research_keywords, public.user_roles, public.roles
to authenticated;

grant insert on public.download_logs to anon;
grant insert on public.audit_logs to authenticated;

grant execute on function public.increment_research_views(uuid) to anon, authenticated;
grant execute on function public.log_research_download(text) to anon, authenticated;
grant execute on function public.log_reading_history(text) to authenticated;
grant execute on function public.user_max_role_rank(uuid) to anon, authenticated;

-- ============================================================================
-- organizations / categories / authors / keywords
-- อ่านได้ทุกคน (รวม guest) จัดการได้เฉพาะ librarian/admin (rank >= 30)
-- ============================================================================

create policy "organizations_select_all" on public.organizations
  for select using (true);
create policy "organizations_manage_librarian_admin" on public.organizations
  for all using (public.user_max_role_rank() >= 30)
  with check (public.user_max_role_rank() >= 30);

create policy "categories_select_all" on public.categories
  for select using (true);
create policy "categories_manage_librarian_admin" on public.categories
  for all using (public.user_max_role_rank() >= 30)
  with check (public.user_max_role_rank() >= 30);

create policy "authors_select_all" on public.authors
  for select using (true);
create policy "authors_manage_staff_and_above" on public.authors
  for insert with check (public.user_max_role_rank() >= 20);
create policy "authors_update_staff_and_above" on public.authors
  for update using (public.user_max_role_rank() >= 20)
  with check (public.user_max_role_rank() >= 20);
create policy "authors_delete_librarian_admin" on public.authors
  for delete using (public.user_max_role_rank() >= 30);

create policy "keywords_select_all" on public.keywords
  for select using (true);
create policy "keywords_insert_staff_and_above" on public.keywords
  for insert with check (public.user_max_role_rank() >= 20);
create policy "keywords_delete_librarian_admin" on public.keywords
  for delete using (public.user_max_role_rank() >= 30);

-- ============================================================================
-- roles: อ่านได้ทุกคนที่ login (สำหรับแสดงป้ายบทบาท) แก้ไขได้เฉพาะ admin
-- ============================================================================
create policy "roles_select_authenticated" on public.roles
  for select using (auth.role() = 'authenticated');
create policy "roles_manage_admin" on public.roles
  for all using (public.user_max_role_rank() >= 40)
  with check (public.user_max_role_rank() >= 40);

-- ============================================================================
-- profiles: เจ้าของแก้ไข/ดูของตัวเองได้ librarian/admin ดูได้ทั้งหมด
-- ============================================================================
create policy "profiles_select_own_or_staff" on public.profiles
  for select using (id = auth.uid() or public.user_max_role_rank() >= 30);
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================================
-- user_roles: ผู้ใช้ดูบทบาทตนเองได้ librarian/admin ดูได้ทั้งหมด
-- มีแค่ admin เท่านั้นที่กำหนด/เปลี่ยนบทบาทให้ผู้อื่นได้
-- ============================================================================
create policy "user_roles_select_own_or_staff" on public.user_roles
  for select using (user_id = auth.uid() or public.user_max_role_rank() >= 30);
create policy "user_roles_admin_insert" on public.user_roles
  for insert with check (public.user_max_role_rank() >= 40);
create policy "user_roles_admin_delete" on public.user_roles
  for delete using (public.user_max_role_rank() >= 40);

-- ============================================================================
-- research_items: หัวใจของระบบสิทธิ์การเข้าถึง
--
-- SELECT:
--   - published + access_level เป็น public/read_only/metadata_only -> ทุกคนเห็น (รวม guest)
--   - published + access_level เป็น member_only -> ต้อง rank >= 10 (member ขึ้นไป)
--   - published + access_level เป็น staff_only  -> ต้อง rank >= 20 (staff ขึ้นไป)
--   - เจ้าของงานวิจัย (submitted_by) เห็นงานของตัวเองทุกสถานะ
--   - librarian/admin (rank >= 30) เห็นทุกรายการเพื่อตรวจสอบ/อนุมัติ
-- ============================================================================
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
    or submitted_by = auth.uid()
    or public.user_max_role_rank() >= 30
  );

-- INSERT: staff ขึ้นไปส่งงานวิจัยของตัวเองได้ librarian/admin เพิ่มแทนใครก็ได้
create policy "research_items_insert" on public.research_items
  for insert with check (
    (public.user_max_role_rank() >= 20 and submitted_by = auth.uid())
    or public.user_max_role_rank() >= 30
  );

-- UPDATE: เจ้าของแก้ไขได้เฉพาะตอนยังเป็น draft/revision_requested
-- librarian/admin แก้ไข/เปลี่ยนสถานะได้ทุกกรณี (สำหรับ workflow อนุมัติ)
create policy "research_items_update" on public.research_items
  for update using (
    (submitted_by = auth.uid() and status in ('draft', 'revision_requested'))
    or public.user_max_role_rank() >= 30
  ) with check (
    (submitted_by = auth.uid() and status in ('draft', 'pending_review', 'revision_requested'))
    or public.user_max_role_rank() >= 30
  );

-- DELETE: เจ้าของลบได้เฉพาะฉบับร่างของตัวเอง admin ลบได้ทุกกรณี
create policy "research_items_delete" on public.research_items
  for delete using (
    (submitted_by = auth.uid() and status = 'draft')
    or public.user_max_role_rank() >= 40
  );

-- ============================================================================
-- research_authors / research_categories / research_keywords
-- มองเห็นได้ตาม research_items ที่เชื่อมอยู่ (RLS ของ research_items จะถูก
-- นำมาประเมินซ้ำโดยอัตโนมัติผ่าน subquery) จัดการได้โดยเจ้าของงานหรือ librarian/admin
-- ============================================================================
create policy "research_authors_select" on public.research_authors
  for select using (
    exists (select 1 from public.research_items ri where ri.id = research_id)
  );
create policy "research_authors_manage" on public.research_authors
  for all using (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  ) with check (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  );

create policy "research_categories_select" on public.research_categories
  for select using (
    exists (select 1 from public.research_items ri where ri.id = research_id)
  );
create policy "research_categories_manage" on public.research_categories
  for all using (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  ) with check (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  );

create policy "research_keywords_select" on public.research_keywords
  for select using (
    exists (select 1 from public.research_items ri where ri.id = research_id)
  );
create policy "research_keywords_manage" on public.research_keywords
  for all using (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  ) with check (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  );

-- ============================================================================
-- favorites: เจ้าของจัดการรายการโปรดของตัวเองเท่านั้น (ต้องเป็น member ขึ้นไป)
-- ============================================================================
create policy "favorites_select_own" on public.favorites
  for select using (user_id = auth.uid());
create policy "favorites_insert_own" on public.favorites
  for insert with check (user_id = auth.uid() and public.user_max_role_rank() >= 10);
create policy "favorites_delete_own" on public.favorites
  for delete using (user_id = auth.uid());

-- ============================================================================
-- reading_history: เจ้าของบันทึก/ดูประวัติของตัวเอง librarian/admin ดูได้ทั้งหมด (รายงาน)
-- ============================================================================
create policy "reading_history_select_own_or_staff" on public.reading_history
  for select using (user_id = auth.uid() or public.user_max_role_rank() >= 30);
create policy "reading_history_insert_own" on public.reading_history
  for insert with check (user_id = auth.uid());

-- ============================================================================
-- download_logs: ทุกคนบันทึกได้ (รวม guest แบบ user_id เป็น null)
-- ดูได้เฉพาะของตัวเองหรือ librarian/admin (รายงาน)
-- ============================================================================
create policy "download_logs_insert_any" on public.download_logs
  for insert with check (user_id = auth.uid() or user_id is null);
create policy "download_logs_select_own_or_staff" on public.download_logs
  for select using (user_id = auth.uid() or public.user_max_role_rank() >= 30);

-- ============================================================================
-- audit_logs: ผู้ใช้ที่เข้าสู่ระบบบันทึกได้ อ่านได้เฉพาะ admin
-- ============================================================================
create policy "audit_logs_insert_authenticated" on public.audit_logs
  for insert with check (auth.uid() is not null and actor_id = auth.uid());
create policy "audit_logs_select_admin" on public.audit_logs
  for select using (public.user_max_role_rank() >= 40);
