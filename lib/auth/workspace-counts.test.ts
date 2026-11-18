import { describe, expect, it } from "vitest";
import {
  badgeCountForHref,
  EMPTY_WORKSPACE_COUNTS,
  formatBadgeCount,
  totalBadgeCount,
} from "./workspace-counts";

const counts = { pendingReview: 7, revisionRequested: 2 };

describe("badgeCountForHref", () => {
  it("maps /dashboard to pending-review and /my-submissions to revision-requested", () => {
    expect(badgeCountForHref("/dashboard", counts)).toBe(7);
    expect(badgeCountForHref("/my-submissions", counts)).toBe(2);
  });

  it("returns 0 for every other link (no badge elsewhere)", () => {
    for (const href of [
      "/favorites",
      "/access-requests",
      "/submit-research",
      "/blog-admin",
      "/superadmin/overview",
      "/dashboard/approvals",
    ]) {
      expect(badgeCountForHref(href, counts)).toBe(0);
    }
  });

  it("returns 0 with the empty counts", () => {
    expect(badgeCountForHref("/dashboard", EMPTY_WORKSPACE_COUNTS)).toBe(0);
    expect(badgeCountForHref("/my-submissions", EMPTY_WORKSPACE_COUNTS)).toBe(0);
  });
});

describe("totalBadgeCount", () => {
  it("sums the badge counts and ignores links without one", () => {
    expect(
      totalBadgeCount([{ badgeCount: 7 }, {}, { badgeCount: 2 }, { badgeCount: undefined }])
    ).toBe(9);
  });

  it("is 0 for no links", () => {
    expect(totalBadgeCount([])).toBe(0);
  });
});

describe("formatBadgeCount", () => {
  it("shows the number up to 99 and 99+ above", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(5000)).toBe("99+");
  });
});
