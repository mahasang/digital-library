"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { enqueueBackgroundJob, retryFailedJob } from "@/lib/jobs/queue.server";
import { createBulkJobBatch } from "@/lib/jobs/bulk-batch.server";
import { getDuplicateScanCandidatesCount } from "@/lib/data/duplicate-scan-candidates.server";
import { logAudit } from "@/lib/data/audit.server";
import { duplicateScanBulkFilterSchema } from "@/lib/validation/bulk-filters";
import {
  pauseJobBatch,
  resumeJobBatch,
  cancelJobBatch,
  retryFailedInBatch,
} from "@/lib/jobs/batch-control.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * ตรวจสอบงานวิจัยซ้ำย้อนหลังเป็นชุด — enqueue job `duplicate_scan` ให้ทุก
 * รายการที่เลือก (จำกัดจำนวนต่อครั้งด้วย batchSize) **ไม่มีการรวมข้อมูล
 * (merge) อัตโนมัติเลย** เป็นแค่การตรวจสอบ+บันทึกคู่ที่น่าสงสัยเหมือนตอนส่ง/
 * แก้ไขงานวิจัยทุกประการ — รายการที่มี job active อยู่แล้วถูกข้ามเงียบๆ
 */
export async function bulkEnqueueDuplicateScanAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const selectedIds = formData.getAll("selectedIds").map(String).filter(Boolean);
  if (selectedIds.length === 0) {
    return { status: "error", message: "กรุณาเลือกอย่างน้อยหนึ่งรายการ" };
  }

  const batchSize = Math.min(200, Math.max(1, Number(formData.get("batchSize")) || 50));
  const targetIds = selectedIds.slice(0, batchSize);

  const batchId = crypto.randomUUID();
  let queued = 0;
  let skipped = 0;

  for (const researchItemId of targetIds) {
    const result = await enqueueBackgroundJob({
      jobType: "duplicate_scan",
      payload: { research_item_id: researchItemId },
      idempotencyKey: `duplicate_scan:${researchItemId}`,
      entityType: "research_items",
      entityId: researchItemId,
      batchId,
      createdBy: auth.userId,
    });
    if (result.ok && !result.alreadyQueued) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId: auth.userId,
    action: "duplicate_scan_bulk",
    entityType: "background_jobs",
    metadata: { batchId, requested: targetIds.length, queued, skipped },
  });

  revalidatePath("/superadmin/data-quality");

  return {
    status: "success",
    message:
      selectedIds.length > targetIds.length
        ? `สร้างงานตรวจสอบ ${queued} รายการ (ข้าม ${skipped} รายการที่มีงานค้างอยู่แล้ว) — เลือกไว้ ${selectedIds.length} รายการ เกินขนาด batch จึงทำเฉพาะ ${targetIds.length} รายการแรก กดอีกครั้งเพื่อทำส่วนที่เหลือ`
        : `สร้างงานตรวจสอบ ${queued} รายการ (ข้าม ${skipped} รายการที่มีงานค้างอยู่แล้ว)`,
  };
}

/** ตรวจสอบ "ทั้งหมดที่ตรงตัวกรอง" ไม่จำกัดแค่ 500 รายการที่แสดงในหน้าเว็บ — ดู
 * bulkEnqueueAllMatchingFilterAction ใน app/superadmin/pdf-processing/actions.ts
 * สำหรับคำอธิบายกลไกแบบเต็ม **รองรับตัวกรองหมวดหมู่ (categoryId) แล้ว** (ช่วงที่
 * 28 เปลี่ยนไปนับ/แบ่งหน้าผ่าน count_duplicate_scan_candidates()/
 * page_duplicate_scan_candidates() ที่ join ในฐานข้อมูลแทน) และเพิ่ม
 * neverScannedOnly ใหม่
 */
export async function bulkEnqueueAllMatchingFilterAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const batchSize = Math.min(500, Math.max(1, Number(formData.get("batchSize")) || 100));

  const raw: Record<string, unknown> = {};
  const year = formData.get("year");
  const categoryId = formData.get("categoryId");
  const status = formData.get("status");
  const neverScannedOnly = formData.get("neverScannedOnly");
  if (year) raw.year = Number(year);
  if (categoryId) raw.categoryId = String(categoryId);
  if (status) raw.status = String(status);
  if (neverScannedOnly === "true") raw.neverScannedOnly = true;
  if (formData.get("recentlyEditedOnly") === "true") {
    raw.editedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const parsed = duplicateScanBulkFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "ตัวกรองไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
  }
  const filters = parsed.data;

  const totalItems = await getDuplicateScanCandidatesCount(filters);
  if (totalItems === null) {
    return { status: "error", message: "ไม่สามารถนับจำนวนรายการได้ กรุณาลองใหม่อีกครั้ง" };
  }
  if (totalItems === 0) {
    return { status: "error", message: "ไม่พบรายการที่ตรงตัวกรองนี้" };
  }

  const supabase = await createClient();
  const result = await createBulkJobBatch({
    supabase,
    jobType: "duplicate_scan",
    filterSnapshot: filters,
    totalItems,
    createdBy: auth.userId,
    batchSize,
  });
  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (!result.isNew) {
    return { status: "success", message: "งานนี้กำลังทำงานอยู่แล้วสำหรับตัวกรองเดียวกัน — ดูความคืบหน้าด้านล่าง" };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "duplicate_scan_bulk_all",
    entityType: "background_jobs",
    metadata: { batchId: result.batchId, filters, totalItems },
  });

  revalidatePath("/superadmin/data-quality");
  return {
    status: "success",
    message: `เริ่มสร้างงานตรวจสอบสำหรับ ${totalItems} รายการแล้ว (ทยอยสร้างเป็นชุด ดูความคืบหน้าด้านล่าง)`,
  };
}

async function batchControlAction(
  formData: FormData,
  fn: (batchId: string) => ReturnType<typeof pauseJobBatch>
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const batchId = String(formData.get("batchId") || "");
  if (!batchId) return { status: "error", message: "ไม่พบรหัสชุดงาน" };
  const result = await fn(batchId);
  if (!result.ok) return result.result;
  revalidatePath("/superadmin/data-quality");
  return { status: "success", message: "ดำเนินการเรียบร้อยแล้ว" };
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
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;
  const batchId = String(formData.get("batchId") || "");
  if (!batchId) return { status: "error", message: "ไม่พบรหัสชุดงาน" };
  const result = await retryFailedInBatch(batchId);
  if (!result.ok) return result.result;
  revalidatePath("/superadmin/data-quality");
  return { status: "success", message: "ส่งรายการที่ล้มเหลวกลับเข้าคิวแล้ว" };
}

export async function retryFailedDuplicateScanJobAction(
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
    action: "duplicate_scan_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/data-quality");
  return { status: "success", message: "ส่งกลับเข้าคิวเรียบร้อยแล้ว" };
}
