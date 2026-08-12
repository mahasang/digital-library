import Image from "next/image";
import Link from "next/link";
import { BookOpenText, Clock } from "lucide-react";
import AccessBadge from "@/components/research/AccessBadge";
import CategoryCover from "@/components/research/CategoryCover";
import { hasRealCoverImage } from "@/lib/categoryCover";
import { getCategoryById } from "@/data/categories";
import { canReadOnline } from "@/lib/labels";
import type { ResearchItem } from "@/types/research";

/**
 * แถวรายการงานวิจัยที่ใช้ร่วมกันระหว่างหน้ารายการโปรดและประวัติการอ่าน
 * (Hallmark Audit Phase 3) — ให้สองหน้านี้มีหน้าตาสอดคล้องกันจริงๆ (component
 * เดียวกัน) โดยไม่แตะ ResearchCard/ResearchGrid ที่หน้าสาธารณะอื่นใช้อยู่
 *
 * ส่ง `readAt` เฉพาะบริบทประวัติการอ่านเท่านั้น — เมื่อส่งมา แถวจะแสดงเวลาที่
 * อ่านล่าสุด และปุ่ม "อ่านต่อ" ที่ลิงก์ตรงไปหน้าอ่าน (ถ้าเอกสารนี้ยังอ่าน
 * ออนไลน์ได้อยู่) ใช้ลิงก์จริงสองอันซ้อนกันด้วยเทคนิค stretched-link แทนการ
 * ซ้อน <a> ใน <a> ที่ผิดหลัก HTML — ทั้งสองอันกดและ Tab ถึงได้อิสระจากกัน
 */
export default function AccountResearchRow({
  item,
  readAt,
}: {
  item: ResearchItem;
  readAt?: string;
}) {
  const category = getCategoryById(item.categoryId);
  const showRealCover = hasRealCoverImage(item.coverImage);
  const readable = canReadOnline(item.accessLevel);
  const authorLabel = item.researchers.map((r) => r.name).join(", ") || item.organization;

  return (
    <div className="group relative flex gap-3 rounded-xl border border-gray-200 bg-surface p-3 transition-shadow hover:shadow-elevated-sm sm:gap-4 sm:p-4">
      <div className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-28 sm:w-20">
        {showRealCover ? (
          <Image
            src={item.coverImage}
            alt={`ปกงานวิจัย: ${item.titleTh}`}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <CategoryCover category={category} iconClassName="h-6 w-6" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
        <div>
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            <Link href={`/research/${item.id}`} className="static after:absolute after:inset-0">
              {item.titleTh}
            </Link>
          </h2>
          <p className="mt-1 line-clamp-1 text-xs text-gray-500">{authorLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AccessBadge accessLevel={item.accessLevel} />
          {category && <span className="text-xs text-gray-500">{category.nameTh}</span>}
          {readAt && (
            <span className="flex items-center gap-1 text-xs text-gray-500 sm:hidden">
              <Clock className="h-3.5 w-3.5" />
              อ่านเมื่อ{" "}
              {new Date(readAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
      </div>

      {readAt && (
        <div className="hidden shrink-0 flex-col items-end justify-between gap-2 sm:flex">
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            อ่านเมื่อ{" "}
            {new Date(readAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          {readable && (
            <Link
              href={`/research/${item.id}/read`}
              aria-label={`อ่านต่อ: ${item.titleTh}`}
              className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-soft-hover"
            >
              <BookOpenText className="h-3.5 w-3.5" />
              อ่านต่อ
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
