import type {
  AccessLevelRow,
  DocumentStatusRow,
  ScanStatusRow,
} from "@/lib/supabase/database.types";

export interface RawOrganizationRef {
  name_th: string | null;
}

export interface RawCategoryRef {
  categories: { slug: string } | null;
}

export interface RawKeywordRef {
  keywords: { keyword: string } | null;
}

export interface RawAuthorRef {
  author_order: number;
  authors: {
    name: string;
    organization_name: string | null;
    organizations: RawOrganizationRef | null;
  } | null;
}

/**
 * รูปร่างของแถวข้อมูลที่ได้จาก Supabase หลัง join (research_items + ตารางที่เกี่ยวข้อง)
 * ตรงกับ select string ใน lib/data/queries.ts — ใช้ cast ผลลัพธ์จาก supabase-js
 * เนื่องจาก Database type ที่เขียนด้วยมือยังไม่ได้ประกาศ Relationships แบบเต็มรูปแบบ
 */
export interface RawResearchRow {
  id: string;
  slug: string;
  title_th: string;
  title_en: string | null;
  year: number;
  abstract: string;
  cover_image: string | null;
  pdf_file: string | null;
  page_count: number;
  access_level: AccessLevelRow;
  status: DocumentStatusRow;
  views: number;
  downloads: number;
  published_at: string | null;
  scan_status: ScanStatusRow;
  organizations: RawOrganizationRef | null;
  research_authors: RawAuthorRef[];
  research_categories: RawCategoryRef[];
  research_keywords: RawKeywordRef[];
}

/**
 * รูปร่างแถวข้อมูลแบบย่อสำหรับหน้าแรกสาธารณะเท่านั้น (Hallmark — homepage
 * data-flow optimization) — ตรงกับ HOMEPAGE_RESEARCH_SELECT ใน queries.ts
 * เลือกเฉพาะคอลัมน์/ความสัมพันธ์ที่ ResearchCard ใช้ render จริง (ไม่รวม
 * abstract, title_en, pdf_file, page_count, ข้อมูลหน่วยงาน, คำสำคัญ, หรือ
 * organization ของผู้วิจัยแต่ละคน — การ์ดหน้าแรกไม่แสดงสิ่งเหล่านี้เลย)
 */
export interface RawHomepageAuthorRef {
  author_order: number;
  authors: { name: string } | null;
}

export interface RawHomepageResearchRow {
  id: string;
  slug: string;
  title_th: string;
  cover_image: string | null;
  access_level: AccessLevelRow;
  year: number;
  published_at: string | null;
  views: number;
  downloads: number;
  research_categories: RawCategoryRef[];
  research_authors: RawHomepageAuthorRef[];
}

/** แถวย่อที่สุด — ใช้เฉพาะนับจำนวนงานวิจัยที่เผยแพร่แล้วต่อหมวดหมู่ (สถิติหน้าแรก) */
export interface RawResearchCategoryLinkRow {
  id: string;
  research_categories: RawCategoryRef[];
}

/** RawResearchRow + ฟิลด์เพิ่มเติมสำหรับหน้าจัดการภายใน */
export interface RawManagementResearchRow extends RawResearchRow {
  submitted_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  attachment_file: string | null;
  copyright_note: string | null;
  copyright_confirmed: boolean;
  scanned_at: string | null;
  scan_provider: string | null;
  scan_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawApprovalLogRow {
  id: string;
  from_status: DocumentStatusRow | null;
  to_status: DocumentStatusRow;
  note: string | null;
  created_at: string;
}
