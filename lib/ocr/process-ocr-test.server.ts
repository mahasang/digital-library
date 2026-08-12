import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { getPdfPageCount } from "@/lib/pdf/extract-text.server";
import { submitOcrTest, pollOcrStatus } from "@/lib/ocr/ocr-provider.server";
import { readOcrTestFixtureBuffer } from "@/lib/ocr/test-fixtures.server";

/**
 * เหมือน lib/ocr/process-ocr.server.ts ทุกประการ (submit ใหม่/poll ต่อ, ไม่เคย
 * throw ออกไปให้ผู้เรียก, แปลง error เป็นสถานะ failed เสมอ) แต่สำหรับ
 * Controlled OCR Test (ช่วงที่ 32) โดยเฉพาะ — ต่างกัน 3 จุด:
 *   1. เรียก submitOcrTest() (ตรวจแค่ provider ตั้งค่าครบ + OCR_TEST_MODE)
 *      แทน submitOcr() (ตรวจ OCR_ENABLED/settings.ocrProviderEnabled เต็ม)
 *   2. อ่านไฟล์จาก fixture (public/ocr-test-fixtures/) แทนการดาวน์โหลดจาก
 *      Supabase Storage
 *   3. เขียนผลลง ocr_test_runs แทน research_document_texts — ไม่มี lock แบบ
 *      acquire_ocr_lock() เพราะไม่มีการแข่งกันแก้ไขแถวเดียวกันแบบเอกสารจริง
 *      (แต่ละแถว ocr_test_runs สร้างใหม่ทุกครั้งที่กด "เริ่มทดสอบ"/"ลองใหม่")
 */

export type OcrTestRunOutcome =
  | { status: "processing"; externalJobId: string; currentPage: number | null; totalPages: number | null }
  | { status: "completed" }
  | { status: "failed"; errorMessage: string }
  | { status: "blocked"; errorMessage: string };

export async function submitOcrTestRun(testRunId: string, fixtureName: string): Promise<OcrTestRunOutcome> {
  if (!isServiceRoleConfigured()) {
    return { status: "failed", errorMessage: "ระบบยังไม่พร้อมประมวลผล OCR กรุณาลองใหม่อีกครั้ง" };
  }
  const service = createServiceRoleClient();

  try {
    const buffer = await readOcrTestFixtureBuffer(fixtureName);
    const pageCount = await getPdfPageCount(buffer);

    await service
      .from("ocr_test_runs")
      .update({ status: "processing", started_at: new Date().toISOString(), page_count: pageCount })
      .eq("id", testRunId);

    const result = await submitOcrTest(buffer, `${fixtureName}.pdf`);

    if (result.status === "processing") {
      const totalPages = result.totalPages ?? null;
      await service
        .from("ocr_test_runs")
        .update({
          current_page: null,
          total_pages: totalPages,
          progress_message: "กำลังประมวลผลโดย OCR provider",
        })
        .eq("id", testRunId);
      return {
        status: "processing",
        externalJobId: result.externalJobId,
        currentPage: null,
        totalPages,
      };
    }

    return await finalizeFromResult(service, testRunId, result);
  } catch (error) {
    console.error("submitOcrTestRun: เกิดข้อผิดพลาดไม่คาดคิด:", error);
    const errorMessage = "เกิดข้อผิดพลาดไม่คาดคิดระหว่างทดสอบ OCR";
    await finalize(service, testRunId, { status: "failed", error_summary: errorMessage });
    return { status: "failed", errorMessage };
  }
}

export async function pollOcrTestRun(testRunId: string, externalJobId: string): Promise<OcrTestRunOutcome> {
  if (!isServiceRoleConfigured()) {
    return { status: "failed", errorMessage: "ระบบยังไม่พร้อมตรวจสอบสถานะ OCR กรุณาลองใหม่อีกครั้ง" };
  }
  const service = createServiceRoleClient();

  try {
    const poll = await pollOcrStatus(externalJobId);

    if (poll.status === "processing") {
      const currentPage = poll.currentPage ?? null;
      const totalPages = poll.totalPages ?? null;
      await service
        .from("ocr_test_runs")
        .update({
          current_page: currentPage,
          total_pages: totalPages,
          progress_message: currentPage === null ? "กำลังประมวลผลโดย OCR provider" : null,
        })
        .eq("id", testRunId);
      return { status: "processing", externalJobId, currentPage, totalPages };
    }

    return await finalizeFromResult(service, testRunId, poll);
  } catch (error) {
    console.error("pollOcrTestRun: เกิดข้อผิดพลาดไม่คาดคิด:", error);
    const errorMessage = "เกิดข้อผิดพลาดไม่คาดคิดระหว่างตรวจสอบสถานะ OCR";
    await finalize(service, testRunId, { status: "failed", error_summary: errorMessage });
    return { status: "failed", errorMessage };
  }
}

async function finalizeFromResult(
  service: ReturnType<typeof createServiceRoleClient>,
  testRunId: string,
  result:
    | { status: "completed"; text: string; confidence?: number | null; language?: string; provider?: string }
    | { status: "failed"; error: string; provider?: string }
    | { status: "blocked"; error: string; provider?: string }
): Promise<OcrTestRunOutcome> {
  const completedAt = new Date().toISOString();

  if (result.status === "completed") {
    await finalize(service, testRunId, {
      status: "completed",
      extracted_char_count: result.text.length,
      completed_at: completedAt,
    });
    return { status: "completed" };
  }

  await finalize(service, testRunId, {
    status: "failed",
    error_summary: result.error,
    completed_at: completedAt,
  });
  return { status: result.status === "blocked" ? "blocked" : "failed", errorMessage: result.error };
}

async function finalize(
  service: ReturnType<typeof createServiceRoleClient>,
  testRunId: string,
  patch: {
    status: "completed" | "failed";
    extracted_char_count?: number;
    error_summary?: string;
    completed_at?: string;
  }
): Promise<void> {
  const { error } = await service
    .from("ocr_test_runs")
    .update({ ...patch, current_page: null, total_pages: null, progress_message: null })
    .eq("id", testRunId);

  if (error) {
    console.error("submitOcrTestRun/pollOcrTestRun: บันทึกผลลัพธ์ไม่สำเร็จ:", error.message);
  }
}
