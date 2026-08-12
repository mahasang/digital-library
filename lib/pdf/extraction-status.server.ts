import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ExtractionStatusRow, OcrStatusRow } from "@/lib/supabase/database.types";

export interface ExtractionStatusInfo {
  status: ExtractionStatusRow;
  extractedAt: string | null;
  errorMessage: string | null;
  ocrStatus: OcrStatusRow;
  ocrErrorMessage: string | null;
  ocrProcessedAt: string | null;
  ocrProvider: string | null;
  ocrConfidence: number | null;
}

function mapRow(data: {
  extraction_status: ExtractionStatusRow;
  extracted_at: string | null;
  extraction_error_message: string | null;
  ocr_status: OcrStatusRow;
  ocr_error_message: string | null;
  ocr_processed_at: string | null;
  ocr_provider: string | null;
  ocr_confidence: number | null;
}): ExtractionStatusInfo {
  return {
    status: data.extraction_status,
    extractedAt: data.extracted_at,
    errorMessage: data.extraction_error_message,
    ocrStatus: data.ocr_status,
    ocrErrorMessage: data.ocr_error_message,
    ocrProcessedAt: data.ocr_processed_at,
    ocrProvider: data.ocr_provider,
    ocrConfidence: data.ocr_confidence,
  };
}

/** อ่านสถานะการดึงข้อความ PDF ด้วย uuid จริงของ research_items (research_item_id
 * ตรงๆ) — ใช้ในหน้าฝั่งจัดการ/แดชบอร์ด (เช่น /dashboard/research/[id]/edit) ที่
 * SubmissionItem.id ถูก mapRowToSubmissionItem set เป็น row.id (uuid จริง)
 * เสมอ ต่างจาก ResearchItem.id ทั่วไปที่เป็น slug — ห้ามใช้ฟังก์ชันนี้กับ slug
 * เด็ดขาด เพราะ research_item_id เป็นคอลัมน์ uuid จะไม่มีวันจับคู่กับ slug ได้
 * คืน null ถ้ายังไม่เคยประมวลผลเลย (ไม่มีแถวในตาราง) ไม่ใช่ error — RLS ของ
 * research_document_texts บังคับสิทธิ์การเข้าถึงอัตโนมัติอยู่แล้ว (ดู migration) */
export async function getExtractionStatus(
  researchItemId: string
): Promise<ExtractionStatusInfo | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_document_texts")
    .select(
      "extraction_status, extracted_at, extraction_error_message, ocr_status, ocr_error_message, ocr_processed_at, ocr_provider, ocr_confidence"
    )
    .eq("research_item_id", researchItemId)
    .maybeSingle();

  if (error) {
    console.error("getExtractionStatus failed:", error.message);
    return null;
  }
  if (!data) return null;

  return mapRow(data);
}

/** เหมือน getExtractionStatus แต่รับ "slug" แทน uuid จริง — ใช้ในหน้าสาธารณะ
 * (เช่น /research/[slug]/read) ที่มีแต่ ResearchItem.id ซึ่งเป็น slug เสมอ
 * (ดู mapRowToResearchItem) join ผ่าน research_items!inner(slug) เพื่อแปลง
 * slug -> uuid จริงในคิวรีเดียว แทนที่จะยิงสองคิวรีแยกกัน */
export async function getExtractionStatusBySlug(
  researchSlug: string
): Promise<ExtractionStatusInfo | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_document_texts")
    .select(
      "extraction_status, extracted_at, extraction_error_message, ocr_status, ocr_error_message, ocr_processed_at, ocr_provider, ocr_confidence, research_items!inner(slug)"
    )
    .eq("research_items.slug", researchSlug)
    .maybeSingle();

  if (error) {
    console.error("getExtractionStatusBySlug failed:", error.message);
    return null;
  }
  if (!data) return null;

  return mapRow(data);
}
