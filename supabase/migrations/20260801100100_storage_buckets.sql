-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 3: Supabase Storage
--
-- Buckets:
--   research-documents      (private) ไฟล์ PDF/eBook ฉบับเต็ม
--   research-covers         (public)  ภาพปกงานวิจัย — ไม่มีข้อมูลอ่อนไหว แสดงได้ทุกคน
--   submission-attachments  (private) เอกสารประกอบการส่ง เช่น หนังสือรับรองลิขสิทธิ์
--
-- รูปแบบพาธไฟล์ (ใช้ร่วมกันทั้ง 3 bucket): {auth.uid()}/{draftKey}/{filename}
-- ส่วนแรกของพาธ (auth.uid()) ใช้ตรวจสอบความเป็นเจ้าของใน Storage Policy
--
-- การเข้าถึงไฟล์จริงของ "ผู้อ่านทั่วไป" (Guest/Member/Staff ตาม access_level)
-- ไม่ได้ผ่าน Storage Policy โดยตรง แต่ผ่าน Signed URL ที่สร้างขึ้นในเซิร์ฟเวอร์
-- (lib/storage/signed-url.server.ts) ด้วย Service Role หลังตรวจสอบสิทธิ์ตาม
-- access_level/status ของ research_items แล้วเท่านั้น — ดังนั้น Storage Policy
-- ในไฟล์นี้จึงเน้นเฉพาะสิทธิ์ "เจ้าของไฟล์" และ "ผู้ตรวจสอบ (librarian/admin)"
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('research-documents', 'research-documents', false, 52428800, array['application/pdf']),
  ('research-covers', 'research-covers', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('submission-attachments', 'submission-attachments', false, 20971520,
    array[
      'application/pdf', 'image/png', 'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- research-documents (private): เจ้าของไฟล์ หรือ librarian/admin เท่านั้น
-- ----------------------------------------------------------------------------
create policy "research_documents_select_owner_or_staff" on storage.objects
  for select using (
    bucket_id = 'research-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.user_max_role_rank() >= 30
    )
  );

create policy "research_documents_insert_owner" on storage.objects
  for insert with check (
    bucket_id = 'research-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.user_max_role_rank() >= 20
  );

create policy "research_documents_delete_owner_or_admin" on storage.objects
  for delete using (
    bucket_id = 'research-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.user_max_role_rank() >= 40
    )
  );

-- ----------------------------------------------------------------------------
-- research-covers (public): อ่านได้ทุกคน เขียนได้เฉพาะเจ้าของไฟล์/ผู้ดูแล
-- ----------------------------------------------------------------------------
create policy "research_covers_select_all" on storage.objects
  for select using (bucket_id = 'research-covers');

create policy "research_covers_insert_owner" on storage.objects
  for insert with check (
    bucket_id = 'research-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.user_max_role_rank() >= 20
  );

create policy "research_covers_delete_owner_or_admin" on storage.objects
  for delete using (
    bucket_id = 'research-covers'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.user_max_role_rank() >= 40
    )
  );

-- ----------------------------------------------------------------------------
-- submission-attachments (private): เจ้าของไฟล์ หรือ librarian/admin เท่านั้น
-- ----------------------------------------------------------------------------
create policy "submission_attachments_select_owner_or_staff" on storage.objects
  for select using (
    bucket_id = 'submission-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.user_max_role_rank() >= 30
    )
  );

create policy "submission_attachments_insert_owner" on storage.objects
  for insert with check (
    bucket_id = 'submission-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.user_max_role_rank() >= 20
  );

create policy "submission_attachments_delete_owner_or_admin" on storage.objects
  for delete using (
    bucket_id = 'submission-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.user_max_role_rank() >= 40
    )
  );
