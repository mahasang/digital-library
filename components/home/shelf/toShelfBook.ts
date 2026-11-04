import { hasRealCoverImage } from "@/lib/categoryCover";
import { getCategoryName } from "@/lib/categoryName";
import type { Category, ResearchItem } from "@/types/research";
import type { ShelfBook } from "@/components/home/shelf/types";

const ELLIPSIS = "…";
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** ตัดตามกลุ่มอักษร เพื่อไม่ให้สระหรือวรรณยุกต์ไทย/ลาวหลุดจากพยัญชนะ */
export function truncateAbstract(text: string, max = 280): string {
  if ([...text].length <= max) return text;

  let result = "";
  let length = 0;
  for (const { segment } of graphemes.segment(text)) {
    const segmentLength = [...segment].length;
    if (length + segmentLength > max - 1) break;
    result += segment;
    length += segmentLength;
  }
  return result.trimEnd() + ELLIPSIS;
}

export function toShelfBook(item: ResearchItem, categories: Category[], locale: string): ShelfBook {
  const category = categories.find((candidate) => candidate.id === item.categoryId);

  return {
    id: item.id,
    title: item.titleTh,
    authors: item.researchers.map((researcher) => researcher.name).join(", "),
    year: item.year,
    abstract: truncateAbstract(item.abstract),
    categoryName: category ? getCategoryName(category, locale) : "",
    coverUrl: hasRealCoverImage(item.coverImage) ? item.coverImage : null,
  };
}
