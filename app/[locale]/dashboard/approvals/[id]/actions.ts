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
import {
  APPROVE_AND_PUBLISH_FROM_STATUSES,
  BULK_APPROVE_FROM_STATUS,
  BULK_APPROVE_MAX,
  BULK_APPROVE_TIME_BUDGET_MS,
  assembleBulkResults,
  canApproveAndPublish,
  classifyBulkItems,
  parseBulkApproveIds,
  runWithinBudget,
  summarizeBulkResults,
  type BulkApproveItemCode,
  type BulkApproveState,
} from "@/lib/approvals/approve-flow";
import type { DocumentStatus } from "@/types/research";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

interface ChangeStatusOptions {
  /** ไม่ส่งอีเมลแจ้งผู้ส่งในขั้นนี้ (ปุ่ม "อนุมัติและเผยแพร่" ส่งอีเมลฉบับเดียวตอนท้าย) */
  skipEmail?: boolean;
  /** ไม่ล้าง cache ในขั้นนี้ (ผู้เรียกล้างเองครั้งเดียวตอนท้าย) */
  skipRevalidate?: boolean;
  /**
   * อัปเดตเฉพาะเมื่อสถานะปัจจุบันเป็นหนึ่งในนี้ — กันการทับสถานะที่ผู้ตรวจอีกคนเพิ่ง
   * เปลี่ยน (ถ้าไม่ระบุ พฤติกรรมเหมือนเดิมทุกประการ)
   */
  expectedStatuses?: readonly DocumentStatus[];
}

interface ChangedItem {
  titleTh: string;
  submittedBy: string | null;
}

interface ChangeStatusOutcome {
  result: ActionResult;
  /** ok = เปลี่ยนแล้ว · status_changed = สถานะไม่ตรง expectedStatuses · error = ล้มเหลวอื่นๆ */
  code: "ok" | "status_changed" | "error";
  item: ChangedItem | null;
}

/**
 * ส่งอีเมลแจ้งผู้ส่งงานวิจัย (best-effort — ไม่ทำให้การเปลี่ยนสถานะล้มเหลวหาก
 * ส่งอีเมลไม่สำเร็จ เนื่องจากสถานะเปลี่ยนไปแล้วจริงและมีการแจ้งเตือนในระบบ
 * จาก database trigger ให้แล้วเสมอ)
 */
async function sendStatusChangeEmail(
  supabase: ServerSupabase,
  locale: string,
  item: ChangedItem,
  newStatus: DocumentStatus,
  note?: string
): Promise<void> {
  if (!item.submittedBy) return;
  try {
    const settings = await getSettings();
    if (settings.notificationsEmailEnabled) {
      const { data: submitterProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", item.submittedBy)
        .maybeSingle();
      if (submitterProfile?.email) {
        const tStatuses = await getTranslations({ locale, namespace: "statuses" });
        await sendNotificationEmail({
          to: submitterProfile.email,
          subject: `สถานะงานวิจัยเปลี่ยนแปลง: ${item.titleTh}`,
          text: `งานวิจัย "${item.titleTh}" ของคุณเปลี่ยนสถานะเป็น "${tStatuses(newStatus)}"${note ? `\n\nหมายเหตุ: ${note}` : ""}`,
        });
      }
    }
  } catch (emailError) {
    console.error("changeStatus: email notification failed:", emailError);
  }
}

function revalidateAfterStatusChange(researchIds: readonly string[]): void {
  for (const researchId of researchIds) {
    revalidatePath(`/dashboard/approvals/${researchId}`);
    revalidatePath(`/my-submissions/${researchId}`);
  }
  revalidatePath("/dashboard/approvals");
  // ตัวเลขงานค้างใน Header (badge เมนูผู้ใช้) อยู่ใน layout — ต้องล้างด้วยเพื่อให้
  // ตัวเลข "รอตรวจ" ของผู้ตรวจที่กำลังใช้งานอยู่ลดลงทันทีหลังอนุมัติ/ปฏิเสธ/ขอแก้ไข
  revalidatePath("/", "layout");
  // เปลี่ยนสถานะทุกครั้ง (ไม่ว่าจะเป็นการเผยแพร่/เก็บถาวร/อนุมัติ/ปฏิเสธ/ขอแก้ไข)
  // อาจกระทบชุดข้อมูลสาธารณะของหน้าแรก — ล้าง cache แบบไม่มีเงื่อนไขไว้ก่อนเสมอ
  // (ถูกกว่าการลืมล้างมาก ดู lib/cache/public-home.ts)
  revalidatePublicResearch();
}

async function changeStatusInternal(
  researchId: string,
  newStatus: DocumentStatus,
  note?: string,
  options: ChangeStatusOptions = {}
): Promise<ChangeStatusOutcome> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "actionMessages.common" });
  const tApprovals = await getTranslations({ locale, namespace: "actionMessages.approvals" });
  const tResearch = await getTranslations({ locale, namespace: "actionMessages.research" });
  const fail = (
    message: string,
    code: ChangeStatusOutcome["code"] = "error"
  ): ChangeStatusOutcome => ({ result: { status: "error", message }, code, item: null });

  if (!isSupabaseConfigured()) {
    return fail(t("supabaseNotConfigured"));
  }
  if (!researchId) {
    return fail(tResearch("researchIdRequired"));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail(t("mustLogIn"));
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return fail(t("requiresLibrarianRank"));
  }

  let update = supabase
    .from("research_items")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      review_note: note ?? null,
    })
    .eq("id", researchId);
  if (options.expectedStatuses) {
    update = update.in("status", [...options.expectedStatuses]);
  }
  const { data: updated, error } = await update
    .select("title_th, submitted_by")
    .maybeSingle();

  if (error) {
    return fail(
      toSafeErrorMessage(error, tApprovals("statusChangeFailed"), "changeStatus failed")
    );
  }
  if (options.expectedStatuses && !updated) {
    return fail(tApprovals("statusChangedMeanwhile"), "status_changed");
  }

  const item: ChangedItem | null = updated
    ? { titleTh: updated.title_th, submittedBy: updated.submitted_by }
    : null;

  if (!options.skipEmail && item?.submittedBy) {
    await sendStatusChangeEmail(supabase, locale, item, newStatus, note);
  }

  // แจ้งผู้ติดตามหมวดหมู่ (in-app + email) เมื่อเผยแพร่ใหม่ — ผ่านจุดกลางเดียว
  // ร่วมกับทุกเส้นทางที่เผยแพร่ได้ (ดู lib/publishing/publish-event.server.ts)
  if (newStatus === "published" && item?.titleTh) {
    await notifyResearchPublished(supabase, {
      researchItemId: researchId,
      titleTh: item.titleTh,
      submittedBy: item.submittedBy,
      actorId: user.id,
      source: "approval",
    });
  }

  if (!options.skipRevalidate) {
    revalidateAfterStatusChange([researchId]);
  }

  return {
    result: { status: "success", message: tApprovals("statusChangeSuccess") },
    code: "ok",
    item,
  };
}

async function changeStatus(
  researchId: string,
  newStatus: DocumentStatus,
  note?: string
): Promise<ActionResult> {
  const { result } = await changeStatusInternal(researchId, newStatus, note);
  return result;
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

function errorMessageOf(result: ActionResult): string {
  return result.status === "error" ? result.message : "";
}

/**
 * อนุมัติและเผยแพร่ในครั้งเดียว — ทำเป็นเปลี่ยนสถานะ 2 ครั้งต่อกัน (approved → published)
 * ผ่านเส้นทางเดิม เพื่อให้ approval_logs/audit_logs และแจ้งเตือนจาก trigger ครบทั้งสองขั้น
 * และตรวจซ้ำฝั่งเซิร์ฟเวอร์ว่าไฟล์สแกนผ่านแล้ว (clean/skipped) — ไม่ข้ามด่านสแกนและไม่แตะ
 * RLS/trigger สิทธิ์เท่าปุ่มอนุมัติ/เผยแพร่เดิม (บรรณารักษ์ขึ้นไป)
 *
 * ผู้ส่งได้อีเมลฉบับเดียว (ว่าเผยแพร่แล้ว) · ถ้าเผยแพร่ล้มหลังอนุมัติ งานค้างที่ "อนุมัติแล้ว"
 * ผู้ส่งได้อีเมลแจ้งว่าอนุมัติ และผู้ตรวจเห็นข้อความให้กดเผยแพร่ซ้ำ
 */
export async function approveAndPublishAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireMinRank(30);
  if (!guard.ok) return guard.result;

  const locale = await getLocale();
  const tApprovals = await getTranslations({ locale, namespace: "actionMessages.approvals" });

  const researchId = String(formData.get("researchId") || "");
  if (!researchId) {
    return { status: "error", message: tApprovals("approvalItemNotFound") };
  }

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("research_items")
    .select("id, status, scan_status")
    .eq("id", researchId)
    .maybeSingle();
  if (itemError || !item) {
    return { status: "error", message: tApprovals("approvalItemNotFound") };
  }

  // ตัดสินซ้ำฝั่งเซิร์ฟเวอร์เสมอ — ห้ามเชื่อว่าปุ่มบนหน้าจอโชว์ถูกต้อง
  const decision = canApproveAndPublish({
    status: item.status,
    scanStatus: item.scan_status,
  });
  if (!decision.allowed) {
    return {
      status: "error",
      message:
        decision.reason === "scan_not_ready"
          ? tApprovals("approvePublishScanNotReady")
          : tApprovals("approvePublishNotReviewable"),
    };
  }

  const approved = await changeStatusInternal(item.id, "approved", undefined, {
    skipEmail: true,
    skipRevalidate: true,
    expectedStatuses: APPROVE_AND_PUBLISH_FROM_STATUSES,
  });
  if (approved.result.status !== "success") return approved.result;

  const published = await changeStatusInternal(item.id, "published", undefined, {
    expectedStatuses: ["approved"],
  });
  if (published.result.status === "success") {
    return { status: "success", message: tApprovals("approvePublishSuccess") };
  }

  // อนุมัติสำเร็จแล้วแต่เผยแพร่ไม่สำเร็จ — แจ้งผู้ส่งว่าอนุมัติ (ขั้นแรกไม่ได้ส่งอีเมล)
  // และล้าง cache ให้หน้าจอตรงกับสถานะจริง
  if (approved.item) {
    await sendStatusChangeEmail(supabase, locale, approved.item, "approved");
  }
  revalidateAfterStatusChange([item.id]);
  return { status: "error", message: tApprovals("approvePublishPartial") };
}

/**
 * อนุมัติหลายรายการ (เฉพาะงานสถานะ "รอตรวจสอบ" — ไม่มีเผยแพร่หลายรายการ)
 *
 * ตรวจสิทธิ์ (บรรณารักษ์ขึ้นไป) ที่ต้นทาง และ changeStatusInternal ตรวจซ้ำทุกรายการ ·
 * อัปเดตแบบมีเงื่อนไขสถานะเดิม (ไม่ทับงานที่ผู้ตรวจอีกคนเพิ่งปฏิเสธ/ขอแก้) · ทำทีละรายการ
 * ภายในงบเวลา ที่เหลือรายงานว่า "ยังไม่ได้ทำ" · อีเมล/แจ้งเตือนผู้ส่งต่อรายการเหมือน
 * การกดอนุมัติทีละรายการ ล้าง cache ครั้งเดียวตอนท้าย
 */
export async function bulkApproveAction(formData: FormData): Promise<BulkApproveState> {
  const guard = await requireMinRank(30);
  if (!guard.ok) return { status: "error", message: errorMessageOf(guard.result) };

  const locale = await getLocale();
  const tApprovals = await getTranslations({ locale, namespace: "actionMessages.approvals" });

  const parsed = parseBulkApproveIds(formData.getAll("ids"));
  if (!parsed.ok) {
    const messageByCode = {
      empty: tApprovals("bulkApproveEmpty"),
      too_many: tApprovals("bulkApproveTooMany", { max: BULK_APPROVE_MAX }),
      invalid: tApprovals("bulkApproveInvalid"),
    } as const;
    return { status: "error", message: messageByCode[parsed.code] };
  }

  const supabase = await createClient();
  const { data: rows, error: rowsError } = await supabase
    .from("research_items")
    .select("id, status")
    .in("id", parsed.ids);
  if (rowsError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        rowsError,
        tApprovals("statusChangeFailed"),
        "bulkApproveAction read failed"
      ),
    };
  }

  const { eligible, immediate } = classifyBulkItems(parsed.ids, rows ?? []);
  const { processed, skippedIds } = await runWithinBudget(
    eligible,
    async (id): Promise<BulkApproveItemCode> => {
      const outcome = await changeStatusInternal(id, "approved", undefined, {
        skipRevalidate: true,
        expectedStatuses: [BULK_APPROVE_FROM_STATUS],
      });
      if (outcome.code === "ok") return "approved";
      return outcome.code === "status_changed" ? "not_pending" : "failed";
    },
    { budgetMs: BULK_APPROVE_TIME_BUDGET_MS }
  );

  const results = assembleBulkResults(
    parsed.ids,
    immediate,
    processed.map((entry) => ({ id: entry.id, code: entry.outcome })),
    skippedIds
  );
  const summary = summarizeBulkResults(results);
  if (summary.approved > 0) {
    revalidateAfterStatusChange(
      results.filter((result) => result.code === "approved").map((result) => result.id)
    );
  }

  return {
    status: "done",
    message: tApprovals("bulkApproveSummary", {
      approved: summary.approved,
      total: summary.total,
    }),
    results,
  };
}
