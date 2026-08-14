"use server";

import { revalidatePath } from "next/cache";
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
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

/**
 * Server Actions ของหน้า /superadmin/jobs (Dead-letter Queue) — ทั้งสามตัว
 * rank >= 50 เหมือนกัน เพราะ background_jobs ทั้งตารางถูกจำกัดสิทธิ์อ่านไว้แค่
 * Super Admin อยู่แล้ว (ดู RLS ใน supabase/migrations/20260810100000_background_jobs.sql)
 */

export async function retryDeadLetterJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: "ไม่พบรหัสงาน" };

  const result = await retryFailedJob(jobId);
  if (!result.ok) {
    return { status: "error", message: result.error ?? "ลองใหม่ไม่สำเร็จ" };
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "background_job_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/jobs");
  return { status: "success", message: "ส่งกลับเข้าคิวเรียบร้อยแล้ว" };
}

export async function cancelDeadLetterJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: "ไม่พบรหัสงาน" };
  const note = String(formData.get("note") || "").trim() || undefined;

  const result = await cancelDeadLetterJob(jobId, auth.userId, note);
  if (!result.ok) {
    return { status: "error", message: result.error ?? "ยกเลิกไม่สำเร็จ" };
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
  return { status: "success", message: "ยกเลิกงานนี้เรียบร้อยแล้ว" };
}

export async function resolveDeadLetterJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: "ไม่พบรหัสงาน" };
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    return { status: "error", message: "กรุณาระบุเหตุผลที่ทำเครื่องหมายว่าแก้ไขแล้ว" };
  }

  const result = await resolveDeadLetterJob(jobId, auth.userId, note);
  if (!result.ok) {
    return { status: "error", message: result.error ?? "บันทึกไม่สำเร็จ" };
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
  return { status: "success", message: "ทำเครื่องหมายว่าแก้ไขแล้วเรียบร้อยแล้ว" };
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
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const jobType = String(formData.get("jobType") || "") as BackgroundJobTypeRow;
  if (!JOB_TYPES.includes(jobType)) {
    return { status: "error", message: "ไม่รู้จักประเภทงานนี้" };
  }

  const concurrency = Number(formData.get("concurrency"));
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    return { status: "error", message: "จำนวนต้องเป็นเลขจำนวนเต็มระหว่าง 1-20" };
  }

  const defaultBatchSize = Number(formData.get("defaultBatchSize"));
  if (!Number.isInteger(defaultBatchSize) || defaultBatchSize < 1 || defaultBatchSize > 500) {
    return { status: "error", message: "ขนาด chunk ต้องเป็นเลขจำนวนเต็มระหว่าง 1-500" };
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from("job_type_settings")
    .update({ concurrency, default_batch_size: defaultBatchSize, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq("job_type", jobType);

  if (error) {
    console.error("updateJobConcurrencyAction failed:", error.message);
    return { status: "error", message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
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
  return { status: "success", message: "บันทึกค่าเรียบร้อยแล้ว" };
}
