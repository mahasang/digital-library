import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { processResearchDocumentExtraction } from "@/lib/pdf/process-extraction.server";
import { completeBackgroundJob, failBackgroundJob, toSafeJobErrorMessage } from "@/lib/jobs/queue.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `pdf_text_extraction` — เรียก
 * processResearchDocumentExtraction() เดิมของช่วงที่ 17 ตรงๆ (ออกแบบไว้ให้เรียก
 * จาก background job ได้โดยไม่ต้องแก้โค้ดภายในอยู่แล้ว) ฟังก์ชันนั้นไม่ throw
 * และไม่คืนผลลัพธ์ ต้อง query สถานะจาก research_document_texts เองหลังจบเพื่อ
 * ตัดสินว่า job นี้ completed หรือ failed
 */
export async function handlePdfTextExtractionJob(job: BackgroundJobRow): Promise<boolean> {
  const researchItemId = String(job.payload.research_item_id ?? "");
  const pdfPath = String(job.payload.pdf_path ?? "");

  if (!researchItemId || !pdfPath) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (research_item_id/pdf_path)");
    return false;
  }

  try {
    await processResearchDocumentExtraction(researchItemId, pdfPath);

    const service = createServiceRoleClient();
    const { data } = await service
      .from("research_document_texts")
      .select("extraction_status, extraction_error_message")
      .eq("research_item_id", researchItemId)
      .maybeSingle();

    if (data?.extraction_status === "failed") {
      await failBackgroundJob(
        job.id,
        data.extraction_error_message ?? "ดึงข้อความจาก PDF ไม่สำเร็จ"
      );
      return false;
    }

    await completeBackgroundJob(job.id);
    return true;
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "handlePdfTextExtractionJob"));
    return false;
  }
}
