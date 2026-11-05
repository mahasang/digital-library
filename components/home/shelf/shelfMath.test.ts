import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bookDimensions,
  clampOffset,
  clothIndex,
  coverWindow,
  createCoverTracker,
  decayVelocity,
  entranceProgress,
  fitText,
  isClick,
  layoutBooks,
  leanAngle,
  nearestIndex,
  pullPose,
  seedFromSlug,
  shouldHandleWheel,
  springStep,
  spreadPositions,
  focusPosition,
  stepIndex,
  wrapText,
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
      expect(thickness).toBeGreaterThanOrEqual(0.26);
      expect(thickness).toBeLessThanOrEqual(0.5);
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

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("สั้น", 20, 3, length)).toEqual(["สั้น"]);
  });

  it("wraps Thai at word boundaries even without spaces", () => {
    const lines = wrapText("การพัฒนาการศึกษาในชนบท", 10, 5, length);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("การพัฒนาการศึกษาในชนบท");
    lines.forEach((line) => expect(length(line)).toBeLessThanOrEqual(10));
  });

  it("wraps English on spaces without leading spaces", () => {
    expect(wrapText("one two three", 7, 3, length)).toEqual(["one two", "three"]);
  });

  it("ends the last allowed line with an ellipsis when text is left over", () => {
    const lines = wrapText("one two three four five six", 7, 2, length);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(length(lines[1])).toBeLessThanOrEqual(7);
  });

  it("splits a word longer than the line without losing its marks", () => {
    const lines = wrapText("นี้".repeat(6), 6, 5, length);
    lines.forEach((line) => expect(line).not.toMatch(/^[ิ-ฺ็-๎]/));
    expect(lines.join("")).toBe("นี้".repeat(6));
  });
});

describe("spreadPositions", () => {
  it("leaves books in place when none is pulled out", () => {
    expect(spreadPositions([1, 2, 3], [5, 5, 5], [0, 0, 0])).toEqual([1, 2, 3]);
  });

  it("moves later books aside and centres the pulled book in its gap", () => {
    expect(spreadPositions([1, 2, 3], [0, 4, 0], [0, 1, 0])).toEqual([1, 4, 7]);
  });

  it("opens the gap in proportion to the pull", () => {
    expect(spreadPositions([1, 2, 3], [0, 4, 0], [0, 0.5, 0])).toEqual([1, 3, 5]);
  });
});

describe("focusPosition", () => {
  it("lands on a book when the offset is on its centre", () => {
    expect(focusPosition(2, [1, 2, 3], [1, 4, 7])).toBe(4);
  });

  it("interpolates between neighbouring books", () => {
    expect(focusPosition(1.5, [1, 2, 3], [1, 4, 7])).toBe(2.5);
  });

  it("stays on the book for a single-book shelf", () => {
    expect(focusPosition(9, [1], [3])).toBe(3);
  });
});

describe("leading vowels", () => {
  it("does not leave a Thai leading vowel before the ellipsis", () => {
    expect(fitText("ประเทศเวียดนาม", 5, length)).toBe("ประ…");
  });

  it("does not leave a Lao leading vowel before the ellipsis", () => {
    expect(fitText("ປະເທດລາວ", 4, length)).toBe("ປະ…");
  });

  it("keeps a leading vowel with its consonant when splitting a long word", () => {
    const lines = wrapText("กกกกเกกกก", 5, 5, length);
    lines.forEach((line) => expect(line).not.toMatch(/[เ-ไ]$/));
    expect(lines.join("")).toBe("กกกกเกกกก");
  });
});

describe("wrapText ellipsis", () => {
  it("adds exactly one ellipsis to the last line", () => {
    expect(wrapText("one two three four five six", 7, 2, length)).toEqual(["one two", "three…"]);
  });

  it("shortens the last line when the ellipsis does not fit", () => {
    expect(wrapText("seven77 eight88 nine", 7, 1, length)).toEqual(["seven7…"]);
  });
});

describe("createCoverTracker", () => {
  it("paints the typeset cover until a real cover has loaded", () => {
    const covers = createCoverTracker();
    expect(covers.needsTypeset(0)).toBe(true);
    covers.accept(0, 1);
    expect(covers.needsTypeset(0)).toBe(false);
    expect(covers.needsTypeset(1)).toBe(true);
  });

  it("ignores a low-resolution cover that arrives after a sharper one", () => {
    const covers = createCoverTracker();
    expect(covers.accept(0, 2)).toBe(true);
    expect(covers.accept(0, 1)).toBe(false);
  });

  it("upgrades a cover to a sharper one", () => {
    const covers = createCoverTracker();
    expect(covers.accept(0, 1)).toBe(true);
    expect(covers.accept(0, 2)).toBe(true);
  });
});

describe("browsers without Intl.Segmenter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("still loads the module for the code on the first-load path", async () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    vi.resetModules();
    const math = await import("@/components/home/shelf/shelfMath");
    expect(math.stepIndex(0, 1, 2)).toBe(1);
  });
});

describe("springStep", () => {
  function settle(frameMs: number, frames: number) {
    let state = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < frames; i += 1) {
      state = springStep(state.value, state.velocity, 1, frameMs);
      peak = Math.max(peak, state.value);
    }
    return { ...state, peak };
  }

  it("settles on the target", () => {
    expect(settle(16, 200).value).toBeCloseTo(1, 3);
  });

  it("overshoots slightly, like a real object, but not by much", () => {
    const { peak } = settle(16, 200);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.08);
  });

  it("stays stable on a slow 50ms frame", () => {
    expect(settle(50, 100).value).toBeCloseTo(1, 3);
  });
});

describe("pullPose", () => {
  it("rests on the shelf at zero", () => {
    expect(pullPose(0)).toEqual({ slide: 0, turn: 0, lift: 0 });
  });

  it("is fully out and facing the viewer at one", () => {
    const pose = pullPose(1);
    expect(pose.slide).toBe(1);
    expect(pose.turn).toBe(1);
    expect(pose.lift).toBeCloseTo(0);
  });

  it("slides out before it turns, as a hand would pull a book", () => {
    const pose = pullPose(0.3);
    expect(pose.slide).toBeGreaterThan(pose.turn);
  });

  it("lifts off the shelf part way through", () => {
    expect(pullPose(0.5).lift).toBeGreaterThan(0);
  });
});

describe("entranceProgress", () => {
  it("waits for the book's turn", () => {
    expect(entranceProgress(0, 3)).toBe(0);
  });

  it("finishes after its duration", () => {
    expect(entranceProgress(5000, 3)).toBe(1);
  });

  it("brings earlier books in first", () => {
    expect(entranceProgress(300, 0)).toBeGreaterThan(entranceProgress(300, 5));
  });
});

describe("leanAngle", () => {
  it("is upright when the shelf is still", () => {
    expect(leanAngle(0)).toBe(0);
  });

  it("leans against the direction of travel", () => {
    expect(leanAngle(0.01)).toBeLessThan(0);
    expect(leanAngle(-0.01)).toBeGreaterThan(0);
  });

  it("never tips far however fast the shelf moves", () => {
    expect(Math.abs(leanAngle(100))).toBeLessThanOrEqual(0.06);
  });
});
