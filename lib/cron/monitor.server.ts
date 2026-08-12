import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { getSettings } from "@/lib/data/settings.server";
import { isEmailProviderConfigured, sendNotificationEmail } from "@/lib/notifications/email.server";
import { sendInBatches, EMAIL_BATCH_CONCURRENCY } from "@/lib/notifications/send-in-batches.server";
import { getSuperAdminRecipients } from "@/lib/data/super-admins.server";
import { getQueueHealth } from "@/lib/data/queue-health.server";
import { startCronRun, finishCronRun } from "@/lib/cron/cron-runs.server";
import { JOB_TYPE_LABELS } from "@/lib/jobs/dlq.server";
import type { CronJobNameRow } from "@/lib/supabase/database.types";

/**
 * ตรวจสุขภาพของ cron/worker ที่สำคัญทั้งหมด (ช่วงที่ 31) — เรียกจาก
 * /api/cron/health-check ซึ่งต้องเป็น Cron **แยกต่างหาก** จาก
 * /api/jobs/process โดยเจตนา (ดู docs/background-jobs.md หัวข้อ 14) เพราะถ้า
 * ตรวจสอบจากภายใน worker เดียวกัน ตอน worker ทั้งชุดหยุดทำงานจริงจะไม่มีอะไร
 * ตรวจจับได้เลย — ไม่มีการสร้างข้อมูลสถานะปลอมใดๆ ทุกตัวเลขมาจาก cron_runs/
 * background_jobs จริงเท่านั้น ข้อความ alert ทุกข้อความเป็นข้อความไทยสั้นๆ
 * ที่เตรียมไว้ล่วงหน้า ไม่มี stack trace/PostgreSQL error ดิบ/secret ใดๆ
 */

const MONITORED_JOB_NAMES: CronJobNameRow[] = [
  "queue_worker",
  "access_expiration",
  "notification_delivery",
  "maintenance_cleanup",
];

/** เวลาผ่อนผันหลัง next_expected_run_at ก่อนจะถือว่า "เกินกำหนด" จริง — กัน
 * แจ้งเตือนทันทีที่เพิ่งเลยเวลาไปไม่กี่วินาทีจากความคลาดเคลื่อนของรอบ Cron เอง */
const OVERDUE_GRACE_MINUTES = 5;

/** cooldown กันแจ้งเตือนซ้ำต่อเงื่อนไขหนึ่ง (ช่วงที่ 31) */
const ALERT_COOLDOWN_MINUTES = 60;

/** threshold คงที่ของ 2 เช็คระดับ queue โดยรวม (ไม่ผูกกับ job_name เดียว) —
 * ไม่ใช่ Setting ที่ปรับได้ เหมือนเกณฑ์ "รอนานผิดปกติ 15 นาที" ของช่วงที่ 30 */
const DLQ_BACKLOG_THRESHOLD = 5;

const JOB_NAME_LABELS: Record<CronJobNameRow, string> = {
  queue_worker: "Worker ประมวลผลคิวหลัก",
  access_expiration: "ตรวจสอบสิทธิ์หมดอายุ",
  notification_delivery: "ส่งอีเมลแจ้งเตือนผู้ติดตามหมวดหมู่",
  maintenance_cleanup: "บำรุงรักษา/ล้างข้อมูลเก่า",
  health_monitoring: "ตรวจสุขภาพ Cron/Worker",
};

interface FiredAlert {
  checkName: string;
  title: string;
  message: string;
}

async function shouldAlert(checkName: string, service: ReturnType<typeof createServiceRoleClient>): Promise<boolean> {
  const { data } = await service.from("cron_alert_state").select("last_alerted_at").eq("check_name", checkName).maybeSingle();
  if (!data) return true;
  const elapsedMinutes = (Date.now() - new Date(data.last_alerted_at).getTime()) / 60_000;
  return elapsedMinutes >= ALERT_COOLDOWN_MINUTES;
}

async function markAlerted(checkName: string, service: ReturnType<typeof createServiceRoleClient>): Promise<void> {
  await service
    .from("cron_alert_state")
    .upsert({ check_name: checkName, last_alerted_at: new Date().toISOString() }, { onConflict: "check_name" });
}

async function checkJobName(
  jobName: CronJobNameRow,
  service: ReturnType<typeof createServiceRoleClient>
): Promise<FiredAlert[]> {
  const alerts: FiredAlert[] = [];
  const label = JOB_NAME_LABELS[jobName];

  const [{ data: latestRun }, { data: settingsRow }] = await Promise.all([
    service
      .from("cron_runs")
      .select("status, failed_count, next_expected_run_at, started_at")
      .eq("job_name", jobName)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("cron_monitoring_settings")
      .select("expected_frequency_minutes, failure_threshold, updated_at")
      .eq("job_name", jobName)
      .maybeSingle(),
  ]);

  if (!settingsRow) return alerts;

  if (!latestRun) {
    const configuredSince = Date.now() - new Date(settingsRow.updated_at).getTime();
    const shouldHaveRunBy = settingsRow.expected_frequency_minutes * 60_000;
    if (configuredSince > shouldHaveRunBy) {
      const checkName = `${jobName}_never_run`;
      if (await shouldAlert(checkName, service)) {
        alerts.push({
          checkName,
          title: "Cron ยังไม่เคยทำงานเลย",
          message: `"${label}" ยังไม่มีประวัติการทำงานเลยตั้งแต่ตั้งค่าระบบไว้ — ตรวจสอบว่าตั้งค่า Cron ที่เรียก /api/jobs/process ถูกต้องหรือไม่`,
        });
      }
    }
    return alerts;
  }

  if (latestRun.next_expected_run_at) {
    const overdueBy = Date.now() - new Date(latestRun.next_expected_run_at).getTime();
    if (overdueBy > OVERDUE_GRACE_MINUTES * 60_000) {
      const checkName = `${jobName}_overdue`;
      if (await shouldAlert(checkName, service)) {
        const overdueMinutes = Math.round(overdueBy / 60_000);
        alerts.push({
          checkName,
          title: "Cron เกินกำหนดเวลาทำงาน",
          message: `"${label}" ไม่ได้ทำงานตามรอบมาแล้วประมาณ ${overdueMinutes} นาที — ตรวจสอบสถานะที่ /superadmin/cron-monitoring`,
        });
      }
    }
  }

  if (latestRun.status === "failed" || latestRun.failed_count >= settingsRow.failure_threshold) {
    const checkName = `${jobName}_high_failure`;
    if (await shouldAlert(checkName, service)) {
      alerts.push({
        checkName,
        title: "Cron มีอัตราความล้มเหลวสูง",
        message: `"${label}" รอบล่าสุดมีงานล้มเหลว ${latestRun.failed_count} รายการ (เกณฑ์ ${settingsRow.failure_threshold}) — ตรวจสอบที่ /superadmin/jobs`,
      });
    }
  }

  return alerts;
}

async function checkAggregateQueueHealth(service: ReturnType<typeof createServiceRoleClient>): Promise<FiredAlert[]> {
  const alerts: FiredAlert[] = [];

  const health = await getQueueHealth();
  const stuck = health.byJobType.filter((row) => row.stuckPendingCount > 0);
  if (stuck.length > 0) {
    const checkName = "queue_stuck_jobs";
    if (await shouldAlert(checkName, service)) {
      const parts = stuck.map((row) => `${JOB_TYPE_LABELS[row.jobType] ?? row.jobType} x${row.stuckPendingCount}`);
      alerts.push({
        checkName,
        title: "มีงานรอคิวนานผิดปกติ",
        message: `พบงานที่รอคิวนานเกิน 15 นาที: ${parts.join(", ")} — ตรวจสอบที่ /superadmin/jobs`,
      });
    }
  }

  const { count } = await service
    .from("background_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .is("resolved_at", null);
  if ((count ?? 0) >= DLQ_BACKLOG_THRESHOLD) {
    const checkName = "queue_dlq_backlog";
    if (await shouldAlert(checkName, service)) {
      alerts.push({
        checkName,
        title: "งานล้มเหลวถาวรสะสมมาก",
        message: `มีงานเข้า Dead-letter Queue ที่ยังไม่ได้จัดการ ${count} รายการ — ตรวจสอบที่ /superadmin/jobs`,
      });
    }
  }

  return alerts;
}

async function dispatchAlert(alert: FiredAlert, service: ReturnType<typeof createServiceRoleClient>): Promise<void> {
  const superAdmins = await getSuperAdminRecipients();
  if (superAdmins.length === 0) return;

  const { error: notifyError } = await service.from("notifications").insert(
    superAdmins.map((admin) => ({
      user_id: admin.userId,
      title: alert.title,
      message: alert.message,
      type: "warning" as const,
      research_id: null,
    }))
  );
  if (notifyError) {
    console.error(`dispatchAlert(${alert.checkName}): insert notifications failed:`, notifyError.message);
  }

  await service.from("audit_logs").insert({
    actor_id: null,
    action: "cron_alert_triggered",
    entity_type: "cron_runs",
    entity_id: null,
    metadata: { check_name: alert.checkName, title: alert.title, message: alert.message },
  });

  const settings = await getSettings();
  if (settings.notificationsEmailEnabled && isEmailProviderConfigured()) {
    const recipients = superAdmins.map((a) => a.email).filter((email): email is string => Boolean(email));
    await sendInBatches(recipients, EMAIL_BATCH_CONCURRENCY, (email) =>
      sendNotificationEmail({ to: email, subject: alert.title, text: alert.message }).catch((error) =>
        console.error(`dispatchAlert(${alert.checkName}): send to ${email} failed:`, error)
      )
    );
  }

  await markAlerted(alert.checkName, service);
}

export interface CronHealthCheckSummary {
  checksRun: number;
  alertsFired: number;
}

export async function runCronHealthChecks(): Promise<CronHealthCheckSummary> {
  if (!isServiceRoleConfigured()) return { checksRun: 0, alertsFired: 0 };

  const runId = await startCronRun("health_monitoring");
  const service = createServiceRoleClient();

  try {
    const perJobAlerts = await Promise.all(MONITORED_JOB_NAMES.map((jobName) => checkJobName(jobName, service)));
    const aggregateAlerts = await checkAggregateQueueHealth(service);
    const allAlerts = [...perJobAlerts.flat(), ...aggregateAlerts];

    for (const alert of allAlerts) {
      await dispatchAlert(alert, service);
    }

    const checksRun = MONITORED_JOB_NAMES.length * 2 + 2; // overdue+high_failure ต่อ job_name (never_run รวมอยู่ในรอบเดียวกัน) + 2 aggregate
    await finishCronRun(runId, {
      jobName: "health_monitoring",
      status: "completed",
      processedCount: checksRun,
      failedCount: allAlerts.length,
    });

    return { checksRun, alertsFired: allAlerts.length };
  } catch (error) {
    console.error("runCronHealthChecks failed:", error);
    await finishCronRun(runId, {
      jobName: "health_monitoring",
      status: "failed",
      processedCount: 0,
      failedCount: 0,
      errorSummary: "เกิดข้อผิดพลาดไม่คาดคิดระหว่างตรวจสุขภาพ Cron/Worker",
    });
    return { checksRun: 0, alertsFired: 0 };
  }
}
