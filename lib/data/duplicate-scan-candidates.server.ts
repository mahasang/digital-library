import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import type { DocumentStatusRow } from "@/lib/supabase/database.types";
import type { CandidatesPageCursor, CandidatesPageResult } from "@/lib/data/pdf-processing.server";
import type { DuplicateScanBulkFilter } from "@/lib/validation/bulk-filters";

export interface DuplicateScanFilters {
  year?: number;
  categoryId?: string;
  status?: DocumentStatusRow;
  recentlyEditedOnly?: boolean;
}

export interface DuplicateScanCandidate {
  id: string;
  titleTh: string;
  year: number;
  status: DocumentStatusRow;
  updatedAt: string;
}

const MAX_CANDIDATES = 500;
const RECENTLY_EDITED_WINDOW_DAYS = 30;

/**
 * รายการงานวิจัยให้เลือกตรวจสอบซ้ำย้อนหลังเป็นชุด — ใช้ที่หน้า
 * /superadmin/data-quality จำกัด MAX_CANDIDATES แถวต่อการเรียกหนึ่งครั้ง
 * (เหมือน lib/data/pdf-processing.server.ts ของช่วงที่ 20) กรอง `merged` ออก
 * เสมอ (ไม่มีความหมายจะตรวจสอบรายการที่ถูกรวมไปแล้ว)
 */
export async function getDuplicateScanCandidates(
  filters: DuplicateScanFilters
): Promise<DuplicateScanCandidate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  interface RawRow {
    id: string;
    title_th: string;
    year: number;
    status: DocumentStatusRow;
    updated_at: string;
  }

  // เลือก join แบบ inner เฉพาะตอนกรองด้วยหมวดหมู่เท่านั้น (ต้องมีแถวจับคู่จริง)
  // ไม่งั้นใช้ select ธรรมดา — join แบบ inner แบบไม่มีเงื่อนไขจะตัดงานวิจัยที่
  // ไม่มีหมวดหมู่เลยออกจากผลลัพธ์โดยไม่ตั้งใจ (research_categories เป็นตาราง
  // เชื่อมแบบ many-to-many แยกต่างหาก ไม่ใช่คอลัมน์ตรงบน research_items) —
  // เขียนแยกสอง query แบบ literal string แทน string ที่ประกอบขึ้นตอนรัน
  // เพราะ Supabase query builder แปลง select string เป็น type ตอน compile
  // (string ทั่วไปที่ไม่ใช่ literal ทำให้ type ของผลลัพธ์อนุมานไม่ได้)
  let rawRows: RawRow[];

  if (filters.categoryId) {
    let query = supabase
      .from("research_items")
      .select("id, title_th, year, status, updated_at, research_categories!inner(category_id)")
      .neq("status", "merged")
      .eq("research_categories.category_id", filters.categoryId)
      .order("updated_at", { ascending: false })
      .limit(MAX_CANDIDATES);

    if (filters.year) query = query.eq("year", filters.year);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.recentlyEditedOnly) {
      const since = new Date(Date.now() - RECENTLY_EDITED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("updated_at", since);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error("getDuplicateScanCandidates failed:", error?.message);
      return [];
    }
    rawRows = data as unknown as RawRow[];
  } else {
    let query = supabase
      .from("research_items")
      .select("id, title_th, year, status, updated_at")
      .neq("status", "merged")
      .order("updated_at", { ascending: false })
      .limit(MAX_CANDIDATES);

    if (filters.year) query = query.eq("year", filters.year);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.recentlyEditedOnly) {
      const since = new Date(Date.now() - RECENTLY_EDITED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("updated_at", since);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error("getDuplicateScanCandidates failed:", error?.message);
      return [];
    }
    rawRows = data;
  }

  // งานวิจัยหนึ่งรายการอาจอยู่หลายหมวดหมู่ — join ผ่าน research_categories!inner
  // (จำเป็นเมื่อกรองด้วย categoryId) อาจทำให้แถวซ้ำ ตัดซ้ำด้วย Map ตาม id
  const seen = new Map<string, DuplicateScanCandidate>();
  for (const row of rawRows) {
    if (seen.has(row.id)) continue;
    seen.set(row.id, {
      id: row.id,
      titleTh: row.title_th,
      year: row.year,
      status: row.status,
      updatedAt: row.updated_at,
    });
  }
  return Array.from(seen.values());
}

/** แปลง filter object ของฟีเจอร์ "ประมวลผลทั้งหมดตามตัวกรอง" เป็น args ของ
 * RPC — recentlyEditedOnly (fixed 30 วันเดิม) แปลงเป็น editedAfter ที่นี่
 * เพื่อให้ caller เดิม (ที่ยังส่ง recentlyEditedOnly มา) ได้พฤติกรรมเดิมทุก
 * ประการ ขณะที่ RPC เองรับช่วงเวลาใดก็ได้ (editedAfter ทั่วไป) */
function toRpcArgs(filters: DuplicateScanBulkFilter & { recentlyEditedOnly?: boolean }) {
  const editedAfter =
    filters.editedAfter ??
    (filters.recentlyEditedOnly
      ? new Date(Date.now() - RECENTLY_EDITED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : undefined);
  return {
    p_year: filters.year ?? null,
    p_category_id: filters.categoryId ?? null,
    p_status: filters.status ?? null,
    p_edited_after: editedAfter ?? null,
    p_never_scanned_only: filters.neverScannedOnly ?? false,
  };
}

/**
 * นับจำนวนรายการที่ตรงเงื่อนไข filter แบบแม่นยำผ่าน
 * count_duplicate_scan_candidates() (migration 20260817110000) — รองรับ
 * categoryId แล้ว (เดิมคืน null เพราะต้อง join research_categories) และ
 * neverScannedOnly ใหม่ (ไม่เคยเป็นคู่ในผลตรวจซ้ำมาก่อนเลย ไม่ว่าฝั่งใดของคู่ —
 * ดู comment ในฟังก์ชัน SQL สำหรับรายละเอียดโครงสร้างตาราง)
 */
export async function getDuplicateScanCandidatesCount(
  filters: DuplicateScanBulkFilter & { recentlyEditedOnly?: boolean }
): Promise<number | null> {
  if (!isServiceRoleConfigured()) return null;
  const service = createServiceRoleClient();

  const { data, error } = await service.rpc("count_duplicate_scan_candidates", toRpcArgs(filters));
  if (error) {
    console.error("getDuplicateScanCandidatesCount failed:", error.message);
    return null;
  }
  return data ?? 0;
}

/**
 * เวอร์ชัน cursor-paginated ผ่าน page_duplicate_scan_candidates() — ใช้โดย
 * bulk-enqueue coordinator เท่านั้น รองรับ categoryId ผ่าน EXISTS subquery
 * ในฟังก์ชัน SQL แทน join (ไม่มีปัญหาแถวซ้ำที่เคยทำให้เคอร์เซอร์คลาดเคลื่อน
 * เหมือนแนวทาง JS-side join เดิมอีกต่อไป)
 */
export async function getDuplicateScanCandidatesPage(
  filters: DuplicateScanBulkFilter & { recentlyEditedOnly?: boolean },
  cursor: CandidatesPageCursor | null,
  limit: number
): Promise<CandidatesPageResult<{ id: string; updatedAt: string }>> {
  if (!isServiceRoleConfigured()) return { items: [], rawScanned: 0, nextCursor: null };
  const service = createServiceRoleClient();

  const { data, error } = await service.rpc("page_duplicate_scan_candidates", {
    ...toRpcArgs(filters),
    p_after_updated_at: cursor?.updatedAt ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: limit,
  });

  if (error || !data) {
    console.error("getDuplicateScanCandidatesPage failed:", error?.message);
    return { items: [], rawScanned: 0, nextCursor: null };
  }

  const items = data.map((row) => ({ id: row.id, updatedAt: row.updated_at }));
  const last = items[items.length - 1];
  const nextCursor = items.length === limit && last ? { updatedAt: last.updatedAt, id: last.id } : null;

  return { items, rawScanned: items.length, nextCursor };
}

/** ปีที่มีงานวิจัยอยู่จริง (สำหรับ dropdown ตัวกรอง) เรียงใหม่สุดก่อน */
export async function getDistinctResearchYears(): Promise<number[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("research_items")
    .select("year")
    .neq("status", "merged")
    .order("year", { ascending: false });

  if (error || !data) return [];
  return Array.from(new Set(data.map((r) => r.year)));
}
