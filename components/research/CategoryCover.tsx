import { BookOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getCategoryIcon } from "@/lib/icons";
import { getCategoryName } from "@/lib/categoryName";
import type { Category } from "@/types/research";

/**
 * ปกงานวิจัยที่สร้างขึ้นเมื่อไม่มีปกจริงที่อัปโหลดไว้ (ดู lib/categoryCover.ts)
 * ออกแบบเป็นเล่มเย็บจริง: ผ้าปกสีกรมท่า สันปกด้านซ้าย และกรอบตัวอักษรสีครีม
 *
 * - ส่ง `title` มา: แสดงเป็นหน้าปกเรียงพิมพ์จากข้อมูลจริงของงาน (หมวดหมู่ ชื่อเรื่อง
 *   ผู้วิจัย ปี) ใช้กับการ์ดและหน้ารายละเอียด ข้อความซ่อนจาก screen reader เพราะ
 *   ซ้ำกับข้อความในการ์ด/ลิงก์ที่อยู่รอบนอก
 * - ไม่ส่ง `title`: แสดงเฉพาะไอคอนหมวดหมู่ สำหรับภาพย่อที่เล็กเกินกว่าจะอ่านได้
 */
export default function CategoryCover({
  category,
  iconClassName = "h-10 w-10",
  title,
  author,
  year,
}: {
  category: Category | undefined;
  iconClassName?: string;
  title?: string;
  author?: string;
  year?: number | string;
}) {
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const Icon = category ? getCategoryIcon(category.icon) : BookOpen;

  return (
    <div className="cover-cloth relative h-full w-full overflow-hidden" aria-hidden="true">
      <span className="cover-spine absolute inset-y-0 left-0" />
      {title ? (
        <div className="cover-frame absolute flex flex-col">
          <span className="cover-meta line-clamp-1">{category ? getCategoryName(category, locale) : tNav("research")}</span>
          <span className="cover-title mt-[12%]">{title}</span>
          <span className="cover-meta mt-auto pt-2">
            {author && <span className="line-clamp-1">{author}</span>}
            {year && <span className="block tabular-nums">{year}</span>}
          </span>
        </div>
      ) : (
        <span className="absolute inset-y-0 left-[6%] right-0 flex items-center justify-center">
          <Icon className={iconClassName} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
