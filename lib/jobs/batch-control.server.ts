import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * ควบคุมวงจรชีวิตของ master job (job_batches) — pause/resume/cancel/
 * retry-failed-in-batch เรียกผ่าน client ของผู้ใช้ที่ล็อกอินอยู่เสมอ (ไม่ใช่
 * Service Role) เพราะฟังก์ชัน SQL ที่เรียก (set_job_batch_status/
 * retry_failed_jobs_in_batch, migration 20260817120000) ตรวจสิทธิ์ภายในด้วย
 * user_max_role_rank() ซึ่งอ่านจาก auth.uid() ของ session ปัจจุบัน — เป็น
 * "RBAC สองชั้น" เดียวกับ merge_authors/acquire_ocr_lock เดิม: requireMinRank(50)
 * ที่นี่เป็นชั้นแรก (ให้ error message ที่เป็นมิตรกว่า), ฟังก์ชัน SQL เป็นชั้นที่
 * สอง (บังคับจริงแม้มีใครเรียกข้ามชั้นแรกมาได้)
 */

async function setStatus(
  batchId: string,
  newStatus: "paused" | "ready" | "cancelled",
  auditAction: string
): Promise<{ ok: true } | { ok: false; result: ActionResult }> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return { ok: false, result: auth.result };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_job_batch_status", {
    p_batch_id: batchId,
    p_new_status: newStatus,
    p_actor_id: auth.userId,
  });

  if (error) {
    return {
      ok: false,
      result: {
        status: "error",
        message: toSafeErrorMessage(error, "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง", "set_job_batch_status"),
      },
    };
  }

  await logAudit(supabase, { actorId: auth.userId, action: auditAction, entityType: "job_batches", entityId: batchId });
  return { ok: true };
}

export async function pauseJobBatch(batchId: string): Promise<{ ok: true } | { ok: false; result: ActionResult }> {
  return setStatus(batchId, "paused", "bulk_batch_pause");
}

export async function resumeJobBatch(batchId: string): Promise<{ ok: true } | { ok: false; result: ActionResult }> {
  return setStatus(batchId, "ready", "bulk_batch_resume");
}

export async function cancelJobBatch(batchId: string): Promise<{ ok: true } | { ok: false; result: ActionResult }> {
  return setStatus(batchId, "cancelled", "bulk_batch_cancel");
}

export async function retryFailedInBatch(batchId: string): Promise<{ ok: true } | { ok: false; result: ActionResult }> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return { ok: false, result: auth.result };

  const supabase = await createClient();
  const { error } = await supabase.rpc("retry_failed_jobs_in_batch", { p_batch_id: batchId });

  if (error) {
    return {
      ok: false,
      result: {
        status: "error",
        message: toSafeErrorMessage(error, "ไม่สามารถลองใหม่ได้ กรุณาลองใหม่อีกครั้ง", "retry_failed_jobs_in_batch"),
      },
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "bulk_batch_retry_failed",
    entityType: "job_batches",
    entityId: batchId,
  });
  return { ok: true };
}
