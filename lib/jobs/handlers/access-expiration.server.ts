import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { completeBackgroundJob, failBackgroundJob, toSafeJobErrorMessage } from "@/lib/jobs/queue.server";
import { getSettings } from "@/lib/data/settings.server";
import { isEmailProviderConfigured } from "@/lib/notifications/email.server";
import { notifyExpiringAccessGrantsByEmail } from "@/lib/notifications/access-request-email.server";
import { startCronRun, finishCronRun } from "@/lib/cron/cron-runs.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `access_expiration` — ประมวลผลการหมดอายุสิทธิ์เข้าถึงทั้งสอง
 * ตารางในรอบเดียว ผ่าน Service Role (ข้าม RLS จึงอัปเดตได้ทุกแถวในคำขอเดียว):
 *
 * 1. `expire_stale_access_requests()` (ช่วงที่ 18) — เปลี่ยนคำขอ approved ที่
 *    หมดอายุแล้วเป็น expired (แจ้งเตือนผู้ขอผ่าน trigger เดิมอัตโนมัติ)
 * 2. `expire_stale_access_grants()` (ใหม่) — ปิด grant ที่หมดอายุแล้วอย่าง
 *    ชัดเจน (revoked_at) แจ้งเตือนผู้ใช้ผ่าน trigger ด้วยถ้อยคำ "หมดอายุ"
 * 3. `warn_expiring_access_grants(p_window_days)` (ใหม่) — แจ้งเตือนล่วงหน้า
 *    ก่อนหมดอายุจริง จำนวนวันมาจาก settings.access_expiration_warning_days
 *    (ตั้งค่าได้ที่ /superadmin/notifications, ช่วงที่ 26) แทนค่าคงที่เดิม
 *    — ถ้าอ่านค่าจาก settings ไม่ได้ (Supabase ยังไม่ได้ตั้งค่า) fallback เป็น
 *    3 วันเสมอ ผลลัพธ์ที่ RPC คืนมา (สิทธิ์ที่เพิ่งถูกแจ้งเตือนในรอบนี้) ถูกส่ง
 *    ต่อให้ notifyExpiringAccessGrantsByEmail() ถ้าเปิดใช้อีเมลไว้
 *
 * ทั้งสามฟังก์ชัน idempotent โดยธรรมชาติ (ดู migration
 * 20260811100000_access_expiration_and_publish_events.sql) — รันซ้ำกี่ครั้งก็
 * ไม่แจ้งเตือนซ้ำ (ทั้ง in-app และอีเมลใช้ผลลัพธ์ "due" ชุดเดียวกันจาก RPC
 * เรียกครั้งเดียว) **การตรวจสิทธิ์จริงตอนสร้าง Signed URL ไม่ได้พึ่งพา job นี้
 * เลย** (เช็ค expires_at/revoked_at ของแถวจริงตรงๆ เสมอ — ดู
 * lib/storage/signed-url.server.ts, lib/data/access-grants.server.ts) งานนี้
 * เป็นงานตรวจสอบตามกำหนดเวลา (ไม่ผูกกับ entity ใดเจาะจง) ดู
 * lib/jobs/dispatch.server.ts สำหรับวิธี seed job นี้ซ้ำทุกครั้งที่ worker ทำงาน
 */
export async function handleAccessExpirationJob(job: BackgroundJobRow): Promise<boolean> {
  const runId = await startCronRun("access_expiration");

  try {
    const service = createServiceRoleClient();
    const settings = await getSettings();
    const warningDays = settings.accessExpirationWarningDays ?? 3;

    const { data: expiredRequests, error: requestsError } = await service.rpc("expire_stale_access_requests");
    if (requestsError) throw requestsError;

    const { data: expiredGrants, error: grantsError } = await service.rpc("expire_stale_access_grants");
    if (grantsError) throw grantsError;

    const { data: warnedGrants, error: warnError } = await service.rpc("warn_expiring_access_grants", {
      p_window_days: warningDays,
    });
    if (warnError) throw warnError;

    if (settings.accessExpirationWarningEmailEnabled && isEmailProviderConfigured() && warnedGrants?.length) {
      await notifyExpiringAccessGrantsByEmail(service, warnedGrants);
    }

    const processedCount = (expiredRequests ?? 0) + (expiredGrants ?? 0) + (warnedGrants?.length ?? 0);
    await finishCronRun(runId, { jobName: "access_expiration", status: "completed", processedCount, failedCount: 0 });

    await completeBackgroundJob(job.id);
    return true;
  } catch (error) {
    const safeMessage = toSafeJobErrorMessage(error, "handleAccessExpirationJob");
    await finishCronRun(runId, {
      jobName: "access_expiration",
      status: "failed",
      processedCount: 0,
      failedCount: 1,
      errorSummary: safeMessage,
    });
    await failBackgroundJob(job.id, safeMessage);
    return false;
  }
}
