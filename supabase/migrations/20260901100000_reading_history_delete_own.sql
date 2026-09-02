-- ============================================================================
-- Web Phase 3: Reading History — "Clear All" ในหน้า Account
--
-- reading_history มี GRANT delete ให้ authenticated อยู่แล้ว (ดู
-- 20260731100200_rls_policies.sql: "grant select, insert, update, delete on
-- ... public.reading_history ... to authenticated") แต่ไม่เคยมี RLS policy
-- สำหรับ delete เลย — Postgres ปฏิเสธทุกแถวโดยปริยายเมื่อเปิด RLS แต่ไม่มี
-- policy ตรงกับ operation นั้นเสมอ ไม่ว่า GRANT จะให้สิทธิ์ไว้แค่ไหนก็ตาม
-- ผู้ใช้จึงลบประวัติการอ่านของตัวเองไม่ได้เลยจนกว่าจะมี policy นี้
-- ============================================================================
create policy "reading_history_delete_own" on public.reading_history
  for delete using (user_id = auth.uid());
