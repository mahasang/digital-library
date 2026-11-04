import { describe, expect, it } from "vitest";
import {
  bookDimensions,
  clampOffset,
  clothIndex,
  coverWindow,
  decayVelocity,
  fitText,
  isClick,
  layoutBooks,
  nearestIndex,
  seedFromSlug,
  shouldHandleWheel,
  stepIndex,
} from "@/components/home/shelf/shelfMath";

const length = (text: string) => [...text].length;

describe("book identity", () => {
  it("gives the same seed for the same slug", () => {
    expect(seedFromSlug("a")).toBe(seedFromSlug("a"));
    expect(seedFromSlug("a")).not.toBe(seedFromSlug("b"));
  });

  it("keeps dimensions inside the design ranges", () => {
    for (let i = 0; i < 100; i += 1) {
      const { height, width, thickness } = bookDimensions(seedFromSlug(`slug-${i}`));
      expect(height).toBeGreaterThanOrEqual(1.9);
      expect(height).toBeLessThanOrEqual(2.4);
      expect(width).toBeGreaterThanOrEqual(1.35);
      expect(width).toBeLessThanOrEqual(1.7);
      expect(thickness).toBeGreaterThanOrEqual(0.16);
      expect(thickness).toBeLessThanOrEqual(0.34);
    }
  });

  it("picks a palette index inside the palette", () => {
    for (let i = 0; i < 100; i += 1) {
      const index = clothIndex(seedFromSlug(`slug-${i}`), 6);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });
});

describe("layout", () => {
  it("places books side by side without overlap", () => {
    const thicknesses = [0.2, 0.3, 0.25];
    const { centers, totalWidth } = layoutBooks(thicknesses);
    for (let i = 1; i < centers.length; i += 1) {
      const gap = centers[i] - centers[i - 1] - (thicknesses[i] + thicknesses[i - 1]) / 2;
      expect(gap).toBeCloseTo(0.02);
    }
    expect(totalWidth).toBeCloseTo(0.75 + 0.04);
  });

  it("stops at both ends of a two-book shelf", () => {
    const { centers } = layoutBooks([0.2, 0.3]);
    expect(clampOffset(999, centers)).toBe(centers[1]);
    expect(clampOffset(-999, centers)).toBe(centers[0]);
  });

  it("finds the nearest book", () => {
    expect(nearestIndex(1.4, [0, 1, 2])).toBe(1);
    expect(nearestIndex(1.6, [0, 1, 2])).toBe(2);
  });

  it("does not step past either end", () => {
    expect(stepIndex(1, 1, 2)).toBe(1);
    expect(stepIndex(0, -1, 2)).toBe(0);
    expect(stepIndex(0, 1, 2)).toBe(1);
  });

  it("loads covers three books either side, within the shelf", () => {
    expect(coverWindow(0, 16)).toEqual([0, 1, 2, 3]);
    expect(coverWindow(15, 16)).toEqual([12, 13, 14, 15]);
    expect(coverWindow(5, 16)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("input", () => {
  it("only takes the wheel when it moves mostly sideways", () => {
    expect(shouldHandleWheel(10, 2)).toBe(true);
    expect(shouldHandleWheel(2, 10)).toBe(false);
    expect(shouldHandleWheel(5, 5)).toBe(false);
    expect(shouldHandleWheel(-10, 2)).toBe(true);
  });

  it("treats a drag over 6px as not a click", () => {
    expect(isClick(6)).toBe(true);
    expect(isClick(7)).toBe(false);
  });

  it("slows momentum toward zero regardless of frame length", () => {
    let velocity = 10;
    for (let i = 0; i < 300; i += 1) velocity = decayVelocity(velocity, 16);
    expect(Math.abs(velocity)).toBeLessThan(0.01);

    const oneLongFrame = decayVelocity(10, 32);
    const twoShortFrames = decayVelocity(decayVelocity(10, 16), 16);
    expect(oneLongFrame).toBeCloseTo(twoShortFrames);
  });
});

describe("fitText", () => {
  it("returns text that already fits", () => {
    expect(fitText("สั้น", 10, length)).toBe("สั้น");
  });

  it("shortens long text to fit and ends with an ellipsis", () => {
    const result = fitText("a".repeat(50), 10, length);
    expect(length(result)).toBeLessThanOrEqual(10);
    expect(result.endsWith("…")).toBe(true);
  });

  it("never cuts a Thai mark from its consonant", () => {
    const result = fitText("นี้".repeat(20), 8, length);
    expect(result.slice(0, -1).endsWith("นี้")).toBe(true);
  });

  it("never cuts a Lao mark from its consonant", () => {
    const result = fitText("ນີ້".repeat(20), 8, length);
    expect(result.slice(0, -1).endsWith("ນີ້")).toBe(true);
  });

  it("returns just the ellipsis when nothing else fits", () => {
    expect(fitText("นี้นี้", 1, length)).toBe("…");
  });
});
