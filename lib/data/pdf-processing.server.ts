import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import type { ExtractionStatusRow, OcrStatusRow } from "@/lib/supabase/database.types";
import type { OcrBulkFilter } from "@/lib/validation/bulk-filters";

export type PdfProcessingFilter = "all" | "no_text" | "failed" | "no_text_found" | "replaced";

export interface PdfProcessingCandidate {
  id: string;
  titleTh: string;
  pdfFile: string;
  status: string;
  extractionStatus: ExtractionStatusRow | null;
  extractionErrorMessage: string | null;
  fileReplaced: boolean;
  ocrStatus: OcrStatusRow | null;
  ocrErrorMessage: string | null;
  accessLevel: string;
  pageCount: number;
}

const MAX_CANDIDATES = 500;

/**
 * รายการงานวิจัยที่อาจต้อง (re)ประมวลผลข้อความ PDF — ใช้ที่หน้า
 * /superadmin/pdf-processing สำหรับ backfill เป็นชุด จำกัด MAX_CANDIDATES แถว
 * ต่อการเรียกหนึ่งครั้ง (ขอบเขตหน้า Super Admin ไม่ได้ออกแบบให้รองรับข้อมูล
 * เป็นแสนแถวในหน้าเดียว — ถ้าเกินต้องกรองเพิ่มเติมด้วย filter ก่อน)
 */
export async function getPdfProcessingCandidates(
  filter: PdfProcessingFilter
): Promise<PdfProcessingCandidate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data: items, error: itemsError } = await supabase
    .from("research_items")
    .select("id, title_th, pdf_file, status, updated_at, access_level, page_count")
    .not("pdf_file", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (itemsError || !items) {
    console.error("getPdfProcessingCandidates: query research_items failed:", itemsError?.message);
    return [];
  }

  const ids = items.map((item) => item.id);
  const { data: texts, error: textsError } = await supabase
    .from("research_document_texts")
    .select("research_item_id, extraction_status, extraction_error_message, source_file_path, ocr_status, ocr_error_message")
    .in("research_item_id", ids);

  if (textsError) {
    console.error(
      "getPdfProcessingCandidates: query research_document_texts failed:",
      textsError.message
    );
  }

  const textByItemId = new Map((texts ?? []).map((t) => [t.research_item_id, t]));

  const candidates: PdfProcessingCandidate[] = items.map((item) => {
    const text = textByItemId.get(item.id);
    const fileReplaced = Boolean(text && text.source_file_path !== item.pdf_file);
    return {
      id: item.id,
      titleTh: item.title_th,
      pdfFile: item.pdf_file as string,
      status: item.status,
      extractionStatus: text?.extraction_status ?? null,
      extractionErrorMessage: text?.extraction_error_message ?? null,
      fileReplaced,
      ocrStatus: text?.ocr_status ?? null,
      ocrErrorMessage: text?.ocr_error_message ?? null,
      accessLevel: item.access_level,
      pageCount: item.page_count,
    };
  });

  switch (filter) {
    case "no_text":
      return candidates.filter((c) => c.extractionStatus === null);
    case "failed":
      return candidates.filter((c) => c.extractionStatus === "failed");
    case "no_text_found":
      return candidates.filter((c) => c.extractionStatus === "no_text_found");
    case "replaced":
      return candidates.filter((c) => c.fileReplaced);
    default:
      return candidates;
  }
}

export interface CandidatesPageCursor {
  updatedAt: string;
  id: string;
}

export interface CandidatesPageResult<T> {
  items: T[];
  /** จำนวนแถวดิบที่สแกนในรอบนี้ (ก่อนกรองด้วย filter) — ใช้ตัดสิน "หมดแล้วหรือยัง"
   * แยกจากจำนวน items ที่ผ่านตัวกรอง เพราะ filter บางแบบ (no_text/replaced)
   * กรองหลัง join ด้วย JS จึงอาจได้ items 0 รายการทั้งที่ยังมีแถวเหลือให้สแกนต่อ */
  rawScanned: number;
  nextCursor: CandidatesPageCursor | null;
}

/** แถวที่ตรงตัวกรองสำหรับเส้นทาง "ประมวลผลทั้งหมดตามตัวกรอง" (ไม่จำกัด 500
 * รายการ) — คนละชุดฟิลด์กับ PdfProcessingCandidate (ซึ่งมีไว้แสดงผลในหน้า
 * เลือกรายการด้วยตนเอง ต้องการ titleTh/extractionStatus ฯลฯ) ชุดนี้มีแค่ฟิลด์
 * ที่ coordinator (handleBulkEnqueueJob) และ checkOcrEligibility ต้องใช้จริง */
export interface PdfProcessingBulkCandidateRow {
  id: string;
  pdfFile: string | null;
  attachmentFile: string | null;
  accessLevel: string;
  pageCount: number;
  updatedAt: string;
}

/**
 * นับจำนวนรายการที่ตรงตัวกรองแบบแม่นยำผ่าน count_pdf_processing_candidates()
 * (migration 20260817110000) — รองรับทุกตัวกรองรวมถึง never_attempted/replaced
 * ที่เดิมนับไม่ได้ด้วย PostgREST query builder (เดิมคืน null ให้สองตัวนี้)
 * ใช้ตัวกรองเดียวกับ OcrBulkFilter (ocrStatus เป็น optional สำหรับหน้า OCR)
 */
export async function getPdfProcessingCandidatesCount(filter: OcrBulkFilter): Promise<number | null> {
  if (!isServiceRoleConfigured()) return null;
  const service = createServiceRoleClient();

  const { data, error } = await service.rpc("count_pdf_processing_candidates", {
    p_extraction_state: filter.extractionState ?? null,
    p_ocr_status: filter.ocrStatus ?? null,
    p_year: filter.year ?? null,
    p_category_id: filter.categoryId ?? null,
    p_publish_status: filter.publishStatus ?? null,
  });
  if (error) {
    console.error("getPdfProcessingCandidatesCount failed:", error.message);
    return null;
  }
  return data ?? 0;
}

/**
 * เวอร์ชัน cursor-paginated ผ่าน page_pdf_processing_candidates() — ใช้โดย
 * bulk-enqueue coordinator (lib/jobs/handlers/bulk-enqueue.server.ts) เท่านั้น
 * เพื่อทยอยสร้าง job ทีละ chunk แทนการโหลดรายการที่ตรงเงื่อนไขทั้งหมดเข้า
 * หน่วยความจำในคำขอเดียว — การกรอง/join ทั้งหมดทำในฐานข้อมูลแล้ว (ไม่มี JS-side
 * join อีกต่อไป) เคอร์เซอร์เดินหน้าตาม (updated_at, id) เหมือนเดิมทุกประการ
 */
export async function getPdfProcessingCandidatesPage(
  filter: OcrBulkFilter,
  cursor: CandidatesPageCursor | null,
  limit: number
): Promise<CandidatesPageResult<PdfProcessingBulkCandidateRow>> {
  if (!isServiceRoleConfigured()) return { items: [], rawScanned: 0, nextCursor: null };
  const service = createServiceRoleClient();

  const { data, error } = await service.rpc("page_pdf_processing_candidates", {
    p_extraction_state: filter.extractionState ?? null,
    p_ocr_status: filter.ocrStatus ?? null,
    p_year: filter.year ?? null,
    p_category_id: filter.categoryId ?? null,
    p_publish_status: filter.publishStatus ?? null,
    p_after_updated_at: cursor?.updatedAt ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: limit,
  });

  if (error || !data) {
    console.error("getPdfProcessingCandidatesPage: RPC failed:", error?.message);
    return { items: [], rawScanned: 0, nextCursor: null };
  }

  const items: PdfProcessingBulkCandidateRow[] = data.map((row) => ({
    id: row.id,
    pdfFile: row.pdf_file,
    attachmentFile: row.attachment_file,
    accessLevel: row.access_level,
    pageCount: row.page_count,
    updatedAt: row.updated_at,
  }));

  const last = items[items.length - 1];
  const nextCursor = items.length === limit && last ? { updatedAt: last.updatedAt, id: last.id } : null;

  return { items, rawScanned: items.length, nextCursor };
}
