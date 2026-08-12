import "server-only";

/**
 * ตรวจสอบชนิดไฟล์จริงจาก byte แรกของเนื้อไฟล์ (magic bytes/file signature)
 * แทนการเชื่อ MIME type/นามสกุลที่ Client ประกาศมาเพียงอย่างเดียว — ใช้คู่กับ
 * lib/storage/limits.ts (ตรวจนามสกุล/MIME ที่ Client ประกาศ) และ Storage bucket
 * allowed_mime_types (บังคับที่ตัว Storage service) เป็นชั้นตรวจสอบสุดท้ายที่
 * เห็นเนื้อไฟล์จริง (ดู lib/security/validate-upload.server.ts)
 */

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const ICO_SIGNATURE = [0x00, 0x00, 0x01, 0x00];
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .doc เก่า
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // .docx (OOXML) เป็นไฟล์ zip

function matchesBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function isWebp(bytes: Uint8Array): boolean {
  // RIFF <4-byte size> WEBP
  return (
    matchesBytes(bytes, [0x52, 0x49, 0x46, 0x46], 0) &&
    matchesBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  );
}

/**
 * SVG เป็นฟอร์แมตข้อความ (XML) ไม่มี magic bytes แบบไบนารีตายตัว — ตรวจแบบ
 * โครงสร้างแทน (ขึ้นต้นด้วย <?xml หรือ <svg หลังตัด BOM/ช่องว่างแล้ว) ยังไม่
 * รัดกุมเท่าไฟล์ไบนารี จึงยังต้องระวังเรื่อง script ฝังใน SVG แยกต่างหาก
 * (ดู docs/file-security.md หัวข้อข้อจำกัด)
 */
function isSvg(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.slice(0, 512))
    .toString("utf8")
    .replace(/^﻿/, "")
    .trimStart()
    .toLowerCase();
  return head.startsWith("<?xml") || head.startsWith("<svg");
}

/** ตรวจแล้วคืนค่า MIME type ที่ตรวจพบจริงจากเนื้อไฟล์ หรือ null หากไม่รู้จัก */
export function detectFileSignature(bytes: Uint8Array): string | null {
  if (matchesBytes(bytes, PDF_SIGNATURE)) return "application/pdf";
  if (matchesBytes(bytes, PNG_SIGNATURE)) return "image/png";
  if (matchesBytes(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  if (isWebp(bytes)) return "image/webp";
  if (matchesBytes(bytes, ICO_SIGNATURE)) return "image/x-icon";
  if (matchesBytes(bytes, OLE2_SIGNATURE)) return "application/msword";
  // ไฟล์ตระกูล OOXML (.docx/.xlsx/.pptx) ใช้ signature เดียวกัน (zip) แยกชนิด
  // กันแน่ชัดจาก magic bytes อย่างเดียวไม่ได้ — คืนค่าเป็น docx เมื่อพบ zip
  // signature เนื่องจากเป็นชนิดเดียวในตระกูลนี้ที่ระบบอนุญาตอยู่ในปัจจุบัน
  if (matchesBytes(bytes, ZIP_SIGNATURE)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (isSvg(bytes)) return "image/svg+xml";
  return null;
}

export interface SignatureCheckResult {
  ok: boolean;
  detectedType: string | null;
  reason?: string;
}

/**
 * เทียบชนิดไฟล์ที่ตรวจพบจริงกับ MIME type ที่ Client ประกาศ และรายการที่อนุญาต
 * สำหรับฟิลด์นั้นๆ (PDF/ภาพปก/เอกสารแนบ) — ต้องตรงกันทั้งสองอย่าง มิฉะนั้นถือว่า
 * ไฟล์ไม่ผ่านการตรวจสอบ (นามสกุล/MIME ไม่ตรงกับเนื้อไฟล์จริง)
 */
export function validateFileSignature(
  bytes: Uint8Array,
  declaredMimeType: string,
  allowedTypes: readonly string[]
): SignatureCheckResult {
  const detectedType = detectFileSignature(bytes);

  if (!detectedType) {
    return {
      ok: false,
      detectedType: null,
      reason: "ไม่รู้จักชนิดไฟล์จากเนื้อไฟล์จริง (ไม่พบ file signature ที่รองรับ)",
    };
  }

  if (!allowedTypes.includes(detectedType)) {
    return {
      ok: false,
      detectedType,
      reason: `เนื้อไฟล์จริงเป็นชนิด ${detectedType} ซึ่งไม่อยู่ในรายการที่อนุญาตสำหรับฟิลด์นี้`,
    };
  }

  if (detectedType !== declaredMimeType) {
    return {
      ok: false,
      detectedType,
      reason: `ชนิดไฟล์ที่ประกาศ (${declaredMimeType}) ไม่ตรงกับเนื้อไฟล์จริงที่ตรวจพบ (${detectedType})`,
    };
  }

  return { ok: true, detectedType };
}
