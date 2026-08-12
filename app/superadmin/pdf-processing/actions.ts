"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoleRank, SUPER_ADMIN_RANK } from "@/lib/supabase/roles";
import { enqueueBackgroundJob, retryFailedJob } from "@/lib/jobs/queue.server";
import { createBulkJobBatch } from "@/lib/jobs/bulk-batch.server";
import { getPdfProcessingCandidatesCount } from "@/lib/data/pdf-processing.server";
import { logAudit } from "@/lib/data/audit.server";
import { checkOcrEligibility, type OcrEligibilityCode } from "@/lib/ocr/ocr-limits.server";
import { OCR_JOB_MAX_ATTEMPTS } from "@/lib/ocr/ocr-provider.server";
import { getSettings } from "@/lib/data/settings.server";
import { ocrBulkFilterSchema } from "@/lib/validation/bulk-filters";
import {
  pauseJobBatch,
  resumeJobBatch,
  cancelJobBatch,
  retryFailedInBatch,
} from "@/lib/jobs/batch-control.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * สั่งประมวลผลข้อความ PDF เป็นชุด — enqueue job `pdf_text_extraction` ให้ทุก
 * รายการที่เลือก (จำกัดจำนวนต่อครั้งด้วย batchSize กันสร้าง job มากเกินไปในครั้ง
 * เดียว) รายการที่มี job active อยู่แล้ว (idempotency key ชนกัน) จะถูกข้ามไป
 * เงียบๆ ไม่ใช่ error — บันทึก Audit Log ครั้งเดียวสรุปทั้ง batch
 */
export async function bulkEnqueuePdfExtractionAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < SUPER_ADMIN_RANK) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็น Super Admin เท่านั้น" };
  }

  const selectedIds = formData.getAll("selectedIds").map(String).filter(Boolean);
  if (selectedIds.length === 0) {
    return { status: "error", message: "กรุณาเลือกอย่างน้อยหนึ่งรายการ" };
  }

  const batchSize = Math.min(200, Math.max(1, Number(formData.get("batchSize")) || 50));
  const targetIds = selectedIds.slice(0, batchSize);

  const { data: items, error } = await supabase
    .from("research_items")
    .select("id, pdf_file")
    .in("id", targetIds);

  if (error || !items) {
    return { status: "error", message: "ไม่สามารถดึงข้อมูลงานวิจัยที่เลือกได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const batchId = crypto.randomUUID();
  let queued = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.pdf_file) continue;
    const result = await enqueueBackgroundJob({
      jobType: "pdf_text_extraction",
      payload: { research_item_id: item.id, pdf_path: item.pdf_file },
      idempotencyKey: `pdf_text_extraction:${item.id}`,
      entityType: "research_items",
      entityId: item.id,
      batchId,
      createdBy: user.id,
    });
    if (result.ok && !result.alreadyQueued) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "pdf_processing_bulk_backfill",
    entityType: "background_jobs",
    metadata: { batchId, requested: targetIds.length, queued, skipped },
  });

  revalidatePath("/superadmin/pdf-processing");

  return {
    status: "success",
    message:
      selectedIds.length > targetIds.length
        ? `สร้างงานประมวลผล ${queued} รายการ (ข้าม ${skipped} รายการที่มีงานค้างอยู่แล้ว) — เลือกไว้ ${selectedIds.length} รายการ เกินขนาด batch จึงทำเฉพาะ ${targetIds.length} รายการแรก กดอีกครั้งเพื่อทำส่วนที่เหลือ`
        : `สร้างงานประมวลผล ${queued} รายการ (ข้าม ${skipped} รายการที่มีงานค้างอยู่แล้ว)`,
  };
}

/**
 * สั่ง OCR เป็นชุด — enqueue job `ocr_processing` ให้ทุกรายการที่เลือก โครงสร้าง
 * เดียวกับ bulkEnqueuePdfExtractionAction ทุกประการ (idempotency, batch size,
 * audit log) — ใช้กับรายการที่ extraction_status = no_text_found เท่านั้น (หน้า
 * เว็บกรองให้แล้ว แต่ตรวจซ้ำที่นี่ไม่ได้เพราะไม่รู้สถานะปัจจุบันจริงจนกว่าจะ
 * query — ปล่อยให้ enqueue ได้เสมอ ถ้าไม่ใช่เอกสารสแกนจริง OCR ก็แค่ไม่พบ
 * ข้อความเพิ่มเติม ไม่ก่อความเสียหายอะไร)
 */
export async function bulkEnqueueOcrAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < SUPER_ADMIN_RANK) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็น Super Admin เท่านั้น" };
  }

  const selectedIds = formData.getAll("selectedIds").map(String).filter(Boolean);
  if (selectedIds.length === 0) {
    return { status: "error", message: "กรุณาเลือกอย่างน้อยหนึ่งรายการ" };
  }

  const batchSize = Math.min(200, Math.max(1, Number(formData.get("batchSize")) || 50));
  const targetIds = selectedIds.slice(0, batchSize);

  const { data: items, error } = await supabase
    .from("research_items")
    .select("id, pdf_file, access_level, page_count")
    .in("id", targetIds);

  if (error || !items) {
    return { status: "error", message: "ไม่สามารถดึงข้อมูลงานวิจัยที่เลือกได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const batchId = crypto.randomUUID();
  let queued = 0;
  let skipped = 0;
  let rejectedByLimits = 0;
  const rejectedByCode: Partial<Record<OcrEligibilityCode, number>> = {};
  const settings = await getSettings();

  for (const item of items) {
    if (!item.pdf_file) continue;

    const eligibility = await checkOcrEligibility({
      researchItemId: item.id,
      pdfPath: item.pdf_file,
      accessLevel: item.access_level,
      pageCount: item.page_count,
      actorUserId: user.id,
      settings,
    });
    if (!eligibility.ok) {
      rejectedByLimits += 1;
      rejectedByCode[eligibility.code] = (rejectedByCode[eligibility.code] ?? 0) + 1;
      continue;
    }

    const result = await enqueueBackgroundJob({
      jobType: "ocr_processing",
      payload: { research_item_id: item.id, pdf_path: item.pdf_file },
      idempotencyKey: `ocr_processing:${item.id}`,
      entityType: "research_items",
      entityId: item.id,
      batchId,
      createdBy: user.id,
      maxAttempts: OCR_JOB_MAX_ATTEMPTS,
    });
    if (result.ok && !result.alreadyQueued) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "ocr_bulk_process",
    entityType: "background_jobs",
    metadata: { batchId, requested: targetIds.length, queued, skipped, rejectedByLimits, rejectedByCode },
  });

  revalidatePath("/superadmin/pdf-processing");

  const limitNote = rejectedByLimits > 0 ? ` — ปฏิเสธ ${rejectedByLimits} รายการเพราะเกินขีดจำกัด OCR` : "";

  return {
    status: "success",
    message:
      selectedIds.length > targetIds.length
        ? `สร้างงาน OCR ${queued} รายการ (ข้าม ${skipped} รายการที่มีงานค้างอยู่แล้ว)${limitNote} — เลือกไว้ ${selectedIds.length} รายการ เกินขนาด batch จึงทำเฉพาะ ${targetIds.length} รายการแรก กดอีกครั้งเพื่อทำส่วนที่เหลือ`
        : `สร้างงาน OCR ${queued} รายการ (ข้าม ${skipped} รายการที่มีงานค้างอยู่แล้ว)${limitNote}`,
  };
}

export async function retryFailedOcrJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < SUPER_ADMIN_RANK) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้" };
  }

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: "ไม่พบรหัสงาน" };

  const result = await retryFailedJob(jobId);
  if (!result.ok) {
    return { status: "error", message: result.error ?? "ลองใหม่ไม่สำเร็จ" };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "ocr_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/pdf-processing");
  return { status: "success", message: "ส่งกลับเข้าคิวเรียบร้อยแล้ว" };
}

/** อ่านฟิลด์ตัวกรองร่วมจาก FormData แล้วตรวจสอบด้วย ocrBulkFilterSchema
 * (.strict() ปฏิเสธ field แปลกปลอม) — ใช้ทั้งโหมด extract (ocrStatus จะเป็น
 * undefined เสมอ) และโหมด ocr */
function parseBulkFilterFromForm(formData: FormData) {
  const raw: Record<string, unknown> = {};
  const extractionState = formData.get("extractionState");
  const ocrStatus = formData.get("ocrStatus");
  const year = formData.get("year");
  const categoryId = formData.get("categoryId");
  const publishStatus = formData.get("publishStatus");
  if (extractionState) raw.extractionState = String(extractionState);
  if (ocrStatus) raw.ocrStatus = String(ocrStatus);
  if (year) raw.year = Number(year);
  if (categoryId) raw.categoryId = String(categoryId);
  if (publishStatus) raw.publishStatus = String(publishStatus);
  return ocrBulkFilterSchema.safeParse(raw);
}

/**
 * สั่งประมวลผล "ทั้งหมดที่ตรงตัวกรอง" ไม่จำกัดแค่ 500 รายการที่แสดงในหน้าเว็บ —
 * ต่างจาก bulkEnqueuePdfExtractionAction/bulkEnqueueOcrAction เดิมตรงที่ไม่รับ
 * รายการ id ที่เลือกไว้ แต่สร้าง background job coordinator (bulk_enqueue) ที่
 * ทยอยหารายการเองทีละ chunk แทน (ดู lib/jobs/handlers/bulk-enqueue.server.ts)
 * — รองรับทุกตัวกรองแล้ว (ช่วงที่ 28 เปลี่ยนไปนับ/แบ่งหน้าผ่าน SQL function
 * ที่ join ในฐานข้อมูลแทน PostgREST query builder เดิมที่ทำ join แบบนี้ไม่ได้)
 */
export async function bulkEnqueueAllMatchingFilterAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < SUPER_ADMIN_RANK) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็น Super Admin เท่านั้น" };
  }

  const mode = formData.get("mode") === "ocr" ? "ocr" : "extract";
  const jobType = mode === "ocr" ? "ocr_processing" : "pdf_text_extraction";
  const batchSize = Math.min(500, Math.max(1, Number(formData.get("batchSize")) || 100));

  const parsedFilter = parseBulkFilterFromForm(formData);
  if (!parsedFilter.success) {
    return { status: "error", message: "ตัวกรองไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
  }
  // โหมด extract ไม่ควรกรองด้วย ocrStatus แม้ฟอร์มจะส่งมาก็ตาม (มิติของ OCR
  // เท่านั้น) — ตัดทิ้งเสมอเมื่อไม่ใช่โหมด ocr
  const filter = mode === "ocr" ? parsedFilter.data : { ...parsedFilter.data, ocrStatus: undefined };

  const totalItems = await getPdfProcessingCandidatesCount(filter);
  if (totalItems === null) {
    return { status: "error", message: "ไม่สามารถตรวจสอบจำนวนรายการได้ กรุณาลองใหม่อีกครั้ง" };
  }
  if (totalItems === 0) {
    return { status: "error", message: "ไม่พบรายการที่ตรงตัวกรองนี้" };
  }

  const result = await createBulkJobBatch({
    supabase,
    jobType,
    filterSnapshot: filter,
    totalItems,
    createdBy: user.id,
    batchSize,
  });
  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  if (!result.isNew) {
    return { status: "success", message: "งานนี้กำลังทำงานอยู่แล้วสำหรับตัวกรองเดียวกัน — ดูความคืบหน้าด้านล่าง" };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: mode === "ocr" ? "ocr_bulk_process_all" : "pdf_processing_bulk_backfill_all",
    entityType: "background_jobs",
    metadata: { batchId: result.batchId, filter, totalItems },
  });

  revalidatePath("/superadmin/pdf-processing");
  return {
    status: "success",
    message: `เริ่มสร้างงานสำหรับ ${totalItems} รายการแล้ว (ทยอยสร้างเป็นชุด ดูความคืบหน้าด้านล่าง)`,
  };
}

export async function retryFailedPdfJobAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < SUPER_ADMIN_RANK) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้" };
  }

  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return { status: "error", message: "ไม่พบรหัสงาน" };

  const result = await retryFailedJob(jobId);
  if (!result.ok) {
    return { status: "error", message: result.error ?? "ลองใหม่ไม่สำเร็จ" };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "pdf_processing_retry",
    entityType: "background_jobs",
    entityId: jobId,
  });

  revalidatePath("/superadmin/pdf-processing");
  return { status: "success", message: "ส่งกลับเข้าคิวเรียบร้อยแล้ว" };
}

async function batchControlAction(
  formData: FormData,
  fn: (batchId: string) => ReturnType<typeof pauseJobBatch>
): Promise<ActionResult> {
  const batchId = String(formData.get("batchId") || "");
  if (!batchId) return { status: "error", message: "ไม่พบรหัสชุดงาน" };
  const result = await fn(batchId);
  if (!result.ok) return result.result;
  revalidatePath("/superadmin/pdf-processing");
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
  const batchId = String(formData.get("batchId") || "");
  if (!batchId) return { status: "error", message: "ไม่พบรหัสชุดงาน" };
  const result = await retryFailedInBatch(batchId);
  if (!result.ok) return result.result;
  revalidatePath("/superadmin/pdf-processing");
  return { status: "success", message: "ส่งรายการที่ล้มเหลวกลับเข้าคิวแล้ว" };
}
