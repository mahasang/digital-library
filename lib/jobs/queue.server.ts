import "server-only";
import crypto from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { sendDeadLetterEmailAlerts } from "@/lib/jobs/dlq-notify.server";
import type {
  BackgroundJobStatusRow,
  BackgroundJobTypeRow,
  Database,
} from "@/lib/supabase/database.types";

/**
 * ชั้นเรียกใช้งาน job queue (`background_jobs`, ดู migration
 * 20260810100000_background_jobs.sql) — ใช้ Service Role client เสมอ (ข้าม RLS
 * ตามธรรมชาติ) เพราะ enqueue/claim/complete เป็นงานฝั่งเซิร์ฟเวอร์ล้วนๆ
 * ไม่มีจุดไหนให้ Client เรียกตรงได้เลย (ดู docs/background-jobs.md)
 */

export type BackgroundJobRow = Database["public"]["Tables"]["background_jobs"]["Row"];

export interface EnqueueJobParams {
  jobType: BackgroundJobTypeRow;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  entityType?: string;
  entityId?: string;
  batchId?: string;
  createdBy?: string | null;
  maxAttempts?: number;
  runAfter?: Date;
}

export type EnqueueJobResult =
  | { ok: true; alreadyQueued: false; job: BackgroundJobRow }
  | { ok: true; alreadyQueued: true; job: null }
  | { ok: false; error: string };

/**
 * สร้าง job ใหม่ — ถ้ามี job ที่ active (pending/processing) อยู่แล้วสำหรับ
 * idempotencyKey เดียวกัน (ชนกับ partial unique index) จะไม่สร้างซ้ำ คืน
 * `alreadyQueued: true` แทนการ error เพื่อให้ผู้เรียก (เช่น bulk backfill)
 * ข้ามรายการนั้นไปอย่างเงียบๆ ได้โดยไม่ต้อง try/catch เอง
 */
export async function enqueueBackgroundJob(params: EnqueueJobParams): Promise<EnqueueJobResult> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่า จึงสร้างงานพื้นหลังไม่ได้" };
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("background_jobs")
    .insert({
      job_type: params.jobType,
      payload: params.payload,
      idempotency_key: params.idempotencyKey,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      batch_id: params.batchId ?? null,
      created_by: params.createdBy ?? null,
      max_attempts: params.maxAttempts ?? 5,
      run_after: (params.runAfter ?? new Date()).toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation — มี job active อยู่แล้วสำหรับ key นี้ ไม่ใช่ error จริง
    if (error.code === "23505") {
      return { ok: true, alreadyQueued: true, job: null };
    }
    console.error("enqueueBackgroundJob failed:", error.message);
    return { ok: false, error: "ไม่สามารถสร้างงานพื้นหลังได้ กรุณาลองใหม่อีกครั้ง" };
  }

  return { ok: true, alreadyQueued: false, job: data as BackgroundJobRow };
}

/**
 * ยกเลิก job ที่ยัง active ทั้งหมดของ entity เดียวกัน — ใช้ก่อน enqueue ใหม่
 * ตอนแทนที่ไฟล์ PDF (job เก่าอ้างไฟล์เดิมที่ไม่มีอยู่แล้ว ต้องไม่ประมวลผลซ้ำ)
 */
export async function cancelActiveJobsForEntity(
  entityType: string,
  entityId: string,
  jobTypes?: BackgroundJobTypeRow[]
): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  const service = createServiceRoleClient();
  const { error } = await service.rpc("cancel_active_jobs_for_entity", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_job_types: jobTypes ?? null,
  });
  if (error) {
    console.error("cancelActiveJobsForEntity failed:", error.message);
  }
}

/** ยกเลิกแล้วสร้างใหม่ทันที — ใช้ตอนแทนที่ไฟล์ PDF ที่ต้องมี job ใหม่เสมอ (ไม่ข้ามแบบ enqueue ปกติ) */
export async function replaceEntityJob(
  params: EnqueueJobParams & { entityType: string; entityId: string }
): Promise<EnqueueJobResult> {
  await cancelActiveJobsForEntity(params.entityType, params.entityId, [params.jobType]);
  return enqueueBackgroundJob(params);
}

export async function claimBackgroundJobs(
  workerId: string,
  limit = 5,
  jobTypes?: BackgroundJobTypeRow[]
): Promise<BackgroundJobRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("claim_background_jobs", {
    p_worker_id: workerId,
    p_limit: limit,
    p_job_types: jobTypes ?? null,
  });
  if (error) {
    console.error("claimBackgroundJobs failed:", error.message);
    return [];
  }
  return (data ?? []) as BackgroundJobRow[];
}

/**
 * เหมือน claimBackgroundJobs() แต่บังคับ concurrency แบบ global ข้าม
 * worker/instance จริง (ช่วงที่ 30) — claimBackgroundJobs()/claim_background_jobs
 * เดิมจำกัดแค่ "ต่อการเรียกหนึ่งครั้ง" เท่านั้น ไม่ได้ตรวจว่ามีงานประเภทเดียวกัน
 * กำลัง processing อยู่แล้วจาก invocation อื่นที่ทำงานพร้อมกันกี่งาน — ฟังก์ชันนี้
 * เรียก RPC ที่ใช้ pg_advisory_xact_lock ต่อประเภทงาน บังคับนับ+claim แบบ serial
 * ข้าม transaction ทั้งหมด (ดู migration 20260819100000_worker_concurrency.sql)
 * ใช้ได้กับ job type เดียวต่อการเรียกหนึ่งครั้งเท่านั้น (ตรงกับที่
 * processJobQueue() เรียกอยู่แล้ว — claim ทีละประเภท)
 */
export async function claimBackgroundJobsForType(
  workerId: string,
  jobType: BackgroundJobTypeRow,
  limit: number,
  concurrency: number
): Promise<BackgroundJobRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("claim_background_jobs_with_concurrency", {
    p_worker_id: workerId,
    p_job_type: jobType,
    p_limit: limit,
    p_concurrency: concurrency,
  });
  if (error) {
    console.error("claimBackgroundJobsForType failed:", error.message);
    return [];
  }
  return (data ?? []) as BackgroundJobRow[];
}

export async function completeBackgroundJob(jobId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.rpc("complete_background_job", { p_job_id: jobId });
  if (error) {
    console.error("completeBackgroundJob failed:", error.message);
  }
}

/**
 * คืนค่า true เมื่อการเรียกครั้งนี้เป็นครั้งที่ทำให้ job เข้า dead-letter queue
 * เป็นครั้งแรก (attempts ครบ max_attempts + ยังไม่เคยแจ้งเตือนมาก่อน) — ใช้ตัดสิน
 * ว่าควรส่งอีเมลแจ้ง Super Admin ต่อหรือไม่ (การแจ้งเตือนแบบ in-app + audit log
 * ถูกสร้างไปแล้วในธุรกรรมเดียวกันฝั่ง SQL ของ fail_background_job เอง ดู
 * migration 20260814100000_background_jobs_reliability.sql) — ไม่ throw ออกไป
 * แม้ส่งอีเมลไม่สำเร็จ (sendDeadLetterEmailAlerts จัดการ error ภายในตัวเองแล้ว)
 */
export async function failBackgroundJob(jobId: string, safeErrorMessage: string): Promise<boolean> {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("fail_background_job", {
    p_job_id: jobId,
    p_error_message: safeErrorMessage,
  });
  if (error) {
    console.error("failBackgroundJob failed:", error.message);
    return false;
  }

  const enteredDeadLetter = data === true;
  if (enteredDeadLetter) {
    await sendDeadLetterEmailAlerts(jobId);
  }
  return enteredDeadLetter;
}

/**
 * ให้ Super Admin สั่ง job ที่ล้มเหลวถาวรแล้ว (status='failed', ครบ max_attempts
 * แล้ว) กลับไปเป็น pending ใหม่ทันที — ต่างจาก retry อัตโนมัติของ
 * fail_background_job ที่มีเพดานจำนวนครั้งจำกัด นี่คือการ "ลองใหม่ด้วยมือ"
 * แยกต่างหาก จึงรีเซ็ต attempts กลับเป็น 0 ให้ครบรอบ retry อัตโนมัติใหม่ทั้งหมด
 * — ล้างสถานะ DLQ ทั้งหมด (resolved_at/resolved_by/resolution_note/
 * dead_letter_notified_at) ด้วยเสมอ เพื่อให้รอบล้มเหลวถัดไป (ถ้ามี) แจ้งเตือน
 * Super Admin ใหม่ได้อีกครั้ง แทนที่จะเงียบไปเพราะ guard เดิมยังติดอยู่
 */
export async function retryFailedJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const service = createServiceRoleClient();
  const { error, data } = await service
    .from("background_jobs")
    .update({
      status: "pending",
      run_after: new Date().toISOString(),
      error_message: null,
      attempts: 0,
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
      dead_letter_notified_at: null,
    })
    .eq("id", jobId)
    .eq("status", "failed")
    .select("id");
  const count = data?.length ?? 0;

  if (error) {
    console.error("retryFailedJob failed:", error.message);
    return { ok: false, error: "ไม่สามารถลองใหม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }
  if (!count) {
    return { ok: false, error: "ไม่พบงานที่ล้มเหลวนี้ (อาจถูกประมวลผลไปแล้ว)" };
  }
  return { ok: true };
}

/**
 * ยกเลิกงานที่เข้า dead-letter queue แล้ว (ไม่ต้องการลองใหม่อีก) — ต่างจาก
 * retryFailedJob ตรงที่ไม่กลับไป pending แต่เปลี่ยนเป็น cancelled ถาวร พร้อม
 * บันทึกว่าใคร/เมื่อไหร่/เพราะอะไร (resolved_* คอลัมน์เดียวกับ resolve เพื่อให้
 * ทั้งสองการกระทำหายไปจากรายการ DLQ ที่ยัง active ด้วยเงื่อนไขเดียวกัน)
 */
export async function cancelDeadLetterJob(
  jobId: string,
  cancelledBy: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const service = createServiceRoleClient();
  const { error, data } = await service
    .from("background_jobs")
    .update({
      status: "cancelled",
      resolved_at: new Date().toISOString(),
      resolved_by: cancelledBy,
      resolution_note: note ?? "ยกเลิกโดย Super Admin",
    })
    .eq("id", jobId)
    .eq("status", "failed")
    .select("id");

  if (error) {
    console.error("cancelDeadLetterJob failed:", error.message);
    return { ok: false, error: "ไม่สามารถยกเลิกงานนี้ได้ กรุณาลองใหม่อีกครั้ง" };
  }
  if (!(data?.length ?? 0)) {
    return { ok: false, error: "ไม่พบงานที่ล้มเหลวนี้ (อาจถูกดำเนินการไปแล้ว)" };
  }
  return { ok: true };
}

/**
 * ทำเครื่องหมายว่างานที่ล้มเหลวถาวรนี้ "แก้ไขแล้ว" โดยไม่เปลี่ยนสถานะ (ยังคงเป็น
 * failed เพื่อเก็บประวัติไว้ครบ) — ใช้เมื่อเจ้าหน้าที่ตรวจสอบแล้วว่าไม่ต้อง
 * ประมวลผลซ้ำอีก (เช่น แก้ปัญหาที่ต้นเหตุด้วยวิธีอื่นแล้ว) ต่างจาก cancel ตรงที่
 * resolve ไม่เปลี่ยน status เลย เพียงซ่อนจากรายการ DLQ ที่ยัง active เท่านั้น
 */
export async function resolveDeadLetterJob(
  jobId: string,
  resolvedBy: string,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  const service = createServiceRoleClient();
  const { error, data } = await service
    .from("background_jobs")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy, resolution_note: note })
    .eq("id", jobId)
    .eq("status", "failed")
    .is("resolved_at", null)
    .select("id");

  if (error) {
    console.error("resolveDeadLetterJob failed:", error.message);
    return { ok: false, error: "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง" };
  }
  if (!(data?.length ?? 0)) {
    return { ok: false, error: "ไม่พบงานที่ล้มเหลวนี้ หรือถูกทำเครื่องหมายแก้ไขแล้วไปก่อนหน้า" };
  }
  return { ok: true };
}

/**
 * ส่ง job ที่กำลัง processing อยู่กลับไปเป็น pending พร้อมเวลาที่กำหนด — ใช้โดย
 * handler ของ job แบบ "ทำงานเป็นรอบๆ ด้วยตัวเอง" เท่านั้น (ปัจจุบันมีแค่
 * bulk_enqueue ที่ทยอยสร้าง job ลูกทีละ chunk แล้ว requeue ตัวเองจนกว่าจะครบ —
 * ดู lib/jobs/handlers/bulk-enqueue.server.ts) ต่างจาก fail/complete ตรงที่ไม่
 * นับเป็นความล้มเหลว/ความสำเร็จ เป็นแค่ "ยังไม่เสร็จ ขอทำต่อรอบหน้า"
 */
export async function requeueJob(jobId: string, runAfter: Date): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service
    .from("background_jobs")
    .update({ status: "pending", run_after: runAfter.toISOString(), locked_by: null, lease_expires_at: null })
    .eq("id", jobId)
    .eq("status", "processing");
  if (error) {
    console.error("requeueJob failed:", error.message);
  }
}

/**
 * บันทึก progress ระดับหน้าของ job หนึ่งงาน (ช่วงที่ 29 — ก่อนหน้านี้มีแค่
 * updateJobProgress(jobId, progress) ที่ไม่มี call site ใดเรียกใช้เลยตั้งแต่
 * ช่วงที่ 20 เปลี่ยนเป็นฟังก์ชันนี้แทนการเพิ่มฟังก์ชันคู่ขนาน) `progressPercent`
 * คำนวณจาก currentPage/totalPages ที่ provider รายงานมาจริงเท่านั้น (ผู้เรียก
 * เป็นคนคำนวณก่อนส่งมา) — ไม่เคยเป็นค่าประมาณ/ปลอมจากฝั่งนี้
 */
export async function updateJobPageProgress(
  jobId: string,
  fields: {
    currentPage?: number | null;
    totalPages?: number | null;
    progressPercent?: number | null;
    progressMessage?: string | null;
    /** payload ใหม่ทั้งก้อน (เช่น เพิ่ม external_job_id) — undefined = ไม่แตะ payload เดิม */
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service
    .from("background_jobs")
    .update({
      current_page: fields.currentPage ?? null,
      total_pages: fields.totalPages ?? null,
      progress_message: fields.progressMessage ?? null,
      ...(typeof fields.progressPercent === "number"
        ? { progress: Math.max(0, Math.min(100, Math.round(fields.progressPercent))) }
        : {}),
      ...(fields.payload ? { payload: fields.payload } : {}),
    })
    .eq("id", jobId);
  if (error) {
    console.error("updateJobPageProgress failed:", error.message);
  }
}

/**
 * แปลง error ดิบเป็นข้อความปลอดภัยสำหรับเก็บใน background_jobs.error_message
 * (คอลัมน์นี้แสดงผลตรงที่หน้า Super Admin) — log ข้อความดิบไว้ฝั่งเซิร์ฟเวอร์
 * เท่านั้น ห้ามให้ stack trace/ข้อความ error ดิบจาก Postgres/Storage/provider
 * ภายนอกหลุดไปที่ UI เด็ดขาด (เข้ากับรูปแบบ toSafeErrorMessage เดิมของโปรเจกต์)
 */
export function toSafeJobErrorMessage(error: unknown, logContext: string): string {
  let rawMessage: string;
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "string") {
    rawMessage = error;
  } else if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    // รูปแบบ error ของ Supabase/PostgREST (PostgrestError) เป็น plain object ที่มี
    // message/code/details/hint ไม่ใช่ instance ของ Error — ต้องดึง .message เอง
    rawMessage = (error as { message: string }).message;
  } else {
    rawMessage = "unknown error";
  }
  console.error(`${logContext}:`, rawMessage);
  return "เกิดข้อผิดพลาดระหว่างประมวลผลงานพื้นหลัง กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากยังไม่สำเร็จ";
}

/** สร้าง worker id สั้นๆ ไม่ซ้ำต่อการรัน worker หนึ่งครั้ง — ใช้ระบุเจ้าของ lease */
export function generateWorkerId(): string {
  return `worker-${crypto.randomUUID().slice(0, 8)}`;
}

export const JOB_TYPES: BackgroundJobTypeRow[] = [
  "pdf_text_extraction",
  "file_security_rescan",
  "access_expiration",
  "category_notification",
  "duplicate_scan",
  "ocr_processing",
  "bulk_enqueue",
  "maintenance_cleanup",
  "ocr_test_run",
];

export const JOB_STATUSES: BackgroundJobStatusRow[] = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
];
