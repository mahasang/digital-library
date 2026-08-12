-- ============================================================================
-- Phase 27: ORCID Public API แบบอ่านอย่างเดียว (cache เท่านั้น ไม่ใช่ข้อมูล
-- นักวิจัยจริง) + การควบคุมค่าใช้จ่าย/ขนาด OCR (ตั้งค่าได้เฉพาะ Super Admin)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. authors: เพิ่มคอลัมน์ cache ผลการตรวจสอบ ORCID Public API 2 คอลัมน์ —
-- เก็บ "เมื่อไหร่ที่ตรวจสอบล่าสุด" และ "ชื่อสาธารณะที่ ORCID คืนมา" เท่านั้น
-- ตั้งใจแยกขาดจาก authors.name/display_name_en/orcid_verified_at/
-- orcid_oauth_verified_at โดยสิ้นเชิง — ฟีเจอร์นี้ไม่มีโค้ดใดเขียนทับคอลัมน์
-- ข้อมูลนักวิจัยจริงเหล่านั้นเลย (ดู lib/orcid/orcid-public-api.server.ts และ
-- checkOrcidPublicApiAction ใน app/dashboard/authors/actions.ts)
-- ----------------------------------------------------------------------------
alter table public.authors
  add column orcid_api_checked_at timestamptz,
  add column orcid_api_public_name text;

comment on column public.authors.orcid_api_checked_at is
  'เวลาที่เจ้าหน้าที่ตรวจสอบ ORCID iD นี้กับ ORCID Public API ล่าสุด (ใช้เป็น cache กันเรียก API ซ้ำภายใน 24 ชม.) — ไม่ใช่การยืนยันตัวตน ดู orcid_verified_at/orcid_oauth_verified_at สำหรับสถานะยืนยันจริง';
comment on column public.authors.orcid_api_public_name is
  'ชื่อสาธารณะที่ ORCID Public API คืนมาล่าสุด (ข้อมูลแนะนำสำหรับเจ้าหน้าที่เปรียบเทียบเท่านั้น) — null หากไม่พบหรือไม่มีข้อมูลสาธารณะ ไม่เคยถูกใช้เขียนทับ authors.name/display_name_en โดยอัตโนมัติ';

-- ----------------------------------------------------------------------------
-- 2. settings: เพิ่มค่าควบคุม OCR 6 ค่า — รูปแบบเดียวกับค่าที่มีอยู่เดิมทุก
-- ประการ (smallint + check ช่วงค่า / boolean / text[] + check ค่าที่อนุญาต)
-- ocr_provider_enabled เป็นสวิตช์ระดับฐานข้อมูล แยกจาก env var
-- OCR_PROVIDER/OCR_API_URL/OCR_ALLOW_EXTERNAL_TRANSFER เดิม — ให้ Super Admin
-- ปิด OCR ได้ทันทีโดยไม่ต้อง deploy ใหม่ ocr_allowed_access_levels ค่าเริ่มต้น
-- เป็น {public} เท่านั้น (เข้มงวดที่สุด) ต้องเปิดเพิ่มเองหากต้องการอนุญาตระดับ
-- อื่น — สอดคล้องกับข้อกำหนด "ห้ามส่งไฟล์ private ไปยัง OCR โดยไม่ได้รับอนุมัติ"
-- ----------------------------------------------------------------------------
alter table public.settings
  add column ocr_max_file_size_mb smallint not null default 20
    check (ocr_max_file_size_mb between 1 and 500),
  add column ocr_max_pages smallint not null default 50
    check (ocr_max_pages between 1 and 2000),
  add column ocr_daily_quota_enabled boolean not null default true,
  add column ocr_max_jobs_per_user_per_day smallint not null default 20
    check (ocr_max_jobs_per_user_per_day between 1 and 1000),
  add column ocr_provider_enabled boolean not null default true,
  add column ocr_allowed_access_levels text[] not null default array['public']::text[]
    check (ocr_allowed_access_levels <@ array['public','member_only','staff_only','read_only','metadata_only']::text[]);

comment on column public.settings.ocr_max_file_size_mb is
  'ขนาดไฟล์ PDF สูงสุด (MB) ที่อนุญาตให้สร้างงาน OCR ได้ (1-500, ค่าเริ่มต้น 20) — ตรวจก่อนสร้าง background_jobs เสมอ ดู lib/ocr/ocr-limits.server.ts';
comment on column public.settings.ocr_max_pages is
  'จำนวนหน้า PDF สูงสุดที่อนุญาตให้สร้างงาน OCR ได้ (1-2000, ค่าเริ่มต้น 50)';
comment on column public.settings.ocr_daily_quota_enabled is
  'เปิด/ปิดการจำกัดจำนวนงาน OCR ต่อผู้ใช้ต่อวัน (ใช้ร่วมกับ ocr_max_jobs_per_user_per_day ผ่าน check_rate_limit() เดิม)';
comment on column public.settings.ocr_max_jobs_per_user_per_day is
  'จำนวนงาน OCR สูงสุดต่อผู้ใช้ต่อวัน เมื่อ ocr_daily_quota_enabled = true (1-1000, ค่าเริ่มต้น 20)';
comment on column public.settings.ocr_provider_enabled is
  'สวิตช์เปิด/ปิด OCR ระดับฐานข้อมูล แยกจาก env var OCR_PROVIDER/OCR_API_URL/OCR_ALLOW_EXTERNAL_TRANSFER — Super Admin ปิดได้ทันทีโดยไม่ต้อง deploy ใหม่ ทุกชั้นต้องเปิดพร้อมกันจึงจะสร้างงาน OCR ได้';
comment on column public.settings.ocr_allowed_access_levels is
  'ระดับการเข้าถึงเอกสาร (research_items.access_level) ที่อนุญาตให้ส่ง OCR ได้ — ค่าเริ่มต้น {public} เท่านั้น (เข้มงวดสุด) ต้องเพิ่มเองหากต้องการอนุญาตระดับอื่น';

-- ----------------------------------------------------------------------------
-- 3. protect_superadmin_settings_columns(): เพิ่มคอลัมน์ OCR ใหม่ทั้ง 6 เข้าไป
-- ในรายการที่ตรวจสอบ (คัดลอกเงื่อนไขเดิมทั้งหมดจาก migration ก่อนหน้ามาครบ
-- ไม่ตัดออกแม้แต่ข้อเดียว มิฉะนั้น Admin rank 40 จะแก้ไขค่าควบคุมค่าใช้จ่าย OCR
-- ได้โดยไม่ต้องมีสิทธิ์ Super Admin)
-- ----------------------------------------------------------------------------
create or replace function public.protect_superadmin_settings_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_max_role_rank() < 50 and (
    new.favicon_url is distinct from old.favicon_url or
    new.social_facebook is distinct from old.social_facebook or
    new.social_twitter is distinct from old.social_twitter or
    new.social_line is distinct from old.social_line or
    new.registration_enabled is distinct from old.registration_enabled or
    new.submission_enabled is distinct from old.submission_enabled or
    new.default_research_status is distinct from old.default_research_status or
    new.captcha_enabled is distinct from old.captcha_enabled or
    new.notifications_in_app_enabled is distinct from old.notifications_in_app_enabled or
    new.notifications_email_enabled is distinct from old.notifications_email_enabled or
    new.max_pdf_size_mb is distinct from old.max_pdf_size_mb or
    new.max_cover_size_mb is distinct from old.max_cover_size_mb or
    new.max_attachment_size_mb is distinct from old.max_attachment_size_mb or
    new.rate_limit_register_max is distinct from old.rate_limit_register_max or
    new.rate_limit_register_window_sec is distinct from old.rate_limit_register_window_sec or
    new.rate_limit_submit_max is distinct from old.rate_limit_submit_max or
    new.rate_limit_submit_window_sec is distinct from old.rate_limit_submit_window_sec or
    new.access_expiration_warning_days is distinct from old.access_expiration_warning_days or
    new.access_expiration_warning_in_app_enabled is distinct from old.access_expiration_warning_in_app_enabled or
    new.access_expiration_warning_email_enabled is distinct from old.access_expiration_warning_email_enabled or
    new.ocr_max_file_size_mb is distinct from old.ocr_max_file_size_mb or
    new.ocr_max_pages is distinct from old.ocr_max_pages or
    new.ocr_daily_quota_enabled is distinct from old.ocr_daily_quota_enabled or
    new.ocr_max_jobs_per_user_per_day is distinct from old.ocr_max_jobs_per_user_per_day or
    new.ocr_provider_enabled is distinct from old.ocr_provider_enabled or
    new.ocr_allowed_access_levels is distinct from old.ocr_allowed_access_levels
  ) then
    raise exception 'ต้องมีสิทธิ์ Super Admin จึงจะแก้ไขการตั้งค่านี้ได้' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
