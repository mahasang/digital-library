/**
 * ตัดสินใจจากผลสแกนมัลแวร์แบบ synchronous ของ "ภาพปก/เอกสารแนบ" (ฟังก์ชันล้วน ไม่ผูก
 * กับ server-only จึงทดสอบได้ตรงๆ) — ใช้ใน lib/security/validate-upload.server.ts
 *
 * - infected → ปฏิเสธเสมอ
 * - error + บังคับสแกน + ตั้งค่า provider แล้วแต่ใช้งานไม่ได้ → ปฏิเสธ (fail closed)
 * - error + บังคับสแกน + "ยังไม่ได้ตั้งค่า provider เลย" (provider = "none") → รับไฟล์
 *   ที่ผ่านการตรวจเนื้อไฟล์/ชนิดไฟล์แล้วเท่านั้น และให้ผู้เรียกบันทึก audit log
 *   (ตัดสินใจร่วมกับเจ้าของระบบเมื่อ 2026-11-19: เดิมปฏิเสธทุกไฟล์ ทำให้ส่งงานพร้อมปก/
 *   เอกสารแนบบน production ไม่ได้เลยตราบใดที่ยังไม่มีระบบสแกน)
 * - error + ไม่บังคับสแกน, clean, skipped → รับตามปกติ
 *
 * ไม่เกี่ยวกับไฟล์ PDF หลัก (ไม่สแกนที่นี่ ไปสแกนใน background job และเผยแพร่ได้เฉพาะ
 * scan_status = clean/skipped ตาม trigger prevent_publish_unscanned_file)
 */

/** provider ที่ scanFileForMalware คืนเมื่อไม่ได้ตั้งค่า MALWARE_SCAN_PROVIDER เลย */
export const SCANNER_NOT_CONFIGURED_PROVIDER = "none";

export const UNSCANNED_ACCEPT_REASON =
  "ยังไม่ได้ตั้งค่าระบบสแกนมัลแวร์ — ผ่านการตรวจเนื้อไฟล์และชนิดไฟล์เท่านั้น";

export type SyncScanHandling =
  | "accept"
  | "accept_unscanned"
  | "reject_infected"
  | "reject_unavailable";

export function decideSyncScanHandling(
  outcome: { status: "clean" | "infected" | "error" | "skipped"; provider: string },
  scanRequired: boolean
): SyncScanHandling {
  if (outcome.status === "infected") return "reject_infected";
  if (outcome.status === "error") {
    if (!scanRequired) return "accept";
    return outcome.provider === SCANNER_NOT_CONFIGURED_PROVIDER
      ? "accept_unscanned"
      : "reject_unavailable";
  }
  return "accept";
}
