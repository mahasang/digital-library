-- ============================================================================
-- content_revisions: view-only point-in-time snapshot ของ blog_posts และ
-- research_items ก่อนถูกแก้ไขแต่ละครั้ง (ไม่มี restore/rollback — แค่ให้
-- staff/librarian/admin ย้อนดูว่าเนื้อหาก่อนหน้าเป็นอย่างไร) บันทึกจาก
-- Server Action ฝั่งแอปเอง (ไม่ใช่ DB trigger) เพราะทั้ง upsertBlogPostAction
-- และ adminUpdateResearchAction รู้ actor_id (ผู้ใช้ session ปัจจุบัน) อยู่แล้ว
-- ในมือ ขณะที่ trigger ระดับ Postgres ไม่เห็น session user ของแอปโดยตรง
-- ============================================================================

create table public.content_revisions (
  id          uuid        primary key default gen_random_uuid(),
  entity_type text        not null check (entity_type in ('blog_post', 'research_item')),
  entity_id   uuid        not null,
  actor_id    uuid        references public.profiles (id) on delete set null,
  snapshot    jsonb       not null,
  created_at  timestamptz not null default now()
);

comment on table public.content_revisions is 'Snapshot ของ blog_posts/research_items ก่อนแก้ไขแต่ละครั้ง (view-only, ไม่มี restore) — บันทึกจาก Server Action ก่อนเรียก .update() จริง';

-- query pattern: ดึงทุก version ของ entity หนึ่งตัว เรียงใหม่สุดก่อน
create index idx_content_revisions_entity
  on public.content_revisions (entity_type, entity_id, created_at desc);

alter table public.content_revisions enable row level security;

-- อ่านได้เฉพาะ librarian ขึ้นไป (rank >= 30) — ตรงกับ rank ที่ /blog-admin และ
-- /dashboard/research/[id]/edit บังคับอยู่แล้วสำหรับหน้าที่จะฝัง revision
-- history นี้ไว้ (ดู 20260731100100_functions_triggers.sql สำหรับ
-- user_max_role_rank — profiles ไม่มีคอลัมน์ rank ตรงๆ ต้องเรียกผ่านฟังก์ชันนี้เท่านั้น)
create policy "content_revisions_select_librarian"
  on public.content_revisions
  for select
  to authenticated
  using (public.user_max_role_rank() >= 30);

-- insert เฉพาะผ่าน Service Role เท่านั้น (saveRevision() ใน
-- lib/data/revisions.server.ts เรียกผ่าน createServiceRoleClient() เสมอ) —
-- ผู้ใช้ authenticated ทั่วไปห้าม insert revision ของตัวเองตรงๆ เด็ดขาด
-- (ป้องกันการปลอมแปลงประวัติ) หมายเหตุ: service_role ข้าม RLS โดยธรรมชาติอยู่
-- แล้วในทางปฏิบัติ — policy นี้มีไว้เพื่อความชัดเจนของเจตนา ไม่ได้มีผลบังคับจริง
create policy "content_revisions_insert_service"
  on public.content_revisions
  for insert
  to service_role
  with check (true);
