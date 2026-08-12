import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AccessLevel,
  AccessRequestAdminRow,
  AccessRequestStatus,
  AccessRequestType,
  DocumentAccessGrantSummary,
} from "@/types/research";

interface RawRow {
  id: string;
  request_type: AccessRequestType;
  purpose: string;
  requester_note: string | null;
  status: AccessRequestStatus;
  reviewer_note: string | null;
  access_granted_at: string | null;
  access_expires_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  research_item_id: string;
  requester_id: string;
  research_items: { slug: string; title_th: string; access_level: AccessLevel } | null;
}

const ADMIN_ROW_COLUMNS =
  "id, request_type, purpose, requester_note, status, reviewer_note, access_granted_at, access_expires_at, reviewed_at, created_at, research_item_id, requester_id, research_items ( slug, title_th, access_level )";

async function mapRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: RawRow[]
): Promise<AccessRequestAdminRow[]> {
  const requesterIds = Array.from(new Set(rows.map((r) => r.requester_id)));
  const { data: profiles } =
    requesterIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", requesterIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profileById.get(row.requester_id);
    return {
      id: row.id,
      researchItemId: row.research_item_id,
      researchSlug: row.research_items?.slug ?? "",
      researchTitleTh: row.research_items?.title_th ?? "",
      researchAccessLevel: row.research_items?.access_level ?? "public",
      requestType: row.request_type,
      purpose: row.purpose,
      requesterNote: row.requester_note,
      status: row.status,
      reviewerNote: row.reviewer_note,
      accessGrantedAt: row.access_granted_at,
      accessExpiresAt: row.access_expires_at,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      requesterId: row.requester_id,
      requesterName: profile?.full_name || "ไม่ระบุชื่อ",
      requesterEmail: profile?.email || "",
    };
  });
}

export interface AccessRequestStaffFilters {
  status?: AccessRequestStatus;
  requestType?: AccessRequestType;
  categoryId?: string; // category slug (ตรงกับ ResearchFilters เดิม)
  requesterQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** รายการคำขอเข้าถึงเอกสารทั้งหมด (มุมมองเจ้าหน้าที่) — Librarian/Admin/Super
 * Admin เท่านั้น (บังคับด้วย RLS access_requests_select_own_or_staff อยู่แล้ว
 * แต่หน้าเว็บควรตรวจ rank ซ้ำก่อนเรียกด้วยเสมอ) เรียก expire_stale_access_requests()
 * ก่อนทุกครั้ง (lazy expire — ดู docs/document-access-requests.md) */
export async function getAccessRequestsForStaff(
  filters: AccessRequestStaffFilters = {}
): Promise<AccessRequestAdminRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const { error: expireError } = await supabase.rpc("expire_stale_access_requests");
  if (expireError) {
    console.error("expire_stale_access_requests failed:", expireError.message);
  }

  let query = supabase.from("access_requests").select(ADMIN_ROW_COLUMNS).order("created_at", {
    ascending: false,
  });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.requestType) query = query.eq("request_type", filters.requestType);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  if (filters.categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.categoryId)
      .maybeSingle();
    if (!category) return [];

    const { data: links } = await supabase
      .from("research_categories")
      .select("research_id")
      .eq("category_id", category.id);
    const ids = (links ?? []).map((l) => l.research_id);
    if (ids.length === 0) return [];
    query = query.in("research_item_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getAccessRequestsForStaff failed:", error.message);
    return [];
  }

  const mapped = await mapRows(supabase, (data ?? []) as unknown as RawRow[]);

  if (filters.requesterQuery) {
    const q = filters.requesterQuery.trim().toLowerCase();
    return mapped.filter(
      (r) => r.requesterName.toLowerCase().includes(q) || r.requesterEmail.toLowerCase().includes(q)
    );
  }

  return mapped;
}

export async function getAccessRequestDetailForStaff(
  requestId: string
): Promise<AccessRequestAdminRow | null> {
  if (!isSupabaseConfigured() || !requestId) return null;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("access_requests")
    .select(ADMIN_ROW_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error("getAccessRequestDetailForStaff failed:", error.message);
    return null;
  }

  const [mapped] = await mapRows(supabase, [row as unknown as RawRow]);
  return mapped ?? null;
}

/** ประวัติคำขอเดิมของผู้ขอคนเดียวกันสำหรับเอกสารเดียวกัน (ไม่รวมคำขอปัจจุบัน)
 * — สำหรับหน้ารายละเอียดคำขอฝั่งเจ้าหน้าที่ */
export async function getPriorRequestsForRequesterAndItem(
  requesterId: string,
  researchItemId: string,
  excludeRequestId: string
): Promise<{ id: string; requestType: AccessRequestType; status: AccessRequestStatus; createdAt: string }[]> {
  if (!isSupabaseConfigured() || !requesterId || !researchItemId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("access_requests")
    .select("id, request_type, status, created_at")
    .eq("requester_id", requesterId)
    .eq("research_item_id", researchItemId)
    .neq("id", excludeRequestId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPriorRequestsForRequesterAndItem failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    requestType: row.request_type,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/** สิทธิ์ที่ผู้ใช้คนนี้มีอยู่แล้วสำหรับเอกสารนี้ (ทั้ง active และเคยเพิกถอน/
 * หมดอายุ) — สำหรับหน้ารายละเอียดคำขอฝั่งเจ้าหน้าที่ ใช้ตัดสินใจว่าจะอนุมัติ
 * เพิ่มหรือมีอยู่แล้ว */
export async function getGrantsForUserAndItem(
  researchItemId: string,
  userId: string
): Promise<DocumentAccessGrantSummary[]> {
  if (!isSupabaseConfigured() || !researchItemId || !userId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_access_grants")
    .select("id, access_type, starts_at, expires_at, revoked_at")
    .eq("research_item_id", researchItemId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getGrantsForUserAndItem failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    accessType: row.access_type,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));
}
