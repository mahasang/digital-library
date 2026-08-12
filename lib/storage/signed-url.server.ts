import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { canDownload, canReadOnline } from "@/lib/labels";
import type { AccessLevel } from "@/types/research";
import type { ScanStatusRow } from "@/lib/supabase/database.types";

const UNSAFE_SCAN_STATUSES: readonly ScanStatusRow[] = ["pending", "infected", "error"];

export interface SignedUrlResult {
  url: string | null;
  error: string | null;
}

const READ_URL_EXPIRES_SECONDS = 60 * 30; // 30 นาที — เพียงพอสำหรับอ่านออนไลน์หนึ่งรอบ
const DOWNLOAD_URL_EXPIRES_SECONDS = 60; // 1 นาที — ใช้ครั้งเดียวทันทีหลังคลิกดาวน์โหลด

/**
 * สร้าง Signed URL สำหรับไฟล์ใน private bucket ด้วย Service Role
 * (ข้าม Storage RLS — ต้องตรวจสอบสิทธิ์ผู้ใช้ด้วยตนเองก่อนเรียกฟังก์ชันนี้เสมอ)
 */
async function createSignedUrlForPath(
  bucket: "research-documents" | "submission-attachments",
  path: string,
  expiresInSeconds: number,
  downloadFileName?: string
): Promise<SignedUrlResult> {
  if (!isServiceRoleConfigured()) {
    return {
      url: null,
      error:
        "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงไม่สามารถสร้างลิงก์เข้าถึงไฟล์ได้ กรุณาตรวจสอบไฟล์ .env.local",
    };
  }

  const service = createServiceRoleClient();
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(
      path,
      expiresInSeconds,
      downloadFileName ? { download: downloadFileName } : undefined
    );

  if (error || !data) {
    if (error) {
      console.error(`createSignedUrl failed for ${bucket}/${path}:`, error.message);
    }
    return {
      url: null,
      error: "ไม่สามารถสร้างลิงก์เข้าถึงไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
    };
  }

  return { url: data.signedUrl, error: null };
}

/**
 * Signed URL สำหรับ "อ่านออนไลน์" เอกสารที่เผยแพร่แล้ว — บังคับตามสิทธิ์ accessLevel
 * (metadata_only ไม่อนุญาตให้อ่าน) ใช้สำหรับผู้อ่านทั่วไปตามสิทธิ์การเข้าถึง
 *
 * `hasReadGrant` (ค่าเริ่มต้น false) คือชั้นสิทธิ์เสริมจากระบบขอสิทธิ์เข้าถึง
 * เอกสาร (document_access_grants, ช่วงที่ 18) — OR เข้ากับ canReadOnline เดิม
 * เท่านั้น ไม่เคยแทนที่ access_level หลักของเอกสาร ผู้เรียกต้องตรวจสอบ grant
 * เอง (เช่น hasActiveAccessGrantBySlug) ก่อนส่งค่า true มาที่นี่
 */
export async function getResearchReadUrl(
  pdfFile: string,
  accessLevel: AccessLevel,
  hasReadGrant = false,
  scanStatus?: ScanStatusRow
): Promise<SignedUrlResult> {
  if (!canReadOnline(accessLevel) && !hasReadGrant) {
    return { url: null, error: "งานวิจัยนี้ไม่อนุญาตให้อ่านฉบับเต็มออนไลน์" };
  }
  if (!pdfFile) {
    return { url: null, error: "ไม่พบไฟล์เอกสารของงานวิจัยนี้" };
  }
  if (scanStatus && UNSAFE_SCAN_STATUSES.includes(scanStatus)) {
    return {
      url: null,
      error: "ไฟล์เอกสารนี้ยังไม่ผ่านการตรวจสอบความปลอดภัย กรุณาลองใหม่อีกครั้งภายหลัง",
    };
  }
  return createSignedUrlForPath("research-documents", pdfFile, READ_URL_EXPIRES_SECONDS);
}

/**
 * Signed URL สำหรับ "ดาวน์โหลด" เอกสารที่เผยแพร่แล้ว — บังคับตามสิทธิ์ accessLevel
 * (read_only/metadata_only ไม่อนุญาตให้ดาวน์โหลด) หมดอายุเร็วกว่าลิงก์อ่าน
 *
 * `hasDownloadGrant` — ดูหมายเหตุเดียวกับ getResearchReadUrl ด้านบน
 */
export async function getResearchDownloadUrl(
  pdfFile: string,
  accessLevel: AccessLevel,
  downloadFileName?: string,
  hasDownloadGrant = false,
  scanStatus?: ScanStatusRow
): Promise<SignedUrlResult> {
  if (!canDownload(accessLevel) && !hasDownloadGrant) {
    return { url: null, error: "งานวิจัยนี้ไม่อนุญาตให้ดาวน์โหลด" };
  }
  if (!pdfFile) {
    return { url: null, error: "ไม่พบไฟล์เอกสารของงานวิจัยนี้" };
  }
  if (scanStatus && UNSAFE_SCAN_STATUSES.includes(scanStatus)) {
    return {
      url: null,
      error: "ไฟล์เอกสารนี้ยังไม่ผ่านการตรวจสอบความปลอดภัย กรุณาลองใหม่อีกครั้งภายหลัง",
    };
  }
  return createSignedUrlForPath(
    "research-documents",
    pdfFile,
    DOWNLOAD_URL_EXPIRES_SECONDS,
    downloadFileName
  );
}

/**
 * Signed URL สำหรับดูตัวอย่างเอกสาร "ก่อนเผยแพร่" (เจ้าของงาน/librarian/admin
 * ในหน้าจัดการภายใน) — ไม่ตรวจ accessLevel เนื่องจากการมองเห็นแถวข้อมูลถูก
 * จำกัดด้วย RLS ของ research_items อยู่แล้ว (เจ้าของหรือ rank >= 30 เท่านั้น
 * ที่ query แถวที่ยังไม่ publish ออกมาได้ตั้งแต่แรก)
 */
export async function getResearchDocumentPreviewUrl(
  pdfFile: string
): Promise<SignedUrlResult> {
  if (!pdfFile) {
    return { url: null, error: "ไม่พบไฟล์เอกสารของงานวิจัยนี้" };
  }
  return createSignedUrlForPath("research-documents", pdfFile, READ_URL_EXPIRES_SECONDS);
}

export async function getAttachmentPreviewUrl(
  attachmentFile: string
): Promise<SignedUrlResult> {
  if (!attachmentFile) {
    return { url: null, error: "ไม่มีไฟล์แนบ" };
  }
  return createSignedUrlForPath(
    "submission-attachments",
    attachmentFile,
    READ_URL_EXPIRES_SECONDS
  );
}
