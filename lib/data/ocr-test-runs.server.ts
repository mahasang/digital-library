import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import type { OcrTestRunStatusRow } from "@/lib/supabase/database.types";

export interface OcrTestRunRow {
  id: string;
  fixtureName: string;
  status: OcrTestRunStatusRow;
  pageCount: number | null;
  extractedCharCount: number | null;
  currentPage: number | null;
  totalPages: number | null;
  progressMessage: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const COLUMNS =
  "id, fixture_name, status, page_count, extracted_char_count, current_page, total_pages, progress_message, error_summary, started_at, completed_at, created_at";

/** ประวัติ Controlled OCR Test ล่าสุด (ช่วงที่ 32) — ใช้ Service Role อ่านตรง
 * (เหมือน getRecentJobs) เพราะหน้า Super Admin ใช้ Server Component render
 * ครั้งแรกแล้ว poll ผ่าน API route ที่ตรวจสิทธิ์ session เองอีกชั้น */
export async function getRecentOcrTestRuns(limit = 20): Promise<OcrTestRunRow[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from("ocr_test_runs")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getRecentOcrTestRuns failed:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    fixtureName: row.fixture_name,
    status: row.status,
    pageCount: row.page_count,
    extractedCharCount: row.extracted_char_count,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    progressMessage: row.progress_message,
    errorMessage: row.error_summary,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));
}
