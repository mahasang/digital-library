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
