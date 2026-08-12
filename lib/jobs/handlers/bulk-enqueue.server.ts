import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  enqueueBackgroundJob,
  completeBackgroundJob,
  failBackgroundJob,
  requeueJob,
  toSafeJobErrorMessage,
} from "@/lib/jobs/queue.server";
import { getPdfProcessingCandidatesPage, type CandidatesPageCursor } from "@/lib/data/pdf-processing.server";
import { getFileSecurityCandidatesPage } from "@/lib/data/file-security-candidates.server";
import { getDuplicateScanCandidatesPage } from "@/lib/data/duplicate-scan-candidates.server";
import { checkOcrEligibility, type OcrEligibilityCode } from "@/lib/ocr/ocr-limits.server";
import { OCR_JOB_MAX_ATTEMPTS } from "@/lib/ocr/ocr-provider.server";
import { getSettings } from "@/lib/data/settings.server";
import { logAudit } from "@/lib/data/audit.server";
import type {
  OcrBulkFilter,
  FileSecurityBulkFilter,
  DuplicateScanBulkFilter,
} from "@/lib/validation/bulk-filters";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

const REQUEUE_DELAY_MS = 2000;
/** ระยะเวลาระหว่างการตรวจสถานะซ้ำตอนถูก pause — ยาวกว่า REQUEUE_DELAY_MS ปกติ
 * มากเพราะไม่มีอะไรต้องทำระหว่างที่ยัง paused อยู่ (แค่รอให้สถานะเปลี่ยนกลับ
 * เป็น enqueueing/ready) requeue ถี่เท่า REQUEUE_DELAY_MS จะเปลืองโดยเปล่า
 * ประโยชน์ */
const PAUSED_RECHECK_DELAY_MS = 30_000;

/**
 * Handler ของ job ประเภท `bulk_enqueue` — coordinator ที่ทยอยสร้าง job ลูกทีละ
 * chunk (ขนาดจาก batch.batch_size — ปรับได้ต่อคำขอ ค่าเริ่มต้นจาก
 * job_type_settings.default_batch_size, ช่วงที่ 28) จากรายการที่ตรงตัวกรอง
 * ของคำขอ "ประมวลผลทั้งหมดตามตัวกรอง" แทนที่จะสร้างทั้งหมดในคำขอเดียว — ทำงาน
 * เป็นรอบๆ ด้วยตัวเอง: สร้าง chunk นี้เสร็จแล้ว requeue ตัวเองให้ worker รอบถัดไป
 * ทำ chunk ต่อไป จนกว่า cursor จะครบ
 *
 * **ไม่โหลดรายการทั้งหมดเข้าหน่วยความจำในคำขอเดียว** — แต่ละรอบดึงมาแค่
 * batch_size แถวผ่าน getXxxCandidatesPage() ที่ paginate ด้วย keyset cursor
 * (กรอง/join ทั้งหมดทำในฐานข้อมูลผ่าน RPC แล้วตั้งแต่ช่วงที่ 28 ไม่มี JS-side
 * join เหลืออยู่เลย)
 *
 * **Resume อัตโนมัติ**: ถ้า worker ตายกลางคัน หลัง requeueJob() ไม่ทันรัน lease
 * 10 นาทีเดิมของ claim_background_jobs จะหมดอายุแล้วมี worker รอบถัดไปหยิบ job
 * นี้กลับมาทำต่อเองโดยอัตโนมัติ — เพราะ cursor ถูก commit ลง job_batches แล้ว
 * ตั้งแต่ก่อนหน้า (อัปเดตทันทีหลัง enqueue แต่ละ chunk เสร็จ ไม่ใช่ตอนจบงาน
 * ทั้งหมด) จึงไม่มีทางสร้าง job ซ้ำจากจุดเริ่มต้นใหม่
 *
 * **Pause**: ตรวจ batch.status === 'paused' ที่ต้นทุกรอบเหมือนกับ 'cancelled'
 * เดิม — ถ้าถูก pause จะ requeue ตัวเองให้ตรวจใหม่อีกครั้งโดยไม่แตะ cursor/ไม่
 * enqueue อะไรเลย (idle-poll) resume แค่เปลี่ยนสถานะกลับผ่าน set_job_batch_status()
 * ไม่ต้องสร้าง coordinator job ใหม่
 *
 * **Cancel**: ตรวจ batch.status === 'cancelled' แล้วหยุดทำงานทันที (งานลูกที่
 * สร้างไปแล้วไม่ถูกแตะ — ถูกยกเลิกแยกต่างหากโดย set_job_batch_status() เอง
 * เฉพาะที่ยัง pending)
 */
export async function handleBulkEnqueueJob(job: BackgroundJobRow): Promise<boolean> {
  const jobBatchesId = String(job.payload.job_batches_id ?? "");
  if (!jobBatchesId) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (job_batches_id)");
    return false;
  }

  const service = createServiceRoleClient();

  try {
    const { data: batch, error: batchError } = await service
      .from("job_batches")
      .select(
        "id, job_type, filter_snapshot, enqueued_items, batch_size, started_at, cursor_after_id, cursor_after_updated_at, status, created_by"
      )
      .eq("id", jobBatchesId)
      .maybeSingle();

    if (batchError || !batch) {
      await failBackgroundJob(job.id, "ไม่พบข้อมูลชุดงานที่จะสร้าง (job_batches)");
      return false;
    }

    if (batch.status === "cancelled") {
      await completeBackgroundJob(job.id);
      return true;
    }

    if (batch.status === "paused") {
      await requeueJob(job.id, new Date(Date.now() + PAUSED_RECHECK_DELAY_MS));
      return true;
    }

    if (!batch.started_at) {
      await service.from("job_batches").update({ started_at: new Date().toISOString() }).eq("id", jobBatchesId);
    }

    const chunkSize = batch.batch_size;
    const cursor: CandidatesPageCursor | null =
      batch.cursor_after_id && batch.cursor_after_updated_at
        ? { id: batch.cursor_after_id, updatedAt: batch.cursor_after_updated_at }
        : null;

    const targetJobType = batch.job_type as BackgroundJobTypeRow;
    const filter = (batch.filter_snapshot ?? {}) as Record<string, unknown>;

    let items: Array<{ id: string; pdfFile?: string | null; accessLevel?: string; pageCount?: number }> = [];
    let rawScanned = 0;
    let nextCursor: CandidatesPageCursor | null = null;

    if (targetJobType === "pdf_text_extraction" || targetJobType === "ocr_processing") {
      const page = await getPdfProcessingCandidatesPage(filter as OcrBulkFilter, cursor, chunkSize);
      items = page.items.map((c) => ({
        id: c.id,
        pdfFile: c.pdfFile,
        accessLevel: c.accessLevel,
        pageCount: c.pageCount,
      }));
      rawScanned = page.rawScanned;
      nextCursor = page.nextCursor;
    } else if (targetJobType === "file_security_rescan") {
      const page = await getFileSecurityCandidatesPage(filter as FileSecurityBulkFilter, cursor, chunkSize);
      items = page.items.map((c) => ({ id: c.id, pdfFile: c.pdfFile }));
      rawScanned = page.rawScanned;
      nextCursor = page.nextCursor;
    } else if (targetJobType === "duplicate_scan") {
      const page = await getDuplicateScanCandidatesPage(filter as DuplicateScanBulkFilter, cursor, chunkSize);
      items = page.items.map((c) => ({ id: c.id }));
      rawScanned = page.rawScanned;
      nextCursor = page.nextCursor;
    } else {
      await failBackgroundJob(job.id, `ไม่รองรับการประมวลผลเป็นชุดสำหรับประเภทงาน: ${targetJobType}`);
      return false;
    }

    let enqueuedThisChunk = 0;
    let skippedThisChunk = 0;
    const rejectedByCode: Partial<Record<OcrEligibilityCode, number>> = {};
    const ocrSettings = targetJobType === "ocr_processing" ? await getSettings() : null;

    for (const item of items) {
      if (targetJobType === "ocr_processing" && item.pdfFile && ocrSettings) {
        const eligibility = await checkOcrEligibility({
          researchItemId: item.id,
          pdfPath: item.pdfFile,
          accessLevel: item.accessLevel ?? "public",
          pageCount: item.pageCount ?? 0,
          actorUserId: batch.created_by ?? "",
          settings: ocrSettings,
        });
        if (!eligibility.ok) {
          skippedThisChunk += 1;
          rejectedByCode[eligibility.code] = (rejectedByCode[eligibility.code] ?? 0) + 1;
          continue;
        }
      }

      const idempotencyKey = `${targetJobType}:${item.id}`;
      const payload: Record<string, unknown> =
        targetJobType === "duplicate_scan"
          ? { research_item_id: item.id }
          : { research_item_id: item.id, pdf_path: item.pdfFile };

      const result = await enqueueBackgroundJob({
        jobType: targetJobType,
        payload,
        idempotencyKey,
        entityType: "research_items",
        entityId: item.id,
        batchId: jobBatchesId,
        ...(targetJobType === "ocr_processing" ? { maxAttempts: OCR_JOB_MAX_ATTEMPTS } : {}),
      });
      if (result.ok && !result.alreadyQueued) {
        enqueuedThisChunk += 1;
      }
    }

    if (skippedThisChunk > 0 && batch.created_by) {
      await logAudit(service, {
        actorId: batch.created_by,
        action: "ocr_bulk_rejected_by_limits",
        entityType: "background_jobs",
        metadata: { batchId: jobBatchesId, skippedThisChunk, rejectedByCode },
      });
    }

    const isDone = nextCursor === null;

    // อ่าน skipped_items ปัจจุบันมาบวกเพิ่ม (ไม่มี atomic increment ผ่าน
    // PostgREST .update() ตรงๆ) — ปลอดภัยเพราะ coordinator ของ batch เดียวกัน
    // รันทีละ 1 อินสแตนซ์เสมอ (idempotency key ของงาน bulk_enqueue เองกันซ้อน
    // กันอยู่แล้ว ไม่มีทางมีสองอินสแตนซ์อัปเดตแถวเดียวกันพร้อมกัน)
    const { data: currentBatch } = await service
      .from("job_batches")
      .select("skipped_items")
      .eq("id", jobBatchesId)
      .maybeSingle();

    await service
      .from("job_batches")
      .update({
        enqueued_items: batch.enqueued_items + enqueuedThisChunk,
        skipped_items: (currentBatch?.skipped_items ?? 0) + skippedThisChunk,
        cursor_after_id: nextCursor?.id ?? null,
        cursor_after_updated_at: nextCursor?.updatedAt ?? null,
        status: isDone ? "ready" : "enqueueing",
      })
      .eq("id", jobBatchesId);

    if (isDone || rawScanned === 0) {
      // rawScanned===0 แต่ nextCursor ไม่ null ไม่ควรเกิดขึ้นจริง — กันไว้เผื่อ
      // edge case เพื่อไม่ให้ loop ค้างไปเรื่อยๆ โดยไม่มีความคืบหน้า
      await completeBackgroundJob(job.id);
      if (isDone) {
        await service.rpc("finalize_job_batch_if_drained", { p_batch_id: jobBatchesId });
      }
      return true;
    }

    await requeueJob(job.id, new Date(Date.now() + REQUEUE_DELAY_MS));
    return true;
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "handleBulkEnqueueJob"));
    return false;
  }
}
