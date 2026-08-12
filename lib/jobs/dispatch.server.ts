import "server-only";
import {
  claimBackgroundJobsForType,
  enqueueBackgroundJob,
  generateWorkerId,
  failBackgroundJob,
  toSafeJobErrorMessage,
  JOB_TYPES,
} from "@/lib/jobs/queue.server";
import { getJobConcurrencySettings, resolveConcurrency } from "@/lib/data/job-type-settings.server";
import { handlePdfTextExtractionJob } from "@/lib/jobs/handlers/pdf-text-extraction.server";
import { handleFileSecurityRescanJob } from "@/lib/jobs/handlers/file-security-rescan.server";
import { handleAccessExpirationJob } from "@/lib/jobs/handlers/access-expiration.server";
import { handleCategoryNotificationJob } from "@/lib/jobs/handlers/category-notification.server";
import { handleDuplicateScanJob } from "@/lib/jobs/handlers/duplicate-scan.server";
import { handleOcrProcessingJob } from "@/lib/jobs/handlers/ocr-processing.server";
import { handleBulkEnqueueJob } from "@/lib/jobs/handlers/bulk-enqueue.server";
import { handleMaintenanceCleanupJob } from "@/lib/jobs/handlers/maintenance-cleanup.server";
import { handleOcrTestRunJob } from "@/lib/jobs/handlers/ocr-test-run.server";
import { startCronRun, finishCronRun } from "@/lib/cron/cron-runs.server";
import { JOB_TYPE_LABELS } from "@/lib/jobs/dlq.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

const DEFAULT_BATCH_SIZE = 5;

/**
 * ไม่มีตัวจัดตารางเวลา (scheduler) แยกในโปรเจกต์นี้ — job ประเภท
 * `access_expiration` จึง "self-seed" ตัวเองใหม่ทุกครั้งที่ worker ทำงาน (ถ้ายัง
 * ไม่มี job ที่ active ค้างอยู่) แทน เพื่อให้ทำงานตามรอบ cron ที่ตั้งไว้โดยไม่ต้อง
 * มีตารางกำหนดเวลาแยกต่างหาก — ปลอดภัยเพราะ partial unique index บน
 * idempotency_key กันสร้างซ้ำระหว่างที่ job ก่อนหน้ายัง active อยู่แล้ว
 */
async function seedAccessExpirationJob(): Promise<void> {
  await enqueueBackgroundJob({
    jobType: "access_expiration",
    payload: {},
    idempotencyKey: "access_expiration:scheduled",
  });
}

/** self-seed เหมือน seedAccessExpirationJob() ข้างบนทุกประการ (ช่วงที่ 31) — ดู
 * lib/jobs/handlers/maintenance-cleanup.server.ts สำหรับงานที่ทำจริง */
async function seedMaintenanceCleanupJob(): Promise<void> {
  await enqueueBackgroundJob({
    jobType: "maintenance_cleanup",
    payload: {},
    idempotencyKey: "maintenance_cleanup:scheduled",
  });
}

async function dispatchJob(job: BackgroundJobRow): Promise<boolean> {
  switch (job.job_type as BackgroundJobTypeRow) {
    case "pdf_text_extraction":
      return handlePdfTextExtractionJob(job);
    case "file_security_rescan":
      return handleFileSecurityRescanJob(job);
    case "access_expiration":
      return handleAccessExpirationJob(job);
    case "category_notification":
      return handleCategoryNotificationJob(job);
    case "duplicate_scan":
      return handleDuplicateScanJob(job);
    case "ocr_processing":
      return handleOcrProcessingJob(job);
    case "bulk_enqueue":
      return handleBulkEnqueueJob(job);
    case "maintenance_cleanup":
      return handleMaintenanceCleanupJob(job);
    case "ocr_test_run":
      return handleOcrTestRunJob(job);
    default:
      await failBackgroundJob(job.id, `ไม่รู้จักประเภทงาน: ${job.job_type}`);
      return false;
  }
}

export interface ProcessJobsSummary {
  workerId: string;
  claimed: number;
  results: Array<{ id: string; jobType: string; ok: boolean }>;
}

async function dispatchJobSafely(job: BackgroundJobRow): Promise<{ id: string; jobType: string; ok: boolean }> {
  try {
    const ok = await dispatchJob(job);
    return { id: job.id, jobType: job.job_type, ok };
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "processJobQueue dispatch"));
    return { id: job.id, jobType: job.job_type, ok: false };
  }
}

/**
 * ประมวลผลคิวหนึ่งรอบ — เรียกจาก worker endpoint (/api/jobs/process) ที่ cron
 * เรียกเป็นระยะ หรือปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ของ Super Admin (ดู
 * docs/background-jobs.md) แต่ละ job ถูกดักด้วย try/catch แยกกัน — job หนึ่งพัง
 * ต้องไม่ทำให้ job อื่นในรอบเดียวกันไม่ได้ประมวลผล
 *
 * `jobTypes` (ไม่บังคับ) จำกัดให้ claim เฉพาะ job ประเภทที่ระบุเท่านั้น — ใช้กับ
 * ปุ่ม "ประมวลผลสิทธิ์ที่หมดอายุทันที" ที่ต้องการรันเฉพาะ `access_expiration`
 * โดยไม่แตะ job ประเภทอื่นที่อาจค้างอยู่ในคิวพร้อมกัน
 *
 * **Concurrency (ช่วงที่ 25, บังคับแบบ global ข้าม worker/instance ตั้งแต่
 * ช่วงที่ 30)**: claim แยกทีละประเภทงาน จำกัดจำนวนที่ claim ต่อประเภทด้วยค่าที่
 * ตั้งไว้ใน job_type_settings (ปรับได้ที่ /superadmin/jobs) โดยผลรวมที่ claim
 * ได้ทั้งหมดยังไม่เกิน batchSize เดิมเสมอ (เพดานความปลอดภัยเดิมไม่เปลี่ยน) —
 * claimBackgroundJobsForType() (ช่วงที่ 30) ใช้ pg_advisory_xact_lock ต่อประเภท
 * งานฝั่ง SQL บังคับว่าจำนวนงานที่ processing อยู่จริงของประเภทเดียวกัน **รวม
 * ทุก invocation ที่ทำงานพร้อมกัน** (Cron ทับซ้อนกัน, ปุ่ม "ประมวลผลคิวเดี๋ยวนี้"
 * ระหว่างที่ Cron กำลังรัน, worker หลาย instance จริงใน production) ไม่มีทาง
 * เกินค่า concurrency ที่ตั้งไว้เลย — ต่างจากช่วงที่ 25 ที่ concurrency เป็นแค่
 * เพดานต่อการเรียกหนึ่งครั้งเท่านั้น (ดู docs/background-jobs.md หัวข้อ
 * concurrency) จากนั้น dispatch ทุก job ที่ claim ได้ "พร้อมกัน" ผ่าน Promise.all
 * — บน Vercel Serverless นี่คือ concurrent await ภายใน invocation เดียว (ใช้ได้
 * จริงกับงานที่รอ I/O เช่น เรียก OCR provider/ดาวน์โหลดจาก Storage) ไม่ใช่ thread
 * ขนานแบบ OS การกันประมวลผล entity เดียวกันซ้ำซ้อนไม่ต้องมีกลไกใหม่เลย —
 * partial unique index บน idempotency_key เดิมทำให้ claim ไม่มีทาง claim job
 * ที่ active ซ้ำกันของ entity+job_type เดียวกันได้อยู่แล้วไม่ว่าจะ concurrency
 * เท่าไหร่ก็ตาม
 */
/** สรุปงานที่ล้มเหลวในรอบนี้เป็นข้อความสั้นๆ แบบนับจำนวนต่อประเภทเท่านั้น
 * (ช่วงที่ 31) — ห้ามมี error message ดิบของ job แต่ละตัวปนอยู่เลย (คอลัมน์
 * cron_runs.error_summary ต้องไม่มี stack trace/PostgreSQL error ดิบ/secret) */
function summarizeFailures(results: Array<{ jobType: string; ok: boolean }>): string | null {
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return null;
  const countByType = new Map<string, number>();
  for (const r of failed) {
    countByType.set(r.jobType, (countByType.get(r.jobType) ?? 0) + 1);
  }
  const parts = Array.from(countByType.entries()).map(
    ([jobType, count]) => `${JOB_TYPE_LABELS[jobType as BackgroundJobTypeRow] ?? jobType} x${count}`
  );
  return `${failed.length} งานล้มเหลว: ${parts.join(", ")}`;
}

export async function processJobQueue(
  batchSize = DEFAULT_BATCH_SIZE,
  jobTypes?: BackgroundJobTypeRow[]
): Promise<ProcessJobsSummary> {
  const runId = await startCronRun("queue_worker");

  try {
    const workerId = generateWorkerId();
    await seedAccessExpirationJob();
    await seedMaintenanceCleanupJob();

    const typesToConsider = jobTypes ?? JOB_TYPES;
    const concurrencyByType = await getJobConcurrencySettings();

    const claimedJobs: BackgroundJobRow[] = [];
    let remainingBudget = batchSize;
    for (const jobType of typesToConsider) {
      if (remainingBudget <= 0) break;
      const concurrency = resolveConcurrency(concurrencyByType, jobType);
      const claimLimit = Math.min(concurrency, remainingBudget);
      if (claimLimit <= 0) continue;
      const claimed = await claimBackgroundJobsForType(workerId, jobType, claimLimit, concurrency);
      claimedJobs.push(...claimed);
      remainingBudget -= claimed.length;
    }

    const results = await Promise.all(claimedJobs.map(dispatchJobSafely));
    const failedCount = results.filter((r) => !r.ok).length;

    await finishCronRun(runId, {
      jobName: "queue_worker",
      status: "completed",
      processedCount: claimedJobs.length,
      failedCount,
      errorSummary: summarizeFailures(results),
    });

    return { workerId, claimed: claimedJobs.length, results };
  } catch (error) {
    // เกิดข้อผิดพลาดไม่คาดคิดก่อนถึงขั้นตอน dispatch job แต่ละตัว (เช่น seed/
    // claim ล้มเหลว) — บันทึกรอบนี้เป็น failed ก่อนโยน error ต่อให้ผู้เรียกเดิม
    // (พฤติกรรมเดิมของฟังก์ชันนี้ไม่เปลี่ยน แค่ไม่ปล่อยให้ cron_runs ค้างสถานะ
    // 'running' ตลอดไปถ้าไม่มีการเรียก finishCronRun เลย)
    await finishCronRun(runId, {
      jobName: "queue_worker",
      status: "failed",
      processedCount: 0,
      failedCount: 0,
      errorSummary: toSafeJobErrorMessage(error, "processJobQueue"),
    });
    throw error;
  }
}
