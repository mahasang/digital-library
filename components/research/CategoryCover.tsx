import { BookOpen } from "lucide-react";
import { getCategoryIcon } from "@/lib/icons";
import { getCategoryToneIndex } from "@/lib/categoryCover";
import type { Category } from "@/types/research";

/**
 * ปกงานวิจัยที่สร้างขึ้นตามหมวดหมู่ — ใช้แทนที่เมื่อไม่มีปกจริงที่อัปโหลดไว้
 * (ดู lib/categoryCover.ts) สีของแต่ละหมวดหมู่คงที่เสมอ ไม่ใช่การไล่สีแบบสุ่ม
 */
export default function CategoryCover({
  category,
  iconClassName = "h-10 w-10",
}: {
  category: Category | undefined;
  iconClassName?: string;
}) {
  const Icon = category ? getCategoryIcon(category.icon) : BookOpen;
  const toneIndex = getCategoryToneIndex(category?.id);

  return (
    <div
      className={`cover-tone-${toneIndex} relative flex h-full w-full flex-col items-center justify-center gap-3 px-4`}
      style={{ background: "var(--tone-bg)", color: "var(--tone-fg)" }}
    >
      <div
        className="pointer-events-none absolute inset-3 rounded-lg border"
        style={{ borderColor: "var(--tone-line)" }}
        aria-hidden="true"
      />
      <Icon className={iconClassName} strokeWidth={1.5} aria-hidden="true" />
      <span className="text-center text-[11px] font-semibold uppercase tracking-wider">
        {category?.nameTh ?? "งานวิจัย"}
      </span>
    </div>
  );
}
