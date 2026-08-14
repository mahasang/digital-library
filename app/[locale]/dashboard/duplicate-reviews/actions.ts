"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { revalidatePublicResearch } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";

async function updateReviewStatus(
  reviewId: string,
  status: "confirmed_duplicate" | "not_duplicate",
  note: string | null
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { error } = await supabase
    .from("duplicate_research_reviews")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", reviewId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถบันทึกผลการตรวจสอบได้ กรุณาลองใหม่อีกครั้ง", "updateReviewStatus failed"),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: status === "confirmed_duplicate" ? "duplicate_review_confirm" : "duplicate_review_dismiss",
    entityType: "duplicate_research_reviews",
    entityId: reviewId,
    metadata: { note },
  });

  revalidatePath("/dashboard/duplicate-reviews");
  revalidatePath(`/dashboard/duplicate-reviews/${reviewId}`);
  return { status: "success", message: "บันทึกผลการตรวจสอบเรียบร้อยแล้ว" };
}

export async function confirmDuplicateAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!reviewId) return { status: "error", message: "ไม่พบรายการนี้" };
  return updateReviewStatus(reviewId, "confirmed_duplicate", note);
}

export async function dismissDuplicateAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!reviewId) return { status: "error", message: "ไม่พบรายการนี้" };
  return updateReviewStatus(reviewId, "not_duplicate", note);
}

/** รวมงานวิจัย — เรียก merge_research_items() RPC (ตรวจสิทธิ์ rank >= 40 ซ้ำใน
 * ตัวฟังก์ชันเองอีกชั้นเสมอ เนื่องจากกระทบความสัมพันธ์กว้างกว่าการรวมผู้วิจัย/
 * หน่วยงานมาก) แล้วตั้งสถานะรีวิวเป็น merged */
export async function mergeResearchItemsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  const reviewId = String(formData.get("reviewId") || "");
  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim();
  if (!sourceId || !targetId) return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  if (confirmText !== "MERGE") {
    return { status: "error", message: "กรุณาพิมพ์ MERGE ให้ถูกต้องเพื่อยืนยันการรวมงานวิจัย" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นผู้ดูแลระบบขึ้นไป" };
  }

  const { error } = await supabase.rpc("merge_research_items", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason || null,
  });

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, "ไม่สามารถรวมงานวิจัยได้ กรุณาลองใหม่อีกครั้ง", "mergeResearchItemsAction failed"),
    };
  }

  if (reviewId) {
    await supabase
      .from("duplicate_research_reviews")
      .update({ status: "merged", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", reviewId);
  }

  revalidatePath("/dashboard/duplicate-reviews");
  revalidatePath("/dashboard/research");
  // การรวมงานวิจัยเปลี่ยนสถานะของรายการต้นทางเป็น "merged" (หายไปจากชุด
  // เผยแพร่แล้วถ้าเคยเผยแพร่อยู่) — อาจกระทบชุดข้อมูลสาธารณะของหน้าแรก
  revalidatePublicResearch();
  return { status: "success", message: "รวมงานวิจัยเรียบร้อยแล้ว" };
}
