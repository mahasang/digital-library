import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import type { CronJobNameRow, CronRunStatusRow } from "@/lib/supabase/database.types";

export interface CronMonitoringRow {
  jobName: CronJobNameRow;
  expectedFrequencyMinutes: number;
  failureThreshold: number;
  lastRun: {
    startedAt: string;
    completedAt: string | null;
    status: CronRunStatusRow;
    processedCount: number;
    failedCount: number;
    errorSummary: string | null;
    nextExpectedRunAt: string | null;
  } | null;
  /** คำนวณฝั่ง TS จาก lastRun เทียบกับเวลาปัจจุบัน — "ok" | "overdue" | "never_run" */
  heartbeatStatus: "ok" | "overdue" | "never_run";
}

export interface RecentCronAlert {
  id: string;
  checkName: string;
  title: string;
  message: string;
  createdAt: string;
}

const JOB_NAMES: CronJobNameRow[] = [
  "queue_worker",
  "access_expiration",
  "notification_delivery",
  "maintenance_cleanup",
  "health_monitoring",
];

const OVERDUE_GRACE_MINUTES = 5;

/**
 * สรุปสถานะ cron ทั้งหมดสำหรับหน้า /superadmin/cron-monitoring (ช่วงที่ 31) —
 * ดึงแถวล่าสุดของแต่ละ job_name จาก cron_runs + ค่าตั้งค่าจาก
 * cron_monitoring_settings แล้วคำนวณ heartbeatStatus ฝั่ง TS (ไม่มีการสร้าง
 * ข้อมูลสถานะปลอม — "never_run" หมายถึงไม่มีแถว cron_runs จริงๆ เท่านั้น)
 */
export async function getCronMonitoringOverview(): Promise<CronMonitoringRow[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const [{ data: settingsRows }, ...latestRuns] = await Promise.all([
    service.from("cron_monitoring_settings").select("job_name, expected_frequency_minutes, failure_threshold"),
    ...JOB_NAMES.map((jobName) =>
      service
        .from("cron_runs")
        .select("started_at, completed_at, status, processed_count, failed_count, error_summary, next_expected_run_at")
        .eq("job_name", jobName)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
  ]);

  const settingsByName = new Map((settingsRows ?? []).map((row) => [row.job_name, row]));

  return JOB_NAMES.map((jobName, i) => {
    const settings = settingsByName.get(jobName);
    const lastRunRow = latestRuns[i].data;

    const lastRun = lastRunRow
      ? {
          startedAt: lastRunRow.started_at,
          completedAt: lastRunRow.completed_at,
          status: lastRunRow.status,
          processedCount: lastRunRow.processed_count,
          failedCount: lastRunRow.failed_count,
          errorSummary: lastRunRow.error_summary,
          nextExpectedRunAt: lastRunRow.next_expected_run_at,
        }
      : null;

    let heartbeatStatus: CronMonitoringRow["heartbeatStatus"] = "ok";
    if (!lastRun) {
      heartbeatStatus = "never_run";
    } else if (lastRun.nextExpectedRunAt) {
      const overdueBy = Date.now() - new Date(lastRun.nextExpectedRunAt).getTime();
      if (overdueBy > OVERDUE_GRACE_MINUTES * 60_000) heartbeatStatus = "overdue";
    }

    return {
      jobName,
      expectedFrequencyMinutes: settings?.expected_frequency_minutes ?? 15,
      failureThreshold: settings?.failure_threshold ?? 3,
      lastRun,
      heartbeatStatus,
    };
  });
}

/** รายการ alert ล่าสุด — อ่านจาก audit_logs (action='cron_alert_triggered')
 * แทนการมีตาราง alert history แยกใหม่ (สอดคล้องกับ retry history ของ DLQ เดิม
 * ที่ใช้ audit_logs เป็นแหล่งข้อมูลเดียวกันมาตั้งแต่ช่วงที่ 25) — ใช้ session
 * client ไม่ใช่ Service Role เพราะ audit_logs ไม่มี grant SELECT ให้
 * service_role เลย (อ่านผ่าน RLS policy `user_max_role_rank() >= 40` เดิมอยู่
 * แล้วเท่านั้น — รูปแบบเดียวกับ lib/data/audit-logs.server.ts ทั้งไฟล์) */
export async function getRecentCronAlerts(limit = 20): Promise<RecentCronAlert[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, metadata, created_at")
    .eq("action", "cron_alert_triggered")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getRecentCronAlerts failed:", error?.message);
    return [];
  }

  return data.map((row) => {
    const metadata = row.metadata as { check_name?: string; title?: string; message?: string };
    return {
      id: row.id,
      checkName: metadata.check_name ?? "unknown",
      title: metadata.title ?? "แจ้งเตือนระบบ",
      message: metadata.message ?? "",
      createdAt: row.created_at,
    };
  });
}
