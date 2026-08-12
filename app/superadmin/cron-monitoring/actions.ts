"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/actions/types";
import type { CronJobNameRow } from "@/lib/supabase/database.types";

const VALID_JOB_NAMES: CronJobNameRow[] = [
  "queue_worker",
  "access_expiration",
  "notification_delivery",
  "maintenance_cleanup",
  "health_monitoring",
];

/** ปรับความถี่ที่คาดหวัง/threshold ความล้มเหลวต่อ cron หนึ่งชื่อ — รูปแบบ
 * เดียวกับ updateJobConcurrencyAction (app/superadmin/jobs/actions.ts) ทุก
 * ประการ */
export async function updateCronMonitoringSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobName = String(formData.get("jobName") || "") as CronJobNameRow;
  if (!VALID_JOB_NAMES.includes(jobName)) {
    return { status: "error", message: "ไม่รู้จักชื่อ cron นี้" };
  }

  const expectedFrequencyMinutes = Number(formData.get("expectedFrequencyMinutes"));
  if (!Number.isInteger(expectedFrequencyMinutes) || expectedFrequencyMinutes < 1 || expectedFrequencyMinutes > 1440) {
    return { status: "error", message: "ความถี่ที่คาดหวังต้องเป็นเลขจำนวนเต็มระหว่าง 1-1440 นาที" };
  }

  const failureThreshold = Number(formData.get("failureThreshold"));
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1) {
    return { status: "error", message: "จำนวนงานล้มเหลวเกณฑ์แจ้งเตือนต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป" };
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from("cron_monitoring_settings")
    .update({
      expected_frequency_minutes: expectedFrequencyMinutes,
      failure_threshold: failureThreshold,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("job_name", jobName);

  if (error) {
    console.error("updateCronMonitoringSettingsAction failed:", error.message);
    return { status: "error", message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "cron_monitoring_settings_update",
    entityType: "cron_monitoring_settings",
    entityId: undefined,
    metadata: { jobName, expectedFrequencyMinutes, failureThreshold },
  });

  revalidatePath("/superadmin/cron-monitoring");
  return { status: "success", message: "บันทึกการตั้งค่าเรียบร้อยแล้ว" };
}
