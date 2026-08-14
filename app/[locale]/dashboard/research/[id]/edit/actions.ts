"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { submissionSchema } from "@/lib/validation/submission";
import { replaceResearchRelations } from "@/lib/data/submission-write.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { validateSubmissionFiles } from "@/lib/security/validate-upload.server";
import { enqueueReplacementFileProcessingJobs } from "@/lib/jobs/enqueue-research-jobs.server";
import { replaceEntityJob } from "@/lib/jobs/queue.server";
import { checkOcrEligibility } from "@/lib/ocr/ocr-limits.server";
import { OCR_JOB_MAX_ATTEMPTS } from "@/lib/ocr/ocr-provider.server";
import { detectDuplicatesForResearchItem } from "@/lib/data/duplicate-research.server";
import { notifyResearchPublished } from "@/lib/publishing/publish-event.server";
import { revalidatePublicResearch } from "@/lib/cache/public-home";
import type { ActionResult } from "@/lib/actions/types";
import type { DocumentStatusRow } from "@/lib/supabase/database.types";

const SUBMISSION_FIELD_TO_SCHEMA_KEY = {
  pdf: "pdfPath",
  cover: "coverPath",
  attachment: "attachmentPath",
} as const;

/**
 * แก้ไขงานวิจัยโดย Librarian/Admin — ไม่จำกัดเจ้าของหรือสถานะปัจจุบัน
 * (ต่างจาก updateSubmissionAction ที่ใช้เฉพาะเจ้าของงานตอน draft/revision_requested)
 */
export async function adminUpdateResearchAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const researchId = String(formData.get("researchId") || "");
  if (!researchId) {
    return { status: "error", message: "ไม่พบรหัสงานวิจัยที่จะแก้ไข" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์แก้ไขงานวิจัย ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: existing } = await supabase
    .from("research_items")
    .select("id, cover_image, attachment_file, pdf_file, status, submitted_by, title_th, title_en, year")
    .eq("id", researchId)
    .maybeSingle();

  if (!existing) {
    return { status: "error", message: "ไม่พบงานวิจัยนี้" };
  }

  let researchers: unknown;
  let keywords: unknown;
  try {
    researchers = JSON.parse(String(formData.get("researchers") || "[]"));
    keywords = JSON.parse(String(formData.get("keywords") || "[]"));
  } catch {
    return { status: "error", message: "ข้อมูลผู้วิจัยหรือคำสำคัญไม่ถูกต้อง" };
  }

  const parsed = submissionSchema.safeParse({
    titleTh: formData.get("titleTh"),
    titleEn: formData.get("titleEn") || undefined,
    abstract: formData.get("abstract"),
    organizationId: formData.get("organizationId"),
    year: formData.get("year"),
    categoryId: formData.get("categoryId"),
    keywords,
    researchers,
    accessLevel: formData.get("accessLevel"),
    copyrightNote: formData.get("copyrightNote"),
    copyrightConfirmed: formData.get("copyrightConfirmed") === "true",
    pdfPath: formData.get("pdfPath"),
    coverPath: formData.get("coverPath") || undefined,
    attachmentPath: formData.get("attachmentPath") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const fileCheck = await validateSubmissionFiles(
    {
      pdfPath: parsed.data.pdfPath,
      coverPath: parsed.data.coverPath,
      attachmentPath: parsed.data.attachmentPath,
    },
    existing.pdf_file
  );
  if (!fileCheck.ok) {
    await logAudit(supabase, {
      actorId: user.id,
      action: "file_upload_rejected",
      entityType: "storage_object",
      entityId: researchId,
      metadata: { field: fileCheck.field, reason: fileCheck.logReason },
    });
    return {
      status: "error",
      message: fileCheck.message,
      fieldErrors: { [SUBMISSION_FIELD_TO_SCHEMA_KEY[fileCheck.field]]: [fileCheck.message] },
    };
  }
  const pdfScan = fileCheck.scans.pdf;

  const intentRaw = String(formData.get("intent") || existing.status);
  const validStatuses: DocumentStatusRow[] = [
    "draft",
    "pending_review",
    "revision_requested",
    "approved",
    "published",
    "rejected",
    "archived",
  ];
  let status: DocumentStatusRow = validStatuses.includes(intentRaw as DocumentStatusRow)
    ? (intentRaw as DocumentStatusRow)
    : (existing.status as DocumentStatusRow);

  // แทนที่ไฟล์ PDF ของงานวิจัยที่ (จะ) เผยแพร่อยู่ → ไฟล์ใหม่ยังไม่ผ่านการสแกน
  // (scan_status จะกลายเป็น 'pending' ด้านล่าง) ต้องลดสถานะลงมาเป็น
  // pending_review ก่อนเสมอ ไม่เช่นนั้น trigger prevent_publish_unscanned_file
  // จะปฏิเสธการบันทึกทั้งฟอร์มไปเลย — เข้ากับนโยบาย "เอกสารที่ยังสแกนไม่เสร็จ
  // ต้องไม่เผยแพร่ได้" โดยไม่ทำให้การแก้ไขฟิลด์อื่นพร้อมกันล้มเหลวไปด้วย
  if (pdfScan && status === "published") {
    status = "pending_review";
  }

  let coverImageUrl = existing.cover_image;
  if (parsed.data.coverPath) {
    const { data } = supabase.storage
      .from("research-covers")
      .getPublicUrl(parsed.data.coverPath);
    coverImageUrl = data.publicUrl;
  }
  const attachmentFile = parsed.data.attachmentPath || existing.attachment_file;

  const { error: updateError } = await supabase
    .from("research_items")
    .update({
      title_th: parsed.data.titleTh,
      title_en: parsed.data.titleEn ?? null,
      organization_id: parsed.data.organizationId,
      year: parsed.data.year,
      ...(pdfScan
        ? {
            scan_status: pdfScan.scanStatus,
            scanned_at: pdfScan.scannedAt,
            scan_provider: pdfScan.scanProvider,
            scan_reason: pdfScan.scanReason,
          }
        : {}),
      abstract: parsed.data.abstract,
      cover_image: coverImageUrl,
      pdf_file: parsed.data.pdfPath,
      attachment_file: attachmentFile,
      access_level: parsed.data.accessLevel,
      status,
      reviewed_by: user.id,
      copyright_note: parsed.data.copyrightNote,
      copyright_confirmed: parsed.data.copyrightConfirmed,
    })
    .eq("id", researchId);

  if (updateError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        updateError,
        "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง",
        "adminUpdateResearchAction update failed"
      ),
    };
  }

  try {
    await replaceResearchRelations(supabase, researchId, parsed.data);
  } catch (relationError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        relationError,
        "เกิดข้อผิดพลาดในการบันทึกข้อมูลที่เกี่ยวข้อง กรุณาลองใหม่อีกครั้ง",
        "adminUpdateResearchAction replaceResearchRelations failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "research_update",
    entityType: "research_items",
    entityId: researchId,
    metadata: { title_th: parsed.data.titleTh, access_level: parsed.data.accessLevel },
  });

  // สแกนความปลอดภัย + ดึงข้อความใหม่แบบ background job เฉพาะตอนแทนที่ไฟล์ PDF
  // จริง (pdfScan มีค่าก็ต่อเมื่อ path เปลี่ยนจากเดิม) — ยกเลิก job เก่าที่ยัง
  // active ของแถวนี้ก่อนเสมอ (อ้างไฟล์เก่าที่ไม่มีอยู่แล้ว) ไฟล์เดิมที่ไม่ได้
  // แทนที่ไม่ต้องสแกน/ดึงซ้ำ ผลเดิมยังใช้ได้
  if (pdfScan) {
    await enqueueReplacementFileProcessingJobs({
      researchItemId: researchId,
      pdfPath: parsed.data.pdfPath,
      userId: user.id,
    });
  }

  // แจ้งผู้ติดตามหมวดหมู่ (in-app + email) เฉพาะตอนเพิ่งเปลี่ยนเป็น published
  // จริง (ไม่ใช่แก้ไขเอกสารที่เผยแพร่อยู่แล้วซ้ำ) — เรียกหลัง
  // replaceResearchRelations() เสมอ (ต้องมีหมวดหมู่ครบก่อนแจ้งผู้ติดตาม)
  if (status === "published" && existing.status !== "published") {
    await notifyResearchPublished(supabase, {
      researchItemId: researchId,
      titleTh: parsed.data.titleTh,
      submittedBy: existing.submitted_by,
      actorId: user.id,
      source: "update",
    });
  }

  // ตรวจสอบงานวิจัยซ้ำใหม่เฉพาะตอนชื่อเรื่องหรือปีเผยแพร่เปลี่ยนจริง — ไม่ต้อง
  // เสียเวลาตรวจซ้ำทุกครั้งที่แก้ไขฟิลด์อื่นที่ไม่กระทบการเปรียบเทียบความคล้าย
  if (
    parsed.data.titleTh !== existing.title_th ||
    (parsed.data.titleEn ?? null) !== existing.title_en ||
    parsed.data.year !== existing.year
  ) {
    await detectDuplicatesForResearchItem(supabase, researchId);
  }

  // แก้ไขงานวิจัย (ชื่อเรื่อง/ปก/สิทธิ์การเข้าถึง/สถานะ ฯลฯ) อาจกระทบชุดข้อมูล
  // สาธารณะของหน้าแรกไม่ว่าจะเปลี่ยนสถานะด้วยหรือไม่ (เช่นแก้ชื่อเรื่อง/ปกของ
  // งานวิจัยที่เผยแพร่อยู่แล้วและติดอยู่ในลิสต์ "ล่าสุด"/"ยอดนิยม") — ล้าง cache
  // แบบไม่มีเงื่อนไขไว้ก่อนเสมอ (ดู lib/cache/public-home.ts)
  revalidatePublicResearch();

  redirect(`/dashboard/research/${researchId}/edit`);
}

/**
 * สั่งดึงข้อความจาก PDF ใหม่ด้วยตนเอง — สำหรับกรณี extraction_status เป็น
 * failed/no_text_found แล้วต้องการลองใหม่ (เช่น หลังแก้ปัญหาไฟล์เสียหายเอง)
 * หรือแค่ต้องการยืนยันผลซ้ำ — จำกัดสิทธิ์เท่ากับหน้านี้ (librarian/admin/
 * super_admin, rank >= 30 เท่านั้น) และบันทึก audit log ทุกครั้งตามที่กำหนด
 */
export async function reprocessResearchTextAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const researchId = String(formData.get("researchId") || "");
  if (!researchId) return { status: "error", message: "ไม่พบรหัสงานวิจัย" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: existing } = await supabase
    .from("research_items")
    .select("pdf_file")
    .eq("id", researchId)
    .maybeSingle();

  if (!existing?.pdf_file) {
    return { status: "error", message: "ไม่พบไฟล์ PDF ของงานวิจัยนี้" };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "research_text_reprocess",
    entityType: "research_items",
    entityId: researchId,
    metadata: { pdf_file: existing.pdf_file },
  });

  await replaceEntityJob({
    jobType: "pdf_text_extraction",
    entityType: "research_items",
    entityId: researchId,
    payload: { research_item_id: researchId, pdf_path: existing.pdf_file },
    idempotencyKey: `pdf_text_extraction:${researchId}`,
    createdBy: user.id,
  });

  revalidatePath(`/dashboard/research/${researchId}/edit`);
  return { status: "success", message: "เริ่มประมวลผลข้อความใหม่เรียบร้อยแล้ว (ทำงานเป็น background job อาจใช้เวลาสักครู่)" };
}

/**
 * สั่ง OCR เอกสารที่ดึงข้อความปกติแล้วได้ no_text_found (เอกสารสแกน) — จำกัด
 * สิทธิ์เท่ากับ reprocessResearchTextAction (librarian/admin/super_admin,
 * rank >= 30) การมองเห็นแถว research_items ถูก RLS จำกัดไว้แล้วว่า rank ระดับ
 * นี้เห็นเฉพาะเอกสารที่มีสิทธิ์จริงเท่านั้น (เอกสาร metadata_only ที่ตัวเองไม่ใช่
 * เจ้าของก็ยังเห็นแถวได้เพราะ rank >= 30 อยู่แล้วตาม RLS เดิม) เป็น background
 * job เสมอ — ไม่เคยรันในคำขอนี้ตรงๆ (แค่ enqueue แล้วคืนทันที)
 */
export async function triggerOcrAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const researchId = String(formData.get("researchId") || "");
  if (!researchId) return { status: "error", message: "ไม่พบรหัสงานวิจัย" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป" };
  }

  const { data: existing } = await supabase
    .from("research_items")
    .select("pdf_file, access_level, page_count")
    .eq("id", researchId)
    .maybeSingle();

  if (!existing?.pdf_file) {
    return { status: "error", message: "ไม่พบไฟล์ PDF ของงานวิจัยนี้" };
  }

  const eligibility = await checkOcrEligibility({
    researchItemId: researchId,
    pdfPath: existing.pdf_file,
    accessLevel: existing.access_level,
    pageCount: existing.page_count,
    actorUserId: user.id,
  });

  if (!eligibility.ok) {
    await logAudit(supabase, {
      actorId: user.id,
      action: "ocr_rejected_by_limits",
      entityType: "research_items",
      entityId: researchId,
      metadata: { code: eligibility.code, message: eligibility.message },
    });
    return { status: "error", message: eligibility.message };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "research_ocr_trigger",
    entityType: "research_items",
    entityId: researchId,
    metadata: { pdf_file: existing.pdf_file },
  });

  await replaceEntityJob({
    jobType: "ocr_processing",
    entityType: "research_items",
    entityId: researchId,
    payload: { research_item_id: researchId, pdf_path: existing.pdf_file },
    idempotencyKey: `ocr_processing:${researchId}`,
    createdBy: user.id,
    maxAttempts: OCR_JOB_MAX_ATTEMPTS,
  });

  revalidatePath(`/dashboard/research/${researchId}/edit`);
  return { status: "success", message: "เริ่ม OCR เรียบร้อยแล้ว (ทำงานเป็น background job อาจใช้เวลาหลายนาที)" };
}
