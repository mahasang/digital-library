export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          access_expires_at: string | null
          access_granted_at: string | null
          created_at: string
          id: string
          purpose: string
          request_type: string
          requester_id: string
          requester_note: string | null
          research_item_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_expires_at?: string | null
          access_granted_at?: string | null
          created_at?: string
          id?: string
          purpose: string
          request_type: string
          requester_id: string
          requester_note?: string | null
          research_item_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_expires_at?: string | null
          access_granted_at?: string | null
          created_at?: string
          id?: string
          purpose?: string
          request_type?: string
          requester_id?: string
          requester_note?: string | null
          research_item_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_research_item_id_fkey"
            columns: ["research_item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          research_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          research_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          research_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_logs_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          biography: string | null
          created_at: string
          display_name_en: string | null
          id: string
          is_active: boolean
          merged_into_author_id: string | null
          name: string
          normalized_name_en: string | null
          normalized_name_th: string | null
          orcid: string | null
          orcid_api_checked_at: string | null
          orcid_api_public_name: string | null
          orcid_oauth_verified_at: string | null
          orcid_verified_at: string | null
          organization_id: string | null
          organization_name: string | null
          profile_id: string | null
          title_prefix_en: string | null
          title_prefix_th: string | null
          updated_at: string
        }
        Insert: {
          biography?: string | null
          created_at?: string
          display_name_en?: string | null
          id?: string
          is_active?: boolean
          merged_into_author_id?: string | null
          name: string
          normalized_name_en?: string | null
          normalized_name_th?: string | null
          orcid?: string | null
          orcid_api_checked_at?: string | null
          orcid_api_public_name?: string | null
          orcid_oauth_verified_at?: string | null
          orcid_verified_at?: string | null
          organization_id?: string | null
          organization_name?: string | null
          profile_id?: string | null
          title_prefix_en?: string | null
          title_prefix_th?: string | null
          updated_at?: string
        }
        Update: {
          biography?: string | null
          created_at?: string
          display_name_en?: string | null
          id?: string
          is_active?: boolean
          merged_into_author_id?: string | null
          name?: string
          normalized_name_en?: string | null
          normalized_name_th?: string | null
          orcid?: string | null
          orcid_api_checked_at?: string | null
          orcid_api_public_name?: string | null
          orcid_oauth_verified_at?: string | null
          orcid_verified_at?: string | null
          organization_id?: string | null
          organization_name?: string | null
          profile_id?: string | null
          title_prefix_en?: string | null
          title_prefix_th?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authors_merged_into_author_id_fkey"
            columns: ["merged_into_author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          attempts: number
          batch_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_page: number | null
          dead_letter_notified_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          job_type: string
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          progress: number
          progress_message: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_after: string
          started_at: string | null
          status: string
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_page?: number | null
          dead_letter_notified_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          progress?: number
          progress_message?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_after?: string
          started_at?: string | null
          status?: string
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_page?: number | null
          dead_letter_notified_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          progress?: number
          progress_message?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_after?: string
          started_at?: string | null
          status?: string
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "job_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_authors: {
        Row: {
          blog_post_id: string
          created_at: string
          display_order: number
          id: string
          profile_id: string
        }
        Insert: {
          blog_post_id: string
          created_at?: string
          display_order?: number
          id?: string
          profile_id: string
        }
        Update: {
          blog_post_id?: string
          created_at?: string
          display_order?: number
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_authors_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_authors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content_en: string
          content_lo: string
          content_th: string
          content_vi: string
          cover_image: string | null
          created_at: string
          excerpt_en: string
          excerpt_lo: string
          excerpt_th: string
          excerpt_vi: string
          id: string
          og_image: string | null
          published_at: string | null
          scheduled_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title_en: string
          title_lo: string
          title_th: string
          title_vi: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content_en?: string
          content_lo?: string
          content_th?: string
          content_vi?: string
          cover_image?: string | null
          created_at?: string
          excerpt_en?: string
          excerpt_lo?: string
          excerpt_th?: string
          excerpt_vi?: string
          id?: string
          og_image?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title_en?: string
          title_lo?: string
          title_th?: string
          title_vi?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content_en?: string
          content_lo?: string
          content_th?: string
          content_vi?: string
          cover_image?: string | null
          created_at?: string
          excerpt_en?: string
          excerpt_lo?: string
          excerpt_th?: string
          excerpt_vi?: string
          id?: string
          og_image?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title_en?: string
          title_lo?: string
          title_th?: string
          title_vi?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name_en: string
          name_th: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name_en: string
          name_th: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name_en?: string
          name_th?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_subscriptions: {
        Row: {
          category_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_subscriptions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          blog_post_id: string | null
          content: string
          created_at: string | null
          id: string
          research_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blog_post_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          research_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blog_post_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          research_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      content_revisions: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          snapshot: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          snapshot: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_revisions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_alert_state: {
        Row: {
          check_name: string
          last_alerted_at: string
        }
        Insert: {
          check_name: string
          last_alerted_at?: string
        }
        Update: {
          check_name?: string
          last_alerted_at?: string
        }
        Relationships: []
      }
      cron_monitoring_settings: {
        Row: {
          expected_frequency_minutes: number
          failure_threshold: number
          job_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          expected_frequency_minutes: number
          failure_threshold: number
          job_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          expected_frequency_minutes?: number
          failure_threshold?: number
          job_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cron_monitoring_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_summary: string | null
          failed_count: number
          id: string
          job_name: string
          next_expected_run_at: string | null
          processed_count: number
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          failed_count?: number
          id?: string
          job_name: string
          next_expected_run_at?: string | null
          processed_count?: number
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          failed_count?: number
          id?: string
          job_name?: string
          next_expected_run_at?: string | null
          processed_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      document_access_grants: {
        Row: {
          access_type: string
          created_at: string
          expires_at: string | null
          expiry_warned_at: string | null
          granted_by: string | null
          id: string
          research_item_id: string
          revoke_reason: string | null
          revoked_at: string | null
          source_request_id: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_type: string
          created_at?: string
          expires_at?: string | null
          expiry_warned_at?: string | null
          granted_by?: string | null
          id?: string
          research_item_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          source_request_id?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string
          expires_at?: string | null
          expiry_warned_at?: string | null
          granted_by?: string | null
          id?: string
          research_item_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          source_request_id?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_research_item_id_fkey"
            columns: ["research_item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      download_logs: {
        Row: {
          downloaded_at: string
          id: string
          ip_address: unknown
          research_id: string
          user_id: string | null
        }
        Insert: {
          downloaded_at?: string
          id?: string
          ip_address?: unknown
          research_id: string
          user_id?: string | null
        }
        Update: {
          downloaded_at?: string
          id?: string
          ip_address?: unknown
          research_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_logs_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_detection_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          threshold_high: number
          threshold_low: number
          threshold_medium: number
          version: number
          weight_author: number
          weight_file_hash: number
          weight_identifier: number
          weight_title: number
          weight_year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          threshold_high: number
          threshold_low: number
          threshold_medium: number
          version: number
          weight_author: number
          weight_file_hash: number
          weight_identifier: number
          weight_title: number
          weight_year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          threshold_high?: number
          threshold_low?: number
          threshold_medium?: number
          version?: number
          weight_author?: number
          weight_file_hash?: number
          weight_identifier?: number
          weight_title?: number
          weight_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_detection_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_research_reviews: {
        Row: {
          candidate_research_item_id: string
          created_at: string
          id: string
          research_item_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rule_version_id: string | null
          similarity_reasons: Json
          similarity_score: number
          status: string
          updated_at: string
        }
        Insert: {
          candidate_research_item_id: string
          created_at?: string
          id?: string
          research_item_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_version_id?: string | null
          similarity_reasons?: Json
          similarity_score: number
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_research_item_id?: string
          created_at?: string
          id?: string
          research_item_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_version_id?: string | null
          similarity_reasons?: Json
          similarity_score?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_research_reviews_candidate_research_item_id_fkey"
            columns: ["candidate_research_item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_research_reviews_research_item_id_fkey"
            columns: ["research_item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_research_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_research_reviews_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "duplicate_detection_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          blog_post_id: string | null
          created_at: string
          id: string
          research_id: string | null
          user_id: string
        }
        Insert: {
          blog_post_id?: string | null
          created_at?: string
          id?: string
          research_id?: string | null
          user_id: string
        }
        Update: {
          blog_post_id?: string | null
          created_at?: string
          id?: string
          research_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_batches: {
        Row: {
          batch_size: number
          cancelled_at: string | null
          cancelled_items: number
          completed_at: string | null
          completed_items: number
          completed_notified_at: string | null
          created_at: string
          created_by: string | null
          cursor_after_id: string | null
          cursor_after_updated_at: string | null
          dlq_notified_at: string | null
          enqueued_items: number
          failed_items: number
          failed_notified_at: string | null
          filter_hash: string | null
          filter_snapshot: Json
          id: string
          job_type: string
          paused_at: string | null
          skipped_items: number
          started_at: string | null
          status: string
          total_items: number | null
          updated_at: string
        }
        Insert: {
          batch_size?: number
          cancelled_at?: string | null
          cancelled_items?: number
          completed_at?: string | null
          completed_items?: number
          completed_notified_at?: string | null
          created_at?: string
          created_by?: string | null
          cursor_after_id?: string | null
          cursor_after_updated_at?: string | null
          dlq_notified_at?: string | null
          enqueued_items?: number
          failed_items?: number
          failed_notified_at?: string | null
          filter_hash?: string | null
          filter_snapshot?: Json
          id?: string
          job_type: string
          paused_at?: string | null
          skipped_items?: number
          started_at?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Update: {
          batch_size?: number
          cancelled_at?: string | null
          cancelled_items?: number
          completed_at?: string | null
          completed_items?: number
          completed_notified_at?: string | null
          created_at?: string
          created_by?: string | null
          cursor_after_id?: string | null
          cursor_after_updated_at?: string | null
          dlq_notified_at?: string | null
          enqueued_items?: number
          failed_items?: number
          failed_notified_at?: string | null
          filter_hash?: string | null
          filter_snapshot?: Json
          id?: string
          job_type?: string
          paused_at?: string | null
          skipped_items?: number
          started_at?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_type_settings: {
        Row: {
          concurrency: number
          default_batch_size: number
          job_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          concurrency?: number
          default_batch_size?: number
          job_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          concurrency?: number
          default_batch_size?: number
          job_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_type_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          access_request_email_enabled: boolean
          access_request_in_app_enabled: boolean
          comment_push_enabled: boolean | null
          created_at: string
          id: string
          new_research_email_enabled: boolean
          new_research_in_app_enabled: boolean
          new_research_push_enabled: boolean | null
          system_push_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_request_email_enabled?: boolean
          access_request_in_app_enabled?: boolean
          comment_push_enabled?: boolean | null
          created_at?: string
          id?: string
          new_research_email_enabled?: boolean
          new_research_in_app_enabled?: boolean
          new_research_push_enabled?: boolean | null
          system_push_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_request_email_enabled?: boolean
          access_request_in_app_enabled?: boolean
          comment_push_enabled?: boolean | null
          created_at?: string
          id?: string
          new_research_email_enabled?: boolean
          new_research_in_app_enabled?: boolean
          new_research_push_enabled?: boolean | null
          system_push_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          research_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          research_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          research_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_test_runs: {
        Row: {
          background_job_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_page: number | null
          error_summary: string | null
          extracted_char_count: number | null
          fixture_name: string
          id: string
          page_count: number | null
          progress_message: string | null
          started_at: string | null
          status: string
          total_pages: number | null
        }
        Insert: {
          background_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_page?: number | null
          error_summary?: string | null
          extracted_char_count?: number | null
          fixture_name: string
          id?: string
          page_count?: number | null
          progress_message?: string | null
          started_at?: string | null
          status?: string
          total_pages?: number | null
        }
        Update: {
          background_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_page?: number | null
          error_summary?: string | null
          extracted_char_count?: number | null
          fixture_name?: string
          id?: string
          page_count?: number | null
          progress_message?: string | null
          started_at?: string | null
          status?: string
          total_pages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_test_runs_background_job_id_fkey"
            columns: ["background_job_id"]
            isOneToOne: false
            referencedRelation: "background_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_test_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orcid_oauth_states: {
        Row: {
          author_id: string
          created_at: string
          expires_at: string
          id: string
          state: string
          user_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          expires_at?: string
          id?: string
          state: string
          user_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcid_oauth_states_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcid_oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orcid_oauth_tokens: {
        Row: {
          access_token: string
          author_id: string
          created_at: string
          expires_at: string | null
          orcid: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          author_id: string
          created_at?: string
          expires_at?: string | null
          orcid: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          author_id?: string
          created_at?: string
          expires_at?: string | null
          orcid?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcid_oauth_tokens_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: true
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          merged_into_organization_id: string | null
          name_en: string | null
          name_th: string
          normalized_name_en: string | null
          normalized_name_th: string | null
          organization_code: string | null
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          merged_into_organization_id?: string | null
          name_en?: string | null
          name_th: string
          normalized_name_en?: string | null
          normalized_name_th?: string | null
          organization_code?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          merged_into_organization_id?: string | null
          name_en?: string | null
          name_th?: string
          normalized_name_en?: string | null
          normalized_name_th?: string | null
          organization_code?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_merged_into_organization_id_fkey"
            columns: ["merged_into_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          organization_name: string | null
          phone: string | null
          push_token: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          organization_id?: string | null
          organization_name?: string | null
          phone?: string | null
          push_token?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          organization_name?: string | null
          phone?: string | null
          push_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: string
          rate_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          rate_key: string
        }
        Update: {
          created_at?: string
          id?: string
          rate_key?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string | null
          id: string
          research_id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          research_id: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          research_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_history: {
        Row: {
          blog_post_id: string | null
          id: string
          read_at: string
          research_id: string | null
          user_id: string | null
        }
        Insert: {
          blog_post_id?: string | null
          id?: string
          read_at?: string
          research_id?: string | null
          user_id?: string | null
        }
        Update: {
          blog_post_id?: string | null
          id?: string
          read_at?: string
          research_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_authors: {
        Row: {
          author_id: string
          author_order: number
          author_role: string
          id: string
          research_id: string
        }
        Insert: {
          author_id: string
          author_order?: number
          author_role?: string
          id?: string
          research_id: string
        }
        Update: {
          author_id?: string
          author_order?: number
          author_role?: string
          id?: string
          research_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_authors_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_categories: {
        Row: {
          category_id: string
          id: string
          research_id: string
        }
        Insert: {
          category_id: string
          id?: string
          research_id: string
        }
        Update: {
          category_id?: string
          id?: string
          research_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_categories_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_document_texts: {
        Row: {
          created_at: string
          extracted_at: string | null
          extracted_text: string | null
          extracted_text_normalized: string | null
          extraction_error_message: string | null
          extraction_status: string
          id: string
          ocr_confidence: number | null
          ocr_error_message: string | null
          ocr_language: string | null
          ocr_processed_at: string | null
          ocr_provider: string | null
          ocr_status: string
          ocr_text: string | null
          ocr_text_normalized: string | null
          research_item_id: string
          source_file_hash: string | null
          source_file_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_at?: string | null
          extracted_text?: string | null
          extracted_text_normalized?: string | null
          extraction_error_message?: string | null
          extraction_status?: string
          id?: string
          ocr_confidence?: number | null
          ocr_error_message?: string | null
          ocr_language?: string | null
          ocr_processed_at?: string | null
          ocr_provider?: string | null
          ocr_status?: string
          ocr_text?: string | null
          ocr_text_normalized?: string | null
          research_item_id: string
          source_file_hash?: string | null
          source_file_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_at?: string | null
          extracted_text?: string | null
          extracted_text_normalized?: string | null
          extraction_error_message?: string | null
          extraction_status?: string
          id?: string
          ocr_confidence?: number | null
          ocr_error_message?: string | null
          ocr_language?: string | null
          ocr_processed_at?: string | null
          ocr_provider?: string | null
          ocr_status?: string
          ocr_text?: string | null
          ocr_text_normalized?: string | null
          research_item_id?: string
          source_file_hash?: string | null
          source_file_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_document_texts_research_item_id_fkey"
            columns: ["research_item_id"]
            isOneToOne: true
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_items: {
        Row: {
          abstract: string
          access_level: string
          attachment_file: string | null
          category_notified_at: string | null
          copyright_confirmed: boolean
          copyright_note: string | null
          cover_image: string | null
          created_at: string
          doi: string | null
          downloads: number
          id: string
          isbn: string | null
          merged_into_research_item_id: string | null
          normalized_title_en: string | null
          normalized_title_th: string | null
          organization_id: string | null
          page_count: number
          pdf_file: string | null
          published_at: string | null
          review_note: string | null
          reviewed_by: string | null
          scan_provider: string | null
          scan_reason: string | null
          scan_status: string
          scanned_at: string | null
          slug: string
          status: string
          submitted_by: string | null
          title_en: string | null
          title_th: string
          updated_at: string
          views: number
          year: number
        }
        Insert: {
          abstract: string
          access_level?: string
          attachment_file?: string | null
          category_notified_at?: string | null
          copyright_confirmed?: boolean
          copyright_note?: string | null
          cover_image?: string | null
          created_at?: string
          doi?: string | null
          downloads?: number
          id?: string
          isbn?: string | null
          merged_into_research_item_id?: string | null
          normalized_title_en?: string | null
          normalized_title_th?: string | null
          organization_id?: string | null
          page_count?: number
          pdf_file?: string | null
          published_at?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          scan_provider?: string | null
          scan_reason?: string | null
          scan_status?: string
          scanned_at?: string | null
          slug: string
          status?: string
          submitted_by?: string | null
          title_en?: string | null
          title_th: string
          updated_at?: string
          views?: number
          year: number
        }
        Update: {
          abstract?: string
          access_level?: string
          attachment_file?: string | null
          category_notified_at?: string | null
          copyright_confirmed?: boolean
          copyright_note?: string | null
          cover_image?: string | null
          created_at?: string
          doi?: string | null
          downloads?: number
          id?: string
          isbn?: string | null
          merged_into_research_item_id?: string | null
          normalized_title_en?: string | null
          normalized_title_th?: string | null
          organization_id?: string | null
          page_count?: number
          pdf_file?: string | null
          published_at?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          scan_provider?: string | null
          scan_reason?: string | null
          scan_status?: string
          scanned_at?: string | null
          slug?: string
          status?: string
          submitted_by?: string | null
          title_en?: string | null
          title_th?: string
          updated_at?: string
          views?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_items_merged_into_research_item_id_fkey"
            columns: ["merged_into_research_item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_items_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_keywords: {
        Row: {
          id: string
          keyword_id: string
          research_id: string
        }
        Insert: {
          id?: string
          keyword_id: string
          research_id: string
        }
        Update: {
          id?: string
          keyword_id?: string
          research_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_keywords_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_view_logs: {
        Row: {
          id: string
          research_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          research_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          research_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_view_logs_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          rank: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rank: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rank?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          access_expiration_warning_days: number
          access_expiration_warning_email_enabled: boolean
          access_expiration_warning_in_app_enabled: boolean
          captcha_enabled: boolean
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          copyright_text: string | null
          created_at: string
          default_research_status: string
          favicon_url: string | null
          homepage_latest_count: number
          homepage_popular_count: number
          id: string
          logo_url: string | null
          max_attachment_size_mb: number
          max_cover_size_mb: number
          max_pdf_size_mb: number
          notifications_email_enabled: boolean
          notifications_in_app_enabled: boolean
          ocr_allowed_access_levels: string[]
          ocr_daily_quota_enabled: boolean
          ocr_max_file_size_mb: number
          ocr_max_jobs_per_user_per_day: number
          ocr_max_pages: number
          ocr_provider_enabled: boolean
          rate_limit_register_max: number
          rate_limit_register_window_sec: number
          rate_limit_submit_max: number
          rate_limit_submit_window_sec: number
          registration_enabled: boolean
          site_name: string
          social_facebook: string | null
          social_line: string | null
          social_twitter: string | null
          submission_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_expiration_warning_days?: number
          access_expiration_warning_email_enabled?: boolean
          access_expiration_warning_in_app_enabled?: boolean
          captcha_enabled?: boolean
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          copyright_text?: string | null
          created_at?: string
          default_research_status?: string
          favicon_url?: string | null
          homepage_latest_count?: number
          homepage_popular_count?: number
          id?: string
          logo_url?: string | null
          max_attachment_size_mb?: number
          max_cover_size_mb?: number
          max_pdf_size_mb?: number
          notifications_email_enabled?: boolean
          notifications_in_app_enabled?: boolean
          ocr_allowed_access_levels?: string[]
          ocr_daily_quota_enabled?: boolean
          ocr_max_file_size_mb?: number
          ocr_max_jobs_per_user_per_day?: number
          ocr_max_pages?: number
          ocr_provider_enabled?: boolean
          rate_limit_register_max?: number
          rate_limit_register_window_sec?: number
          rate_limit_submit_max?: number
          rate_limit_submit_window_sec?: number
          registration_enabled?: boolean
          site_name?: string
          social_facebook?: string | null
          social_line?: string | null
          social_twitter?: string | null
          submission_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_expiration_warning_days?: number
          access_expiration_warning_email_enabled?: boolean
          access_expiration_warning_in_app_enabled?: boolean
          captcha_enabled?: boolean
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          copyright_text?: string | null
          created_at?: string
          default_research_status?: string
          favicon_url?: string | null
          homepage_latest_count?: number
          homepage_popular_count?: number
          id?: string
          logo_url?: string | null
          max_attachment_size_mb?: number
          max_cover_size_mb?: number
          max_pdf_size_mb?: number
          notifications_email_enabled?: boolean
          notifications_in_app_enabled?: boolean
          ocr_allowed_access_levels?: string[]
          ocr_daily_quota_enabled?: boolean
          ocr_max_file_size_mb?: number
          ocr_max_jobs_per_user_per_day?: number
          ocr_max_pages?: number
          ocr_provider_enabled?: boolean
          rate_limit_register_max?: number
          rate_limit_register_window_sec?: number
          rate_limit_submit_max?: number
          rate_limit_submit_window_sec?: number
          registration_enabled?: boolean
          site_name?: string
          social_facebook?: string | null
          social_line?: string | null
          social_twitter?: string | null
          submission_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      research_favorites_count: {
        Row: {
          favorites_count: number | null
          research_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_extraction_lock: {
        Args: { p_research_item_id: string; p_source_file_path: string }
        Returns: string
      }
      acquire_ocr_lock: {
        Args: { p_research_item_id: string }
        Returns: string
      }
      cancel_active_jobs_for_entity: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_job_types?: string[]
        }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_key: string
          p_max_attempts: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_background_jobs: {
        Args: { p_job_types?: string[]; p_limit?: number; p_worker_id: string }
        Returns: {
          attempts: number
          batch_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_page: number | null
          dead_letter_notified_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          job_type: string
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          progress: number
          progress_message: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_after: string
          started_at: string | null
          status: string
          total_pages: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "background_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_background_jobs_with_concurrency: {
        Args: {
          p_concurrency: number
          p_job_type: string
          p_limit: number
          p_worker_id: string
        }
        Returns: {
          attempts: number
          batch_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_page: number | null
          dead_letter_notified_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          job_type: string
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          progress: number
          progress_message: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_after: string
          started_at: string | null
          status: string
          total_pages: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "background_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_rate_limit_events: {
        Args: { p_retention_days: number }
        Returns: number
      }
      complete_background_job: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      count_duplicate_scan_candidates: {
        Args: {
          p_category_id?: string
          p_edited_after?: string
          p_never_scanned_only?: boolean
          p_status?: string
          p_year?: number
        }
        Returns: number
      }
      count_file_security_candidates: {
        Args: {
          p_created_after?: string
          p_created_before?: string
          p_file_kind?: string
          p_never_scanned_only?: boolean
          p_scan_status?: string
        }
        Returns: number
      }
      count_pdf_processing_candidates: {
        Args: {
          p_category_id?: string
          p_extraction_state?: string
          p_ocr_status?: string
          p_publish_status?: string
          p_year?: number
        }
        Returns: number
      }
      create_duplicate_detection_rule_version: {
        Args: {
          p_threshold_high: number
          p_threshold_low: number
          p_threshold_medium: number
          p_weight_author: number
          p_weight_file_hash: number
          p_weight_identifier: number
          p_weight_title: number
          p_weight_year: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          threshold_high: number
          threshold_low: number
          threshold_medium: number
          version: number
          weight_author: number
          weight_file_hash: number
          weight_identifier: number
          weight_title: number
          weight_year: number
        }
        SetofOptions: {
          from: "*"
          to: "duplicate_detection_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_job_batch_if_not_exists: {
        Args: {
          p_batch_size: number
          p_created_by: string
          p_filter_snapshot: Json
          p_job_type: string
          p_total_items: number
        }
        Returns: {
          batch_id: string
          is_new: boolean
        }[]
      }
      delete_own_account: { Args: never; Returns: undefined }
      expire_stale_access_grants: { Args: never; Returns: number }
      expire_stale_access_requests: { Args: never; Returns: number }
      fail_background_job: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: boolean
      }
      finalize_job_batch_if_drained: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      find_similar_authors_by_name: {
        Args: { p_exclude_id?: string; p_name_th: string }
        Returns: {
          id: string
          name: string
          sim: number
        }[]
      }
      find_similar_organizations_by_name: {
        Args: { p_exclude_id?: string; p_name_th: string }
        Returns: {
          id: string
          name_th: string
          sim: number
        }[]
      }
      find_similar_research_items: {
        Args: { p_research_item_id: string }
        Returns: {
          candidate_id: string
          same_doi: boolean
          same_isbn: boolean
          same_pdf_hash: boolean
          same_principal_author: boolean
          same_year: boolean
          title_similarity_en: number
          title_similarity_th: number
        }[]
      }
      get_background_job_status_counts: {
        Args: never
        Returns: {
          job_count: number
          status: string
        }[]
      }
      get_blog_comments: {
        Args: { p_blog_post_id: string; p_limit?: number }
        Returns: {
          author_avatar_url: string
          author_name: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }[]
      }
      get_blog_favorites_count: {
        Args: { p_blog_post_id: string }
        Returns: number
      }
      get_comments: {
        Args: { p_limit?: number; p_research_id: string }
        Returns: {
          author_avatar_url: string
          author_name: string
          content: string
          created_at: string
          id: string
          user_id: string
        }[]
      }
      get_favorites_count: { Args: { p_research_id: string }; Returns: number }
      get_job_batch_progress: {
        Args: { p_batch_id: string }
        Returns: {
          item_count: number
          status: string
        }[]
      }
      get_queue_health: {
        Args: never
        Returns: {
          active_worker_count: number
          concurrency_limit: number
          expired_lease_count: number
          job_type: string
          pending_count: number
          processing_count: number
          stuck_pending_count: number
        }[]
      }
      get_rating_stats: {
        Args: { p_research_id: string }
        Returns: {
          avg_score: number
          rating_count: number
        }[]
      }
      increment_research_views:
        | { Args: { p_research_id: string }; Returns: undefined }
        | {
            Args: { p_research_id: string; p_user_id?: string }
            Returns: undefined
          }
      log_blog_reading_history: { Args: { p_slug: string }; Returns: undefined }
      log_reading_history: { Args: { p_slug: string }; Returns: undefined }
      log_research_download: { Args: { p_slug: string }; Returns: undefined }
      merge_authors: {
        Args: { p_reason?: string; p_source_id: string; p_target_id: string }
        Returns: undefined
      }
      merge_organizations: {
        Args: { p_reason?: string; p_source_id: string; p_target_id: string }
        Returns: undefined
      }
      merge_research_items: {
        Args: { p_reason?: string; p_source_id: string; p_target_id: string }
        Returns: undefined
      }
      normalize_person_name: { Args: { p_text: string }; Returns: string }
      normalize_text_for_matching: { Args: { p_text: string }; Returns: string }
      notify_category_subscribers_published: {
        Args: { p_research_item_id: string }
        Returns: boolean
      }
      notify_job_batch_finished: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      page_duplicate_scan_candidates: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_category_id?: string
          p_edited_after?: string
          p_limit?: number
          p_never_scanned_only?: boolean
          p_status?: string
          p_year?: number
        }
        Returns: {
          id: string
          updated_at: string
        }[]
      }
      page_file_security_candidates: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_created_after?: string
          p_created_before?: string
          p_file_kind?: string
          p_limit?: number
          p_never_scanned_only?: boolean
          p_scan_status?: string
        }
        Returns: {
          attachment_file: string
          id: string
          pdf_file: string
          updated_at: string
        }[]
      }
      page_pdf_processing_candidates: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_category_id?: string
          p_extraction_state?: string
          p_limit?: number
          p_ocr_status?: string
          p_publish_status?: string
          p_year?: number
        }
        Returns: {
          access_level: string
          attachment_file: string
          id: string
          page_count: number
          pdf_file: string
          updated_at: string
        }[]
      }
      retry_failed_jobs_in_batch: {
        Args: { p_batch_id: string }
        Returns: number
      }
      search_research_document_excerpts: {
        Args: { p_normalized_query: string; p_raw_query: string }
        Returns: {
          excerpt: string
          is_ocr: boolean
          research_item_id: string
        }[]
      }
      set_job_batch_status: {
        Args: { p_actor_id: string; p_batch_id: string; p_new_status: string }
        Returns: {
          batch_size: number
          cancelled_at: string | null
          cancelled_items: number
          completed_at: string | null
          completed_items: number
          completed_notified_at: string | null
          created_at: string
          created_by: string | null
          cursor_after_id: string | null
          cursor_after_updated_at: string | null
          dlq_notified_at: string | null
          enqueued_items: number
          failed_items: number
          failed_notified_at: string | null
          filter_hash: string | null
          filter_snapshot: Json
          id: string
          job_type: string
          paused_at: string | null
          skipped_items: number
          started_at: string | null
          status: string
          total_items: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "job_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      superadmin_move_category: {
        Args: {
          p_category_id: string
          p_new_parent_id: string
          p_ordered_ids: string[]
        }
        Returns: undefined
      }
      superadmin_orphaned_storage_objects: {
        Args: { p_bucket_id: string }
        Returns: {
          created_at: string
          name: string
          size_bytes: number
        }[]
      }
      superadmin_reorder_categories: {
        Args: { p_ordered_ids: string[]; p_parent_id: string }
        Returns: undefined
      }
      superadmin_reorder_organizations: {
        Args: { p_ordered_ids: string[] }
        Returns: undefined
      }
      superadmin_storage_usage: {
        Args: never
        Returns: {
          bucket_id: string
          object_count: number
          total_bytes: number
        }[]
      }
      superadmin_update_bucket_limit: {
        Args: { p_bucket_id: string; p_size_limit_bytes: number }
        Returns: undefined
      }
      user_max_role_rank: { Args: { uid?: string }; Returns: number }
      warn_expiring_access_grants: {
        Args: { p_window_days?: number }
        Returns: {
          access_type: string
          expires_at: string
          grant_id: string
          research_item_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
