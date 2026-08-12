import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AccessRequestStatus, AccessRequestSummary, AccessRequestType } from "@/types/research";

interface RawAccessRequestRow {
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
  research_items: { slug: string; title_th: string } | null;
}

function mapRow(row: RawAccessRequestRow): AccessRequestSummary {
  return {
    id: row.id,
    researchSlug: row.research_items?.slug ?? "",
    researchTitleTh: row.research_items?.title_th ?? "",
    requestType: row.request_type,
    purpose: row.purpose,
    requesterNote: row.requester_note,
    status: row.status,
    reviewerNote: row.reviewer_note,
    accessGrantedAt: row.access_granted_at,
    accessExpiresAt: row.access_expires_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

/** รายการคำขอเข้าถึงเอกสารของผู้ใช้ปัจจุบัน (สำหรับ /access-requests) — เรียก
 * expire_stale_access_requests() ก่อนเสมอ (lazy expire เนื่องจากไม่มี job
 * queue/cron ในโปรเจกต์นี้ — ดู docs/document-access-requests.md) */
export async function getMyAccessRequests(
  statusFilter?: AccessRequestStatus
): Promise<AccessRequestSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { error: expireError } = await supabase.rpc("expire_stale_access_requests");
  if (expireError) {
    console.error("expire_stale_access_requests failed:", expireError.message);
  }

  let query = supabase
    .from("access_requests")
    .select(
      "id, request_type, purpose, requester_note, status, reviewer_note, access_granted_at, access_expires_at, reviewed_at, created_at, research_items ( slug, title_th )"
    )
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getMyAccessRequests failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawAccessRequestRow[]).map(mapRow);
}

/** สถานะคำขอล่าสุด (ทุกสถานะ ไม่ใช่แค่ active) ของผู้ใช้ปัจจุบันสำหรับเอกสาร+
 * ประเภทสิทธิ์หนึ่ง — ใช้ตัดสินใจว่าจะแสดงปุ่ม "ขอสิทธิ์" หรือสถานะคำขอเดิม
 * ที่หน้ารายละเอียดงานวิจัย รับ slug เหมือน getExtractionStatusBySlug (ช่วงที่
 * 17) เพราะ ResearchItem.id ของหน้าสาธารณะเป็น slug เสมอ ไม่ใช่ uuid จริง */
export async function getMyLatestRequestForItem(
  researchSlug: string,
  requestType: AccessRequestType
): Promise<{ id: string; status: AccessRequestStatus } | null> {
  if (!isSupabaseConfigured() || !researchSlug) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("access_requests")
    .select("id, status, research_items!inner(slug)")
    .eq("research_items.slug", researchSlug)
    .eq("request_type", requestType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getMyLatestRequestForItem failed:", error.message);
    return null;
  }
  return data;
}
