import type { Category } from "@/types/research";

/**
 * ชื่อหมวดหมู่ตาม locale สำหรับหน้าสาธารณะ — ตาราง categories มีแค่ name_th และ
 * name_en จึงแปลได้เฉพาะ en ส่วน locale อื่น (lo, vi) ใช้ชื่อภาษาไทยไปก่อนจนกว่า
 * จะมีคอลัมน์ของภาษานั้น ถ้า nameEn ว่างก็ใช้ภาษาไทยเช่นกัน
 */
export function getCategoryName(
  category: Pick<Category, "nameTh" | "nameEn">,
  locale: string,
): string {
  if (locale === "en") return category.nameEn.trim() || category.nameTh;
  return category.nameTh;
}
