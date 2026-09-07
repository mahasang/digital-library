import Image from "next/image";
import Link from "next/link";
import { Eye, Download, Calendar, FileSearch, CalendarClock, Star } from "lucide-react";
import AccessBadge from "@/components/research/AccessBadge";
import CategoryCover from "@/components/research/CategoryCover";
import { hasRealCoverImage } from "@/lib/categoryCover";
import { getCategoryById } from "@/data/categories";
import type { ResearchItem } from "@/types/research";

export interface ResearchCardItem extends ResearchItem {
  snippet?: string | null;
  snippetMatchStart?: number | null;
  snippetMatchEnd?: number | null;
  isOcrMatch?: boolean;
}

function formatPublishedDate(publishedAt: string): string | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

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

export default function ResearchCard({
  item,
  rank,
  footerMode = "default",
  priority = false,
}: {
  item: ResearchCardItem;
  rank?: number;
  footerMode?: "default" | "recency";
  priority?: boolean;
}) {
  const category = getCategoryById(item.categoryId);
  const showRealCover = hasRealCoverImage(item.coverImage);
  const publishedLabel = footerMode === "recency" ? formatPublishedDate(item.publishedAt) : null;

  return (
    <Link
      href={`/research/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-sm border border-gray-200 bg-white transition-all hover:border-brand-300 hover:shadow-md"
    >
      {/* ── Cover ── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {showRealCover ? (
          <Image
            src={item.coverImage}
            alt={`ປົກງານວິໄຈ: ${item.titleTh}`}
            fill
            priority={priority}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <CategoryCover category={category} />
        )}
        {/* category badge */}
        {category && (
          <span className="absolute left-0 top-3 bg-[#0f1f3d] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            {category.nameTh}
          </span>
        )}
        {/* rank badge */}
        {typeof rank === "number" && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-sm bg-brand-600 text-xs font-bold text-white shadow">
            #{rank}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col p-3 gap-1.5">
        {/* title */}
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-brand-700 transition-colors">
          {item.titleTh}
        </h2>

        {/* authors */}
        <p className="line-clamp-1 text-xs text-gray-500 italic">
          {item.researchers.map((r) => r.name).join(", ")}
        </p>

        {/* snippet */}
        {item.snippet && (
          <div className="rounded border-l-2 border-amber-400 bg-amber-50 pl-2.5 pr-2 py-1.5 text-xs leading-relaxed text-gray-600">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
              <FileSearch className="h-3 w-3" />
              พบในเนื้อหาเอกสาร
              {item.isOcrMatch && (
                <span className="font-normal text-amber-600">(OCR)</span>
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

        {/* access badge */}
        <div className="mt-auto pt-1 flex flex-wrap items-center gap-1.5">
          <AccessBadge accessLevel={item.accessLevel} />
        </div>

        {/* ── Footer metadata ── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-400">
          {/* year / date */}
          {publishedLabel ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {publishedLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {item.year}
            </span>
          )}

          {/* stats */}
          <span className="flex items-center gap-2.5">
            {item.ratingCount > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {item.avgScore.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {item.views.toLocaleString("th-TH")}
            </span>
            <span className="flex items-center gap-0.5">
              <Download className="h-3 w-3" />
              {item.downloads.toLocaleString("th-TH")}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}