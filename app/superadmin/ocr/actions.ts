"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { SETTINGS_ROW_ID } from "@/lib/data/settings.server";
import { ocrSettingsSchema } from "@/lib/validation/ocr-settings";
import { checkOcrProviderConnectivity, OCR_JOB_MAX_ATTEMPTS } from "@/lib/ocr/ocr-provider.server";
import { getOcrTestFixture } from "@/lib/ocr/test-fixtures.server";
import { enqueueBackgroundJob } from "@/lib/jobs/queue.server";
import type { ActionResult } from "@/lib/actions/types";

export async function updateOcrSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const parsed = ocrSettingsSchema.safeParse({
    ocrMaxFileSizeMb: formData.get("ocrMaxFileSizeMb"),
    ocrMaxPages: formData.get("ocrMaxPages"),
    ocrDailyQuotaEnabled: formData.get("ocrDailyQuotaEnabled") === "true",
    ocrMaxJobsPerUserPerDay: formData.get("ocrMaxJobsPerUserPerDay"),
    ocrProviderEnabled: formData.get("ocrProviderEnabled") === "true",
    ocrAllowedAccessLevels: formData.getAll("ocrAllowedAccessLevels").map(String),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      ocr_max_file_size_mb: parsed.data.ocrMaxFileSizeMb,
      ocr_max_pages: parsed.data.ocrMaxPages,
      ocr_daily_quota_enabled: parsed.data.ocrDailyQuotaEnabled,
      ocr_max_jobs_per_user_per_day: parsed.data.ocrMaxJobsPerUserPerDay,
      ocr_provider_enabled: parsed.data.ocrProviderEnabled,
      ocr_allowed_access_levels: parsed.data.ocrAllowedAccessLevels,
      updated_by: auth.userId,
    })
    .eq("id", SETTINGS_ROW_ID);

  if (error) {
    console.error("updateOcrSettingsAction failed:", error.message);
    return { status: "error", message: "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง" };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "ocr_settings_update",
    entityType: "settings",
    entityId: SETTINGS_ROW_ID,
    metadata: {
      ocrMaxFileSizeMb: parsed.data.ocrMaxFileSizeMb,
      ocrMaxPages: parsed.data.ocrMaxPages,
      ocrDailyQuotaEnabled: parsed.data.ocrDailyQuotaEnabled,
      ocrMaxJobsPerUserPerDay: parsed.data.ocrMaxJobsPerUserPerDay,
      ocrProviderEnabled: parsed.data.ocrProviderEnabled,
      ocrAllowedAccessLevels: parsed.data.ocrAllowedAccessLevels,
    },
  });

  revalidatePath("/superadmin/ocr");
  return { status: "success", message: "บันทึกการตั้งค่า OCR เรียบร้อยแล้ว" };
}

/**
 * "ตรวจสอบการเชื่อมต่อ" ของ OCR Readiness Check (ช่วงที่ 32) — เรียก
 * checkOcrProviderConnectivity() (ไม่ส่งไฟล์ ไม่สร้าง OCR job) แล้วบันทึก
 * Audit Log ทุกครั้งที่สั่งตรวจสอบ ไม่ว่าผลจะเป็นอย่างไร
 */
export async function checkOcrConnectivityAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const result = await checkOcrProviderConnectivity();

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "ocr_readiness_check",
    entityType: "settings",
    entityId: undefined,
    metadata: { reachable: result.reachable, detail: result.detail },
  });

  revalidatePath("/superadmin/ocr");
  return result.reachable
    ? { status: "success", message: result.detail }
    : { status: "error", message: result.detail };
}

/**
 * "เริ่มทดสอบ"/"ลองใหม่" ของ Controlled OCR Test (ช่วงที่ 32) — สร้างแถว
 * ocr_test_runs ใหม่เสมอ (ไม่แก้แถวเดิม เก็บประวัติไว้ครบ) แล้ว enqueue job
 * `ocr_test_run` หนึ่งงาน — ไม่ตรวจ OCR_ENABLED/settings.ocrProviderEnabled
 * (ดู submitOcrTest() ใน lib/ocr/ocr-provider.server.ts) แต่ต้องมี fixture
 * พร้อมใช้งานจริงก่อนเสมอ
 */
export async function triggerOcrTestRunAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const fixtureName = String(formData.get("fixtureName") || "");
  const fixture = await getOcrTestFixture(fixtureName);
  if (!fixture) {
    return { status: "error", message: "ไม่รู้จักไฟล์ทดสอบนี้" };
  }
  if (!fixture.available) {
    return { status: "error", message: `ยังไม่มีไฟล์ "${fixture.label}" ในระบบ กรุณาเพิ่มไฟล์ก่อนทดสอบ` };
  }

  const service = createServiceRoleClient();
  const { data: testRun, error: insertError } = await service
    .from("ocr_test_runs")
    .insert({ fixture_name: fixtureName, created_by: auth.userId })
    .select("id")
    .single();

  if (insertError || !testRun) {
    console.error("triggerOcrTestRunAction: สร้างแถว ocr_test_runs ไม่สำเร็จ:", insertError?.message);
    return { status: "error", message: "ไม่สามารถเริ่มทดสอบได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const enqueueResult = await enqueueBackgroundJob({
    jobType: "ocr_test_run",
    payload: { ocr_test_run_id: testRun.id, fixture_name: fixtureName },
    idempotencyKey: `ocr_test_run:${testRun.id}`,
    createdBy: auth.userId,
    maxAttempts: OCR_JOB_MAX_ATTEMPTS,
  });

  if (!enqueueResult.ok) {
    return { status: "error", message: "ไม่สามารถสร้างงานทดสอบได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const isRetry = formData.get("isRetry") === "true";
  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: isRetry ? "ocr_test_run_retry" : "ocr_test_run_triggered",
    entityType: "ocr_test_runs",
    entityId: testRun.id,
    metadata: { fixtureName },
  });

  revalidatePath("/superadmin/ocr");
  return { status: "success", message: `เริ่มทดสอบด้วยไฟล์ "${fixture.label}" แล้ว` };
}
