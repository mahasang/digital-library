"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { cancelActiveJobsForEntity } from "@/lib/jobs/queue.server";
import { getScanOverrideDecision } from "@/lib/submission/scan-override.server";
import {
  SCAN_OVERRIDE_MIN_RANK,
  SCAN_OVERRIDE_PROVIDER,
  SCAN_OVERRIDE_REASON_MAX_LENGTH,
  SCAN_OVERRIDE_REASON_MIN_LENGTH,
  SCAN_OVERRIDE_MIN_STUCK_MINUTES,
  buildOverrideScanReason,
  validateOverrideReason,
} from "@/lib/submission/scan-override";
import { getSettings } from "@/lib/data/settings.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";
import { notifyResearchPublished } from "@/lib/publishing/publish-event.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { revalidatePublicResearch } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";
import type { ScanStatusRow } from "@/lib/supabase/types";
import type { DocumentStatus } from "@/types/research";

async function changeStatus(
  researchId: string,
  newStatus: DocumentStatus,
  note?: string
): Promise<ActionResult> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "actionMessages.common" });
  const tApprovals = await getTranslations({ locale, namespace: "actionMessages.approvals" });
  const tResearch = await getTranslations({ locale, namespace: "actionMessages.research" });
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfigured") };
  }
  if (!researchId) {
    return { status: "error", message: tResearch("researchIdRequired") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: t("mustLogIn") };
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: t("requiresLibrarianRank") };
  }

  const { data: updated, error } = await supabase
    .from("research_items")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      review_note: note ?? null,
    })
    .eq("id", researchId)
    .select("title_th, submitted_by")
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tApprovals("statusChangeFailed"),
        "changeStatus failed"
      ),
    };
  }

  // ส่งอีเมลแจ้งผู้ส่งงานวิจัย (best-effort — ไม่ทำให้การเปลี่ยนสถานะล้มเหลวหาก
  // ส่งอีเมลไม่สำเร็จ เนื่องจากสถานะเปลี่ยนไปแล้วจริงและมีการแจ้งเตือนในระบบ
  // จาก database trigger ให้แล้วเสมอ)
  if (updated?.submitted_by) {
    try {
      const settings = await getSettings();
      if (settings.notificationsEmailEnabled) {
        const { data: submitterProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", updated.submitted_by)
          .maybeSingle();
        if (submitterProfile?.email) {
          const tStatuses = await getTranslations({ locale, namespace: "statuses" });
          await sendNotificationEmail({
            to: submitterProfile.email,
            subject: `สถานะงานวิจัยเปลี่ยนแปลง: ${updated.title_th}`,
            text: `งานวิจัย "${updated.title_th}" ของคุณเปลี่ยนสถานะเป็น "${tStatuses(newStatus)}"${note ? `\n\nหมายเหตุ: ${note}` : ""}`,
          });
        }
      }
    } catch (emailError) {
      console.error("changeStatus: email notification failed:", emailError);
    }
  }

  // แจ้งผู้ติดตามหมวดหมู่ (in-app + email) เมื่อเผยแพร่ใหม่ — ผ่านจุดกลางเดียว
  // ร่วมกับทุกเส้นทางที่เผยแพร่ได้ (ดู lib/publishing/publish-event.server.ts)
  if (newStatus === "published" && updated?.title_th) {
    await notifyResearchPublished(supabase, {
      researchItemId: researchId,
      titleTh: updated.title_th,
      submittedBy: updated.submitted_by,
      actorId: user.id,
      source: "approval",
    });
  }

  revalidatePath(`/dashboard/approvals/${researchId}`);
  revalidatePath("/dashboard/approvals");
  revalidatePath(`/my-submissions/${researchId}`);
  // เปลี่ยนสถานะทุกครั้ง (ไม่ว่าจะเป็นการเผยแพร่/เก็บถาวร/อนุมัติ/ปฏิเสธ/ขอแก้ไข)
  // อาจกระทบชุดข้อมูลสาธารณะของหน้าแรก — ล้าง cache แบบไม่มีเงื่อนไขไว้ก่อนเสมอ
  // (ถูกกว่าการลืมล้างมาก ดู lib/cache/public-home.ts)
  revalidatePublicResearch();

  return { status: "success", message: tApprovals("statusChangeSuccess") };
}

export async function approveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return changeStatus(String(formData.get("researchId") || ""), "approved");
}

export async function rejectAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    const tApprovals = await getTranslations("actionMessages.approvals");
    return { status: "error", message: tApprovals("rejectReasonRequired") };
  }
  return changeStatus(String(formData.get("researchId") || ""), "rejected", note);
}

export async function requestRevisionAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    const tApprovals = await getTranslations("actionMessages.approvals");
    return { status: "error", message: tApprovals("revisionDetailRequired") };
  }
  return changeStatus(
    String(formData.get("researchId") || ""),
    "revision_requested",
    note
  );
}

export async function publishAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return changeStatus(String(formData.get("researchId") || ""), "published");
}

export async function archiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return changeStatus(String(formData.get("researchId") || ""), "archived");
}

/**
 * เผยแพร่โดยยืนยันเอง — ผู้ดูแลระบบ (admin ขึ้นไป) เผยแพร่งานวิจัยที่อนุมัติแล้วโดย
 * ไม่รอผลสแกนไฟล์ (ใช้เมื่อสแกนค้างนานเกิน 30 นาที หรือผลสแกนเป็น error เพราะ
 * ยังไม่มีระบบสแกน) ต้องระบุเหตุผลเสมอ และบันทึก audit log ก่อนลงมือทำจริง
 *
 * ไม่แตะ RLS/trigger: ตั้ง scan_status = 'skipped' (provider = admin_override) ซึ่ง
 * trigger prevent_publish_unscanned_file ยอมให้เผยแพร่ แล้วเผยแพร่ผ่าน
 * changeStatus เดิม (อีเมล/แจ้งเตือน/revalidate ทำงานเหมือนการเผยแพร่ปกติ)
 * ไม่มีทางข้ามไฟล์ที่ผลสแกนเป็น infected
 */
export async function publishWithoutScanAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireMinRank(SCAN_OVERRIDE_MIN_RANK);
  if (!guard.ok) return guard.result;

  const locale = await getLocale();
  const tApprovals = await getTranslations({ locale, namespace: "actionMessages.approvals" });

  const researchId = String(formData.get("researchId") || "");
  if (!researchId) {
    return { status: "error", message: tApprovals("scanOverrideNotFound") };
  }

  const reasonResult = validateOverrideReason(formData.get("reason"));
  if (!reasonResult.ok) {
    const messageByCode = {
      required: tApprovals("scanOverrideReasonRequired"),
      too_short: tApprovals("scanOverrideReasonTooShort", {
        min: SCAN_OVERRIDE_REASON_MIN_LENGTH,
      }),
      too_long: tApprovals("scanOverrideReasonTooLong", {
        max: SCAN_OVERRIDE_REASON_MAX_LENGTH,
      }),
    } as const;
    return { status: "error", message: messageByCode[reasonResult.code] };
  }

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("research_items")
    .select("id, status, scan_status, scan_provider, title_th")
    .eq("id", researchId)
    .maybeSingle();

  if (itemError || !item) {
    return { status: "error", message: tApprovals("scanOverrideNotFound") };
  }

  // ตัดสินซ้ำฝั่งเซิร์ฟเวอร์เสมอ — ห้ามเชื่อว่าปุ่มบนหน้าจอโชว์ถูกต้อง
  const decision = await getScanOverrideDecision({
    id: item.id,
    // ค่าสองตัวนี้ถูกบังคับด้วย check constraint ของฐานข้อมูลอยู่แล้ว
    status: item.status as DocumentStatus,
    scanStatus: item.scan_status as ScanStatusRow,
  });
  if (!decision.allowed) {
    const messageByReason = {
      not_approved: tApprovals("scanOverrideNotApproved"),
      scan_not_blocking: tApprovals("scanOverrideNotNeeded"),
      infected: tApprovals("scanOverrideInfected"),
      too_early: tApprovals("scanOverrideTooEarly", {
        minutes: decision.waitMinutes ?? SCAN_OVERRIDE_MIN_STUCK_MINUTES,
      }),
      unavailable: tApprovals("scanOverrideUnavailable"),
    } as const;
    return { status: "error", message: messageByReason[decision.reason] };
  }

  // 1) บันทึก audit log ก่อนลงมือ — ถ้าบันทึกไม่ได้ให้หยุด (ไม่ข้ามการสแกนแบบไม่มีร่องรอย)
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: guard.userId,
    action: "publish_without_scan",
    entity_type: "research_items",
    entity_id: item.id,
    metadata: {
      reason: reasonResult.reason,
      title_th: item.title_th,
      previous_scan_status: item.scan_status,
      previous_scan_provider: item.scan_provider,
    },
  });
  if (auditError) {
    console.error("publishWithoutScanAction: audit log failed:", auditError.message);
    return { status: "error", message: tApprovals("scanOverrideFailed") };
  }

  // 2) ยกเลิก job สแกนที่ยังค้างของรายการนี้ (กันผล error มาทับทีหลังแล้วระบบปิดการเข้าถึงเอง)
  await cancelActiveJobsForEntity("research_items", item.id, ["file_security_rescan"]);

  // 3) ตั้งผลสแกนเป็น 'skipped' ด้วย service role (เหมือน handler สแกน) เฉพาะแถวที่ยัง
  //    อนุมัติอยู่และผลสแกนยังเป็น pending/error — กันแข่งกับการเปลี่ยนสถานะอื่น
  const service = createServiceRoleClient();
  const { data: overridden, error: overrideError } = await service
    .from("research_items")
    .update({
      scan_status: "skipped",
      scanned_at: new Date().toISOString(),
      scan_provider: SCAN_OVERRIDE_PROVIDER,
      scan_reason: buildOverrideScanReason(reasonResult.reason),
    })
    .eq("id", item.id)
    .eq("status", "approved")
    .in("scan_status", ["pending", "error"])
    .select("id")
    .maybeSingle();

  if (overrideError || !overridden) {
    if (overrideError) {
      console.error("publishWithoutScanAction: override failed:", overrideError.message);
    }
    return { status: "error", message: tApprovals("scanOverrideFailed") };
  }

  // 4) เผยแพร่ผ่านเส้นทางเดิม (อีเมลแจ้งผู้ส่ง, แจ้งผู้ติดตามหมวดหมู่, revalidate)
  const published = await changeStatus(item.id, "published");
  if (published.status !== "success") return published;

  return { status: "success", message: tApprovals("scanOverrideSuccess") };
}
