import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { completeBackgroundJob, failBackgroundJob, toSafeJobErrorMessage } from "@/lib/jobs/queue.server";
import { startCronRun, finishCronRun } from "@/lib/cron/cron-runs.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `maintenance_cleanup` (ช่วงที่ 31) — งานบำรุงรักษาจริงงาน
 * แรกของระบบ (เดิมไม่มี job ประเภทนี้เลย) ลบแถว `rate_limit_events` ที่เก่ากว่า
 * `RETENTION_DAYS` ทิ้ง — ตารางนี้เก็บ event การจำกัดอัตรา (สมัครสมาชิก/ส่งงาน
 * วิจัย/OCR) ที่ไม่มีการล้างมาก่อนเลย สะสมไปเรื่อยๆ โดยไม่มีประโยชน์อีกต่อไป
 * หลังพ้นหน้าต่างเวลาที่ใช้จำกัดอัตราจริง (นานสุดคือโควตา OCR ต่อวัน = 86400
 * วินาที ดู lib/rate-limit.server.ts) — 7 วันเผื่อเหลือเผื่อขาดกว้างกว่ามาก
 *
 * self-seed ทุกครั้งที่ worker ทำงานเหมือน access_expiration (ดู
 * lib/jobs/dispatch.server.ts) — RETENTION_DAYS เป็นค่าคงที่ในโค้ด ไม่ใช่
 * Setting ที่ Super Admin ปรับได้ (ไม่มีความเสี่ยงพอที่ต้องเปิดให้ปรับ)
 */

const RETENTION_DAYS = 7;

export async function handleMaintenanceCleanupJob(job: BackgroundJobRow): Promise<boolean> {
  const runId = await startCronRun("maintenance_cleanup");

  try {
    const service = createServiceRoleClient();
    // rate_limit_events ไม่มี grant ให้ service_role เข้าถึงตรงๆ (เขียน/อ่านผ่าน
    // check_rate_limit() ซึ่งเป็น security definer เท่านั้นมาตั้งแต่ต้น) — ลบผ่าน
    // ฟังก์ชัน security definer เฉพาะงานนี้เช่นกัน (least privilege)
    const { data: processedCount, error } = await service.rpc("cleanup_old_rate_limit_events", {
      p_retention_days: RETENTION_DAYS,
    });
    if (error) throw error;
    await finishCronRun(runId, {
      jobName: "maintenance_cleanup",
      status: "completed",
      processedCount: processedCount ?? 0,
      failedCount: 0,
    });
    await completeBackgroundJob(job.id);
    return true;
  } catch (error) {
    const safeMessage = toSafeJobErrorMessage(error, "handleMaintenanceCleanupJob");
    await finishCronRun(runId, {
      jobName: "maintenance_cleanup",
      status: "failed",
      processedCount: 0,
      failedCount: 1,
      errorSummary: safeMessage,
    });
    await failBackgroundJob(job.id, safeMessage);
    return false;
  }
}
