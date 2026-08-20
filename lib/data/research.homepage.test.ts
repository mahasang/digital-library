import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RawHomepageResearchRow } from "@/lib/data/types";

/**
 * Pure-logic + mock-data-fallback tests for the homepage data-flow
 * optimization (see lib/data/research.server.ts, lib/data/mappers.ts,
 * lib/data/queries.ts). Does not need a real Supabase connection — the
 * pure functions (mapHomepageRowToResearchItem, buildResearchCategoryStats)
 * are tested directly, and the exported async functions are exercised via
 * the "Supabase not configured" fallback path (same technique the rest of
 * this file avoids network calls with), which is deterministic regardless
 * of whether this machine has .env.local configured.
 */

vi.mock("@/lib/supabase/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/config")>();
  return {
    ...actual,
    isSupabaseConfigured: () => false,
  };
});

import { mapHomepageRowToResearchItem } from "@/lib/data/mappers";
import {
  buildResearchCategoryStats,
  getLatestResearch,
  getPopularResearch,
  getPublishedResearchStats,
} from "@/lib/data/research.server";
import * as mockData from "@/data/research";

function makeRawHomepageRow(
  overrides: Partial<RawHomepageResearchRow> & { id: string }
): RawHomepageResearchRow {
  return {
    slug: overrides.id,
    title_th: "หัวข้องานวิจัย",
    cover_image: null,
    access_level: "public",
    year: 2568,
    published_at: "2026-01-01T00:00:00.000Z",
    views: 0,
    downloads: 0,
    research_categories: [{ categories: { slug: "engineering" } }],
    research_authors: [
      { author_order: 1, authors: { name: "ผู้วิจัยคนที่หนึ่ง" } },
      { author_order: 0, authors: { name: "ผู้วิจัยคนที่ศูนย์" } },
    ],
    ...overrides,
  };
}

describe("mapHomepageRowToResearchItem", () => {
  it("maps every field that ResearchCard actually renders", () => {
    const row = makeRawHomepageRow({
      id: "row-1",
      title_th: "ชื่อเรื่อง",
      cover_image: "/covers/cover-01.svg",
      access_level: "member_only",
      year: 2569,
      published_at: "2026-03-15T08:00:00.000Z",
      views: 42,
      downloads: 7,
    });

    const item = mapHomepageRowToResearchItem(row);

    expect(item.id).toBe("row-1"); // id = slug, matching mapRowToResearchItem's convention
    expect(item.titleTh).toBe("ชื่อเรื่อง");
    expect(item.coverImage).toBe("/covers/cover-01.svg");
    expect(item.accessLevel).toBe("member_only");
    expect(item.year).toBe(2569);
    expect(item.publishedAt).toBe("2026-03-15T08:00:00.000Z");
    expect(item.views).toBe(42);
    expect(item.downloads).toBe(7);
    expect(item.categoryId).toBe("engineering");
  });

  it("sorts researchers by author_order and only carries their name (organization not fetched)", () => {
    const row = makeRawHomepageRow({ id: "row-2" });
    const item = mapHomepageRowToResearchItem(row);
    expect(item.researchers.map((r) => r.name)).toEqual([
      "ผู้วิจัยคนที่ศูนย์",
      "ผู้วิจัยคนที่หนึ่ง",
    ]);
    expect(item.researchers.every((r) => r.organization === "")).toBe(true);
  });

  it("defaults fields ResearchCard never renders on the homepage instead of leaving them undefined", () => {
    const item = mapHomepageRowToResearchItem(makeRawHomepageRow({ id: "row-3" }));
    expect(item.titleEn).toBe("");
    expect(item.organization).toBe("");
    expect(item.keywords).toEqual([]);
    expect(item.abstract).toBe("");
    expect(item.pdfFile).toBe("");
    expect(item.pageCount).toBe(0);
    expect(item.status).toBe("published");
    expect(item.scanStatus).toBe("clean");
  });

  it("falls back to an empty categoryId when the item has no linked category", () => {
    const row = makeRawHomepageRow({ id: "row-4", research_categories: [] });
    expect(mapHomepageRowToResearchItem(row).categoryId).toBe("");
  });

  it("falls back to an empty author name when the author relation is missing", () => {
    const row = makeRawHomepageRow({
      id: "row-5",
      research_authors: [{ author_order: 0, authors: null }],
    });
    expect(mapHomepageRowToResearchItem(row).researchers).toEqual([
      { authorId: null, name: "", organization: "" },
    ]);
  });
});

describe("buildResearchCategoryStats", () => {
  it("counts published items per category and the total", () => {
    const stats = buildResearchCategoryStats([
      "engineering",
      "engineering",
      "it",
      "engineering",
    ]);
    expect(stats.totalCount).toBe(4);
    expect(stats.countByCategoryId).toEqual({ engineering: 3, it: 1 });
  });

  it("counts items with no category toward the total but not toward any category", () => {
    const stats = buildResearchCategoryStats(["engineering", null, "", "it"]);
    expect(stats.totalCount).toBe(4);
    expect(stats.countByCategoryId).toEqual({ engineering: 1, it: 1 });
  });

  it("returns zero counts for an empty published set (matches CategorySection's '0 รายการ' empty state)", () => {
    const stats = buildResearchCategoryStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.countByCategoryId).toEqual({});
  });
});

describe("getLatestResearch / getPopularResearch — Supabase-not-configured fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getLatestResearch falls back to mock data, respects the limit, and stays sorted by publishedAt descending", async () => {
    const items = await getLatestResearch(3);
    expect(items.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].publishedAt >= items[i].publishedAt).toBe(true);
    }
  });

  it("getLatestResearch matches the existing mock-data module's own getLatestResearch exactly (preserves current fallback behavior)", async () => {
    const expected = mockData.getLatestResearch(5).map((i) => i.id);
    const actual = (await getLatestResearch(5)).map((i) => i.id);
    expect(actual).toEqual(expected);
  });

  it("getPopularResearch falls back to mock data, respects the limit, and stays sorted by views descending", async () => {
    const items = await getPopularResearch(3);
    expect(items.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].views >= items[i].views).toBe(true);
    }
  });

  it("getPopularResearch matches the existing mock-data module's own getPopularResearch exactly (preserves current fallback behavior)", async () => {
    const expected = mockData.getPopularResearch(5).map((i) => i.id);
    const actual = (await getPopularResearch(5)).map((i) => i.id);
    expect(actual).toEqual(expected);
  });

  it("only ever returns published items", async () => {
    const [latest, popular] = await Promise.all([getLatestResearch(50), getPopularResearch(50)]);
    expect(latest.every((i) => i.status === "published")).toBe(true);
    expect(popular.every((i) => i.status === "published")).toBe(true);
  });
});

describe("getPublishedResearchStats — Supabase-not-configured fallback", () => {
  it("total count matches the number of published mock items, and category counts sum to it", async () => {
    const publishedCount = mockData.getPublishedResearch().length;
    const stats = await getPublishedResearchStats();

    expect(stats.totalCount).toBe(publishedCount);

    const sumOfCategoryCounts = Object.values(stats.countByCategoryId).reduce(
      (sum, n) => sum + n,
      0
    );
    // ผลรวมของทุกหมวดหมู่ <= totalCount เสมอ (งานวิจัยที่ไม่มีหมวดหมู่ผูกไว้
    // จะนับใน totalCount แต่ไม่นับในหมวดใดเลย — ดู buildResearchCategoryStats)
    expect(sumOfCategoryCounts).toBeLessThanOrEqual(stats.totalCount);
  });

  it("every category count is a real, positive integer (no NaN/undefined leaking through)", async () => {
    const stats = await getPublishedResearchStats();
    for (const count of Object.values(stats.countByCategoryId)) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThan(0);
    }
  });
});
