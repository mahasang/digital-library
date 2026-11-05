import { hasRealCoverImage } from "@/lib/categoryCover";
import { getCategoryName } from "@/lib/categoryName";
import { fitText } from "@/components/home/shelf/shelfMath";
import type { Category, ResearchItem } from "@/types/research";
import type { ShelfBook } from "@/components/home/shelf/types";

const characterCount = (text: string) => [...text].length;

export function truncateAbstract(text: string, max = 280): string {
  return fitText(text, max, characterCount);
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
