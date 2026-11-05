import { describe, expect, it } from "vitest";
import { toShelfBook, truncateAbstract } from "@/components/home/shelf/toShelfBook";
import type { Category, ResearchItem } from "@/types/research";

const category = { id: "eng", nameTh: "วิศวกรรม", nameEn: "Engineering" } as Category;

function makeItem(overrides: Partial<ResearchItem> = {}): ResearchItem {
  return {
    id: "slug-1",
    titleTh: "ชื่อเรื่อง",
    researchers: [
      { authorId: null, name: "ก", organization: "" },
      { authorId: null, name: "ข", organization: "" },
    ],
    year: 2568,
    categoryId: "eng",
    abstract: "บทคัดย่อ",
    coverImage: "https://example.com/cover.jpg",
    ...overrides,
  } as ResearchItem;
}

describe("truncateAbstract", () => {
  it("keeps text at the limit unchanged", () => {
    const text = "a".repeat(280);
    expect(truncateAbstract(text)).toBe(text);
  });

  it("shortens longer text to the limit and ends with an ellipsis", () => {
    const result = truncateAbstract("a".repeat(281));
    expect([...result].length).toBeLessThanOrEqual(280);
    expect(result.endsWith("…")).toBe(true);
  });

  it("does not leave a Thai vowel or tone mark cut from its base letter", () => {
    const result = truncateAbstract("นี้".repeat(200), 10);
    const body = result.slice(0, -1);
    expect(body.endsWith("นี้")).toBe(true);
  });
});

describe("truncateAbstract leading vowels", () => {
  it("does not end on a Thai leading vowel", () => {
    expect(truncateAbstract("ประเทศเวียดนาม", 5)).toBe("ประ…");
  });
});

describe("toShelfBook", () => {
  it("treats placeholder covers as having no cover", () => {
    const book = toShelfBook(makeItem({ coverImage: "/covers/cover-01.svg" }), [category], "th");
    expect(book.coverUrl).toBeNull();
  });

  it("keeps a real cover URL", () => {
    expect(toShelfBook(makeItem(), [category], "th").coverUrl).toBe("https://example.com/cover.jpg");
  });

  it("joins researchers and localizes the category", () => {
    const book = toShelfBook(makeItem(), [category], "en");
    expect(book.authors).toBe("ก, ข");
    expect(book.categoryName).toBe("Engineering");
  });

  it("returns empty strings when researchers and category are missing", () => {
    const book = toShelfBook(makeItem({ researchers: [], categoryId: "none" }), [category], "th");
    expect(book.authors).toBe("");
    expect(book.categoryName).toBe("");
  });
});
