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

/** จัดรูปแบบวันที่เผยแพร่แบบไทย (ปี พ.ศ.) — ใช้เฉพาะโหมด footerMode="recency" */
function formatPublishedDate(publishedAt: string): string | null {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** ไฮไลต์ช่วงที่ตรงกับคำค้นหาใน snippet — แบ่งเป็น text node ล้วนๆ แล้วห่อ
 * เฉพาะช่วงที่ตรงด้วย <mark> เท่านั้น (ไม่ใช้ dangerouslySetInnerHTML เด็ดขาด)
 * จึงปลอดภัยแม้เนื้อความจาก PDF จะมีอักขระ HTML-like ปนอยู่ก็ตาม */
function HighlightedSnippet({
  snippet,
  matchStart,
  matchEnd,
}: {
  snippet: string;
  matchStart: number | null | undefined;
  matchEnd: number | null | undefined;
}) {
  // ตรวจด้วย typeof + Number.isFinite() ไม่ใช่แค่ `== null` — กัน NaN/Infinity
  // หลุดไปถึง String.prototype.slice() ซึ่งไม่ throw แต่ปฏิบัติกับ NaN เหมือน 0
  // (ทำให้ไฮไลต์ผิดตำแหน่งแบบเงียบๆ แทนที่จะแสดง snippet เดิมโดยไม่ไฮไลต์อย่าง
  // ปลอดภัย) — เขียนเป็น typeof check ตรงๆ (ไม่ใช้ Number.isFinite() เดี่ยวๆ)
  // เพื่อให้ TypeScript แคบชนิดข้อมูลจาก `number | null | undefined` เป็น
  // `number` ได้จริงหลังผ่านเงื่อนไขนี้
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
  /** อันดับที่แสดงเป็นตราเลขมุมขวาบนของปก (ใช้กับส่วน "งานวิจัยยอดนิยม" เท่านั้น) */
  rank?: number;
  /** "recency" แสดงวันที่เผยแพร่แทนปีในแถวข้อมูลด้านล่าง (ใช้กับส่วน "งานวิจัยล่าสุด") */
  footerMode?: "default" | "recency";
  /** ส่งเป็น true เฉพาะการ์ดใบแรกของกริดที่อยู่เหนือ fold ตอนโหลดหน้าครั้งแรก */
  priority?: boolean;
}) {
  const category = getCategoryById(item.categoryId);
  const showRealCover = hasRealCoverImage(item.coverImage);
  const publishedLabel = footerMode === "recency" ? formatPublishedDate(item.publishedAt) : null;

  return (
    <Link
      href={`/research/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated-md"
    >
      <div className="relative aspect-[4/5.6] w-full overflow-hidden bg-gray-100">
        {showRealCover ? (
          <Image
            src={item.coverImage}
            alt={`ปกงานวิจัย: ${item.titleTh}`}
            fill
            priority={priority}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <CategoryCover category={category} />
        )}
        {category && showRealCover && (
          <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {category.nameTh}
          </span>
        )}
        {typeof rank === "number" && (
          <span className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-xs font-bold text-white shadow-elevated-sm">
            {rank}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-brand-700">
          {item.titleTh}
        </h2>
        <p className="line-clamp-1 text-xs text-gray-500">
          {item.researchers.map((r) => r.name).join(", ")}
        </p>
        {item.snippet && (
          <div className="rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-gray-600">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
              <FileSearch className="h-3 w-3" />
              พบในเนื้อหาเอกสาร
              {item.isOcrMatch && (
                <span className="font-normal text-amber-600">(จาก OCR อาจคลาดเคลื่อน)</span>
              )}
            </p>
            <p className="line-clamp-3">
              <HighlightedSnippet
                snippet={item.snippet}
                matchStart={item.snippetMatchStart}
                matchEnd={item.snippetMatchEnd}
              />
            </p>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <AccessBadge accessLevel={item.accessLevel} />
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-500">
          {publishedLabel ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {publishedLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {item.year}
            </span>
          )}
          <span className="flex items-center gap-3">
            {item.ratingCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span>{item.avgScore.toFixed(1)}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {item.views.toLocaleString("th-TH")}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {item.downloads.toLocaleString("th-TH")}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
