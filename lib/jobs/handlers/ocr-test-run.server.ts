import "server-only";
import { submitOcrTestRun, pollOcrTestRun } from "@/lib/ocr/process-ocr-test.server";
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
 * Handler ของ job `ocr_test_run` (ช่วงที่ 32, Controlled OCR Test) — โครงสร้าง
 * เดียวกับ handleOcrProcessingJob() ทุกประการ (submit ใหม่/poll ต่อ,
 * requeue ตัวเองเมื่อ "processing") ต่างกันแค่เขียนผลลง ocr_test_runs แทน
 * research_document_texts ผ่าน lib/ocr/process-ocr-test.server.ts
 */
export async function handleOcrTestRunJob(job: BackgroundJobRow): Promise<boolean> {
  const testRunId = String(job.payload.ocr_test_run_id ?? "");
  const fixtureName = String(job.payload.fixture_name ?? "");
  const externalJobId = typeof job.payload.external_job_id === "string" ? job.payload.external_job_id : null;

  if (!testRunId || !fixtureName) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (ocr_test_run_id/fixture_name)");
    return false;
  }

  try {
    const outcome = externalJobId
      ? await pollOcrTestRun(testRunId, externalJobId)
      : await submitOcrTestRun(testRunId, fixtureName);

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

    // failed หรือ blocked — ทั้งคู่จบที่สถานะ job แบบ failed เหมือนกัน (เหมือน
    // ocr_processing เดิม) ocr_test_runs.status เก็บแค่ "failed" (ไม่มีคอลัมน์
    // blocked แยก — งานทดสอบไม่จำเป็นต้องแยกละเอียดเท่าเอกสารจริง)
    await failBackgroundJob(job.id, outcome.errorMessage);
    return false;
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "handleOcrTestRunJob"));
    return false;
  }
}
