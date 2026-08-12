import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Cache-invalidation wiring tests (Hallmark — public homepage caching).
 * Verifies that each revalidatePublic*() helper busts exactly the tags it
 * documents — this is the mechanism every write path (category actions,
 * settings action, research status/edit/merge actions) relies on to make
 * changed public data appear on the homepage without waiting for the
 * PUBLIC_HOME_REVALIDATE_SECONDS time-based fallback.
 *
 * Doesn't (and can't, without a full Next.js server runtime) exercise
 * unstable_cache()'s actual cache store — that's proven live instead by
 * e2e/public-home-cache.spec.ts, which triggers a real admin write against
 * the running dev server and asserts the homepage reflects it immediately.
 */

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => revalidateTagMock(tag),
}));

import {
  PUBLIC_HOME_TAG,
  PUBLIC_SETTINGS_TAG,
  PUBLIC_CATEGORIES_TAG,
  PUBLIC_RESEARCH_TAG,
  revalidatePublicSettings,
  revalidatePublicCategories,
  revalidatePublicResearch,
} from "@/lib/cache/public-home";

beforeEach(() => {
  revalidateTagMock.mockClear();
});

describe("revalidatePublicSettings", () => {
  it("busts public-settings and the public-home umbrella tag, nothing else", () => {
    revalidatePublicSettings();
    expect(revalidateTagMock).toHaveBeenCalledTimes(2);
    expect(revalidateTagMock).toHaveBeenCalledWith(PUBLIC_SETTINGS_TAG);
    expect(revalidateTagMock).toHaveBeenCalledWith(PUBLIC_HOME_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(PUBLIC_CATEGORIES_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(PUBLIC_RESEARCH_TAG);
  });
});

describe("revalidatePublicCategories", () => {
  it("busts public-categories and the public-home umbrella tag, nothing else", () => {
    revalidatePublicCategories();
    expect(revalidateTagMock).toHaveBeenCalledTimes(2);
    expect(revalidateTagMock).toHaveBeenCalledWith(PUBLIC_CATEGORIES_TAG);
    expect(revalidateTagMock).toHaveBeenCalledWith(PUBLIC_HOME_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(PUBLIC_SETTINGS_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(PUBLIC_RESEARCH_TAG);
  });
});

describe("revalidatePublicResearch", () => {
  it("busts public-research and the public-home umbrella tag, nothing else", () => {
    revalidatePublicResearch();
    expect(revalidateTagMock).toHaveBeenCalledTimes(2);
    expect(revalidateTagMock).toHaveBeenCalledWith(PUBLIC_RESEARCH_TAG);
    expect(revalidateTagMock).toHaveBeenCalledWith(PUBLIC_HOME_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(PUBLIC_SETTINGS_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalledWith(PUBLIC_CATEGORIES_TAG);
  });
});

describe("tag naming", () => {
  it("tags match the exact names documented for this feature", () => {
    // ล็อกชื่อ tag ไว้ตรงๆ — ถ้าใครเผลอแก้ชื่อ tag โดยไม่ตั้งใจ (typo ฯลฯ)
    // การ revalidateTag() จากฝั่งเขียนข้อมูลจะ "ล้าง" tag ที่ไม่มีใครฟังอยู่จริง
    // เงียบๆ โดยไม่มี error ใดๆ เลย — test นี้กันไว้ไม่ให้เกิดแบบนั้น
    expect(PUBLIC_HOME_TAG).toBe("public-home");
    expect(PUBLIC_SETTINGS_TAG).toBe("public-settings");
    expect(PUBLIC_CATEGORIES_TAG).toBe("public-categories");
    expect(PUBLIC_RESEARCH_TAG).toBe("public-research");
  });
});
