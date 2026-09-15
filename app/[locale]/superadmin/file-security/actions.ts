"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { enqueueBackgroundJob, retryFailedJob } from "@/lib/jobs/queue.server";
import { createBulkJobBatch } from "@/lib/jobs/bulk-batch.server";
import { getFileSecurityCandidatesCount } from "@/lib/data/file-security-candidates.server";
import { logAudit } from "@/lib/data/audit.server";
import { fileSecurityBulkFilterSchema } from "@/lib/validation/bulk-filters";
import {
  pauseJobBatch,
  resumeJobBatch,
  cancelJobBatch,
  retryFailedInBatch,
} from "@/lib/jobs/batch-control.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * สั่งสแกนความปลอดภัยไฟล์ PDF เดิมซ้ำเป็นชุด — enqueue job
 * `file_security_rescan` ให้ทุกรายการที่เลือก ไม่ลบ/ปิดการเข้าถึงไฟล์ที่กำลัง
 * ใช้งานอยู่ทันที (ผลสแกนจะอัปเดตทีหลังเมื่อ job ทำงานจริงเท่านั้น — ไฟล์ที่
 * เผยแพร่อยู่แล้วยังใช้งานได้ปกติระหว่างรอคิว) หากพบว่าไม่ปลอดภัยจริง
 * close_access_on_scan_failure() (migration 20260810100000) จะปิดการเข้าถึง
 * อัตโนมัติตอนนั้น ไม่ใช่ตอน enqueue
 *
 * **ช่วงที่ 28**: เปลี่ยนมาใช้ requireMinRank(50) แทนการตรวจ rank ด้วยมือ —
 * ให้ผลเหมือนเดิมทุกประการ (rank >= 50) แต่ได้ตรวจ MFA (aal2) เพิ่มเป็น
 * defense-in-depth เหมือนหน้า Super Admin อื่นที่ใช้ helper นี้อยู่แล้ว (เดิม
 * หน้านี้เป็นจุดเดียวที่ตรวจ rank ด้วยมือแทน ไม่ได้ตรวจ MFA ชั้นนี้)
 */
export async function bulkEnqueueFileRescanAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tFileSecurity = await getTranslations("actionMessages.superadmin.fileSecurity");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const supabase = await createClient();

  const selectedIds = formData.getAll("selectedIds").map(String).filter(Boolean);
  if (selectedIds.length === 0) {
    return { status: "error", message: t("selectAtLeastOne") };
  }

  const batchSize = Math.min(200, Math.max(1, Number(formData.get("batchSize")) || 50));
  const targetIds = selectedIds.slice(0, batchSize);

  const { data: items, error } = await supabase
    .from("research_items")
    .select("id, pdf_file")
    .in("id", targetIds);

  if (error || !items) {
    return { status: "error", message: t("fetchSelectedResearchFailed") };
  }

  const batchId = crypto.randomUUID();
  let queued = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.pdf_file) continue;
    const result = await enqueueBackgroundJob({
      jobType: "file_security_rescan",
      payload: { research_item_id: item.id, pdf_path: item.pdf_file },
      idempotencyKey: `file_security_rescan:${item.id}`,
      entityType: "research_items",
      entityId: item.id,
      batchId,
      createdBy: auth.userId,
    });
    if (result.ok && !result.alreadyQueued) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "file_security_bulk_rescan",
    entityType: "background_jobs",
    metadata: { batchId, requested: targetIds.length, queued, skipped },
  });

  revalidatePath("/superadmin/file-security");

  return {
    status: "success",
    message:
      tFileSecurity("bulkCreated", { queued, skipped }) +
      (selectedIds.length > targetIds.length
        ? t("bulkOverLimitSuffix", { selected: selectedIds.length, target: targetIds.length })
        : ""),
  };
}

/** สั่งสแกน "ทั้งหมดที่ตรงตัวกรอง" ไม่จำกัดแค่ 500 รายการที่แสดงในหน้าเว็บ — ดู
 * bulkEnqueueAllMatchingFilterAction ใน app/superadmin/pdf-processing/actions.ts
 * สำหรับคำอธิบายกลไกแบบเต็ม (ใช้ createBulkJobBatch เดียวกัน) — เพิ่มตัวกรอง
 * fileKind/createdAfter/createdBefore/neverScannedOnly ใหม่ (ช่วงที่ 28) */
export async function bulkEnqueueAllMatchingFilterAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tFileSecurity = await getTranslations("actionMessages.superadmin.fileSecurity");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const supabase = await createClient();

  const batchSize = Math.min(500, Math.max(1, Number(formData.get("batchSize")) || 100));

  const raw: Record<string, unknown> = {};
  const scanStatus = formData.get("scanStatus");
  const fileKind = formData.get("fileKind");
  const createdAfter = formData.get("createdAfter");
  const createdBefore = formData.get("createdBefore");
  if (scanStatus) raw.scanStatus = String(scanStatus);
  if (fileKind) raw.fileKind = String(fileKind);
  if (createdAfter) raw.createdAfter = new Date(String(createdAfter)).toISOString();
  if (createdBefore) raw.createdBefore = new Date(String(createdBefore)).toISOString();
  if (formData.get("neverScannedOnly") === "true") raw.neverScannedOnly = true;

  const parsed = fileSecurityBulkFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: t("invalidFilter") };
  }
  const filter = parsed.data;

  const totalItems = await getFileSecurityCandidatesCount(filter);
  if (totalItems === null) {
    return { status: "error", message: t("countCandidatesFailed") };
  }
  if (totalItems === 0) {
    return { status: "error", message: t("noMatchingItems") };
  }

  const result = await createBulkJobBatch({
    supabase,
    jobType: "file_security_rescan",
    filterSnapshot: filter,
    totalItems,
    createdBy: auth.userId,
    batchSize,
  });
  if (!result.ok) {
    return { status: "error", message: result.error };
  }
  if (!result.isNew) {
    return { status: "success", message: t("alreadyRunningSameFilter") };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "file_security_bulk_rescan_all",
    entityType: "background_jobs",
    metadata: { batchId: result.batchId, filter, totalItems },
  });

  revalidatePath("/superadmin/file-security");
  return {
    status: "success",
    message: tFileSecurity("bulkAllCreated", { total: totalItems }),
  };
}

export async function retryFailedRescanJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const supabase = await createClient();

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: t("jobNotFound") };

  const result = await retryFailedJob(jobId);
  if (!result.ok) {
    return { status: "error", message: result.error ?? t("retryFailed") };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "file_security_rescan_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/file-security");
  return { status: "success", message: t("requeuedSuccess") };
}

async function batchControlAction(
  formData: FormData,
  fn: (batchId: string) => ReturnType<typeof pauseJobBatch>
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const batchId = String(formData.get("batchId") || "");
  if (!batchId) return { status: "error", message: t("batchIdNotFound") };
  const result = await fn(batchId);
  if (!result.ok) return result.result;
  revalidatePath("/superadmin/file-security");
  return { status: "success", message: t("actionSuccess") };
}

export async function pauseBatchAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  return batchControlAction(formData, pauseJobBatch);
}
export async function resumeBatchAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  return batchControlAction(formData, resumeJobBatch);
}
export async function cancelBatchAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  return batchControlAction(formData, cancelJobBatch);
}
export async function retryFailedInBatchAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const batchId = String(formData.get("batchId") || "");
  if (!batchId) return { status: "error", message: t("batchIdNotFound") };
  const result = await retryFailedInBatch(batchId);
  if (!result.ok) return result.result;
  revalidatePath("/superadmin/file-security");
  return { status: "success", message: t("requeuedFailedSuccess") };
}
