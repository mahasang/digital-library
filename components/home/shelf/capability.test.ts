import { describe, expect, it } from "vitest";
import {
  detectCapability,
  isSoftwareRenderer,
  shouldEnable3D,
} from "@/components/home/shelf/capability";

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

describe("isSoftwareRenderer", () => {
  it("recognises renderers that run on the CPU", () => {
    expect(isSoftwareRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)")).toBe(true);
    expect(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
    expect(isSoftwareRenderer("ANGLE (Microsoft, Microsoft Basic Render Driver, D3D11)")).toBe(true);
  });

  it("treats real GPUs as hardware", () => {
    expect(isSoftwareRenderer("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, D3D11)")).toBe(false);
    expect(isSoftwareRenderer("Adreno (TM) 640")).toBe(false);
  });

  it("treats an unknown renderer as hardware", () => {
    expect(isSoftwareRenderer("")).toBe(false);
  });
});
