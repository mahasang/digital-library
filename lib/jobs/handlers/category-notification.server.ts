import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyCategorySubscribersByEmail } from "@/lib/notifications/category-subscribers.server";
import { completeBackgroundJob, failBackgroundJob, toSafeJobErrorMessage } from "@/lib/jobs/queue.server";
import { startCronRun, finishCronRun } from "@/lib/cron/cron-runs.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `category_notification` — เรียก
 * notifyCategorySubscribersByEmail() เดิมของช่วงที่ 18 ผ่าน Service Role แทนการ
 * await ตรงในคำขอ publish (เดิมฟังก์ชันนี้ best-effort อยู่แล้วและไม่เคย throw
 * แต่การส่งอีเมลจำนวนมากยังกินเวลาในคำขอเดิม ย้ายมาเป็น background job ตัดปัญหา
 * timeout เมื่อมีผู้ติดตามจำนวนมาก)
 */
export async function handleCategoryNotificationJob(job: BackgroundJobRow): Promise<boolean> {
  const researchItemId = String(job.payload.research_item_id ?? "");
  const titleTh = String(job.payload.title_th ?? "");
  const submittedBy =
    typeof job.payload.submitted_by === "string" ? job.payload.submitted_by : null;

  if (!researchItemId || !titleTh) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (research_item_id/title_th)");
    return false;
  }

  const runId = await startCronRun("notification_delivery");

  try {
    const service = createServiceRoleClient();
    const { attempted, sent } = await notifyCategorySubscribersByEmail(service, researchItemId, titleTh, submittedBy);

    await finishCronRun(runId, {
      jobName: "notification_delivery",
      status: "completed",
      processedCount: sent,
      failedCount: Math.max(0, attempted - sent),
    });

    await completeBackgroundJob(job.id);
    return true;
  } catch (error) {
    const safeMessage = toSafeJobErrorMessage(error, "handleCategoryNotificationJob");
    await finishCronRun(runId, {
      jobName: "notification_delivery",
      status: "failed",
      processedCount: 0,
      failedCount: 1,
      errorSummary: safeMessage,
    });
    await failBackgroundJob(job.id, safeMessage);
    return false;
  }
}
