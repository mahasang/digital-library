import type { Category } from "@/types/research";

const TRANSLATED_NAME_FIELD: Partial<Record<string, "nameEn" | "nameLo" | "nameVi">> = {
  en: "nameEn",
  lo: "nameLo",
  vi: "nameVi",
};

/**
 * ชื่อหมวดหมู่ตาม locale — จุดเดียวที่ตัดสินใจว่าจะแสดงชื่อภาษาอะไร ถ้า locale นั้น
 * ไม่มีคำแปล (null, ว่าง หรือมีแต่ช่องว่าง) จะใช้ชื่อภาษาไทยแทน
 */
export function getCategoryName(
  category: Pick<Category, "nameTh" | "nameEn" | "nameLo" | "nameVi">,
  locale: string,
): string {
  const field = TRANSLATED_NAME_FIELD[locale];
  const translated = field ? category[field]?.trim() : "";
  return translated || category.nameTh;
}
