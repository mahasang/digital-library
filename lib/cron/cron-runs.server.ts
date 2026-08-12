import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import type { CronJobNameRow, CronRunStatusRow } from "@/lib/supabase/database.types";

/**
 * บันทึกประวัติการทำงานของ cron/worker ที่สำคัญแต่ละครั้ง (ช่วงที่ 31) —
 * เรียกคู่กันเสมอ startCronRun() ตอนเริ่ม แล้ว finishCronRun() ตอนจบ (ทั้งสำเร็จ
 * และล้มเหลว) ไม่เคย throw ออกไปให้ผู้เรียกล้มเหลวตาม (การบันทึกประวัติพัง
 * ต้องไม่ทำให้ cron/worker ตัวจริงทำงานไม่ได้) — ถ้า service role ยังไม่ได้
 * ตั้งค่า จะข้ามการบันทึกเงียบๆ (คืน null แทน run id)
 */

export async function startCronRun(jobName: CronJobNameRow): Promise<string | null> {
  if (!isServiceRoleConfigured()) return null;
  try {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("cron_runs")
      .insert({ job_name: jobName, status: "running" })
      .select("id")
      .single();
    if (error) {
      console.error(`startCronRun(${jobName}) failed:`, error.message);
      return null;
    }
    return data.id;
  } catch (error) {
    console.error(`startCronRun(${jobName}) threw:`, error);
    return null;
  }
}

export async function finishCronRun(
  runId: string | null,
  params: {
    jobName: CronJobNameRow;
    status: CronRunStatusRow;
    processedCount: number;
    failedCount: number;
    /** ข้อความสรุปแบบสั้นๆ ที่ sanitize แล้วเท่านั้น — ห้ามมี stack trace/PostgreSQL error ดิบ/secret */
    errorSummary?: string | null;
  }
): Promise<void> {
  if (!runId || !isServiceRoleConfigured()) return;
  try {
    const service = createServiceRoleClient();

    const { data: settingsRow } = await service
      .from("cron_monitoring_settings")
      .select("expected_frequency_minutes")
      .eq("job_name", params.jobName)
      .maybeSingle();
    const frequencyMinutes = settingsRow?.expected_frequency_minutes ?? 15;
    const nextExpectedRunAt = new Date(Date.now() + frequencyMinutes * 60_000).toISOString();

    const { error } = await service
      .from("cron_runs")
      .update({
        completed_at: new Date().toISOString(),
        status: params.status,
        processed_count: params.processedCount,
        failed_count: params.failedCount,
        error_summary: params.errorSummary ?? null,
        next_expected_run_at: nextExpectedRunAt,
      })
      .eq("id", runId);

    if (error) {
      console.error(`finishCronRun(${params.jobName}) failed:`, error.message);
    }
  } catch (error) {
    console.error(`finishCronRun(${params.jobName}) threw:`, error);
  }
}
