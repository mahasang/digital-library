/**
 * ระบบปกงานวิจัยตามหมวดหมู่ (Hallmark Audit Phase 1)
 *
 * ปกตัวอย่าง 10 ไฟล์ใน public/covers/*.svg (cover-01.svg..cover-10.svg) เป็น
 * ภาพ placeholder ที่ seed/mock data ใช้แทนปกจริง (ไล่สี + ป้ายหมวดหมู่ภาษา
 * อังกฤษฝังตายตัวในไฟล์) ไม่ใช่ภาพที่ผู้วิจัยอัปโหลดเองผ่าน submit-research —
 * จึงถือว่า "ไม่มีปกจริง" และควรแสดงด้วยระบบปกตามหมวดหมู่แบบใหม่แทน
 * ส่วนภาพที่อัปโหลดจริงผ่าน Supabase Storage (bucket research-covers) จะมี
 * URL รูปแบบอื่นเสมอ จึงไม่ตรงกับ pattern นี้ และจะแสดงตามที่อัปโหลดไว้เหมือนเดิม
 */
const PLACEHOLDER_COVER_PATTERN = /\/covers\/cover-\d+\.svg$/;

export function hasRealCoverImage(coverImage: string | null | undefined): boolean {
  if (!coverImage) return false;
  return !PLACEHOLDER_COVER_PATTERN.test(coverImage);
}

/** จำนวนโทนสีปกตามหมวดหมู่ที่กำหนดไว้ล่วงหน้า (ดู .cover-tone-0..7 ใน globals.css) */
export const CATEGORY_COVER_TONE_COUNT = 8;

/**
 * แฮชข้อความแบบ deterministic (ไม่ใช้ Math.random/เวลาปัจจุบัน) — categoryId
 * เดียวกันจะได้ค่าดัชนีโทนสีเดิมเสมอทุกครั้งที่ render ทั้งฝั่งเซิร์ฟเวอร์และ
 * ไคลเอนต์ และคงที่แม้จะรีเฟรชหน้าเว็บ จึงทำให้แต่ละหมวดหมู่มี "สี/สไตล์ปก"
 * ประจำตัวที่ไม่เปลี่ยนไปมา ตรงข้ามกับปก placeholder เดิมที่กำหนดสีตามไฟล์
 * ที่สุ่มหยิบมาใช้ ไม่ได้ผูกกับหมวดหมู่จริง
 */
export function getCategoryToneIndex(categoryId: string | null | undefined): number {
  const key = categoryId || "uncategorized";
  // เริ่มจาก seed คงที่ (ไม่ใช่ 0) แบบเดียวกับ djb2 — เลือกค่านี้เพราะเมื่อ
  // ทดสอบกับ id ของ 8 หมวดหมู่จริงในระบบ (ดู data/categories.ts) แล้วกระจาย
  // ครบทั้ง 8 โทนสีพอดี ไม่มีหมวดหมู่ไหนโทนซ้ำกัน — ยังคง deterministic และ
  // ใช้ได้กับหมวดหมู่ใหม่ที่อาจเพิ่มภายหลังเช่นเดิม
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % CATEGORY_COVER_TONE_COUNT;
}
