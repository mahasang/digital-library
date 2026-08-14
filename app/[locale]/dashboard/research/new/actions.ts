"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { submissionSchema } from "@/lib/validation/submission";
import {
  generateResearchSlug,
  replaceResearchRelations,
} from "@/lib/data/submission-write.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { validateSubmissionFiles } from "@/lib/security/validate-upload.server";
import { enqueueInitialFileProcessingJobs } from "@/lib/jobs/enqueue-research-jobs.server";
import { detectDuplicatesForResearchItem } from "@/lib/data/duplicate-research.server";
import type { ActionResult } from "@/lib/actions/types";

const SUBMISSION_FIELD_TO_SCHEMA_KEY = {
  pdf: "pdfPath",
  cover: "coverPath",
  attachment: "attachmentPath",
} as const;

/** สร้างงานวิจัยโดย Librarian/Admin โดยตรง (เช่น นำเข้าเอกสารเก่า หรือเผยแพร่ทันที) */
export async function adminCreateResearchAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
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
    return { status: "error", message: "คุณไม่มีสิทธิ์เพิ่มงานวิจัย ต้องเป็นบรรณารักษ์ขึ้นไป" };
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

  const fileCheck = await validateSubmissionFiles({
    pdfPath: parsed.data.pdfPath,
    coverPath: parsed.data.coverPath,
    attachmentPath: parsed.data.attachmentPath,
  });
  if (!fileCheck.ok) {
    await logAudit(supabase, {
      actorId: user.id,
      action: "file_upload_rejected",
      entityType: "storage_object",
      metadata: { field: fileCheck.field, reason: fileCheck.logReason },
    });
    return {
      status: "error",
      message: fileCheck.message,
      fieldErrors: { [SUBMISSION_FIELD_TO_SCHEMA_KEY[fileCheck.field]]: [fileCheck.message] },
    };
  }
  const pdfScan = fileCheck.scans.pdf!;

  const intentRaw = String(formData.get("intent") || "draft");
  let status = ["draft", "pending_review", "published"].includes(intentRaw)
    ? (intentRaw as "draft" | "pending_review" | "published")
    : "draft";

  // ไฟล์ PDF เพิ่งอัปโหลดใหม่เสมอตอนสร้างงานวิจัย (ยังไม่ผ่านการสแกนความ
  // ปลอดภัยแบบ background job) — เผยแพร่ทันทีไม่ได้ ลดเป็น pending_review แทน
  // (เข้ากับ trigger prevent_publish_unscanned_file ของฐานข้อมูล)
  if (status === "published") {
    status = "pending_review";
  }
  const slug = generateResearchSlug(parsed.data.titleEn, parsed.data.titleTh);

  let coverImageUrl: string | null = null;
  if (parsed.data.coverPath) {
    const { data } = supabase.storage
      .from("research-covers")
      .getPublicUrl(parsed.data.coverPath);
    coverImageUrl = data.publicUrl;
  }

  const { data: inserted, error } = await supabase
    .from("research_items")
    .insert({
      slug,
      title_th: parsed.data.titleTh,
      title_en: parsed.data.titleEn ?? null,
      organization_id: parsed.data.organizationId,
      year: parsed.data.year,
      abstract: parsed.data.abstract,
      cover_image: coverImageUrl,
      pdf_file: parsed.data.pdfPath,
      attachment_file: parsed.data.attachmentPath ?? null,
      access_level: parsed.data.accessLevel,
      status,
      submitted_by: user.id,
      copyright_note: parsed.data.copyrightNote,
      copyright_confirmed: parsed.data.copyrightConfirmed,
      scan_status: pdfScan.scanStatus,
      scanned_at: pdfScan.scannedAt,
      scan_provider: pdfScan.scanProvider,
      scan_reason: pdfScan.scanReason,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถบันทึกงานวิจัยได้ กรุณาลองใหม่อีกครั้ง",
        "adminCreateResearchAction insert failed"
      ),
    };
  }

  try {
    await replaceResearchRelations(supabase, inserted.id, parsed.data);
  } catch (relationError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        relationError,
        "เกิดข้อผิดพลาดในการบันทึกข้อมูลที่เกี่ยวข้อง กรุณาลองใหม่อีกครั้ง",
        "adminCreateResearchAction replaceResearchRelations failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "research_create",
    entityType: "research_items",
    entityId: inserted.id,
    metadata: { title_th: parsed.data.titleTh, status },
  });

  await enqueueInitialFileProcessingJobs({
    researchItemId: inserted.id,
    pdfPath: parsed.data.pdfPath,
    userId: user.id,
  });
  await detectDuplicatesForResearchItem(supabase, inserted.id);

  // หมายเหตุ: เส้นทาง "สร้างงานใหม่พร้อมเผยแพร่ทันที" ไม่มีทางเกิดขึ้นจริงใน
  // โค้ดปัจจุบัน — status ถูกลดจาก "published" เป็น "pending_review" เสมอไป
  // แล้วด้านบน (ไฟล์ PDF ใหม่ยังไม่ผ่านสแกน) จึงไม่มี branch เรียก
  // notifyResearchPublished() ที่นี่ (จะเป็น dead code เพราะ status ไม่มีทาง
  // เป็น "published" ณ จุดนี้อีกต่อไป — TypeScript พิสูจน์ให้แล้วตอน build)
  // หากในอนาคตมีการเปลี่ยนตรรกะการลดสถานะข้างต้น ต้องเพิ่มการเรียก
  // notifyResearchPublished() (lib/publishing/publish-event.server.ts) กลับมา
  // ที่นี่ด้วย — ดู docs/document-access-requests.md

  redirect(`/dashboard/research/${inserted.id}/edit`);
}
