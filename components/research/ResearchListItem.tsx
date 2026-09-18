import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Eye, Calendar, CalendarClock, FileSearch, Star } from "lucide-react";
import AccessBadge from "@/components/research/AccessBadge";
import CategoryCover from "@/components/research/CategoryCover";
import { hasRealCoverImage } from "@/lib/categoryCover";
import { getCategoryById } from "@/data/categories";
import type { ResearchCardItem } from "@/components/research/ResearchCard";

/**
 * จัดรูปแบบวันที่เผยแพร่แบบไทย (ปี พ.ศ.) — duplicate จาก ResearchCard
 * เพื่อ keep scope เล็ก ถ้าต้องการ DRY ในอนาคตให้ย้ายไป lib/formatDate.ts
 */
function formatPublishedDate(publishedAt: string): string | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * ไฮไลต์ snippet — duplicate จาก ResearchCard เพื่อ keep scope เล็ก
 */
function HighlightedSnippet({
  snippet,
  matchStart,
  matchEnd,
}: {
  snippet: string;
  matchStart: number | null | undefined;
  matchEnd: number | null | undefined;
}) {
  const isValidStart = typeof matchStart === "number" && Number.isFinite(matchStart);
  const isValidEnd = typeof matchEnd === "number" && Number.isFinite(matchEnd);
  if (!isValidStart || !isValidEnd || matchStart < 0 || matchStart >= matchEnd) {
    return <>{snippet}</>;
  }
  return (
    <>
      {snippet.slice(0, matchStart)}
      <mark className="rounded bg-amber-200 px-0.5 text-gray-900">
        {snippet.slice(matchStart, matchEnd)}
      </mark>
      {snippet.slice(matchEnd)}
    </>
  );
}

/**
 * ResearchListItem — แสดงงานวิจัย 1 รายการในรูปแบบ list row (แนวนอน)
 * ใช้ใน ResearchGrid เมื่อ view="list"
 * ข้อมูลที่แสดง: thumbnail เล็ก, title, researchers, year/date, accessLevel,
 * views, rating, snippet (ถ้ามี)
 */
export default function ResearchListItem({
  item,
  footerMode = "default",
}: {
  item: ResearchCardItem;
  footerMode?: "default" | "recency";
}) {
  const category = getCategoryById(item.categoryId);
  const showRealCover = hasRealCoverImage(item.coverImage);
  const publishedLabel = footerMode === "recency" ? formatPublishedDate(item.publishedAt) : null;

  return (
    <Link
      href={`/research/${item.id}`}
      className="group flex items-start gap-4 rounded-lg border border-gray-200 bg-surface px-4 py-3.5 transition-colors hover:bg-surface-muted"
    >
      {/* Thumbnail — สัดส่วน 3:4, กว้างคงที่ ไม่ยืดหยุ่น */}
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
        {showRealCover ? (
          <Image
            src={item.coverImage}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <CategoryCover category={category} />
        )}
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Title */}
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-brand-700">
          {item.titleTh}
        </h2>

        {/* Researchers */}
        <p className="line-clamp-1 text-xs text-gray-500">
          {item.researchers.map((r) => r.name).join(", ")}
        </p>

        {/* Snippet (ถ้ามี) */}
        {item.snippet && (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-relaxed text-gray-600">
            <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
              <FileSearch className="h-3 w-3" aria-hidden="true" />
              พบในเนื้อหาเอกสาร
              {item.isOcrMatch && (
                <span className="font-normal text-amber-600">(จาก OCR อาจคลาดเคลื่อน)</span>
              )}
            </p>
            <p className="line-clamp-2">
              <HighlightedSnippet
                snippet={item.snippet}
                matchStart={item.snippetMatchStart}
                matchEnd={item.snippetMatchEnd}
              />
            </p>
          </div>
        )}

        {/* Meta row: date · access badge · views · rating */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-gray-500">
          {publishedLabel ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {publishedLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {item.year}
            </span>
          )}
          <AccessBadge accessLevel={item.accessLevel} />
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {item.views.toLocaleString("th-TH")}
          </span>
          {item.ratingCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              {item.avgScore.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
