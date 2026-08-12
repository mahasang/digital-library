import "server-only";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { extractPdfText, normalizeExtractedText } from "@/lib/pdf/extract-text.server";
import type { Database, ExtractionStatusRow } from "@/lib/supabase/database.types";

/**
 * ดึงข้อความจาก PDF ของงานวิจัยหนึ่งรายการแบบ end-to-end: ล็อกแถวแบบ atomic
 * ก่อนเสมอ (กันประมวลผลไฟล์เดียวกันซ้ำซ้อนพร้อมกัน) → ดาวน์โหลดไฟล์ด้วย
 * Service Role → คำนวณ SHA-256 → ดึงข้อความ → บันทึกผลลัพธ์
 *
 * เรียกจาก Server Action หลังผ่านการตรวจ magic-byte/มัลแวร์ (validateSubmissionFiles)
 * และบันทึกแถว research_items สำเร็จแล้วเท่านั้น — ฟังก์ชันนี้ไม่ throw ออกไปให้
 * ผู้เรียกเลย (จับ error ทั้งหมดเองและบันทึกสถานะ failed แทน) เพราะการดึง
 * ข้อความล้มเหลวต้องไม่ทำให้การอัปโหลด/แก้ไขงานวิจัยทั้งฟอร์มล้มเหลวไปด้วย
 *
 * ออกแบบเป็นฟังก์ชัน standalone รับแค่ researchItemId/pdfPath ไม่ผูกกับ
 * request context ของ Next.js เลย — เรียกจาก background job/queue ในอนาคตได้
 * โดยไม่ต้องแก้โค้ดนี้เลย (ดูข้อจำกัดเรื่อง Serverless timeout ที่
 * docs/pdf-full-text-search.md)
 */
export async function processResearchDocumentExtraction(
  researchItemId: string,
  pdfPath: string
): Promise<void> {
  if (!isServiceRoleConfigured()) {
    console.error(
      "processResearchDocumentExtraction: SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่า ข้ามการดึงข้อความ"
    );
    return;
  }

  const service = createServiceRoleClient();

  const { data: lockId, error: lockError } = await service.rpc("acquire_extraction_lock", {
    p_research_item_id: researchItemId,
    p_source_file_path: pdfPath,
  });

  if (lockError) {
    console.error("processResearchDocumentExtraction: acquire_extraction_lock ล้มเหลว:", lockError.message);
    return;
  }
  if (!lockId) {
    console.log(
      `processResearchDocumentExtraction: งานวิจัย ${researchItemId} กำลังถูกประมวลผลอยู่แล้ว ข้ามรอบนี้`
    );
    return;
  }

  try {
    const { data: blob, error: downloadError } = await service.storage
      .from("research-documents")
      .download(pdfPath);

    if (downloadError || !blob) {
      console.error(
        `processResearchDocumentExtraction: ดาวน์โหลด ${pdfPath} ไม่สำเร็จ:`,
        downloadError?.message
      );
      await finalize(service, researchItemId, {
        extraction_status: "failed",
        extraction_error_message: "ไม่สามารถเปิดไฟล์เพื่อดึงข้อความได้ กรุณาลองประมวลผลใหม่อีกครั้ง",
      });
      return;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const sourceFileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const outcome = await extractPdfText(buffer);
    const extractedAt = new Date().toISOString();

    if (outcome.status === "completed") {
      await finalize(service, researchItemId, {
        extraction_status: "completed",
        extracted_text: outcome.text,
        extracted_text_normalized: normalizeExtractedText(outcome.text),
        extraction_error_message: null,
        extracted_at: extractedAt,
        source_file_hash: sourceFileHash,
      });
    } else if (outcome.status === "no_text_found") {
      await finalize(service, researchItemId, {
        extraction_status: "no_text_found",
        extracted_text: null,
        extracted_text_normalized: null,
        extraction_error_message: null,
        extracted_at: extractedAt,
        source_file_hash: sourceFileHash,
      });
    } else {
      await finalize(service, researchItemId, {
        extraction_status: "failed",
        extraction_error_message: outcome.error,
        extracted_at: extractedAt,
        source_file_hash: sourceFileHash,
      });
    }
  } catch (error) {
    console.error("processResearchDocumentExtraction: เกิดข้อผิดพลาดไม่คาดคิด:", error);
    await finalize(service, researchItemId, {
      extraction_status: "failed",
      extraction_error_message: "เกิดข้อผิดพลาดไม่คาดคิดระหว่างประมวลผลไฟล์",
    });
  }
}

async function finalize(
  service: SupabaseClient<Database>,
  researchItemId: string,
  patch: {
    extraction_status: ExtractionStatusRow;
    extracted_text?: string | null;
    extracted_text_normalized?: string | null;
    extraction_error_message: string | null;
    extracted_at?: string;
    source_file_hash?: string;
  }
): Promise<void> {
  const { error } = await service
    .from("research_document_texts")
    .update(patch)
    .eq("research_item_id", researchItemId);

  if (error) {
    console.error("processResearchDocumentExtraction: บันทึกผลลัพธ์ไม่สำเร็จ:", error.message);
  }
}
