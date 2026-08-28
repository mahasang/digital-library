import { SearchX } from "lucide-react";
import ResearchCard, { type ResearchCardItem } from "@/components/research/ResearchCard";

export default function ResearchGrid({
  items,
  rankStart,
  footerMode = "default",
}: {
  items: ResearchCardItem[];
  /** เริ่มแสดงตราอันดับจากเลขนี้ (เช่น 1) — ไม่ส่ง prop นี้เพื่อไม่แสดงตราอันดับ */
  rankStart?: number;
  footerMode?: "default" | "recency";
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center">
        <SearchX className="h-8 w-8 text-gray-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-gray-700">ไม่พบงานวิจัยที่ตรงกับเงื่อนไข</p>
        <p className="mt-1 text-sm text-gray-500">
          ลองปรับคำค้นหาหรือเปลี่ยนหมวดหมู่ดูใหม่อีกครั้ง
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <ResearchCard
          key={item.id}
          item={item}
          rank={typeof rankStart === "number" ? rankStart + index : undefined}
          footerMode={footerMode}
          priority={index === 0}
        />
      ))}
    </div>
  );
}
