"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { submissionSchema } from "@/lib/validation/submission";
import { replaceResearchRelations } from "@/lib/data/submission-write.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { validateSubmissionFiles } from "@/lib/security/validate-upload.server";
import { enqueueReplacementFileProcessingJobs } from "@/lib/jobs/enqueue-research-jobs.server";
import { detectDuplicatesForResearchItem } from "@/lib/data/duplicate-research.server";
import { logAudit } from "@/lib/data/audit.server";
import type { ActionResult } from "@/lib/actions/types";

const SUBMISSION_FIELD_TO_SCHEMA_KEY = {
  pdf: "pdfPath",
  cover: "coverPath",
  attachment: "attachmentPath",
} as const;

export async function updateSubmissionAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: "ระบบยังไม่ได้เชื่อมต่อ Supabase จึงยังไม่สามารถบันทึกได้",
    };
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

  const { data: existing, error: fetchError } = await supabase
    .from("research_items")
    .select("id, submitted_by, status, cover_image, attachment_file, pdf_file, title_th, title_en, year")
    .eq("id", researchId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { status: "error", message: "ไม่พบงานวิจัยนี้" };
  }
  if (existing.submitted_by !== user.id) {
    return { status: "error", message: "คุณไม่มีสิทธิ์แก้ไขงานวิจัยนี้" };
  }
  if (!["draft", "revision_requested"].includes(existing.status)) {
    return {
      status: "error",
      message: "ไม่สามารถแก้ไขงานวิจัยที่อยู่ระหว่างตรวจสอบหรือเผยแพร่แล้วได้",
    };
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

  const intent = formData.get("intent") === "pending_review" ? "pending_review" : "draft";

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
      abstract: parsed.data.abstract,
      cover_image: coverImageUrl,
      pdf_file: parsed.data.pdfPath,
      attachment_file: attachmentFile,
      access_level: parsed.data.accessLevel,
      status: intent,
      copyright_note: parsed.data.copyrightNote,
      copyright_confirmed: parsed.data.copyrightConfirmed,
      ...(pdfScan
        ? {
            scan_status: pdfScan.scanStatus,
            scanned_at: pdfScan.scannedAt,
            scan_provider: pdfScan.scanProvider,
            scan_reason: pdfScan.scanReason,
          }
        : {}),
    })
    .eq("id", researchId);

  if (updateError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        updateError,
        "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง",
        "updateSubmissionAction update failed"
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
        "updateSubmissionAction replaceResearchRelations failed"
      ),
    };
  }

  if (pdfScan) {
    await enqueueReplacementFileProcessingJobs({
      researchItemId: researchId,
      pdfPath: parsed.data.pdfPath,
      userId: user.id,
    });
  }

  // ตรวจสอบงานวิจัยซ้ำใหม่เฉพาะตอนชื่อเรื่องหรือปีเผยแพร่เปลี่ยนจริง
  if (
    parsed.data.titleTh !== existing.title_th ||
    (parsed.data.titleEn ?? null) !== existing.title_en ||
    parsed.data.year !== existing.year
  ) {
    await detectDuplicatesForResearchItem(supabase, researchId);
  }

  redirect(`/my-submissions/${researchId}`);
}
