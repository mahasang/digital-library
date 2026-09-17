/**
 * Type aliases สำหรับ column ที่เป็น "enum-like" แต่จริงๆ เก็บเป็น `text` +
 * CHECK constraint ในฐานข้อมูล (ไม่ใช่ native Postgres enum) — `supabase gen
 * types` จึงไม่สร้าง alias เหล่านี้ให้อัตโนมัติ (column ออกมาเป็น `string`
 * เฉยๆ ใน Tables Row/Insert/Update) ไฟล์นี้ประกาศ literal union เองโดยอิง
 * จาก CHECK constraint ล่าสุดในแต่ละตาราง (ดู comment อ้างอิง migration ที่
 * แต่ละ type)
 *
 * ห้ามแก้ lib/supabase/database.types.ts (ไฟล์ generated) — เพิ่ม/แก้ type
 * เหล่านี้ที่ไฟล์นี้แทน
 */

/** access_requests.request_type — supabase/migrations/20260808100000_document_access_requests.sql */
export type AccessRequestTypeRow = "read" | "download";

/** roles.name — supabase/migrations/20260731100300_seed_reference_data.sql
 * + super_admin เพิ่มทีหลังใน 20260802100100_super_admin_role.sql */
export type RoleName = "member" | "staff" | "librarian" | "admin" | "super_admin";

/** duplicate_research_reviews.status — supabase/migrations/20260809100000_data_quality_authority_control.sql */
export type DuplicateReviewStatusRow = "pending" | "confirmed_duplicate" | "not_duplicate" | "merged";

/** research_items.status — supabase/migrations/20260731100000_schema.sql
 * ('merged' เพิ่มทีหลังใน 20260809100000_data_quality_authority_control.sql) */
export type DocumentStatusRow =
  | "draft"
  | "pending_review"
  | "revision_requested"
  | "approved"
  | "published"
  | "rejected"
  | "archived"
  | "merged";

/** cron_runs.job_name — supabase/migrations/20260820100000_cron_monitoring.sql */
export type CronJobNameRow =
  | "queue_worker"
  | "access_expiration"
  | "notification_delivery"
  | "maintenance_cleanup"
  | "health_monitoring";

/** cron_runs.status — supabase/migrations/20260820100000_cron_monitoring.sql */
export type CronRunStatusRow = "running" | "completed" | "failed";

/** background_jobs.job_type / job_type_settings.job_type — ค่าล่าสุดหลัง
 * ALTER หลายรอบ, อ้างอิง supabase/migrations/20260821100000_ocr_provider_validation.sql
 * (การ ALTER ครั้งล่าสุด) */
export type BackgroundJobTypeRow =
  | "pdf_text_extraction"
  | "file_security_rescan"
  | "access_expiration"
  | "category_notification"
  | "duplicate_scan"
  | "ocr_processing"
  | "bulk_enqueue"
  | "maintenance_cleanup"
  | "ocr_test_run";

/** background_jobs.status — supabase/migrations/20260810100000_background_jobs.sql
 * (ไม่เคยถูก ALTER เพิ่ม — dead-letter ติดตามผ่าน dead_letter_notified_at
 * timestamp column แยกต่างหาก ไม่ใช่ค่า status เพิ่มเติม) */
export type BackgroundJobStatusRow = "pending" | "processing" | "completed" | "failed" | "cancelled";

/** job_batches.status — ค่าล่าสุดหลัง ALTER ใน
 * supabase/migrations/20260817100000_job_batches_lifecycle_schema.sql */
export type JobBatchStatusRow = "enqueueing" | "ready" | "paused" | "cancelled" | "completed" | "failed";

/** research_items.extraction_status — supabase/migrations/20260807100000_pdf_fulltext_search.sql
 * (ไม่รวม "never_attempted"/"replaced" — สองค่านั้นเป็น derived filter state
 * ของ bulk-filters.ts เท่านั้น ไม่ใช่ค่าที่เก็บจริงใน column นี้) */
export type ExtractionStatusRow = "pending" | "processing" | "completed" | "no_text_found" | "failed";

/** research_items.ocr_status — ค่าล่าสุดหลัง ALTER ใน
 * supabase/migrations/20260818100000_ocr_progress_and_blocked_status.sql (เพิ่ม "blocked") */
export type OcrStatusRow = "not_required" | "pending" | "processing" | "completed" | "failed" | "blocked";

/** research_items.scan_status — ค่าล่าสุดหลัง ALTER ใน
 * supabase/migrations/20260810100000_background_jobs.sql (เพิ่ม "pending") */
export type ScanStatusRow = "pending" | "clean" | "infected" | "error" | "skipped";

/** research_items.access_level — supabase/migrations/20260731100000_schema.sql */
export type AccessLevelRow = "public" | "member_only" | "staff_only" | "read_only" | "metadata_only";

/** research_authors.author_role — supabase/migrations/20260809100000_data_quality_authority_control.sql */
export type AuthorRoleRow = "principal_investigator" | "co_investigator";

/** ocr_test_runs.status — supabase/migrations/20260821100000_ocr_provider_validation.sql */
export type OcrTestRunStatusRow = "pending" | "processing" | "completed" | "failed";
