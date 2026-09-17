"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import {
  retryFailedJob,
  cancelDeadLetterJob,
  resolveDeadLetterJob,
} from "@/lib/jobs/queue.server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { JOB_TYPES } from "@/lib/jobs/queue.server";
import type { ActionResult } from "@/lib/actions/types";
import type { BackgroundJobTypeRow } from "@/lib/supabase/types";

/**
 * Server Actions ของหน้า /superadmin/jobs (Dead-letter Queue) — ทั้งสามตัว
 * rank >= 50 เหมือนกัน เพราะ background_jobs ทั้งตารางถูกจำกัดสิทธิ์อ่านไว้แค่
 * Super Admin อยู่แล้ว (ดู RLS ใน supabase/migrations/20260810100000_background_jobs.sql)
 */

export async function retryDeadLetterJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: t("jobNotFound") };

  const result = await retryFailedJob(jobId);
  if (!result.ok) {
    return { status: "error", message: result.error ?? t("retryFailed") };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "background_job_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/jobs");
  return { status: "success", message: t("requeuedSuccess") };
}

export async function cancelDeadLetterJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tJobs = await getTranslations("actionMessages.superadmin.jobs");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: t("jobNotFound") };
  const note = String(formData.get("note") || "").trim() || undefined;

  const result = await cancelDeadLetterJob(jobId, auth.userId, note);
  if (!result.ok) {
    return { status: "error", message: result.error ?? tJobs("cancelFailed") };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "background_job_cancel",
    entityType: "background_jobs",
    entityId: jobId,
    metadata: note ? { note } : undefined,
  });

  revalidatePath("/superadmin/jobs");
  return { status: "success", message: tJobs("cancelSuccess") };
}

export async function resolveDeadLetterJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tJobs = await getTranslations("actionMessages.superadmin.jobs");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: t("jobNotFound") };
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    return { status: "error", message: tJobs("resolveReasonRequired") };
  }

  const result = await resolveDeadLetterJob(jobId, auth.userId, note);
  if (!result.ok) {
    return { status: "error", message: result.error ?? tJobs("resolveFailed") };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "background_job_resolve",
    entityType: "background_jobs",
    entityId: jobId,
    metadata: { note },
  });

  revalidatePath("/superadmin/jobs");
  return { status: "success", message: tJobs("resolveSuccess") };
}

/**
 * ปรับ concurrency (จำนวนงานสูงสุดที่ประมวลผลพร้อมกัน) และ default_batch_size
 * (ขนาด chunk เริ่มต้นตอนสร้าง master job ใหม่ — ช่วงที่ 28, คนละมิติกับ
 * concurrency) ของประเภทงานหนึ่ง — ทีละประเภทต่อการเรียกครั้งเดียว (ฟอร์มแยก
 * ต่อแถวที่หน้าเว็บ) ตามรูปแบบเดียวกับ updateSystemSettingsAction เดิม
 * (requireMinRank(50) → validate → upsert → logAudit → revalidatePath)
 */
export async function updateJobConcurrencyAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tJobs = await getTranslations("actionMessages.superadmin.jobs");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobType = String(formData.get("jobType") || "") as BackgroundJobTypeRow;
  if (!JOB_TYPES.includes(jobType)) {
    return { status: "error", message: tJobs("unknownJobType") };
  }

  const concurrency = Number(formData.get("concurrency"));
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    return { status: "error", message: tJobs("concurrencyRange") };
  }

  const defaultBatchSize = Number(formData.get("defaultBatchSize"));
  if (!Number.isInteger(defaultBatchSize) || defaultBatchSize < 1 || defaultBatchSize > 500) {
    return { status: "error", message: tJobs("batchSizeRange") };
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from("job_type_settings")
    .update({ concurrency, default_batch_size: defaultBatchSize, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq("job_type", jobType);

  if (error) {
    console.error("updateJobConcurrencyAction failed:", error.message);
    return { status: "error", message: t("saveFailedGeneric") };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "job_concurrency_update",
    entityType: "job_type_settings",
    entityId: jobType,
    metadata: { jobType, concurrency, defaultBatchSize },
  });

  revalidatePath("/superadmin/jobs");
  return { status: "success", message: tJobs("concurrencySaveSuccess") };
}
