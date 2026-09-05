import type { ResearchItem, SubmissionItem, ApprovalLogEntry } from "@/types/research";
import type {
  RawResearchRow,
  RawManagementResearchRow,
  RawApprovalLogRow,
  RawHomepageResearchRow,
} from "@/lib/data/types";

function calcRating(ratings: { score: number }[]): { avgScore: number; ratingCount: number } {
  if (!ratings || ratings.length === 0) return { avgScore: 0, ratingCount: 0 };
  const sum = ratings.reduce((acc, r) => acc + r.score, 0);
  return { avgScore: Math.round((sum / ratings.length) * 10) / 10, ratingCount: ratings.length };
}

export function mapRowToResearchItem(row: RawResearchRow): ResearchItem {
  return {
    id: row.slug,
    titleTh: row.title_th,
    titleEn: row.title_en ?? "",
    researchers: [...row.research_authors]
      .sort((a, b) => a.author_order - b.author_order)
      .map((ra) => ({
        authorId: ra.authors?.id ?? null,
        name: ra.authors?.name ?? "",
        organization:
          ra.authors?.organizations?.name_th ?? ra.authors?.organization_name ?? "",
      })),
    organization: row.organizations?.name_th ?? "",
    year: row.year,
    categoryId: row.research_categories[0]?.categories?.slug ?? "",
    keywords: row.research_keywords
      .map((rk) => rk.keywords?.keyword ?? "")
      .filter((keyword) => keyword.length > 0),
    abstract: row.abstract,
    coverImage: row.cover_image ?? "",
    pdfFile: row.pdf_file ?? "",
    pageCount: row.page_count,
    accessLevel: row.access_level,
    status: row.status,
    views: row.views,
    downloads: row.downloads,
    ...calcRating(row.ratings),
    publishedAt: row.published_at ?? "",
    scanStatus: row.scan_status,
  };
}

/**
 * แปลงแถวย่อของหน้าแรก (HOMEPAGE_RESEARCH_SELECT) เป็น ResearchItem เต็มรูปแบบ
 * เพื่อให้ยังใช้ร่วมกับ ResearchCard/ResearchGrid/ResearchSection เดิมได้โดย
 * ไม่ต้องแก้ prop type ของ component เหล่านั้นเลย (คงหน้าตา UI เดิมทุกประการ)
 *
 * ฟิลด์ที่ ResearchCard ไม่ได้ render บนหน้าแรก (titleEn, organization,
 * keywords, abstract, pdfFile, pageCount) ตั้งเป็นค่าว่าง/ศูนย์โดยตั้งใจ —
 * ไม่ใช่ข้อมูลที่ขาดหาย แต่เป็นเพราะแถวนี้ไม่ได้ดึงคอลัมน์เหล่านั้นมาตั้งแต่ต้น
 * ห้ามใช้ผลลัพธ์จากฟังก์ชันนี้ในหน้า/ส่วนอื่นที่ต้องการฟิลด์เหล่านี้จริง
 * (เช่น หน้ารายละเอียดงานวิจัย) — ใช้ mapRowToResearchItem() กับ
 * RESEARCH_SELECT เต็มรูปแบบแทนสำหรับกรณีนั้น status เป็น "published" และ
 * scanStatus เป็น "clean" เสมอเพราะ query ต้นทางกรอง status='published'ไว้
 * แล้ว (มี trigger ฐานข้อมูลบล็อกการเผยแพร่ไฟล์ที่สแกนไม่ผ่านอยู่แล้ว)
 */
export function mapHomepageRowToResearchItem(row: RawHomepageResearchRow): ResearchItem {
  return {
    id: row.slug,
    titleTh: row.title_th,
    titleEn: "",
    researchers: [...row.research_authors]
      .sort((a, b) => a.author_order - b.author_order)
      .map((ra) => ({ authorId: null, name: ra.authors?.name ?? "", organization: "" })),
    organization: "",
    year: row.year,
    categoryId: row.research_categories[0]?.categories?.slug ?? "",
    keywords: [],
    abstract: "",
    coverImage: row.cover_image ?? "",
    pdfFile: "",
    pageCount: 0,
    accessLevel: row.access_level,
    status: "published",
    views: row.views,
    downloads: row.downloads,
    ...calcRating(row.ratings),
    publishedAt: row.published_at ?? "",
    scanStatus: "clean",
  };
}

export function mapRowToSubmissionItem(row: RawManagementResearchRow): SubmissionItem {
  return {
    ...mapRowToResearchItem(row),
    id: row.id,
    submittedBy: row.submitted_by,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note ?? "",
    attachmentFile: row.attachment_file ?? "",
    copyrightNote: row.copyright_note ?? "",
    copyrightConfirmed: row.copyright_confirmed,
    scanStatus: row.scan_status,
    scannedAt: row.scanned_at,
    scanProvider: row.scan_provider,
    scanReason: row.scan_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToApprovalLogEntry(row: RawApprovalLogRow): ApprovalLogEntry {
  return {
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}
