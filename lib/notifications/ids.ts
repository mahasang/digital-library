/**
 * ตัวกรอง id การแจ้งเตือนที่ client ส่งมากับ server action
 * markNotificationsReadAction — server action เป็น endpoint สาธารณะ จึงไม่เชื่อ
 * input จาก client: รับเฉพาะ UUID ที่ถูกรูปแบบ ตัดซ้ำ และจำกัดจำนวนต่อครั้ง
 * (แผงกระดิ่งแสดงสูงสุด 10 รายการ — เผื่อไว้ 50)
 *
 * สิทธิ์จริงไม่ได้พึ่งฟังก์ชันนี้ — action ยังกรอง user_id = ผู้ใช้ปัจจุบัน และ
 * RLS ของตาราง notifications จำกัดแถวของตัวเองอีกชั้นหนึ่งเสมอ
 */
export const MAX_NOTIFICATION_IDS_PER_CALL = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeNotificationIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const unique = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) continue;
    unique.add(value.toLowerCase());
    if (unique.size >= MAX_NOTIFICATION_IDS_PER_CALL) break;
  }
  return [...unique];
}
