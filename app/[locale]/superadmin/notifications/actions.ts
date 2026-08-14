"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { SETTINGS_ROW_ID } from "@/lib/data/settings.server";
import { processJobQueue } from "@/lib/jobs/dispatch.server";
import { retryFailedJob } from "@/lib/jobs/queue.server";
import type { ActionResult } from "@/lib/actions/types";

export async function updateNotificationSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const inAppEnabled = formData.get("notificationsInAppEnabled") === "true";
  const emailEnabled = formData.get("notificationsEmailEnabled") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      notifications_in_app_enabled: inAppEnabled,
      notifications_email_enabled: emailEnabled,
      updated_by: auth.userId,
    })
    .eq("id", SETTINGS_ROW_ID);

  if (error) {
    console.error("updateNotificationSettingsAction failed:", error.message);
    return { status: "error", message: "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง" };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "notification_settings_update",
    entityType: "settings",
    entityId: SETTINGS_ROW_ID,
    metadata: { in_app_enabled: inAppEnabled, email_enabled: emailEnabled },
  });

  revalidatePath("/superadmin/notifications");
  return { status: "success", message: "บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว" };
}

/**
 * ตั้งค่าการแจ้งเตือนก่อนสิทธิ์เข้าถึงเอกสารหมดอายุ (ช่วงที่ 26) — จำนวนวัน
 * (1-30) และ toggle in-app/email เฉพาะฟีเจอร์นี้ (ทำงานร่วมกับมาสเตอร์สวิตช์
 * รวมใน updateNotificationSettingsAction ด้านบน ไม่ใช่แทนที่) ใช้แทนค่าคงที่
 * เดิมใน lib/jobs/handlers/access-expiration.server.ts
 */
export async function updateAccessExpirationWarningSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const days = Number(formData.get("accessExpirationWarningDays"));
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return { status: "error", message: "จำนวนวันต้องเป็นเลขจำนวนเต็มระหว่าง 1-30" };
  }
  const inAppEnabled = formData.get("accessExpirationWarningInAppEnabled") === "true";
  const emailEnabled = formData.get("accessExpirationWarningEmailEnabled") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      access_expiration_warning_days: days,
      access_expiration_warning_in_app_enabled: inAppEnabled,
      access_expiration_warning_email_enabled: emailEnabled,
      updated_by: auth.userId,
    })
    .eq("id", SETTINGS_ROW_ID);

  if (error) {
    console.error("updateAccessExpirationWarningSettingsAction failed:", error.message);
    return { status: "error", message: "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง" };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "access_expiration_warning_settings_update",
    entityType: "settings",
    entityId: SETTINGS_ROW_ID,
    metadata: {
      access_expiration_warning_days: days,
      in_app_enabled: inAppEnabled,
      email_enabled: emailEnabled,
    },
  });

  revalidatePath("/superadmin/notifications");
  return { status: "success", message: "บันทึกการตั้งค่าแจ้งเตือนก่อนหมดอายุเรียบร้อยแล้ว" };
}

/**
 * ปุ่ม "ประมวลผลสิทธิ์ที่หมดอายุทันที" — เหมือนปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ของ
 * หน้าอื่น (lib/jobs/process-now.action.server.ts) แต่จำกัดเฉพาะ job ประเภท
 * `access_expiration` เท่านั้น ไม่แตะ job ประเภทอื่นที่อาจค้างอยู่ในคิวพร้อมกัน
 * (เช่น pdf_text_extraction ของ Super Admin คนอื่นที่กำลังสั่ง backfill อยู่)
 */
export async function processAccessExpirationNowAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const summary = await processJobQueue(5, ["access_expiration"]);

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "access_expiration_process_now",
    entityType: "background_jobs",
    metadata: { claimed: summary.claimed, results: summary.results },
  });

  revalidatePath("/superadmin/notifications");

  const okCount = summary.results.filter((r) => r.ok).length;
  return {
    status: "success",
    message:
      summary.claimed === 0
        ? "ไม่มีงานหมดอายุสิทธิ์ค้างอยู่ในคิว (ประมวลผลล่าสุดไปแล้ว)"
        : `ประมวลผลสิทธิ์ที่หมดอายุแล้ว ${okCount}/${summary.claimed} งานสำเร็จ`,
  };
}

/** ปุ่ม "ลองใหม่" สำหรับ job หมดอายุสิทธิ์/แจ้งเตือนที่ล้มเหลวถาวรที่หน้านี้ */
export async function retryFailedNotificationJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: "ไม่พบรหัสงาน" };

  const result = await retryFailedJob(jobId);
  if (!result.ok) {
    return { status: "error", message: result.error ?? "ลองใหม่ไม่สำเร็จ" };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "notification_job_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/notifications");
  return { status: "success", message: "ส่งกลับเข้าคิวเรียบร้อยแล้ว" };
}
