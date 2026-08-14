import type { SupabaseClient } from "@supabase/supabase-js";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type {
  AccessLevelRow,
  Database,
  DocumentStatusRow,
} from "@/lib/supabase/database.types";
import type {
  RawResearchRow,
  RawManagementResearchRow,
  RawHomepageResearchRow,
  RawResearchCategoryLinkRow,
} from "@/lib/data/types";

const RESEARCH_FETCH_FALLBACK_MESSAGE = "ไม่สามารถดึงข้อมูลงานวิจัยจาก Supabase ได้ กรุณาลองใหม่อีกครั้ง";

/**
 * select string ที่ใช้ร่วมกันสำหรับดึงข้อมูลงานวิจัยพร้อมความสัมพันธ์ทั้งหมด
 * (หน่วยงาน, ผู้วิจัย, หมวดหมู่, คำสำคัญ) ให้อยู่ในรูปเดียวกับ RawResearchRow
 * ใช้สำหรับหน้าสาธารณะ (published เท่านั้น) — ไม่รวมฟิลด์ภายใน เช่น review_note
 */
const RESEARCH_SELECT = `
  id, slug, title_th, title_en, year, abstract, cover_image, pdf_file,
  page_count, access_level, status, views, downloads, published_at,
  organizations ( name_th ),
  research_authors ( author_order, authors ( name, organization_name, organizations ( name_th ) ) ),
  research_categories ( categories ( slug ) ),
  research_keywords ( keywords ( keyword ) )
`;

/**
 * select string สำหรับหน้าจัดการภายใน (ส่งงานวิจัย/อนุมัติ) รวมฟิลด์เพิ่มเติม
 * ที่ไม่แสดงต่อสาธารณะ — การมองเห็นแถวยังคงถูกจำกัดโดย RLS ตามปกติ
 * (เจ้าของงานหรือ librarian/admin เท่านั้น)
 */
const RESEARCH_MANAGEMENT_SELECT = `
  ${RESEARCH_SELECT},
  submitted_by, reviewed_by, review_note, attachment_file,
  copyright_note, copyright_confirmed,
  scan_status, scanned_at, scan_provider, scan_reason,
  created_at, updated_at
`;

export async function fetchPublishedResearchRows(
  client: SupabaseClient<Database>
): Promise<RawResearchRow[]> {
  const { data, error } = await client
    .from("research_items")
    .select(RESEARCH_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchPublishedResearchRows")
    );
  }

  return (data ?? []) as unknown as RawResearchRow[];
}

/**
 * select string แบบย่อสำหรับหน้าแรกสาธารณะเท่านั้น (Hallmark — homepage
 * data-flow optimization) — คัดเฉพาะคอลัมน์/ความสัมพันธ์ที่ ResearchCard บน
 * หน้าแรกใช้ render จริง: ไม่มี organizations, ไม่มี research_keywords, ไม่มี
 * organization ของผู้วิจัยแต่ละคน (authors.organization_name/organizations),
 * ไม่มี abstract/title_en/pdf_file/page_count — เทียบกับ RESEARCH_SELECT
 * เต็มรูปแบบด้านบนซึ่งดึงทุกความสัมพันธ์ไม่ว่าหน้านั้นจะ render หรือไม่
 */
const HOMEPAGE_RESEARCH_SELECT = `
  id, slug, title_th, cover_image, access_level, year, published_at, views, downloads,
  research_categories ( categories ( slug ) ),
  research_authors ( author_order, authors ( name ) )
`;

/**
 * ดึงงานวิจัยที่เผยแพร่แล้วสำหรับหน้าแรก เรียงลำดับ/จำกัดจำนวนที่ฐานข้อมูล
 * โดยตรงผ่าน .order()/.limit() แทนการดึงทุกแถวมาเรียงเองใน JavaScript
 *
 * secondaryOrder (ใช้เฉพาะ "งานวิจัยยอดนิยม") จำเป็นเพื่อคงลำดับเดิมเป๊ะเมื่อ
 * views เท่ากันหลายรายการ — โค้ดเดิมดึงทุกแถว (ซึ่งมาจาก fetchPublishedResearchRows
 * ที่เรียง published_at ใหม่สุดก่อนอยู่แล้ว) แล้ว sort ด้วย views ผ่าน
 * Array.prototype.sort() ซึ่ง JS การันตีว่า stable (ES2019+) รายการที่ views
 * เท่ากันจึงคงลำดับเดิม (published_at ใหม่สุดก่อน) ไว้เสมอ — ทำซ้ำพฤติกรรมนี้
 * ที่ฐานข้อมูลต้องระบุ published_at DESC เป็นตัวตัดสินลำดับรองอย่างชัดเจน
 * เพราะ Postgres ไม่การันตีลำดับที่เท่ากันโดยไม่มี ORDER BY ระบุไว้
 */
export async function fetchHomepageResearchRows(
  client: SupabaseClient<Database>,
  orderColumn: "published_at" | "views",
  limit: number,
  secondaryOrder?: "published_at"
): Promise<RawHomepageResearchRow[]> {
  let query = client
    .from("research_items")
    .select(HOMEPAGE_RESEARCH_SELECT)
    .eq("status", "published")
    .order(orderColumn, { ascending: false });

  if (secondaryOrder) {
    query = query.order(secondaryOrder, { ascending: false });
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchHomepageResearchRows")
    );
  }

  return (data ?? []) as unknown as RawHomepageResearchRow[];
}

/**
 * ดึงเฉพาะ id + หมวดหมู่ที่ผูกไว้ ของงานวิจัยที่เผยแพร่แล้วทั้งหมด — สำหรับ
 * คำนวณสถิติหน้าแรก (จำนวนรวม + จำนวนต่อหมวดหมู่) เท่านั้น ไม่ .limit() เพราะ
 * ต้องใช้ทุกแถวเพื่อนับให้ถูกต้อง แต่ payload เล็กกว่า RESEARCH_SELECT เต็ม
 * รูปแบบมาก (2 คอลัมน์ + 1 ความสัมพันธ์ แทนที่จะเป็น ~15 คอลัมน์ + 4 ความสัมพันธ์)
 */
export async function fetchPublishedResearchCategoryLinkRows(
  client: SupabaseClient<Database>
): Promise<RawResearchCategoryLinkRow[]> {
  const { data, error } = await client
    .from("research_items")
    .select("id, research_categories ( categories ( slug ) )")
    .eq("status", "published");

  if (error) {
    throw new Error(
      toSafeErrorMessage(
        error,
        "ไม่สามารถดึงสถิติงานวิจัยสำหรับหน้าแรกจาก Supabase ได้ กรุณาลองใหม่อีกครั้ง",
        "fetchPublishedResearchCategoryLinkRows"
      )
    );
  }

  return (data ?? []) as unknown as RawResearchCategoryLinkRow[];
}

export async function fetchResearchRowBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<RawResearchRow | null> {
  const { data, error } = await client
    .from("research_items")
    .select(RESEARCH_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchResearchRowBySlug")
    );
  }

  return (data ?? null) as unknown as RawResearchRow | null;
}

/** ดึงข้อมูลงานวิจัยตาม id จริง (ทุกสถานะ) — ใช้ในหน้าจัดการภายใน RLS จำกัดแถวเอง */
export async function fetchManagementResearchRowById(
  client: SupabaseClient<Database>,
  id: string
): Promise<RawManagementResearchRow | null> {
  const { data, error } = await client
    .from("research_items")
    .select(RESEARCH_MANAGEMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchManagementResearchRowById")
    );
  }

  return (data ?? null) as unknown as RawManagementResearchRow | null;
}

/** รายการงานวิจัยที่ผู้ใช้ปัจจุบันเป็นผู้ส่ง (ทุกสถานะ) */
export async function fetchOwnSubmissionRows(
  client: SupabaseClient<Database>,
  userId: string
): Promise<RawManagementResearchRow[]> {
  const { data, error } = await client
    .from("research_items")
    .select(RESEARCH_MANAGEMENT_SELECT)
    .eq("submitted_by", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchOwnSubmissionRows")
    );
  }

  return (data ?? []) as unknown as RawManagementResearchRow[];
}

/** ดึงงานวิจัยที่เผยแพร่แล้วตามรายการ id ที่ระบุ (ใช้กับรายการโปรด/ประวัติการอ่าน) */
export async function fetchPublishedResearchRowsByIds(
  client: SupabaseClient<Database>,
  ids: string[]
): Promise<RawResearchRow[]> {
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("research_items")
    .select(RESEARCH_SELECT)
    .eq("status", "published")
    .in("id", ids);

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchPublishedResearchRowsByIds")
    );
  }

  return (data ?? []) as unknown as RawResearchRow[];
}

/** รายการงานวิจัยตามสถานะที่ระบุ (สำหรับ Dashboard ของ librarian/admin) */
export async function fetchResearchRowsByStatus(
  client: SupabaseClient<Database>,
  statuses: DocumentStatusRow[]
): Promise<RawManagementResearchRow[]> {
  const { data, error } = await client
    .from("research_items")
    .select(RESEARCH_MANAGEMENT_SELECT)
    .in("status", statuses)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "fetchResearchRowsByStatus")
    );
  }

  return (data ?? []) as unknown as RawManagementResearchRow[];
}

export interface ManagementSearchFilters {
  query?: string;
  status?: DocumentStatusRow;
  accessLevel?: AccessLevelRow;
  /** จำกัดเฉพาะ id ที่อยู่ในรายการนี้ (ใช้เมื่อกรองตามหมวดหมู่ ซึ่ง resolve จาก slug มาก่อนแล้ว) */
  researchIds?: string[];
  limit: number;
  offset: number;
}

/**
 * ค้นหา/กรองงานวิจัยทุกสถานะแบบแบ่งหน้า (Server-side) — สำหรับ /dashboard/research
 * กรองและแบ่งหน้าที่ฐานข้อมูลโดยตรง ไม่ดึงข้อมูลทั้งหมดมาไว้ฝั่งแอปโดยไม่จำเป็น
 */
export async function searchManagementResearchRows(
  client: SupabaseClient<Database>,
  filters: ManagementSearchFilters
): Promise<{ rows: RawManagementResearchRow[]; total: number }> {
  let query = client
    .from("research_items")
    .select(RESEARCH_MANAGEMENT_SELECT, { count: "exact" });

  if (filters.query) {
    const safe = filters.query.replace(/[,()%]/g, " ").trim();
    if (safe) {
      query = query.or(`title_th.ilike.%${safe}%,title_en.ilike.%${safe}%`);
    }
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.accessLevel) {
    query = query.eq("access_level", filters.accessLevel);
  }
  if (filters.researchIds) {
    query = query.in("id", filters.researchIds);
  }

  query = query
    .order("updated_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(
      toSafeErrorMessage(error, RESEARCH_FETCH_FALLBACK_MESSAGE, "searchManagementResearchRows")
    );
  }

  return {
    rows: (data ?? []) as unknown as RawManagementResearchRow[],
    total: count ?? 0,
  };
}
