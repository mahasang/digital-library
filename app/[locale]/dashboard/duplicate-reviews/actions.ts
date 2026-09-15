"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("actionMessages.common");
  const tDuplicateReviews = await getTranslations("actionMessages.duplicateReviews");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { error } = await supabase
    .from("duplicate_research_reviews")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", reviewId);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, tDuplicateReviews("reviewSaveFailed"), "updateReviewStatus failed"),
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
  return { status: "success", message: tDuplicateReviews("reviewSaveSuccess") };
}

export async function confirmDuplicateAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!reviewId) {
    const tDuplicateReviews = await getTranslations("actionMessages.duplicateReviews");
    return { status: "error", message: tDuplicateReviews("itemNotFound") };
  }
  return updateReviewStatus(reviewId, "confirmed_duplicate", note);
}

export async function dismissDuplicateAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!reviewId) {
    const tDuplicateReviews = await getTranslations("actionMessages.duplicateReviews");
    return { status: "error", message: tDuplicateReviews("itemNotFound") };
  }
  return updateReviewStatus(reviewId, "not_duplicate", note);
}

/** รวมงานวิจัย — เรียก merge_research_items() RPC (ตรวจสิทธิ์ rank >= 40 ซ้ำใน
 * ตัวฟังก์ชันเองอีกชั้นเสมอ เนื่องจากกระทบความสัมพันธ์กว้างกว่าการรวมผู้วิจัย/
 * หน่วยงานมาก) แล้วตั้งสถานะรีวิวเป็น merged */
export async function mergeResearchItemsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tDuplicateReviews = await getTranslations("actionMessages.duplicateReviews");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  const reviewId = String(formData.get("reviewId") || "");
  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const confirmText = String(formData.get("confirmText") || "").trim();
  if (!sourceId || !targetId) return { status: "error", message: tDuplicateReviews("mergeDataIncomplete") };
  if (confirmText !== "MERGE") {
    return { status: "error", message: tDuplicateReviews("mergeConfirmTextMismatch") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) {
    return { status: "error", message: t("requiresAdminRank") };
  }

  const { error } = await supabase.rpc("merge_research_items", {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason || null,
  });

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(error, tDuplicateReviews("mergeFailed"), "mergeResearchItemsAction failed"),
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
  return { status: "success", message: tDuplicateReviews("mergeSuccess") };
}
