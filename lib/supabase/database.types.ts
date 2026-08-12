/**
 * Type definitions ของฐานข้อมูล Supabase (เขียนด้วยมือให้ตรงกับ SQL migrations
 * ใน supabase/migrations/) ครอบคลุมเฉพาะคอลัมน์ที่แอปพลิเคชันใช้งานจริง
 *
 * หมายเหตุ: @supabase/postgrest-js กำหนดให้แต่ละตารางต้องมีฟิลด์ Relationships
 * (แม้เป็น array ว่าง) และ schema ต้องมีคีย์ Views เสมอ มิฉะนั้น generic type
 * ของ query builder (.update()/.insert() ฯลฯ) จะ infer เป็น never
 *
 * เมื่อเชื่อมต่อกับโปรเจกต์ Supabase จริงแล้ว แนะนำให้สร้างไฟล์นี้ใหม่อัตโนมัติด้วย:
 *   npx supabase gen types typescript --linked > lib/supabase/database.types.ts
 */

export type AccessLevelRow =
  | "public"
  | "member_only"
  | "staff_only"
  | "read_only"
  | "metadata_only";

export type DocumentStatusRow =
  | "draft"
  | "pending_review"
  | "revision_requested"
  | "approved"
  | "published"
  | "rejected"
  | "archived"
  | "merged";

export type AuthorRoleRow = "principal_investigator" | "co_investigator";

export type DuplicateReviewStatusRow =
  | "pending"
  | "confirmed_duplicate"
  | "not_duplicate"
  | "merged";

export type RoleName = "member" | "staff" | "librarian" | "admin" | "super_admin";

export type ScanStatusRow = "pending" | "clean" | "infected" | "error" | "skipped";

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

export type OcrTestRunStatusRow = "pending" | "processing" | "completed" | "failed";

export type CronJobNameRow =
  | "queue_worker"
  | "access_expiration"
  | "notification_delivery"
  | "maintenance_cleanup"
  | "health_monitoring";

export type CronRunStatusRow = "running" | "completed" | "failed";

export type JobBatchStatusRow = "enqueueing" | "ready" | "paused" | "cancelled" | "completed" | "failed";

export type BackgroundJobStatusRow =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ExtractionStatusRow =
  | "pending"
  | "processing"
  | "completed"
  | "no_text_found"
  | "failed";

export type OcrStatusRow = "not_required" | "pending" | "processing" | "completed" | "failed" | "blocked";

export type AccessRequestTypeRow = "read" | "download";

export type AccessRequestStatusRow =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "more_information_required"
  | "cancelled"
  | "expired";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          organization_name: string | null;
          organization_id: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          organization_name?: string | null;
          organization_id?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          full_name?: string | null;
          organization_name?: string | null;
          organization_id?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: RoleName;
          rank: number;
          description: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
        };
        Update: never;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name_th: string;
          name_en: string | null;
          description: string | null;
          normalized_name_th: string | null;
          normalized_name_en: string | null;
          parent_id: string | null;
          organization_code: string | null;
          website_url: string | null;
          is_active: boolean;
          sort_order: number;
          merged_into_organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          name_th: string;
          name_en?: string | null;
          description?: string | null;
          parent_id?: string | null;
          organization_code?: string | null;
          website_url?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          name_th: string;
          name_en: string | null;
          description: string | null;
          parent_id: string | null;
          organization_code: string | null;
          website_url: string | null;
          is_active: boolean;
          sort_order: number;
          merged_into_organization_id: string | null;
        }>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name_th: string;
          name_en: string;
          description: string | null;
          icon: string | null;
          parent_id: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          name_th: string;
          name_en: string;
          description?: string | null;
          icon?: string | null;
          parent_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          slug: string;
          name_th: string;
          name_en: string;
          description: string | null;
          icon: string | null;
          parent_id: string | null;
          is_active: boolean;
          sort_order: number;
        }>;
        Relationships: [];
      };
      authors: {
        Row: {
          id: string;
          name: string;
          organization_id: string | null;
          organization_name: string | null;
          profile_id: string | null;
          display_name_en: string | null;
          normalized_name_th: string | null;
          normalized_name_en: string | null;
          title_prefix_th: string | null;
          title_prefix_en: string | null;
          orcid: string | null;
          orcid_verified_at: string | null;
          orcid_oauth_verified_at: string | null;
          orcid_api_checked_at: string | null;
          orcid_api_public_name: string | null;
          biography: string | null;
          is_active: boolean;
          merged_into_author_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          organization_id?: string | null;
          organization_name?: string | null;
          profile_id?: string | null;
          display_name_en?: string | null;
          title_prefix_th?: string | null;
          title_prefix_en?: string | null;
          orcid?: string | null;
          orcid_verified_at?: string | null;
          biography?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          name: string;
          organization_id: string | null;
          organization_name: string | null;
          profile_id: string | null;
          display_name_en: string | null;
          title_prefix_th: string | null;
          title_prefix_en: string | null;
          orcid: string | null;
          orcid_verified_at: string | null;
          orcid_oauth_verified_at: string | null;
          orcid_api_checked_at: string | null;
          orcid_api_public_name: string | null;
          biography: string | null;
          is_active: boolean;
          merged_into_author_id: string | null;
        }>;
        Relationships: [];
      };
      research_items: {
        Row: {
          id: string;
          slug: string;
          title_th: string;
          title_en: string | null;
          organization_id: string | null;
          year: number;
          abstract: string;
          cover_image: string | null;
          pdf_file: string | null;
          page_count: number;
          access_level: AccessLevelRow;
          status: DocumentStatusRow;
          views: number;
          downloads: number;
          submitted_by: string | null;
          reviewed_by: string | null;
          review_note: string | null;
          published_at: string | null;
          copyright_note: string | null;
          copyright_confirmed: boolean;
          attachment_file: string | null;
          scan_status: ScanStatusRow;
          scanned_at: string | null;
          scan_provider: string | null;
          scan_reason: string | null;
          isbn: string | null;
          doi: string | null;
          normalized_title_th: string | null;
          normalized_title_en: string | null;
          merged_into_research_item_id: string | null;
          category_notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          title_th: string;
          title_en?: string | null;
          organization_id?: string | null;
          year: number;
          abstract: string;
          cover_image?: string | null;
          pdf_file?: string | null;
          page_count?: number;
          access_level?: AccessLevelRow;
          status?: DocumentStatusRow;
          submitted_by?: string | null;
          copyright_note?: string | null;
          copyright_confirmed?: boolean;
          attachment_file?: string | null;
          scan_status?: ScanStatusRow;
          scanned_at?: string | null;
          scan_provider?: string | null;
          scan_reason?: string | null;
          isbn?: string | null;
          doi?: string | null;
        };
        Update: Partial<{
          title_th: string;
          title_en: string | null;
          organization_id: string | null;
          year: number;
          abstract: string;
          cover_image: string | null;
          pdf_file: string | null;
          page_count: number;
          access_level: AccessLevelRow;
          status: DocumentStatusRow;
          reviewed_by: string | null;
          review_note: string | null;
          published_at: string | null;
          copyright_note: string | null;
          copyright_confirmed: boolean;
          attachment_file: string | null;
          scan_status: ScanStatusRow;
          scanned_at: string | null;
          scan_provider: string | null;
          scan_reason: string | null;
          isbn: string | null;
          doi: string | null;
          merged_into_research_item_id: string | null;
        }>;
        Relationships: [];
      };
      research_authors: {
        Row: {
          id: string;
          research_id: string;
          author_id: string;
          author_order: number;
          author_role: AuthorRoleRow;
        };
        Insert: {
          research_id: string;
          author_id: string;
          author_order?: number;
          author_role?: AuthorRoleRow;
        };
        Update: never;
        Relationships: [];
      };
      research_categories: {
        Row: {
          id: string;
          research_id: string;
          category_id: string;
        };
        Insert: {
          research_id: string;
          category_id: string;
        };
        Update: never;
        Relationships: [];
      };
      keywords: {
        Row: {
          id: string;
          keyword: string;
          created_at: string;
        };
        Insert: {
          keyword: string;
        };
        Update: never;
        Relationships: [];
      };
      research_keywords: {
        Row: {
          id: string;
          research_id: string;
          keyword_id: string;
        };
        Insert: {
          research_id: string;
          keyword_id: string;
        };
        Update: never;
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          research_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          research_id: string;
        };
        Update: never;
        Relationships: [];
      };
      reading_history: {
        Row: {
          id: string;
          user_id: string | null;
          research_id: string;
          read_at: string;
        };
        Insert: {
          user_id?: string | null;
          research_id: string;
        };
        Update: never;
        Relationships: [];
      };
      download_logs: {
        Row: {
          id: string;
          user_id: string | null;
          research_id: string;
          downloaded_at: string;
          ip_address: string | null;
        };
        Insert: {
          user_id?: string | null;
          research_id: string;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
      approval_logs: {
        Row: {
          id: string;
          research_id: string;
          actor_id: string | null;
          from_status: DocumentStatusRow | null;
          to_status: DocumentStatusRow;
          note: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          site_name: string;
          logo_url: string | null;
          favicon_url: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          contact_address: string | null;
          social_facebook: string | null;
          social_twitter: string | null;
          social_line: string | null;
          copyright_text: string | null;
          homepage_latest_count: number;
          homepage_popular_count: number;
          registration_enabled: boolean;
          submission_enabled: boolean;
          default_research_status: DocumentStatusRow;
          captcha_enabled: boolean;
          notifications_in_app_enabled: boolean;
          notifications_email_enabled: boolean;
          max_pdf_size_mb: number;
          max_cover_size_mb: number;
          max_attachment_size_mb: number;
          rate_limit_register_max: number;
          rate_limit_register_window_sec: number;
          rate_limit_submit_max: number;
          rate_limit_submit_window_sec: number;
          access_expiration_warning_days: number;
          access_expiration_warning_in_app_enabled: boolean;
          access_expiration_warning_email_enabled: boolean;
          ocr_max_file_size_mb: number;
          ocr_max_pages: number;
          ocr_daily_quota_enabled: boolean;
          ocr_max_jobs_per_user_per_day: number;
          ocr_provider_enabled: boolean;
          ocr_allowed_access_levels: string[];
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: Partial<{
          site_name: string;
          logo_url: string | null;
          favicon_url: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          contact_address: string | null;
          social_facebook: string | null;
          social_twitter: string | null;
          social_line: string | null;
          copyright_text: string | null;
          homepage_latest_count: number;
          homepage_popular_count: number;
          registration_enabled: boolean;
          submission_enabled: boolean;
          default_research_status: DocumentStatusRow;
          captcha_enabled: boolean;
          notifications_in_app_enabled: boolean;
          notifications_email_enabled: boolean;
          max_pdf_size_mb: number;
          max_cover_size_mb: number;
          max_attachment_size_mb: number;
          rate_limit_register_max: number;
          rate_limit_register_window_sec: number;
          rate_limit_submit_max: number;
          rate_limit_submit_window_sec: number;
          access_expiration_warning_days: number;
          access_expiration_warning_in_app_enabled: boolean;
          access_expiration_warning_email_enabled: boolean;
          ocr_max_file_size_mb: number;
          ocr_max_pages: number;
          ocr_daily_quota_enabled: boolean;
          ocr_max_jobs_per_user_per_day: number;
          ocr_provider_enabled: boolean;
          ocr_allowed_access_levels: string[];
          updated_by: string | null;
        }>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: "info" | "success" | "warning";
          research_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        // ไม่มี insert grant ให้ authenticated จริง (ดู migration) — insert
        // ใช้ได้จริงเฉพาะผ่าน trigger (security definer) หรือ Service Role
        // client เท่านั้น (เช่น resetUserMfaAction) ไม่ใช่ผ่าน client ปกติ
        Insert: {
          user_id: string;
          title: string;
          message: string;
          type?: "info" | "success" | "warning";
          research_id?: string | null;
        };
        Update: Partial<{ read_at: string | null }>;
        Relationships: [];
      };
      research_document_texts: {
        Row: {
          id: string;
          research_item_id: string;
          extracted_text: string | null;
          extracted_text_normalized: string | null;
          extraction_status: ExtractionStatusRow;
          extraction_error_message: string | null;
          extracted_at: string | null;
          source_file_path: string | null;
          source_file_hash: string | null;
          ocr_status: OcrStatusRow;
          ocr_text: string | null;
          ocr_text_normalized: string | null;
          ocr_error_message: string | null;
          ocr_provider: string | null;
          ocr_language: string | null;
          ocr_confidence: number | null;
          ocr_processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // ไม่มี insert/update grant ให้ authenticated — เขียนได้เฉพาะผ่าน
        // Service Role client จาก lib/pdf/process-extraction.server.ts และ
        // lib/jobs/handlers/ocr-processing.server.ts เท่านั้น
        Insert: {
          research_item_id: string;
          extraction_status?: ExtractionStatusRow;
          source_file_path?: string | null;
        };
        Update: Partial<{
          extracted_text: string | null;
          extracted_text_normalized: string | null;
          extraction_status: ExtractionStatusRow;
          extraction_error_message: string | null;
          extracted_at: string | null;
          source_file_path: string | null;
          source_file_hash: string | null;
          ocr_status: OcrStatusRow;
          ocr_text: string | null;
          ocr_text_normalized: string | null;
          ocr_error_message: string | null;
          ocr_provider: string | null;
          ocr_language: string | null;
          ocr_confidence: number | null;
          ocr_processed_at: string | null;
        }>;
        Relationships: [];
      };
      background_jobs: {
        Row: {
          id: string;
          job_type: BackgroundJobTypeRow;
          payload: Record<string, unknown>;
          status: BackgroundJobStatusRow;
          attempts: number;
          max_attempts: number;
          progress: number;
          current_page: number | null;
          total_pages: number | null;
          progress_message: string | null;
          error_message: string | null;
          idempotency_key: string;
          batch_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          locked_by: string | null;
          locked_at: string | null;
          lease_expires_at: string | null;
          run_after: string;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_note: string | null;
          dead_letter_notified_at: string | null;
        };
        // ไม่มี insert/update grant ให้ authenticated — enqueue/ประมวลผลผ่าน
        // Service Role client จาก lib/jobs/queue.server.ts เท่านั้น
        Insert: {
          job_type: BackgroundJobTypeRow;
          payload?: Record<string, unknown>;
          status?: BackgroundJobStatusRow;
          max_attempts?: number;
          idempotency_key: string;
          batch_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          run_after?: string;
          created_by?: string | null;
        };
        Update: Partial<{
          status: BackgroundJobStatusRow;
          progress: number;
          current_page: number | null;
          total_pages: number | null;
          progress_message: string | null;
          payload: Record<string, unknown>;
          error_message: string | null;
          run_after: string;
          attempts: number;
          locked_by: string | null;
          lease_expires_at: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_note: string | null;
          dead_letter_notified_at: string | null;
        }>;
        Relationships: [];
      };
      job_batches: {
        Row: {
          id: string;
          job_type: BackgroundJobTypeRow;
          filter_snapshot: Record<string, unknown>;
          total_items: number | null;
          enqueued_items: number;
          cursor_after_id: string | null;
          cursor_after_updated_at: string | null;
          status: JobBatchStatusRow;
          batch_size: number;
          filter_hash: string | null;
          started_at: string | null;
          paused_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          completed_items: number;
          failed_items: number;
          cancelled_items: number;
          skipped_items: number;
          completed_notified_at: string | null;
          failed_notified_at: string | null;
          dlq_notified_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        // ไม่มี insert/update grant ให้ authenticated โดยตรง — สร้าง/แก้ผ่าน
        // Service Role client (lib/jobs/*) หรือฟังก์ชัน security definer
        // (create_job_batch_if_not_exists/set_job_batch_status/
        // retry_failed_jobs_in_batch) เท่านั้น
        Insert: {
          job_type: BackgroundJobTypeRow;
          filter_snapshot?: Record<string, unknown>;
          total_items?: number | null;
          status?: JobBatchStatusRow;
          batch_size?: number;
          filter_hash?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          total_items: number | null;
          enqueued_items: number;
          cursor_after_id: string | null;
          cursor_after_updated_at: string | null;
          status: JobBatchStatusRow;
          batch_size: number;
          started_at: string | null;
          paused_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          completed_items: number;
          failed_items: number;
          cancelled_items: number;
          skipped_items: number;
          completed_notified_at: string | null;
          failed_notified_at: string | null;
          dlq_notified_at: string | null;
        }>;
        Relationships: [];
      };
      job_type_settings: {
        Row: {
          job_type: BackgroundJobTypeRow;
          concurrency: number;
          default_batch_size: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          job_type: BackgroundJobTypeRow;
          concurrency?: number;
          default_batch_size?: number;
          updated_by?: string | null;
        };
        Update: Partial<{
          concurrency: number;
          default_batch_size: number;
          updated_at: string;
          updated_by: string | null;
        }>;
        Relationships: [];
      };
      cron_runs: {
        Row: {
          id: string;
          job_name: CronJobNameRow;
          started_at: string;
          completed_at: string | null;
          status: CronRunStatusRow;
          processed_count: number;
          failed_count: number;
          error_summary: string | null;
          next_expected_run_at: string | null;
          created_at: string;
        };
        Insert: {
          job_name: CronJobNameRow;
          started_at?: string;
          status?: CronRunStatusRow;
        };
        Update: Partial<{
          completed_at: string | null;
          status: CronRunStatusRow;
          processed_count: number;
          failed_count: number;
          error_summary: string | null;
          next_expected_run_at: string | null;
        }>;
        Relationships: [];
      };
      cron_monitoring_settings: {
        Row: {
          job_name: CronJobNameRow;
          expected_frequency_minutes: number;
          failure_threshold: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          job_name: CronJobNameRow;
          expected_frequency_minutes?: number;
          failure_threshold?: number;
          updated_by?: string | null;
        };
        Update: Partial<{
          expected_frequency_minutes: number;
          failure_threshold: number;
          updated_at: string;
          updated_by: string | null;
        }>;
        Relationships: [];
      };
      cron_alert_state: {
        Row: {
          check_name: string;
          last_alerted_at: string;
        };
        Insert: {
          check_name: string;
          last_alerted_at?: string;
        };
        Update: Partial<{
          last_alerted_at: string;
        }>;
        Relationships: [];
      };
      ocr_test_runs: {
        Row: {
          id: string;
          fixture_name: string;
          background_job_id: string | null;
          status: OcrTestRunStatusRow;
          page_count: number | null;
          extracted_char_count: number | null;
          current_page: number | null;
          total_pages: number | null;
          progress_message: string | null;
          error_summary: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          fixture_name: string;
          background_job_id?: string | null;
          status?: OcrTestRunStatusRow;
          created_by?: string | null;
        };
        Update: Partial<{
          background_job_id: string | null;
          status: OcrTestRunStatusRow;
          page_count: number | null;
          extracted_char_count: number | null;
          current_page: number | null;
          total_pages: number | null;
          progress_message: string | null;
          error_summary: string | null;
          started_at: string | null;
          completed_at: string | null;
        }>;
        Relationships: [];
      };
      access_requests: {
        Row: {
          id: string;
          research_item_id: string;
          requester_id: string;
          request_type: AccessRequestTypeRow;
          purpose: string;
          requester_note: string | null;
          status: AccessRequestStatusRow;
          reviewer_id: string | null;
          reviewer_note: string | null;
          access_granted_at: string | null;
          access_expires_at: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          research_item_id: string;
          requester_id: string;
          request_type: AccessRequestTypeRow;
          purpose: string;
          requester_note?: string | null;
          status?: AccessRequestStatusRow;
        };
        Update: Partial<{
          status: AccessRequestStatusRow;
          reviewer_id: string | null;
          reviewer_note: string | null;
          access_granted_at: string | null;
          access_expires_at: string | null;
          reviewed_at: string | null;
        }>;
        Relationships: [];
      };
      document_access_grants: {
        Row: {
          id: string;
          research_item_id: string;
          user_id: string;
          access_type: AccessRequestTypeRow;
          granted_by: string | null;
          source_request_id: string | null;
          starts_at: string;
          expires_at: string | null;
          revoked_at: string | null;
          revoke_reason: string | null;
          expiry_warned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          research_item_id: string;
          user_id: string;
          access_type: AccessRequestTypeRow;
          granted_by?: string | null;
          source_request_id?: string | null;
          starts_at?: string;
          expires_at?: string | null;
        };
        Update: Partial<{
          expires_at: string | null;
          revoked_at: string | null;
          revoke_reason: string | null;
          expiry_warned_at: string | null;
        }>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          new_research_in_app_enabled: boolean;
          new_research_email_enabled: boolean;
          access_request_in_app_enabled: boolean;
          access_request_email_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          new_research_in_app_enabled?: boolean;
          new_research_email_enabled?: boolean;
          access_request_in_app_enabled?: boolean;
          access_request_email_enabled?: boolean;
        };
        Update: Partial<{
          new_research_in_app_enabled: boolean;
          new_research_email_enabled: boolean;
          access_request_in_app_enabled: boolean;
          access_request_email_enabled: boolean;
        }>;
        Relationships: [];
      };
      category_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          category_id: string;
        };
        Update: Partial<{ category_id: string }>;
        Relationships: [];
      };
      duplicate_research_reviews: {
        Row: {
          id: string;
          research_item_id: string;
          candidate_research_item_id: string;
          similarity_score: number;
          similarity_reasons: string[];
          status: DuplicateReviewStatusRow;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          rule_version_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          research_item_id: string;
          candidate_research_item_id: string;
          similarity_score: number;
          similarity_reasons?: string[];
          status?: DuplicateReviewStatusRow;
          rule_version_id?: string | null;
        };
        Update: Partial<{
          status: DuplicateReviewStatusRow;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
        }>;
        Relationships: [];
      };
      duplicate_detection_rules: {
        Row: {
          id: string;
          version: number;
          weight_title: number;
          weight_author: number;
          weight_year: number;
          weight_identifier: number;
          weight_file_hash: number;
          threshold_low: number;
          threshold_medium: number;
          threshold_high: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      orcid_oauth_states: {
        Row: {
          id: string;
          state: string;
          user_id: string;
          author_id: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          state: string;
          user_id: string;
          author_id: string;
          expires_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      orcid_oauth_tokens: {
        Row: {
          author_id: string;
          orcid: string;
          access_token: string;
          refresh_token: string | null;
          token_type: string | null;
          scope: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          orcid: string;
          access_token: string;
          refresh_token?: string | null;
          token_type?: string | null;
          scope?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<{
          orcid: string;
          access_token: string;
          refresh_token: string | null;
          token_type: string | null;
          scope: string | null;
          expires_at: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_research_views: {
        Args: { p_research_id: string };
        Returns: void;
      };
      create_duplicate_detection_rule_version: {
        Args: {
          p_weight_title: number;
          p_weight_author: number;
          p_weight_year: number;
          p_weight_identifier: number;
          p_weight_file_hash: number;
          p_threshold_low: number;
          p_threshold_medium: number;
          p_threshold_high: number;
        };
        Returns: Database["public"]["Tables"]["duplicate_detection_rules"]["Row"];
      };
      find_similar_research_items: {
        Args: { p_research_item_id: string };
        Returns: {
          candidate_id: string;
          title_similarity_th: number;
          title_similarity_en: number;
          same_year: boolean;
          same_isbn: boolean;
          same_doi: boolean;
          same_pdf_hash: boolean;
          same_principal_author: boolean;
        }[];
      };
      merge_authors: {
        Args: { p_source_id: string; p_target_id: string; p_reason?: string | null };
        Returns: void;
      };
      merge_organizations: {
        Args: { p_source_id: string; p_target_id: string; p_reason?: string | null };
        Returns: void;
      };
      merge_research_items: {
        Args: { p_source_id: string; p_target_id: string; p_reason?: string | null };
        Returns: void;
      };
      find_similar_authors_by_name: {
        Args: { p_name_th: string; p_exclude_id?: string | null };
        Returns: { id: string; name: string; sim: number }[];
      };
      find_similar_organizations_by_name: {
        Args: { p_name_th: string; p_exclude_id?: string | null };
        Returns: { id: string; name_th: string; sim: number }[];
      };
      log_research_download: {
        Args: { p_slug: string };
        Returns: void;
      };
      user_max_role_rank: {
        Args: { uid?: string };
        Returns: number;
      };
      cleanup_old_rate_limit_events: {
        Args: { p_retention_days: number };
        Returns: number;
      };
      expire_stale_access_requests: {
        Args: Record<string, never>;
        Returns: number;
      };
      expire_stale_access_grants: {
        Args: Record<string, never>;
        Returns: number;
      };
      warn_expiring_access_grants: {
        Args: { p_window_days?: number };
        Returns: {
          grant_id: string;
          user_id: string;
          research_item_id: string;
          access_type: string;
          expires_at: string;
        }[];
      };
      notify_category_subscribers_published: {
        Args: { p_research_item_id: string };
        Returns: boolean;
      };
      log_reading_history: {
        Args: { p_slug: string };
        Returns: void;
      };
      superadmin_storage_usage: {
        Args: Record<string, never>;
        Returns: { bucket_id: string; total_bytes: number; object_count: number }[];
      };
      superadmin_orphaned_storage_objects: {
        Args: { p_bucket_id: string };
        Returns: { name: string; size_bytes: number; created_at: string }[];
      };
      check_rate_limit: {
        Args: { p_key: string; p_max_attempts: number; p_window_seconds: number };
        Returns: boolean;
      };
      superadmin_update_bucket_limit: {
        Args: { p_bucket_id: string; p_size_limit_bytes: number };
        Returns: void;
      };
      superadmin_reorder_categories: {
        Args: { p_parent_id: string | null; p_ordered_ids: string[] };
        Returns: void;
      };
      superadmin_move_category: {
        Args: { p_category_id: string; p_new_parent_id: string | null; p_ordered_ids: string[] };
        Returns: void;
      };
      superadmin_reorder_organizations: {
        Args: { p_ordered_ids: string[] };
        Returns: void;
      };
      acquire_extraction_lock: {
        Args: { p_research_item_id: string; p_source_file_path: string };
        Returns: string | null;
      };
      search_research_document_excerpts: {
        Args: { p_raw_query: string; p_normalized_query: string };
        Returns: { research_item_id: string; excerpt: string | null; is_ocr: boolean }[];
      };
      acquire_ocr_lock: {
        Args: { p_research_item_id: string };
        Returns: string | null;
      };
      claim_background_jobs: {
        Args: { p_worker_id: string; p_limit?: number; p_job_types?: string[] | null };
        Returns: Database["public"]["Tables"]["background_jobs"]["Row"][];
      };
      claim_background_jobs_with_concurrency: {
        Args: { p_worker_id: string; p_job_type: string; p_limit: number; p_concurrency: number };
        Returns: Database["public"]["Tables"]["background_jobs"]["Row"][];
      };
      complete_background_job: {
        Args: { p_job_id: string };
        Returns: void;
      };
      fail_background_job: {
        Args: { p_job_id: string; p_error_message: string };
        Returns: boolean;
      };
      cancel_active_jobs_for_entity: {
        Args: {
          p_entity_type: string;
          p_entity_id: string;
          p_job_types?: string[] | null;
        };
        Returns: void;
      };
      count_pdf_processing_candidates: {
        Args: {
          p_extraction_state?: string | null;
          p_ocr_status?: string | null;
          p_year?: number | null;
          p_category_id?: string | null;
          p_publish_status?: string | null;
        };
        Returns: number;
      };
      page_pdf_processing_candidates: {
        Args: {
          p_extraction_state?: string | null;
          p_ocr_status?: string | null;
          p_year?: number | null;
          p_category_id?: string | null;
          p_publish_status?: string | null;
          p_after_updated_at?: string | null;
          p_after_id?: string | null;
          p_limit?: number;
        };
        Returns: {
          id: string;
          pdf_file: string | null;
          attachment_file: string | null;
          access_level: string;
          page_count: number;
          updated_at: string;
        }[];
      };
      count_duplicate_scan_candidates: {
        Args: {
          p_year?: number | null;
          p_category_id?: string | null;
          p_status?: string | null;
          p_edited_after?: string | null;
          p_never_scanned_only?: boolean;
        };
        Returns: number;
      };
      page_duplicate_scan_candidates: {
        Args: {
          p_year?: number | null;
          p_category_id?: string | null;
          p_status?: string | null;
          p_edited_after?: string | null;
          p_never_scanned_only?: boolean;
          p_after_updated_at?: string | null;
          p_after_id?: string | null;
          p_limit?: number;
        };
        Returns: { id: string; updated_at: string }[];
      };
      count_file_security_candidates: {
        Args: {
          p_scan_status?: string | null;
          p_never_scanned_only?: boolean;
          p_file_kind?: string | null;
          p_created_after?: string | null;
          p_created_before?: string | null;
        };
        Returns: number;
      };
      page_file_security_candidates: {
        Args: {
          p_scan_status?: string | null;
          p_never_scanned_only?: boolean;
          p_file_kind?: string | null;
          p_created_after?: string | null;
          p_created_before?: string | null;
          p_after_updated_at?: string | null;
          p_after_id?: string | null;
          p_limit?: number;
        };
        Returns: { id: string; pdf_file: string | null; attachment_file: string | null; updated_at: string }[];
      };
      create_job_batch_if_not_exists: {
        Args: {
          p_job_type: string;
          p_filter_snapshot: Record<string, unknown>;
          p_batch_size: number;
          p_total_items: number | null;
          p_created_by: string;
        };
        Returns: { batch_id: string; is_new: boolean }[];
      };
      set_job_batch_status: {
        Args: { p_batch_id: string; p_new_status: string; p_actor_id: string };
        Returns: Database["public"]["Tables"]["job_batches"]["Row"];
      };
      retry_failed_jobs_in_batch: {
        Args: { p_batch_id: string };
        Returns: number;
      };
      get_job_batch_progress: {
        Args: { p_batch_id: string };
        Returns: { status: string; item_count: number }[];
      };
      get_queue_health: {
        Args: Record<string, never>;
        Returns: {
          job_type: string;
          concurrency_limit: number;
          processing_count: number;
          active_worker_count: number;
          expired_lease_count: number;
          pending_count: number;
          stuck_pending_count: number;
        }[];
      };
      get_background_job_status_counts: {
        Args: Record<string, never>;
        Returns: { status: string; job_count: number }[];
      };
      notify_job_batch_finished: {
        Args: { p_batch_id: string };
        Returns: void;
      };
      finalize_job_batch_if_drained: {
        Args: { p_batch_id: string };
        Returns: void;
      };
    };
  };
}
