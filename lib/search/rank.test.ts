import { describe, expect, it } from "vitest";
import {
  normalizeRank,
  chainComparators,
  compareByPublishedAtAsc,
  compareByPublishedAtDesc,
  compareByIdAsc,
} from "./rank";

describe("normalizeRank", () => {
  it("returns the value unchanged when it is a normal finite number", () => {
    expect(normalizeRank(4, 0)).toBe(4);
    expect(normalizeRank(0, -1)).toBe(0);
    expect(normalizeRank(-3.5, 0)).toBe(-3.5);
  });

  it("falls back for null", () => {
    expect(normalizeRank(null, 0)).toBe(0);
    expect(normalizeRank(null, 99)).toBe(99);
  });

  it("falls back for undefined", () => {
    expect(normalizeRank(undefined, 0)).toBe(0);
  });

  it("falls back for NaN", () => {
    expect(normalizeRank(NaN, 0)).toBe(0);
  });

  it("falls back for Infinity and -Infinity", () => {
    expect(normalizeRank(Infinity, 0)).toBe(0);
    expect(normalizeRank(-Infinity, 0)).toBe(0);
  });

  it("falls back for non-numeric types without trying to parse them", () => {
    // ต้องไม่ parse string เป็นตัวเลข ("5" ต้องกลายเป็น fallback ไม่ใช่ 5) —
    // เพราะการ parse คือการซ่อนข้อมูลผิดปกติ ไม่ใช่การป้องกัน
    expect(normalizeRank("5", 0)).toBe(0);
    expect(normalizeRank("abc", 0)).toBe(0);
    expect(normalizeRank(true, 0)).toBe(0);
    expect(normalizeRank({}, 0)).toBe(0);
    expect(normalizeRank([], 0)).toBe(0);
  });
});

describe("chainComparators", () => {
  it("returns the first non-zero result", () => {
    const alwaysEqual = () => 0;
    const returnsOne = () => 1;
    const returnsMinusOne = () => -1;
    expect(chainComparators(alwaysEqual, returnsOne, returnsMinusOne)(1, 2)).toBe(1);
    expect(chainComparators(returnsMinusOne, returnsOne)(1, 2)).toBe(-1);
  });

  it("returns 0 when every comparator in the chain returns 0", () => {
    const alwaysEqual = () => 0;
    expect(chainComparators(alwaysEqual, alwaysEqual)(1, 2)).toBe(0);
  });

  it("with zero comparators returns 0 (never throws)", () => {
    expect(chainComparators()(1, 2)).toBe(0);
  });
});

describe("compareByPublishedAtDesc / Asc", () => {
  const newer = { publishedAt: "2026-06-01T00:00:00.000Z" };
  const older = { publishedAt: "2024-01-01T00:00:00.000Z" };
  const unpublished = { publishedAt: "" };

  it("desc: newer sorts before older", () => {
    expect(compareByPublishedAtDesc(newer, older)).toBeLessThan(0);
    expect(compareByPublishedAtDesc(older, newer)).toBeGreaterThan(0);
  });

  it("asc: older sorts before newer", () => {
    expect(compareByPublishedAtAsc(older, newer)).toBeLessThan(0);
    expect(compareByPublishedAtAsc(newer, older)).toBeGreaterThan(0);
  });

  it("equal dates return exactly 0", () => {
    expect(compareByPublishedAtDesc(newer, { ...newer })).toBe(0);
  });

  it("unpublished items (publishedAt === '') always sort after published ones, never crash", () => {
    expect(compareByPublishedAtDesc(newer, unpublished)).toBeLessThan(0);
    expect(compareByPublishedAtDesc(unpublished, newer)).toBeGreaterThan(0);
  });
});

describe("compareByIdAsc", () => {
  it("orders lexicographically by id", () => {
    expect(compareByIdAsc({ id: "a" }, { id: "b" })).toBeLessThan(0);
    expect(compareByIdAsc({ id: "b" }, { id: "a" })).toBeGreaterThan(0);
  });

  it("returns exactly 0 only for identical ids — the only comparator in the chain allowed to do so safely", () => {
    expect(compareByIdAsc({ id: "same" }, { id: "same" })).toBe(0);
  });

  it("never returns NaN or a non-finite result for any string pair", () => {
    const result = compareByIdAsc({ id: "" }, { id: "x" });
    expect(Number.isFinite(result)).toBe(true);
  });
});
