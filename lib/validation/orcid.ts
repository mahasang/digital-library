/**
 * ตรวจสอบรูปแบบและ checksum ของ ORCID iD (ISO 7064 MOD 11-2) — ไม่ได้เรียก
 * ORCID API ใดๆ เลย เป็นเพียงการตรวจ "รูปแบบตัวเลขถูกต้องตามอัลกอริทึม" เท่านั้น
 * ห้ามถือว่าผ่านการตรวจนี้แล้วเท่ากับ "ยืนยันจาก ORCID จริง" — การยืนยันจริง
 * ต้องเชื่อม ORCID API/OAuth (ดู docs/orcid-integration.md) ซึ่งยังไม่ได้ทำใน
 * เวอร์ชันนี้ ระบบจึงมีแค่สถานะ "เจ้าหน้าที่ตรวจสอบแล้วด้วยตนเอง" (orcid_verified_at)
 */

const ORCID_SHAPE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** คำนวณอักขระตรวจสอบ (checksum) ตาม ISO 7064 MOD 11-2 จาก 15 หลักแรกของ ORCID */
function computeOrcidChecksum(first15Digits: string): string {
  let total = 0;
  for (const digit of first15Digits) {
    total = (total + Number(digit)) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  return result === 10 ? "X" : String(result);
}

export interface OrcidValidationResult {
  valid: boolean;
  formatted: string | null;
  error: string | null;
}

/**
 * รับ ORCID ในรูปแบบใดก็ได้ (มี/ไม่มีขีด, มี/ไม่มี https://orcid.org/ นำหน้า)
 * แล้วคืนค่ารูปแบบมาตรฐาน 0000-0000-0000-000X พร้อมผล checksum
 */
export function validateOrcid(raw: string): OrcidValidationResult {
  const stripped = raw.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "");
  const digitsOnly = stripped.replace(/-/g, "").toUpperCase();

  if (digitsOnly.length !== 16 || !/^\d{15}[\dX]$/.test(digitsOnly)) {
    return { valid: false, formatted: null, error: "รูปแบบ ORCID ไม่ถูกต้อง (ต้องเป็น 0000-0000-0000-0000)" };
  }

  const formatted = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 8)}-${digitsOnly.slice(8, 12)}-${digitsOnly.slice(12, 16)}`;
  if (!ORCID_SHAPE.test(formatted)) {
    return { valid: false, formatted: null, error: "รูปแบบ ORCID ไม่ถูกต้อง (ต้องเป็น 0000-0000-0000-0000)" };
  }

  const expectedChecksum = computeOrcidChecksum(digitsOnly.slice(0, 15));
  const actualChecksum = digitsOnly[15];
  if (expectedChecksum !== actualChecksum) {
    return { valid: false, formatted: null, error: "ORCID นี้ไม่ถูกต้อง (checksum ไม่ตรงกัน กรุณาตรวจสอบตัวเลขอีกครั้ง)" };
  }

  return { valid: true, formatted, error: null };
}

export function orcidProfileUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`;
}
