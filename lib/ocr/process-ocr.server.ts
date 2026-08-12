import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { normalizeExtractedText, MAX_EXTRACTED_TEXT_LENGTH } from "@/lib/pdf/extract-text.server";
import { submitOcr, pollOcrStatus } from "@/lib/ocr/ocr-provider.server";

/**
 * OCR ของ PDF ของงานวิจัยหนึ่งรายการ — โครงสร้างพื้นฐานเดียวกับ
 * processResearchDocumentExtraction() ของช่วงที่ 17 (ล็อกแบบ atomic ก่อนเสมอ →
 * ดาวน์โหลดไฟล์ด้วย Service Role → เรียก provider → บันทึกผล) แต่ตั้งแต่ช่วงที่
 * 29 อาจ**ไม่จบในรอบเดียว**ถ้า provider เป็นแบบ async (submit + poll) — คืนค่า
 * OcrRunOutcome ให้ handler (lib/jobs/handlers/ocr-processing.server.ts)
 * ตัดสินใจว่าจะ complete/fail/requeue job ต่อ
 *
 * ไม่เคย throw ออกไปให้ผู้เรียก — ครอบทุกขั้นตอนไว้และแปลงข้อผิดพลาดเป็นสถานะ
 * failed ในฐานข้อมูลแทนเสมอ เรียกจาก handler เท่านั้น (ไม่เคยรันใน request ที่
 * อัปโหลด/แก้ไขงานวิจัยโดยตรง — ต้องเป็น background job เสมอตามข้อกำหนด)
 */

export type OcrRunOutcome =
  | { status: "processing"; externalJobId: string; currentPage: number | null; totalPages: number | null }
  | { status: "completed" }
  | { status: "failed"; errorMessage: string }
  | { status: "blocked"; errorMessage: string };

/** สร้างงาน OCR ใหม่ (ยังไม่มี external_job_id) — เรียกครั้งเดียวต่อ job
 * (รอบถัดๆ ไปถ้า provider เป็น async จะเรียก pollResearchDocumentOcr() แทน) */
export async function processResearchDocumentOcr(
  researchItemId: string,
  pdfPath: string
): Promise<OcrRunOutcome> {
  if (!isServiceRoleConfigured()) {
    console.error("processResearchDocumentOcr: SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่า ข้าม OCR");
    return { status: "failed", errorMessage: "ระบบยังไม่พร้อมประมวลผล OCR กรุณาลองใหม่อีกครั้ง" };
  }

  const service = createServiceRoleClient();

  const { data: lockId, error: lockError } = await service.rpc("acquire_ocr_lock", {
    p_research_item_id: researchItemId,
  });

  if (lockError) {
    console.error("processResearchDocumentOcr: acquire_ocr_lock ล้มเหลว:", lockError.message);
    return { status: "failed", errorMessage: "ไม่สามารถเริ่มประมวลผล OCR ได้ กรุณาลองใหม่อีกครั้ง" };
  }
  if (!lockId) {
    // มีงาน OCR ของรายการนี้กำลังทำอยู่แล้ว (ป้องกันด้วย idempotency key ตั้งแต่
    // ตอน enqueue อยู่แล้วตามปกติ — กรณีนี้แทบไม่เกิดขึ้นจริง) ถือว่าไม่ใช่ความ
    // ล้มเหลว ปล่อยให้งานที่ถืออยู่ทำต่อไป (พฤติกรรมเดิมตั้งแต่ช่วงที่ 23)
    console.log(`processResearchDocumentOcr: งานวิจัย ${researchItemId} กำลัง OCR อยู่แล้ว ข้ามรอบนี้`);
    return { status: "completed" };
  }

  try {
    const { data: blob, error: downloadError } = await service.storage
      .from("research-documents")
      .download(pdfPath);

    if (downloadError || !blob) {
      console.error(`processResearchDocumentOcr: ดาวน์โหลด ${pdfPath} ไม่สำเร็จ:`, downloadError?.message);
      const errorMessage = "ไม่สามารถเปิดไฟล์เพื่อทำ OCR ได้ กรุณาลองประมวลผลใหม่อีกครั้ง";
      await finalize(service, researchItemId, { ocr_status: "failed", ocr_error_message: errorMessage });
      return { status: "failed", errorMessage };
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const filename = pdfPath.split("/").pop() ?? pdfPath;
    const result = await submitOcr(buffer, filename);

    if (result.status === "processing") {
      // ไม่ finalize — ocr_status ยังคง 'processing' จากตอน acquire lock อยู่
      // แล้ว จะ finalize จริงตอน pollResearchDocumentOcr() ได้ผลสุดท้าย — ยังไม่
      // มี currentPage ในรอบ submit แรก (provider เพิ่งรับงานไป ยังไม่เริ่มนับหน้า)
      return {
        status: "processing",
        externalJobId: result.externalJobId,
        currentPage: null,
        totalPages: result.totalPages ?? null,
      };
    }

    return await finalizeFromResult(service, researchItemId, result);
  } catch (error) {
    console.error("processResearchDocumentOcr: เกิดข้อผิดพลาดไม่คาดคิด:", error);
    const errorMessage = "เกิดข้อผิดพลาดไม่คาดคิดระหว่างทำ OCR";
    await finalize(service, researchItemId, { ocr_status: "failed", ocr_error_message: errorMessage });
    return { status: "failed", errorMessage };
  }
}

/** ตรวจสอบสถานะงาน OCR ที่ submit ไปแล้ว (provider แบบ async เท่านั้น) —
 * **ไม่เรียก acquire_ocr_lock() ซ้ำ** (ล็อกถืออยู่แล้วตั้งแต่รอบแรก — ocr_status
 * ยังเป็น 'processing' ต่อเนื่อง เรียกซ้ำจะล้มเหลวเปล่าๆ เพราะเงื่อนไขของล็อก
 * คือ ocr_status != 'processing') */
export async function pollResearchDocumentOcr(
  researchItemId: string,
  externalJobId: string
): Promise<OcrRunOutcome> {
  if (!isServiceRoleConfigured()) {
    return { status: "failed", errorMessage: "ระบบยังไม่พร้อมตรวจสอบสถานะ OCR กรุณาลองใหม่อีกครั้ง" };
  }
  const service = createServiceRoleClient();

  try {
    const poll = await pollOcrStatus(externalJobId);

    if (poll.status === "processing") {
      return {
        status: "processing",
        externalJobId,
        currentPage: poll.currentPage ?? null,
        totalPages: poll.totalPages ?? null,
      };
    }

    return await finalizeFromResult(service, researchItemId, poll);
  } catch (error) {
    console.error("pollResearchDocumentOcr: เกิดข้อผิดพลาดไม่คาดคิด:", error);
    const errorMessage = "เกิดข้อผิดพลาดไม่คาดคิดระหว่างตรวจสอบสถานะ OCR";
    await finalize(service, researchItemId, { ocr_status: "failed", ocr_error_message: errorMessage });
    return { status: "failed", errorMessage };
  }
}

/** แปลงผลลัพธ์สุดท้าย (completed/failed/blocked) จาก submitOcr()/pollOcrStatus()
 * เป็นการเขียน research_document_texts + OcrRunOutcome ที่ handler ใช้ตัดสินใจ
 * complete/fail job ต่อ — จุดเดียวที่ทั้งสอง entry point (submit ใหม่/poll ต่อ)
 * ใช้ร่วมกัน กันโค้ดเขียนผลลัพธ์ซ้ำสองที่ */
async function finalizeFromResult(
  service: ReturnType<typeof createServiceRoleClient>,
  researchItemId: string,
  result:
    | { status: "completed"; text: string; confidence?: number | null; language?: string; provider?: string }
    | { status: "failed"; error: string; provider?: string }
    | { status: "blocked"; error: string; provider?: string }
): Promise<OcrRunOutcome> {
  const processedAt = new Date().toISOString();

  if (result.status === "completed") {
    const text =
      result.text.length > MAX_EXTRACTED_TEXT_LENGTH ? result.text.slice(0, MAX_EXTRACTED_TEXT_LENGTH) : result.text;
    await finalize(service, researchItemId, {
      ocr_status: "completed",
      ocr_text: text,
      ocr_text_normalized: normalizeExtractedText(text),
      ocr_error_message: null,
      ocr_provider: result.provider ?? null,
      ocr_language: result.language ?? null,
      ocr_confidence: result.confidence ?? null,
      ocr_processed_at: processedAt,
    });
    return { status: "completed" };
  }

  const ocrStatus = result.status === "blocked" ? "blocked" : "failed";
  await finalize(service, researchItemId, {
    ocr_status: ocrStatus,
    ocr_error_message: result.error,
    ocr_provider: result.provider ?? null,
    ocr_processed_at: processedAt,
  });
  return { status: ocrStatus, errorMessage: result.error };
}

async function finalize(
  service: ReturnType<typeof createServiceRoleClient>,
  researchItemId: string,
  patch: {
    ocr_status: "completed" | "failed" | "blocked";
    ocr_text?: string | null;
    ocr_text_normalized?: string | null;
    ocr_error_message: string | null;
    ocr_provider?: string | null;
    ocr_language?: string | null;
    ocr_confidence?: number | null;
    ocr_processed_at?: string;
  }
): Promise<void> {
  const { error } = await service
    .from("research_document_texts")
    .update(patch)
    .eq("research_item_id", researchItemId);

  if (error) {
    console.error("processResearchDocumentOcr: บันทึกผลลัพธ์ไม่สำเร็จ:", error.message);
  }
}
