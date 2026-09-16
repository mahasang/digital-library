"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSettings } from "@/lib/data/settings.server";
import { checkRateLimit, rateLimitKeyForIp } from "@/lib/rate-limit.server";
import { hasActiveAccessGrantBySlug } from "@/lib/data/access-grants.server";
import { createAccessRequestSchema } from "@/lib/validation/access-request";
import { canDownload, canReadOnline } from "@/lib/labels";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * ส่งคำขอเข้าถึงเอกสาร (อ่าน/ดาวน์โหลด) — ตรวจสอบว่าผู้ใช้ยังไม่มีสิทธิ์นี้อยู่
 * แล้วก่อนเสมอ (ทั้งจาก access_level เดิมและ grant ที่อนุมัติไว้ก่อนหน้า) กัน
 * คำขอซ้ำด้วย unique index ระดับฐานข้อมูล (idx_access_requests_active_unique)
 * — error code 23505 แปลว่าชนกับคำขอ pending/under_review เดิมของเอกสาร+
 * ประเภทเดียวกัน
 */
export async function submitAccessRequestAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAccessRequests = await getTranslations("actionMessages.accessRequests");
  const tResearch = await getTranslations("actionMessages.research");

  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: tAccessRequests("mustLoginToRequest") };
  }

  const tValidation = await getTranslations("validation");
  const parsed = createAccessRequestSchema(tValidation).safeParse({
    researchSlug: formData.get("researchSlug"),
    requestType: formData.get("requestType"),
    purpose: formData.get("purpose"),
    requesterNote: formData.get("requesterNote") || undefined,
    termsAccepted: formData.get("termsAccepted") === "true",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { data: item } = await supabase
    .from("research_items")
    .select("id, access_level, status")
    .eq("slug", parsed.data.researchSlug)
    .maybeSingle();

  if (!item || item.status !== "published") {
    return { status: "error", message: tResearch("notFound") };
  }

  const alreadyAllowed =
    parsed.data.requestType === "read"
      ? canReadOnline(item.access_level)
      : canDownload(item.access_level);
  if (
    alreadyAllowed ||
    (await hasActiveAccessGrantBySlug(parsed.data.researchSlug, parsed.data.requestType))
  ) {
    return { status: "error", message: tAccessRequests("alreadyHasAccess") };
  }

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const settings = await getSettings();
  const { allowed } = await checkRateLimit(
    rateLimitKeyForIp("access-request", clientIp ?? user.id),
    settings.rateLimitSubmitMax,
    settings.rateLimitSubmitWindowSec
  );
  if (!allowed) {
    return { status: "error", message: tAccessRequests("submitRateLimited") };
  }

  const { error } = await supabase.from("access_requests").insert({
    research_item_id: item.id,
    requester_id: user.id,
    request_type: parsed.data.requestType,
    purpose: parsed.data.purpose,
    requester_note: parsed.data.requesterNote || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: tAccessRequests("duplicatePending") };
    }
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tAccessRequests("submitFailed"),
        "submitAccessRequestAction failed"
      ),
    };
  }

  revalidatePath(`/research/${parsed.data.researchSlug}`);
  return { status: "success", message: tAccessRequests("submitSuccess") };
}

/** ยกเลิกคำขอของตัวเอง — ทำได้เฉพาะขณะสถานะยัง "pending" เท่านั้น (บังคับซ้ำ
 * ด้วย RLS policy access_requests_cancel_own — การ select หลัง update ว่างเปล่า
 * หมายความว่า RLS ปฏิเสธ ไม่ใช่แค่ไม่พบแถว) */
export async function cancelAccessRequestAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAccessRequests = await getTranslations("actionMessages.accessRequests");

  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return { status: "error", message: tAccessRequests("notFound") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("mustLogIn") };

  const { data, error } = await supabase
    .from("access_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tAccessRequests("cancelFailed"),
        "cancelAccessRequestAction failed"
      ),
    };
  }
  if (!data) {
    return {
      status: "error",
      message: tAccessRequests("cancelNotAllowed"),
    };
  }

  revalidatePath("/access-requests");
  return { status: "success", message: tAccessRequests("cancelSuccess") };
}
