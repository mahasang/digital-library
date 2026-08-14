"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { submissionSchema } from "@/lib/validation/submission";
import { getSettings } from "@/lib/data/settings.server";
import { checkRateLimit, rateLimitKeyForIp } from "@/lib/rate-limit.server";
import { verifyCaptchaIfEnabled } from "@/lib/captcha.server";
import {
  generateResearchSlug,
  replaceResearchRelations,
} from "@/lib/data/submission-write.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { validateSubmissionFiles } from "@/lib/security/validate-upload.server";
import { enqueueInitialFileProcessingJobs } from "@/lib/jobs/enqueue-research-jobs.server";
import { detectDuplicatesForResearchItem } from "@/lib/data/duplicate-research.server";
import { logAudit } from "@/lib/data/audit.server";
import type { ActionResult } from "@/lib/actions/types";

const SUBMISSION_FIELD_TO_SCHEMA_KEY = {
  pdf: "pdfPath",
  cover: "coverPath",
  attachment: "attachmentPath",
} as const;

export async function submitResearchAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: "ระบบยังไม่ได้เชื่อมต่อ Supabase จึงยังไม่สามารถส่งงานวิจัยได้",
    };
  }

  const settings = await getSettings();
  if (!settings.submissionEnabled) {
    return {
      status: "error",
      message: "ระบบปิดรับการส่งงานวิจัยใหม่ชั่วคราว กรุณาติดต่อผู้ดูแลระบบ",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 20) {
    return {
      status: "error",
      message: "คุณไม่มีสิทธิ์ส่งงานวิจัย ต้องเป็นบุคลากรขององค์กรขึ้นไป",
    };
  }

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { allowed } = await checkRateLimit(
    rateLimitKeyForIp("submit-research", clientIp ?? user.id),
    settings.rateLimitSubmitMax,
    settings.rateLimitSubmitWindowSec
  );
  if (!allowed) {
    return {
      status: "error",
      message: "มีการส่งงานวิจัยบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง",
    };
  }

  const captchaResult = await verifyCaptchaIfEnabled(
    settings.captchaEnabled,
    formData.get("turnstileToken")
  );
  if (!captchaResult.ok) {
    return { status: "error", message: captchaResult.message };
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
  // pdf เป็นฟิลด์บังคับและเป็นการอัปโหลดใหม่เสมอตอนส่งงานวิจัยครั้งแรก (ไม่มี
  // แถวเดิมให้เทียบ) จึงมีผลสแกนเสมอเมื่อ fileCheck.ok เป็น true
  const pdfScan = fileCheck.scans.pdf!;

  const intentRaw = formData.get("intent");
  const intent =
    intentRaw === "pending_review" || intentRaw === "draft"
      ? intentRaw
      : settings.defaultResearchStatus;
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
      status: intent,
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
        "submitResearchAction insert failed"
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
        "submitResearchAction replaceResearchRelations failed"
      ),
    };
  }

  // สแกนความปลอดภัย + ดึงข้อความจาก PDF ย้ายไปเป็น background job ทั้งคู่ (ช่วง
  // ที่ 20) — enqueue เท่านั้น ไม่รอผล ไม่ throw ออกมาเอง จึงไม่ทำให้การส่งงาน
  // วิจัยล้มเหลวแม้ job จะยังไม่เสร็จ/ล้มเหลวภายหลัง (scan_status = 'pending'
  // กันการเผยแพร่/ออก Signed URL ไว้แล้วจนกว่า job จะสแกนเสร็จ)
  await enqueueInitialFileProcessingJobs({
    researchItemId: inserted.id,
    pdfPath: parsed.data.pdfPath,
    userId: user.id,
  });

  // ตรวจสอบงานวิจัยซ้ำ — ไม่เคยบล็อกการส่งงานวิจัย แค่บันทึกคำเตือนไว้ให้
  // เจ้าหน้าที่ตรวจสอบที่ /dashboard/duplicate-reviews (ไม่ throw เองเช่นกัน)
  await detectDuplicatesForResearchItem(supabase, inserted.id);

  redirect(`/my-submissions/${inserted.id}`);
}
