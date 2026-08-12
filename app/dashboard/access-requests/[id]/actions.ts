"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { notifyAccessRequestByEmail } from "@/lib/notifications/access-request-email.server";
import type { ActionResult } from "@/lib/actions/types";
import type { AccessRequestTypeRow } from "@/lib/supabase/database.types";

interface RequestRow {
  id: string;
  research_item_id: string;
  requester_id: string;
  request_type: AccessRequestTypeRow;
  status: string;
  research_items: { title_th: string } | null;
}

const REQUEST_COLUMNS =
  "id, research_item_id, requester_id, request_type, status, research_items ( title_th )";

const OPEN_STATUSES = ["pending", "under_review", "more_information_required"];

async function requireStaffAndLoadRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string
): Promise<{ userId: string; row: RequestRow } | ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: row } = await supabase
    .from("access_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();

  if (!row) return { status: "error", message: "ไม่พบคำขอนี้" };

  return { userId: user.id, row: row as unknown as RequestRow };
}

/** อนุมัติคำขอ — สร้าง/ต่ออายุ document_access_grants (revoke สิทธิ์ active เดิม
 * ประเภทเดียวกันก่อนเสมอเพื่อไม่ให้ชนกับ unique index) ไม่แตะ access_level หลัก
 * ของเอกสารเลย — expiresAt ว่างหมายถึงสิทธิ์ถาวร */
export async function approveAccessRequestAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return { status: "error", message: "ไม่พบคำขอนี้" };

  const supabase = await createClient();
  const guard = await requireStaffAndLoadRequest(supabase, requestId);
  if ("status" in guard) return guard;
  const { userId, row } = guard;

  if (!OPEN_STATUSES.includes(row.status)) {
    return { status: "error", message: "คำขอนี้ถูกตรวจสอบไปแล้ว" };
  }

  const reviewerNote = String(formData.get("reviewerNote") || "").trim() || null;
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  // revoke สิทธิ์ active ประเภทเดียวกันเดิม (ถ้ามี) ก่อนออกสิทธิ์ใหม่ — กันชน
  // idx_document_access_grants_active_unique และเก็บประวัติไว้ครบ (revoked_at)
  await supabase
    .from("document_access_grants")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: "แทนที่ด้วยสิทธิ์ใหม่จากคำขอนี้" })
    .eq("research_item_id", row.research_item_id)
    .eq("user_id", row.requester_id)
    .eq("access_type", row.request_type)
    .is("revoked_at", null);

  const { error: grantError } = await supabase.from("document_access_grants").insert({
    research_item_id: row.research_item_id,
    user_id: row.requester_id,
    access_type: row.request_type,
    granted_by: userId,
    source_request_id: row.id,
    expires_at: expiresAt,
  });

  if (grantError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        grantError,
        "ไม่สามารถออกสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง",
        "approveAccessRequestAction grant insert failed"
      ),
    };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("access_requests")
    .update({
      status: "approved",
      reviewer_id: userId,
      reviewer_note: reviewerNote,
      access_granted_at: nowIso,
      access_expires_at: expiresAt,
      reviewed_at: nowIso,
    })
    .eq("id", requestId);

  if (updateError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        updateError,
        "ไม่สามารถบันทึกผลการอนุมัติได้ กรุณาลองใหม่อีกครั้ง",
        "approveAccessRequestAction update failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: userId,
    action: "access_request_approve",
    entityType: "access_requests",
    entityId: requestId,
    metadata: {
      research_item_id: row.research_item_id,
      requester_id: row.requester_id,
      request_type: row.request_type,
      access_expires_at: expiresAt,
    },
  });

  await notifyAccessRequestByEmail(supabase, {
    requesterId: row.requester_id,
    researchTitleTh: row.research_items?.title_th ?? "",
    requestType: row.request_type,
    newStatus: "approved",
    reviewerNote,
  });

  revalidatePath(`/dashboard/access-requests/${requestId}`);
  revalidatePath("/dashboard/access-requests");
  return { status: "success", message: "อนุมัติคำขอเรียบร้อยแล้ว" };
}

/** ปฏิเสธคำขอ — บังคับระบุเหตุผลเสมอ ไม่สร้าง grant ใดๆ */
export async function rejectAccessRequestAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const requestId = String(formData.get("requestId") || "");
  const reviewerNote = String(formData.get("reviewerNote") || "").trim();
  if (!requestId) return { status: "error", message: "ไม่พบคำขอนี้" };
  if (!reviewerNote) return { status: "error", message: "กรุณาระบุเหตุผลที่ปฏิเสธคำขอนี้" };

  const supabase = await createClient();
  const guard = await requireStaffAndLoadRequest(supabase, requestId);
  if ("status" in guard) return guard;
  const { userId, row } = guard;

  if (!OPEN_STATUSES.includes(row.status)) {
    return { status: "error", message: "คำขอนี้ถูกตรวจสอบไปแล้ว" };
  }

  const { error } = await supabase
    .from("access_requests")
    .update({
      status: "rejected",
      reviewer_id: userId,
      reviewer_note: reviewerNote,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถบันทึกผลการปฏิเสธได้ กรุณาลองใหม่อีกครั้ง",
        "rejectAccessRequestAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: userId,
    action: "access_request_reject",
    entityType: "access_requests",
    entityId: requestId,
    metadata: { research_item_id: row.research_item_id, requester_id: row.requester_id, reason: reviewerNote },
  });

  await notifyAccessRequestByEmail(supabase, {
    requesterId: row.requester_id,
    researchTitleTh: row.research_items?.title_th ?? "",
    requestType: row.request_type,
    newStatus: "rejected",
    reviewerNote,
  });

  revalidatePath(`/dashboard/access-requests/${requestId}`);
  revalidatePath("/dashboard/access-requests");
  return { status: "success", message: "ปฏิเสธคำขอเรียบร้อยแล้ว" };
}

/** ขอข้อมูลเพิ่มเติมจากผู้ขอ — บังคับระบุรายละเอียดที่ต้องการ */
export async function requestMoreInfoAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const requestId = String(formData.get("requestId") || "");
  const reviewerNote = String(formData.get("reviewerNote") || "").trim();
  if (!requestId) return { status: "error", message: "ไม่พบคำขอนี้" };
  if (!reviewerNote) return { status: "error", message: "กรุณาระบุรายละเอียดข้อมูลที่ต้องการเพิ่มเติม" };

  const supabase = await createClient();
  const guard = await requireStaffAndLoadRequest(supabase, requestId);
  if ("status" in guard) return guard;
  const { userId, row } = guard;

  if (!OPEN_STATUSES.includes(row.status)) {
    return { status: "error", message: "คำขอนี้ถูกตรวจสอบไปแล้ว" };
  }

  const { error } = await supabase
    .from("access_requests")
    .update({
      status: "more_information_required",
      reviewer_id: userId,
      reviewer_note: reviewerNote,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง",
        "requestMoreInfoAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: userId,
    action: "access_request_more_info",
    entityType: "access_requests",
    entityId: requestId,
    metadata: { research_item_id: row.research_item_id, requester_id: row.requester_id, note: reviewerNote },
  });

  await notifyAccessRequestByEmail(supabase, {
    requesterId: row.requester_id,
    researchTitleTh: row.research_items?.title_th ?? "",
    requestType: row.request_type,
    newStatus: "more_information_required",
    reviewerNote,
  });

  revalidatePath(`/dashboard/access-requests/${requestId}`);
  revalidatePath("/dashboard/access-requests");
  return { status: "success", message: "ส่งคำขอข้อมูลเพิ่มเติมเรียบร้อยแล้ว" };
}

/** เพิกถอนสิทธิ์ที่เคยอนุมัติ — บังคับระบุเหตุผลเสมอ ไม่แก้ไขสถานะของคำขอต้นทาง
 * (ยังแสดง "approved" ในประวัติ — ความจริงที่ว่าถูกเพิกถอนแล้วดูได้จาก
 * revoked_at ของ document_access_grants) */
export async function revokeAccessGrantAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const grantId = String(formData.get("grantId") || "");
  const revokeReason = String(formData.get("revokeReason") || "").trim();
  const requestId = String(formData.get("requestId") || "");
  if (!grantId) return { status: "error", message: "ไม่พบสิทธิ์นี้" };
  if (!revokeReason) return { status: "error", message: "กรุณาระบุเหตุผลในการเพิกถอนสิทธิ์" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: updated, error } = await supabase
    .from("document_access_grants")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: revokeReason })
    .eq("id", grantId)
    .is("revoked_at", null)
    .select("id, research_item_id, user_id")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถเพิกถอนสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง",
        "revokeAccessGrantAction failed"
      ),
    };
  }
  if (!updated) {
    return { status: "error", message: "ไม่พบสิทธิ์นี้ หรือถูกเพิกถอนไปแล้ว" };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "access_grant_revoke",
    entityType: "document_access_grants",
    entityId: grantId,
    metadata: { research_item_id: updated.research_item_id, user_id: updated.user_id, reason: revokeReason },
  });

  if (requestId) revalidatePath(`/dashboard/access-requests/${requestId}`);
  revalidatePath("/dashboard/access-requests");
  return { status: "success", message: "เพิกถอนสิทธิ์เรียบร้อยแล้ว" };
}
