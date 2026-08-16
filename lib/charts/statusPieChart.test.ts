import { describe, expect, it } from "vitest";
import { buildStatusPieChartData } from "./statusPieChart";

const getLabel = (status: string) => `label:${status}`;

describe("buildStatusPieChartData", () => {
  it("keeps a single 100%-share status as one slice (regression: Finding 14)", () => {
    const result = buildStatusPieChartData(
      [
        { status: "published", count: 10 },
        { status: "draft", count: 0 },
        { status: "archived", count: 0 },
      ],
      getLabel
    );
    expect(result).toEqual([{ name: "label:published", value: 10, status: "published" }]);
  });

  it("filters out every zero-count status", () => {
    const result = buildStatusPieChartData(
      [
        { status: "draft", count: 0 },
        { status: "pending_review", count: 0 },
        { status: "rejected", count: 0 },
      ],
      getLabel
    );
    expect(result).toEqual([]);
  });

  it("preserves counts and labels for multiple non-zero statuses", () => {
    const result = buildStatusPieChartData(
      [
        { status: "published", count: 7 },
        { status: "draft", count: 3 },
        { status: "archived", count: 0 },
        { status: "rejected", count: 1 },
      ],
      getLabel
    );
    expect(result).toEqual([
      { name: "label:published", value: 7, status: "published" },
      { name: "label:draft", value: 3, status: "draft" },
      { name: "label:rejected", value: 1, status: "rejected" },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(buildStatusPieChartData([], getLabel)).toEqual([]);
  });

  it("never returns a negative or NaN value from a well-formed count", () => {
    const result = buildStatusPieChartData([{ status: "published", count: 5 }], getLabel);
    expect(result[0].value).toBe(5);
    expect(Number.isFinite(result[0].value)).toBe(true);
  });
});
