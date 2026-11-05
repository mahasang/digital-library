import { describe, expect, it } from "vitest";
import { detectCapability, shouldEnable3D } from "@/components/home/shelf/capability";

describe("shouldEnable3D", () => {
  it("needs WebGL2", () => {
    expect(shouldEnable3D({ webgl2: false })).toBe(false);
  });

  it("respects data saver", () => {
    expect(shouldEnable3D({ webgl2: true, saveData: true })).toBe(false);
  });

  it("skips devices reporting under 4 GB of memory", () => {
    expect(shouldEnable3D({ webgl2: true, deviceMemory: 2 })).toBe(false);
    expect(shouldEnable3D({ webgl2: true, deviceMemory: 4 })).toBe(true);
  });

  it("allows browsers that do not report memory", () => {
    expect(shouldEnable3D({ webgl2: true })).toBe(true);
  });
});

describe("detectCapability", () => {
  it("reports no WebGL2 outside a browser", () => {
    expect(detectCapability().webgl2).toBe(false);
  });
});
