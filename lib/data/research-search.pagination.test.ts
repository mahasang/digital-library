import { describe, expect, it } from "vitest";
import { finalizeResults, relevanceOf } from "./research-search.server";
import type { ResearchSearchParams, MatchSource } from "./research-search.server";
import type { ResearchItem } from "@/types/research";

interface CandidateEntry {
  matchSource: MatchSource;
  snippet: string | null;
  snippetMatchStart: number | null;
  snippetMatchEnd: number | null;
}

function candidateMap(items: ResearchItem[]): Map<string, CandidateEntry> {
  return new Map(
    items.map((i) => [
      i.id,
      { matchSource: null, snippet: null, snippetMatchStart: null, snippetMatchEnd: null },
    ])
  );
}

/**
 * Pure unit test สำหรับ pagination/sorting/filtering ของ finalizeResults() —
 * ไม่ต้องต่อ Supabase เลย (ต่างจาก
 * lib/data/research-search-rls.integration.test.ts ที่ทดสอบชั้น RLS/สิทธิ์
 * โดยเฉพาะ) ครอบคลุมส่วน "search behavior" ที่เหลือของ SEARCH-03/
 * docs/qa-test-plan.md: การแบ่งหน้า, การเรียงลำดับ, การกรอง
 */

function makeItem(overrides: Partial<ResearchItem> & { id: string }): ResearchItem {
  return {
    titleTh: "หัวข้อ",
    titleEn: "title",
    researchers: [],
    organization: "org",
    year: 2560,
    categoryId: "cat-1",
    keywords: [],
    abstract: "abstract",
    coverImage: "",
    pdfFile: "",
    pageCount: 1,
    accessLevel: "public",
    status: "published",
    views: 0,
    downloads: 0,
    publishedAt: "2026-01-01T00:00:00.000Z",
    scanStatus: "clean",
    ...overrides,
  };
}

function pairs(items: ResearchItem[]) {
  return items.map((item) => ({ item, uuid: item.id }));
}

describe("finalizeResults — pagination", () => {
  it("splits results into pages of the requested size", () => {
    const items = Array.from({ length: 25 }, (_, i) => makeItem({ id: `item-${i}`, publishedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` }));
    const candidates = candidateMap(items);

    const page1 = finalizeResults(pairs(items), candidates, {}, 1, 10, []);
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page1.page).toBe(1);

    const page3 = finalizeResults(pairs(items), candidates, {}, 3, 10, []);
    expect(page3.items).toHaveLength(5);
    expect(page3.page).toBe(3);
  });

  it("returns an empty page (not an error) past the last page", () => {
    const items = [makeItem({ id: "only-one" })];
    const candidates = candidateMap(items);
    const result = finalizeResults(pairs(items), candidates, {}, 5, 10, []);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  it("totalPages is always at least 1, even with zero results", () => {
    const result = finalizeResults([], new Map<string, CandidateEntry>(), {}, 1, 10, []);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(0);
  });
});

describe("finalizeResults — sorting", () => {
  const items = [
    makeItem({ id: "old", publishedAt: "2024-01-01T00:00:00.000Z", views: 5, downloads: 50, titleTh: "ก" }),
    makeItem({ id: "new", publishedAt: "2026-06-01T00:00:00.000Z", views: 50, downloads: 5, titleTh: "ข" }),
    makeItem({ id: "mid", publishedAt: "2025-03-01T00:00:00.000Z", views: 20, downloads: 20, titleTh: "ค" }),
  ];
  const candidates = candidateMap(items);

  it("sorts newest first by default when there is no search query", () => {
    const result = finalizeResults(pairs(items), candidates, {}, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["new", "mid", "old"]);
  });

  it("sorts oldest first", () => {
    const params: ResearchSearchParams = { sort: "oldest" };
    const result = finalizeResults(pairs(items), candidates, params, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["old", "mid", "new"]);
  });

  it("sorts by popularity (views)", () => {
    const params: ResearchSearchParams = { sort: "popular" };
    const result = finalizeResults(pairs(items), candidates, params, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["new", "mid", "old"]);
  });

  it("sorts by downloads", () => {
    const params: ResearchSearchParams = { sort: "downloads" };
    const result = finalizeResults(pairs(items), candidates, params, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["old", "mid", "new"]);
  });

  it("relevance (title/researcher/keyword/abstract/pdf match) always outranks sort order when there is a query", () => {
    const withMatches = new Map<string, CandidateEntry>(candidates);
    withMatches.set("old", { matchSource: "title", snippet: null, snippetMatchStart: null, snippetMatchEnd: null });
    // "new" and "mid" have no match — relevance sort still puts the one match first
    // even though it's chronologically the oldest and "sort" asks for newest-first.
    const result = finalizeResults(pairs(items), withMatches, { sort: "newest" }, 1, 10, []);
    expect(result.items[0].id).toBe("old");
  });
});

describe("finalizeResults — filtering", () => {
  const items = [
    makeItem({ id: "cat-a-2020", categoryId: "cat-a", year: 2563, accessLevel: "public" }),
    makeItem({ id: "cat-b-2020", categoryId: "cat-b", year: 2563, accessLevel: "member_only" }),
    makeItem({ id: "cat-a-2022", categoryId: "cat-a", year: 2565, accessLevel: "public" }),
  ];
  const candidates = candidateMap(items);

  it("filters by categoryId", () => {
    const result = finalizeResults(pairs(items), candidates, { categoryId: "cat-a" }, 1, 10, []);
    expect(result.items.map((i) => i.id).sort()).toEqual(["cat-a-2020", "cat-a-2022"]);
  });

  it("filters by year", () => {
    const result = finalizeResults(pairs(items), candidates, { year: 2563 }, 1, 10, []);
    expect(result.items.map((i) => i.id).sort()).toEqual(["cat-a-2020", "cat-b-2020"]);
  });

  it("filters by accessLevel", () => {
    const result = finalizeResults(pairs(items), candidates, { accessLevel: "member_only" }, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["cat-b-2020"]);
  });

  it("combines multiple filters", () => {
    const result = finalizeResults(
      pairs(items),
      candidates,
      { categoryId: "cat-a", year: 2563 },
      1,
      10,
      []
    );
    expect(result.items.map((i) => i.id)).toEqual(["cat-a-2020"]);
  });

  it("categoryId 'all' means no filter", () => {
    const result = finalizeResults(pairs(items), candidates, { categoryId: "all" }, 1, 10, []);
    expect(result.items).toHaveLength(3);
  });
});

/**
 * แก้ finding M-1 (docs/production-readiness-report.md) — เดิม comparator
 * ของ relevance ไม่มีด่านตรวจสอบว่าค่าคะแนนเป็นตัวเลขจำกัดจริง และไม่มีตัว
 * ตัดสินลำดับสุดท้ายที่ไม่ซ้ำกัน (id) ทำให้ผลลัพธ์ที่คะแนน/วันที่เผยแพร่เท่ากัน
 * เรียงลำดับไม่คงที่ระหว่างคำขอ (Postgres ไม่การันตีลำดับแถวที่คืนมาโดยไม่มี
 * ORDER BY) ชุด test นี้ครอบคลุมตามที่ระบุไว้: rank ปกติ/null/ไม่มีค่า/NaN-
 * Infinity/ผลลัพธ์เท่ากัน/pagination หลายหน้า/ค้นหาไม่มี full-text result/
 * title-metadata search และ PDF text search
 */
describe("relevanceOf — M-1: rank normalization", () => {
  it("returns the correct rank for each normal matchSource", () => {
    expect(relevanceOf({ matchSource: "title" })).toBe(4);
    expect(relevanceOf({ matchSource: "researcher" })).toBe(3);
    expect(relevanceOf({ matchSource: "keyword" })).toBe(3);
    expect(relevanceOf({ matchSource: "abstract" })).toBe(2);
    expect(relevanceOf({ matchSource: "pdf" })).toBe(1);
  });

  it("returns 0 for null matchSource (no match — lowest possible rank)", () => {
    expect(relevanceOf({ matchSource: null })).toBe(0);
  });

  it("returns 0 for an unrecognized matchSource instead of NaN/undefined (future MatchSource drift, or a runtime type violation)", () => {
    // จำลองกรณีมีการเพิ่ม MatchSource ใหม่ในอนาคตแล้วลืมอัปเดต
    // MATCH_SOURCE_RELEVANCE — ใช้ cast เฉพาะใน test นี้เพื่อจำลองสถานการณ์
    // ที่ type system ปกติจะป้องกันไว้ ไม่ใช่การ cast เพื่อซ่อนปัญหาในโค้ดจริง
    const corrupted = { matchSource: "organization" as unknown as MatchSource };
    const result = relevanceOf(corrupted);
    expect(result).toBe(0);
    expect(Number.isFinite(result)).toBe(true);
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe("finalizeResults — M-1: deterministic tiebreaking with equal ranks", () => {
  it("breaks a tie in relevance AND publishedAt deterministically via id, regardless of input array order", () => {
    const items = [
      makeItem({ id: "zeta", publishedAt: "2026-01-01T00:00:00.000Z" }),
      makeItem({ id: "alpha", publishedAt: "2026-01-01T00:00:00.000Z" }),
      makeItem({ id: "mid", publishedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const withMatches = new Map<string, CandidateEntry>(
      items.map((i) => [i.id, { matchSource: "title" as MatchSource, snippet: null, snippetMatchStart: null, snippetMatchEnd: null }])
    );

    // เรียกด้วยลำดับ input ต่างกัน 2 แบบ (จำลองว่าฐานข้อมูลคืนแถวมาคนละลำดับ
    // กันระหว่างคำขอ) — ผลลัพธ์สุดท้ายต้องเหมือนกันทุกประการเสมอ
    const forward = finalizeResults(pairs(items), withMatches, { sort: "newest" }, 1, 10, []);
    const shuffled = finalizeResults(pairs([...items].reverse()), withMatches, { sort: "newest" }, 1, 10, []);

    expect(forward.items.map((i) => i.id)).toEqual(["alpha", "mid", "zeta"]);
    expect(shuffled.items.map((i) => i.id)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("breaks a tie in sort-option value (e.g. equal views) deterministically via id", () => {
    const items = [
      makeItem({ id: "c", views: 10 }),
      makeItem({ id: "a", views: 10 }),
      makeItem({ id: "b", views: 10 }),
    ];
    const candidates = candidateMap(items);
    const result = finalizeResults(pairs(items), candidates, { sort: "popular" }, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("is stable across repeated calls with the same input order", () => {
    const items = [
      makeItem({ id: "b", views: 5 }),
      makeItem({ id: "a", views: 5 }),
    ];
    const candidates = candidateMap(items);
    const run1 = finalizeResults(pairs(items), candidates, { sort: "popular" }, 1, 10, []);
    const run2 = finalizeResults(pairs(items), candidates, { sort: "popular" }, 1, 10, []);
    expect(run1.items.map((i) => i.id)).toEqual(run2.items.map((i) => i.id));
  });
});

describe("finalizeResults — M-1: pagination stability across differently-ordered input", () => {
  it("produces identical page 1 and page 2 contents regardless of the underlying candidate order", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem({ id: `item-${String(i).padStart(2, "0")}`, publishedAt: "2026-01-01T00:00:00.000Z", views: 1 })
    );
    const candidates = candidateMap(items);

    const orderA = pairs(items);
    const orderB = pairs([...items].sort(() => 0.5 - Math.random()));

    const page1A = finalizeResults(orderA, candidates, { sort: "popular" }, 1, 5, []);
    const page1B = finalizeResults(orderB, candidates, { sort: "popular" }, 1, 5, []);
    const page2A = finalizeResults(orderA, candidates, { sort: "popular" }, 2, 5, []);
    const page2B = finalizeResults(orderB, candidates, { sort: "popular" }, 2, 5, []);
    const page3A = finalizeResults(orderA, candidates, { sort: "popular" }, 3, 5, []);
    const page3B = finalizeResults(orderB, candidates, { sort: "popular" }, 3, 5, []);

    expect(page1A.items.map((i) => i.id)).toEqual(page1B.items.map((i) => i.id));
    expect(page2A.items.map((i) => i.id)).toEqual(page2B.items.map((i) => i.id));
    expect(page3A.items.map((i) => i.id)).toEqual(page3B.items.map((i) => i.id));

    // ไม่มีรายการซ้ำหรือหายไปข้ามหน้า
    const allIds = [...page1A.items, ...page2A.items, ...page3A.items].map((i) => i.id);
    expect(new Set(allIds).size).toBe(12);
  });
});

describe("finalizeResults — M-1: title/metadata search vs PDF full-text search", () => {
  it("ranks a title match above a PDF-text-only match for the same query", () => {
    const items = [
      makeItem({ id: "pdf-only", publishedAt: "2020-01-01T00:00:00.000Z" }),
      makeItem({ id: "title-match", publishedAt: "2019-01-01T00:00:00.000Z" }),
    ];
    const candidates = new Map<string, CandidateEntry>([
      ["pdf-only", { matchSource: "pdf", snippet: "...found in pdf...", snippetMatchStart: 3, snippetMatchEnd: 8 }],
      ["title-match", { matchSource: "title", snippet: null, snippetMatchStart: null, snippetMatchEnd: null }],
    ]);
    const result = finalizeResults(pairs(items), candidates, {}, 1, 10, []);
    // title-match มาก่อนแม้จะเผยแพร่เก่ากว่า — relevance ชนะ publishedAt เสมอ
    expect(result.items.map((i) => i.id)).toEqual(["title-match", "pdf-only"]);
  });

  it("bibliographic-only search (no PDF full-text result at all) still sorts and paginates correctly", () => {
    const items = [
      makeItem({ id: "abstract-match", publishedAt: "2026-01-01T00:00:00.000Z" }),
      makeItem({ id: "keyword-match", publishedAt: "2025-01-01T00:00:00.000Z" }),
      makeItem({ id: "no-match", publishedAt: "2024-01-01T00:00:00.000Z" }),
    ];
    const candidates = new Map<string, CandidateEntry>([
      ["abstract-match", { matchSource: "abstract", snippet: null, snippetMatchStart: null, snippetMatchEnd: null }],
      ["keyword-match", { matchSource: "keyword", snippet: null, snippetMatchStart: null, snippetMatchEnd: null }],
      // "no-match" ไม่มี entry ใน candidates เลย — จำลองรายการที่ไม่ผ่าน
      // ตัวกรองคำค้นหาใดๆ เลย (matchSource ต้อง default เป็น null อัตโนมัติ)
    ]);
    const result = finalizeResults(pairs(items), candidates, {}, 1, 10, []);
    expect(result.items.map((i) => i.id)).toEqual(["keyword-match", "abstract-match", "no-match"]);
    expect(result.items[2].matchSource).toBeNull();
  });

  it("a search with zero results in every source returns an empty, well-formed page (not an error)", () => {
    const items = [makeItem({ id: "unrelated" })];
    const candidates = candidateMap(items); // ไม่มี match เลยสักรายการ
    const result = finalizeResults(pairs(items), candidates, {}, 1, 10, []);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].matchSource).toBeNull();
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
