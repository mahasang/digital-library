import { describe, expect, it } from "vitest";
import { buildStatusPieChartData } from "./statusPieChart";
import { statusLabels } from "@/lib/labels";

describe("buildStatusPieChartData", () => {
  it("keeps a single 100%-share status as one slice (regression: Finding 14)", () => {
    const result = buildStatusPieChartData([
      { status: "published", count: 10 },
      { status: "draft", count: 0 },
      { status: "archived", count: 0 },
    ]);
    expect(result).toEqual([{ name: statusLabels.published, value: 10, status: "published" }]);
  });

  it("filters out every zero-count status", () => {
    const result = buildStatusPieChartData([
      { status: "draft", count: 0 },
      { status: "pending_review", count: 0 },
      { status: "rejected", count: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it("preserves counts and labels for multiple non-zero statuses", () => {
    const result = buildStatusPieChartData([
      { status: "published", count: 7 },
      { status: "draft", count: 3 },
      { status: "archived", count: 0 },
      { status: "rejected", count: 1 },
    ]);
    expect(result).toEqual([
      { name: statusLabels.published, value: 7, status: "published" },
      { name: statusLabels.draft, value: 3, status: "draft" },
      { name: statusLabels.rejected, value: 1, status: "rejected" },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(buildStatusPieChartData([])).toEqual([]);
  });

  it("never returns a negative or NaN value from a well-formed count", () => {
    const result = buildStatusPieChartData([{ status: "published", count: 5 }]);
    expect(result[0].value).toBe(5);
    expect(Number.isFinite(result[0].value)).toBe(true);
  });
});
