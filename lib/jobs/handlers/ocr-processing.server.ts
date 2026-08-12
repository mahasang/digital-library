import "server-only";
import { processResearchDocumentOcr, pollResearchDocumentOcr } from "@/lib/ocr/process-ocr.server";
import {
  completeBackgroundJob,
  failBackgroundJob,
  requeueJob,
  updateJobPageProgress,
  toSafeJobErrorMessage,
} from "@/lib/jobs/queue.server";
import { OCR_POLL_DELAY_MS } from "@/lib/ocr/ocr-provider.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `ocr_processing` — ตั้งแต่ช่วงที่ 29 อาจต้องทำงานหลายรอบถ้า
 * provider เป็นแบบ async (submit + poll): รอบแรกไม่มี `external_job_id` ใน
 * payload เลย ไปเรียก processResearchDocumentOcr() (submit ใหม่) รอบถัดๆ ไปมี
 * `external_job_id` แล้วไปเรียก pollResearchDocumentOcr() แทน (ไม่ submit ซ้ำ)
 * ผลลัพธ์ "processing" ทำให้ job นี้ requeue ตัวเอง (เก็บ external_job_id ไว้ใน
 * payload ก่อน) แบบเดียวกับ handleBulkEnqueueJob (ช่วงที่ 28/25) — ผลลัพธ์
 * "completed"/"failed"/"blocked" คือจบงานนี้จริง
 *
 * provider แบบ `"http"` (synchronous) ไม่เคยคืน "processing" เลย จึงจบในรอบ
 * เดียวเสมอเหมือนเดิมทุกประการ — โค้ดนี้ไม่ได้เปลี่ยนพฤติกรรมของ provider เดิม
 */
export async function handleOcrProcessingJob(job: BackgroundJobRow): Promise<boolean> {
  const researchItemId = String(job.payload.research_item_id ?? "");
  const pdfPath = String(job.payload.pdf_path ?? "");
  const externalJobId = typeof job.payload.external_job_id === "string" ? job.payload.external_job_id : null;

  if (!researchItemId || !pdfPath) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (research_item_id/pdf_path)");
    return false;
  }

  try {
    const outcome = externalJobId
      ? await pollResearchDocumentOcr(researchItemId, externalJobId)
      : await processResearchDocumentOcr(researchItemId, pdfPath);

    if (outcome.status === "processing") {
      const { currentPage, totalPages } = outcome;
      const progressPercent =
        currentPage !== null && totalPages && totalPages > 0
          ? Math.round((currentPage / totalPages) * 100)
          : null;

      await updateJobPageProgress(job.id, {
        currentPage,
        totalPages,
        progressPercent,
        progressMessage: currentPage === null ? "กำลังประมวลผลโดย OCR provider" : null,
        payload: { ...job.payload, external_job_id: outcome.externalJobId },
      });
      await requeueJob(job.id, new Date(Date.now() + OCR_POLL_DELAY_MS));
      return true;
    }

    if (outcome.status === "completed") {
      await completeBackgroundJob(job.id);
      return true;
    }

    // failed หรือ blocked — ทั้งคู่จบที่สถานะ job แบบ failed เหมือนกัน (ต่างกัน
    // แค่ label ระดับ research_document_texts.ocr_status สำหรับความชัดเจนของ
    // เจ้าหน้าที่ ดู migration 20260818100000)
    await failBackgroundJob(job.id, outcome.errorMessage);
    return false;
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "handleOcrProcessingJob"));
    return false;
  }
}
