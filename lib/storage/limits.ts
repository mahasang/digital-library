/**
 * ข้อจำกัดชนิดและขนาดไฟล์ — ชนิดไฟล์ที่รองรับต้องตรงกับ allowed_mime_types
 * ของแต่ละ bucket ใน supabase/migrations/20260801100100_storage_buckets.sql
 * เสมอ (คงที่ ไม่ได้ปรับผ่าน System Settings)
 *
 * ส่วนขนาดไฟล์สูงสุดเป็นค่าเริ่มต้น/fallback เท่านั้น — ค่าจริงที่ใช้แสดงผลต้อง
 * ดึงจาก `settings.maxPdfSizeMb`/`maxCoverSizeMb`/`maxAttachmentSizeMb`
 * (`lib/data/settings.server.ts`) แบบไดนามิกเสมอ เพื่อให้ตรงกับค่าที่ผู้ดูแล
 * ปรับไว้ที่ /superadmin/system-settings — ค่าเริ่มต้นด้านล่างใช้เฉพาะตอนยังไม่มี
 * แถวการตั้งค่าในฐานข้อมูล (`DEFAULT_SETTINGS`) เท่านั้น
 *
 * การตรวจสอบฝั่ง client นี้เป็นเพียง UX (แจ้งผลทันทีก่อนอัปโหลด) — การบังคับใช้
 * จริงอยู่ที่ Storage bucket (`file_size_limit`/`allowed_mime_types`) ซึ่งซิงก์
 * กับค่าการตั้งค่าอัตโนมัติผ่าน `superadmin_update_bucket_limit()` จึงยังทำงาน
 * ถูกต้องเสมอแม้ผู้ใช้จะแก้ไข/ปิด JavaScript ฝั่ง client
 */

export const DEFAULT_PDF_MAX_SIZE_MB = 50;
export const PDF_ALLOWED_TYPES = ["application/pdf"];
export const PDF_ALLOWED_EXTENSIONS = [".pdf"];

export const DEFAULT_COVER_MAX_SIZE_MB = 5;
export const COVER_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
export const COVER_ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

export const DEFAULT_ATTACHMENT_MAX_SIZE_MB = 20;
export const ATTACHMENT_ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ATTACHMENT_ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"];

export const DEFAULT_AVATAR_MAX_SIZE_MB = 5;
export const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const AVATAR_ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export const SITE_ASSET_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];
export const SITE_ASSET_ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"];

/** MIME type ที่ browser รายงาน (`file.type`) → นามสกุลไฟล์ที่ควรจะเป็น — ใช้กัน
 * ไฟล์ที่เปลี่ยนนามสกุลหลอกลวง (เช่น เปลี่ยน .exe เป็น .pdf) โดยดูจากสิ่งที่
 * browser ตรวจพบจริงจากเนื้อไฟล์เทียบกับนามสกุลที่ผู้ใช้ตั้งชื่อไว้ */
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
  "image/x-icon": [".ico"],
  "image/vnd.microsoft.icon": [".ico"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

/**
 * ตรวจว่านามสกุลไฟล์ตรงกับ MIME type ที่ browser ตรวจพบหรือไม่ — เป็นการ
 * ตรวจสอบฝั่ง client เท่านั้น (ป้องกันการเปลี่ยนนามสกุลแบบพื้นฐาน ไม่ใช่การ
 * ตรวจเนื้อไฟล์จริงแบบ magic-byte) ต้องใช้คู่กับการตรวจสอบฝั่งเซิร์ฟเวอร์เสมอ
 */
export function isExtensionMatchingMimeType(filename: string, mimeType: string): boolean {
  const allowed = MIME_TO_EXTENSIONS[mimeType];
  if (!allowed) return false;
  return allowed.includes(getExtension(filename));
}

/**
 * ตรวจว่า path/ชื่อไฟล์มีนามสกุลอยู่ในรายการที่อนุญาตหรือไม่ — ใช้ตรวจซ้ำฝั่ง
 * เซิร์ฟเวอร์ก่อนบันทึกพาธไฟล์ลงฐานข้อมูลเสมอ (ดู lib/validation/submission.ts)
 * ห้ามเชื่อการตรวจสอบฝั่ง client เพียงอย่างเดียว
 */
export function isExtensionAllowed(path: string, allowedExtensions: string[]): boolean {
  return allowedExtensions.includes(getExtension(path));
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSizeBytes: number
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `ชนิดไฟล์ไม่ถูกต้อง รองรับเฉพาะ ${allowedTypes.join(", ")}`;
  }
  if (!isExtensionMatchingMimeType(file.name, file.type)) {
    return "นามสกุลไฟล์ไม่ตรงกับชนิดไฟล์ที่ตรวจพบ กรุณาตรวจสอบไฟล์อีกครั้ง";
  }
  if (file.size > maxSizeBytes) {
    return `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${formatFileSize(maxSizeBytes)})`;
  }
  return null;
}
