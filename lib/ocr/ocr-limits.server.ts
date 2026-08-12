import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import {
  isOcrConfigured,
  isOcrEnabled,
  isPrivateDocumentTransferAllowed,
  getConfiguredProviderKind,
  getOcrEnvLimits,
} from "@/lib/ocr/ocr-provider.server";
import { getPdfPageCount } from "@/lib/pdf/extract-text.server";
import { getSettings } from "@/lib/data/settings.server";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit.server";
import type { AppSettings } from "@/types/research";

/**
 * ตรวจสอบว่าเอกสารหนึ่งรายการมีสิทธิ์สร้างงาน OCR ได้หรือไม่ — เรียกจากทุกจุด
 * ที่สร้างงาน OCR (triggerOcrAction, bulkEnqueueOcrAction,
 * handleBulkEnqueueJob) **ก่อน** enqueueBackgroundJob() เสมอ เพื่อไม่ให้สร้าง
 * แถว background_jobs เลยหากเกินขีดจำกัด (ตามข้อกำหนด "ห้ามสร้าง OCR job")
 *
 * ลำดับการตรวจ: การตั้งค่า/สวิตช์เปิดปิด → ระดับการเข้าถึงเอกสารที่อนุญาต →
 * นโยบายเอกสาร private กับ external provider (ช่วงที่ 32) → ขนาดไฟล์ →
 * จำนวนหน้า → โควตาต่อผู้ใช้ต่อวัน (ตรวจโควตาไว้ท้ายสุดโดยตั้งใจ — รายการที่ถูก
 * ปฏิเสธจากเหตุผลอื่นอยู่แล้วไม่ควรกินโควตาของผู้ใช้ไปด้วย)
 *
 * **(ช่วงที่ 32)** ขนาดไฟล์/จำนวนหน้า/โควตาต่อวัน ใช้ `min(เพดานจาก
 * environment variable, ค่าที่ Super Admin ตั้งไว้ใน Settings)` เสมอ — env
 * เป็นเพดานสูงสุดที่ปรับได้แค่ตอน deploy เท่านั้น ส่วนค่าใน Settings ยังปรับ
 * แบบ live ได้ตามเดิมทุกประการ (ดู lib/ocr/ocr-provider.server.ts
 * getOcrEnvLimits())
 */

const RESEARCH_DOCUMENTS_BUCKET = "research-documents";

export type OcrEligibilityCode =
  | "not_configured"
  | "provider_disabled"
  | "access_level_not_allowed"
  | "private_document_not_allowed"
  | "file_too_large"
  | "too_many_pages"
  | "quota_exceeded"
  | "check_failed";

export type OcrEligibilityResult =
  | { ok: true; pageCount: number | null }
  | { ok: false; code: OcrEligibilityCode; message: string };

function splitStoragePath(pdfPath: string): { dir: string; filename: string } {
  const idx = pdfPath.lastIndexOf("/");
  if (idx === -1) return { dir: "", filename: pdfPath };
  return { dir: pdfPath.slice(0, idx), filename: pdfPath.slice(idx + 1) };
}

export async function checkOcrEligibility(params: {
  researchItemId: string;
  pdfPath: string;
  accessLevel: string;
  /** research_items.page_count ปัจจุบัน (0 หมายถึงยังไม่เคยคำนวณ) */
  pageCount: number;
  actorUserId: string;
  settings?: AppSettings;
}): Promise<OcrEligibilityResult> {
  const settings = params.settings ?? (await getSettings());

  if (!isOcrConfigured() || !isOcrEnabled()) {
    return {
      ok: false,
      code: "not_configured",
      message: "ระบบ OCR ยังไม่ได้ตั้งค่าหรือยังไม่ได้เปิดใช้งาน",
    };
  }
  if (!settings.ocrProviderEnabled) {
    return { ok: false, code: "provider_disabled", message: "ผู้ดูแลระบบปิดการใช้งาน OCR ไว้ชั่วคราว" };
  }

  if (!settings.ocrAllowedAccessLevels.includes(params.accessLevel)) {
    return {
      ok: false,
      code: "access_level_not_allowed",
      message: "ระดับการเข้าถึงของเอกสารนี้ยังไม่ได้รับอนุญาตให้ส่ง OCR ตามนโยบายที่ตั้งไว้",
    };
  }

  // (ช่วงที่ 32) เอกสารที่ไม่ใช่ "public" ส่งไปยัง external provider ได้ก็ต่อเมื่อ
  // ได้รับอนุมัติเพิ่มอีกชั้นผ่าน OCR_ALLOW_PRIVATE_DOCUMENTS — self_hosted ไม่ตรวจ
  // เงื่อนไขนี้ (ถือว่าอยู่ในโครงสร้างพื้นฐานขององค์กรเอง)
  if (
    getConfiguredProviderKind() === "external_api" &&
    params.accessLevel !== "public" &&
    !isPrivateDocumentTransferAllowed()
  ) {
    return {
      ok: false,
      code: "private_document_not_allowed",
      message: "เอกสารระดับการเข้าถึงนี้ยังไม่ได้รับอนุญาตให้ส่งไปยังผู้ให้บริการ OCR ภายนอก (ตั้งค่า OCR_ALLOW_PRIVATE_DOCUMENTS=true เมื่อได้รับอนุมัติแล้ว)",
    };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: false, code: "check_failed", message: "ไม่สามารถตรวจสอบไฟล์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" };
  }
  const service = createServiceRoleClient();

  // (ช่วงที่ 32) เพดานที่ใช้บังคับจริง = min(env ceiling, ค่าที่ตั้งไว้ใน Settings)
  // — ไม่ได้ตั้งค่า env ถือว่าไม่มีเพดานเพิ่มจาก env (ใช้ค่า Settings อย่างเดียว
  // เหมือนช่วงที่ 27 เดิมทุกประการ)
  const envLimits = getOcrEnvLimits();
  const effectiveMaxFileSizeMb =
    envLimits.maxFileSizeMb !== null
      ? Math.min(envLimits.maxFileSizeMb, settings.ocrMaxFileSizeMb)
      : settings.ocrMaxFileSizeMb;
  const effectiveMaxPages =
    envLimits.maxPages !== null ? Math.min(envLimits.maxPages, settings.ocrMaxPages) : settings.ocrMaxPages;
  const effectiveMaxJobsPerDay =
    envLimits.maxJobsPerDay !== null
      ? Math.min(envLimits.maxJobsPerDay, settings.ocrMaxJobsPerUserPerDay)
      : settings.ocrMaxJobsPerUserPerDay;

  const { dir, filename } = splitStoragePath(params.pdfPath);
  const { data: listing, error: listError } = await service.storage
    .from(RESEARCH_DOCUMENTS_BUCKET)
    .list(dir, { search: filename, limit: 1 });

  const fileEntry = listing?.find((f) => f.name === filename);
  const sizeBytes = fileEntry?.metadata?.size;

  if (listError || !fileEntry || typeof sizeBytes !== "number") {
    console.error("checkOcrEligibility: ไม่สามารถตรวจสอบขนาดไฟล์ได้:", params.pdfPath, listError?.message);
    return { ok: false, code: "check_failed", message: "ไม่สามารถตรวจสอบขนาดไฟล์ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const maxBytes = effectiveMaxFileSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      code: "file_too_large",
      message: `ไฟล์มีขนาดเกิน ${effectiveMaxFileSizeMb} MB ที่กำหนดไว้สำหรับ OCR — แนะนำให้แบ่งไฟล์หรือให้เจ้าหน้าที่ดำเนินการตามนโยบาย`,
    };
  }

  let pageCount = params.pageCount || null;
  if (!pageCount) {
    const { data: blob, error: downloadError } = await service.storage
      .from(RESEARCH_DOCUMENTS_BUCKET)
      .download(params.pdfPath);
    if (downloadError || !blob) {
      console.error("checkOcrEligibility: ดาวน์โหลดไฟล์เพื่อนับจำนวนหน้าไม่สำเร็จ:", downloadError?.message);
      return {
        ok: false,
        code: "check_failed",
        message: "ไม่สามารถเปิดไฟล์เพื่อตรวจสอบจำนวนหน้าได้ กรุณาลองใหม่อีกครั้ง",
      };
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    const counted = await getPdfPageCount(buffer);
    if (counted === null) {
      return {
        ok: false,
        code: "check_failed",
        message: "ไม่สามารถตรวจสอบจำนวนหน้าของไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
      };
    }
    pageCount = counted;
    // cache กลับไปที่ research_items.page_count เพื่อไม่ต้องดาวน์โหลด/คำนวณซ้ำ
    // ในการตรวจครั้งถัดไป และให้หน้าแสดงรายละเอียดเอกสารใช้ค่านี้ได้ด้วย
    await service.from("research_items").update({ page_count: pageCount }).eq("id", params.researchItemId);
  }

  if (pageCount > effectiveMaxPages) {
    return {
      ok: false,
      code: "too_many_pages",
      message: `จำนวนหน้าเอกสาร (${pageCount} หน้า) เกิน ${effectiveMaxPages} หน้าที่กำหนดไว้สำหรับ OCR — แนะนำให้แบ่งไฟล์หรือให้เจ้าหน้าที่ดำเนินการตามนโยบาย`,
    };
  }

  if (settings.ocrDailyQuotaEnabled && params.actorUserId) {
    const { allowed } = await checkRateLimit(
      rateLimitKeyForUser("ocr_job", params.actorUserId),
      effectiveMaxJobsPerDay,
      86400
    );
    if (!allowed) {
      return {
        ok: false,
        code: "quota_exceeded",
        message: `เกินจำนวนงาน OCR สูงสุดที่อนุญาตต่อผู้ใช้ต่อวัน (${effectiveMaxJobsPerDay} งาน) กรุณาลองใหม่ในวันถัดไป`,
      };
    }
  }

  return { ok: true, pageCount };
}
