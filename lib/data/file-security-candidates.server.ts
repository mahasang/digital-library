import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import type { ScanStatusRow } from "@/lib/supabase/database.types";
import type { CandidatesPageCursor, CandidatesPageResult } from "@/lib/data/pdf-processing.server";
import type { FileSecurityBulkFilter } from "@/lib/validation/bulk-filters";

export type FileSecurityFilter = "all" | "pending" | "error" | "infected" | "clean" | "skipped";

export interface FileSecurityCandidate {
  id: string;
  titleTh: string;
  pdfFile: string;
  status: string;
  scanStatus: ScanStatusRow;
  scannedAt: string | null;
  scanReason: string | null;
}

const MAX_CANDIDATES = 500;

/**
 * รายการงานวิจัยที่มีไฟล์ PDF ให้เลือกสแกนความปลอดภัยซ้ำเป็นชุด — ใช้ที่หน้า
 * /superadmin/file-security จำกัด MAX_CANDIDATES แถวต่อการเรียกหนึ่งครั้ง
 * เหมือน lib/data/pdf-processing.server.ts
 */
export async function getFileSecurityCandidates(
  filter: FileSecurityFilter
): Promise<FileSecurityCandidate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  let query = supabase
    .from("research_items")
    .select("id, title_th, pdf_file, status, scan_status, scanned_at, scan_reason")
    .not("pdf_file", "is", null)
    .order("scanned_at", { ascending: true, nullsFirst: true })
    .limit(MAX_CANDIDATES);

  if (filter !== "all") {
    query = query.eq("scan_status", filter);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("getFileSecurityCandidates failed:", error?.message);
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    titleTh: item.title_th,
    pdfFile: item.pdf_file as string,
    status: item.status,
    scanStatus: item.scan_status,
    scannedAt: item.scanned_at,
    scanReason: item.scan_reason,
  }));
}

/** แถวที่ตรงตัวกรองสำหรับเส้นทาง "ประมวลผลทั้งหมดตามตัวกรอง" — คนละชุดฟิลด์
 * กับ FileSecurityCandidate (ซึ่งมีไว้แสดงผลหน้าเลือกรายการด้วยตนเอง) */
export interface FileSecurityBulkCandidateRow {
  id: string;
  pdfFile: string | null;
  attachmentFile: string | null;
  updatedAt: string;
}

/**
 * นับจำนวนรายการที่ตรงเงื่อนไข filter แบบแม่นยำผ่าน
 * count_file_security_candidates() (migration 20260817110000) — เพิ่ม
 * fileKind/createdAfter/createdBefore/neverScannedOnly ที่เดิมไม่รองรับเลย
 */
export async function getFileSecurityCandidatesCount(filter: FileSecurityBulkFilter): Promise<number | null> {
  if (!isServiceRoleConfigured()) return null;
  const service = createServiceRoleClient();

  const { data, error } = await service.rpc("count_file_security_candidates", {
    p_scan_status: filter.scanStatus ?? null,
    p_never_scanned_only: filter.neverScannedOnly ?? false,
    p_file_kind: filter.fileKind ?? null,
    p_created_after: filter.createdAfter ?? null,
    p_created_before: filter.createdBefore ?? null,
  });
  if (error) {
    console.error("getFileSecurityCandidatesCount failed:", error.message);
    return null;
  }
  return data ?? 0;
}

/**
 * เวอร์ชัน cursor-paginated ผ่าน page_file_security_candidates() — ใช้โดย
 * bulk-enqueue coordinator เท่านั้น
 */
export async function getFileSecurityCandidatesPage(
  filter: FileSecurityBulkFilter,
  cursor: CandidatesPageCursor | null,
  limit: number
): Promise<CandidatesPageResult<FileSecurityBulkCandidateRow>> {
  if (!isServiceRoleConfigured()) return { items: [], rawScanned: 0, nextCursor: null };
  const service = createServiceRoleClient();

  const { data, error } = await service.rpc("page_file_security_candidates", {
    p_scan_status: filter.scanStatus ?? null,
    p_never_scanned_only: filter.neverScannedOnly ?? false,
    p_file_kind: filter.fileKind ?? null,
    p_created_after: filter.createdAfter ?? null,
    p_created_before: filter.createdBefore ?? null,
    p_after_updated_at: cursor?.updatedAt ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: limit,
  });

  if (error || !data) {
    console.error("getFileSecurityCandidatesPage failed:", error?.message);
    return { items: [], rawScanned: 0, nextCursor: null };
  }

  const items: FileSecurityBulkCandidateRow[] = data.map((row) => ({
    id: row.id,
    pdfFile: row.pdf_file,
    attachmentFile: row.attachment_file,
    updatedAt: row.updated_at,
  }));

  const last = items[items.length - 1];
  const nextCursor = items.length === limit && last ? { updatedAt: last.updatedAt, id: last.id } : null;

  return { items, rawScanned: items.length, nextCursor };
}
