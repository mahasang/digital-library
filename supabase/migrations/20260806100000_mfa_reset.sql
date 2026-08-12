-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 15: Super Admin รีเซ็ต MFA
--
-- ฟีเจอร์นี้ไม่ต้องเพิ่มตาราง/คอลัมน์ใหม่ — ใช้ Supabase Auth Admin API
-- (supabase.auth.admin.mfa.listFactors/deleteFactor) ผ่าน Service Role จัดการ
-- auth.mfa_factors โดยตรง (นอก schema public จึงไม่ต้องมี RLS Policy ของแอปเอง)
-- และเขียน public.audit_logs/public.notifications ตามปกติ
--
-- ต้องแก้ไขเพียงอย่างเดียว: public.notifications ยังไม่เคย grant สิทธิ์ insert
-- ให้ role ใดเลย (เดิม insert ได้เฉพาะผ่าน trigger security definer เท่านั้น
-- — ดู 20260803100000_superadmin_phase2.sql ข้อ 4-5) แต่ resetUserMfaAction
-- ต้อง insert notification แจ้งเจ้าของบัญชีตรงจาก Server Action ผ่าน Service
-- Role client — service_role มี BYPASSRLS แต่ยังต้องมี table-level grant ตาม
-- ปกติของ Postgres (bypass RLS Policy ไม่ได้แปลว่าข้าม GRANT ไปด้วย)
-- ============================================================================

grant insert on public.notifications to service_role;
