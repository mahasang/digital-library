export type AccessLevel =
  | "public"
  | "member_only"
  | "staff_only"
  | "read_only"
  | "metadata_only";

export type DocumentStatus =
  | "draft"
  | "pending_review"
  | "revision_requested"
  | "approved"
  | "published"
  | "rejected"
  | "archived"
  | "merged";

export type UserRole =
  | "guest"
  | "member"
  | "staff"
  | "librarian"
  | "admin"
  | "super_admin";

export interface Researcher {
  authorId: string | null;
  name: string;
  organization: string;
}

export interface ResearchItem {
  id: string;
  titleTh: string;
  titleEn: string;
  researchers: Researcher[];
  organization: string;
  year: number;
  categoryId: string;
  keywords: string[];
  abstract: string;
  coverImage: string;
  pdfFile: string;
  pageCount: number;
  accessLevel: AccessLevel;
  status: DocumentStatus;
  views: number;
  downloads: number;
  avgScore: number;
  ratingCount: number;
  publishedAt: string;
  scanStatus: ScanStatus;
}

export interface Category {
  id: string;
  nameTh: string;
  nameEn: string;
  description: string;
  icon: string;
  parentId?: string | null;
  isActive?: boolean;
}

export interface Organization {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  isActive?: boolean;
}

export interface AppSettings {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialFacebook: string;
  socialTwitter: string;
  socialLine: string;
  copyrightText: string;
  homepageLatestCount: number;
  homepagePopularCount: number;
  registrationEnabled: boolean;
  submissionEnabled: boolean;
  defaultResearchStatus: "draft" | "pending_review";
  captchaEnabled: boolean;
  notificationsInAppEnabled: boolean;
  notificationsEmailEnabled: boolean;
  maxPdfSizeMb: number;
  maxCoverSizeMb: number;
  maxAttachmentSizeMb: number;
  rateLimitRegisterMax: number;
  rateLimitRegisterWindowSec: number;
  rateLimitSubmitMax: number;
  rateLimitSubmitWindowSec: number;
  accessExpirationWarningDays: number;
  accessExpirationWarningInAppEnabled: boolean;
  accessExpirationWarningEmailEnabled: boolean;
  ocrMaxFileSizeMb: number;
  ocrMaxPages: number;
  ocrDailyQuotaEnabled: boolean;
  ocrMaxJobsPerUserPerDay: number;
  ocrProviderEnabled: boolean;
  /** ระดับ research_items.access_level ที่อนุญาตให้ส่ง OCR ได้ — ค่าเริ่มต้น ["public"] เท่านั้น */
  ocrAllowedAccessLevels: string[];
  /** เวลาที่แก้ไขแถวการตั้งค่าล่าสุด (ระดับทั้งแถว ไม่ใช่รายฟิลด์) — null ถ้ายังไม่เคยตั้งค่า Supabase */
  updatedAt: string | null;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  researchId: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * ข้อมูลงานวิจัยฉบับเต็มสำหรับหน้าจัดการภายใน (ส่งงานวิจัย/อนุมัติ)
 * มีฟิลด์เพิ่มเติมจาก ResearchItem ที่ไม่แสดงต่อสาธารณะ
 */
export type ScanStatus = "pending" | "clean" | "infected" | "error" | "skipped";

export interface SubmissionItem extends ResearchItem {
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewNote: string;
  attachmentFile: string;
  copyrightNote: string;
  copyrightConfirmed: boolean;
  scannedAt: string | null;
  scanProvider: string | null;
  scanReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MfaFactorSummary {
  id: string;
  friendlyName: string | null;
  factorType: string;
  status: "verified" | "unverified";
  createdAt: string;
  lastChallengedAt: string | null;
}

export interface ApprovalLogEntry {
  id: string;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus;
  note: string;
  createdAt: string;
}

export type AccessRequestType = "read" | "download";

export type AccessRequestStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "more_information_required"
  | "cancelled"
  | "expired";

/** คำขอเข้าถึงเอกสารมุมมองของผู้ขอเอง (/access-requests) */
export interface AccessRequestSummary {
  id: string;
  researchSlug: string;
  researchTitleTh: string;
  requestType: AccessRequestType;
  purpose: string;
  requesterNote: string | null;
  status: AccessRequestStatus;
  reviewerNote: string | null;
  accessGrantedAt: string | null;
  accessExpiresAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** คำขอเข้าถึงเอกสารมุมมองเจ้าหน้าที่ (/dashboard/access-requests) — มีข้อมูล
 * ผู้ขอเพิ่มเติมสำหรับตรวจสอบ (ไม่แสดงต่อผู้ใช้ทั่วไปตามข้อกำหนดความเป็นส่วนตัว) */
export interface AccessRequestAdminRow extends AccessRequestSummary {
  researchItemId: string;
  researchAccessLevel: AccessLevel;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
}

export interface DocumentAccessGrantSummary {
  id: string;
  accessType: AccessRequestType;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}
