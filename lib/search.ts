import type { ResearchItem } from "@/types/research";
import {
  normalizeRank,
  chainComparators,
  compareByPublishedAtAsc,
  compareByPublishedAtDesc,
  compareByIdAsc,
} from "@/lib/search/rank";

export type SortOption = "newest" | "oldest" | "popular" | "downloads" | "title";

export const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "ใหม่ล่าสุด" },
  { value: "oldest", label: "เก่าที่สุด" },
  { value: "popular", label: "ยอดนิยม (เข้าชมมากสุด)" },
  { value: "downloads", label: "ดาวน์โหลดมากสุด" },
  { value: "title", label: "ชื่อเรื่อง (ก-ฮ)" },
];

export interface ResearchFilters {
  query?: string;
  categoryId?: string;
  year?: number;
  sort?: SortOption;
}

export function searchResearch(
  items: ResearchItem[],
  filters: ResearchFilters
): ResearchItem[] {
  let result = [...items];
  const query = filters.query?.trim().toLowerCase();

  if (query) {
    result = result.filter((item) => {
      const haystack = [
        item.titleTh,
        item.titleEn,
        item.abstract,
        item.organization,
        ...item.keywords,
        ...item.researchers.map((r) => r.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (filters.categoryId && filters.categoryId !== "all") {
    result = result.filter((item) => item.categoryId === filters.categoryId);
  }

  if (filters.year) {
    result = result.filter((item) => item.year === filters.year);
  }

  // ใช้ utility กลางเดียวกับ lib/data/research-search.server.ts เสมอ (ดู
  // lib/search/rank.ts) — ปิดท้ายทุก sort ด้วย compareByIdAsc เพื่อให้ผลลัพธ์
  // ที่ค่าเรียงลำดับหลักเท่ากันเรียงลำดับแบบเดียวกันเสมอทุกครั้งที่เรียก
  let primary: (a: ResearchItem, b: ResearchItem) => number;
  switch (filters.sort) {
    case "oldest":
      primary = compareByPublishedAtAsc;
      break;
    case "popular":
      primary = (a, b) => normalizeRank(b.views, 0) - normalizeRank(a.views, 0);
      break;
    case "downloads":
      primary = (a, b) => normalizeRank(b.downloads, 0) - normalizeRank(a.downloads, 0);
      break;
    case "title":
      primary = (a, b) => a.titleTh.localeCompare(b.titleTh, "th");
      break;
    case "newest":
    default:
      primary = compareByPublishedAtDesc;
      break;
  }
  result.sort(chainComparators(primary, compareByIdAsc));

  return result;
}
