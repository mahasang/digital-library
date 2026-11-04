import { describe, expect, it } from "vitest";
import { getCategoryName } from "./categoryName";

const category = {
  nameTh: "วิศวกรรมศาสตร์",
  nameEn: "Engineering",
  nameLo: "lo-name",
  nameVi: "vi-name",
};

describe("getCategoryName", () => {
  it("returns the stored name for each translated locale", () => {
    expect(getCategoryName(category, "en")).toBe("Engineering");
    expect(getCategoryName(category, "lo")).toBe("lo-name");
    expect(getCategoryName(category, "vi")).toBe("vi-name");
  });

  it("returns the Thai name for th", () => {
    expect(getCategoryName(category, "th")).toBe("วิศวกรรมศาสตร์");
  });

  it("falls back to Thai for an unknown locale", () => {
    expect(getCategoryName(category, "fr")).toBe("วิศวกรรมศาสตร์");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["whitespace", "   "],
  ])("falls back to Thai when the lo and vi names are %s", (_label, value) => {
    const blank = { ...category, nameLo: value, nameVi: value };
    expect(getCategoryName(blank, "lo")).toBe("วิศวกรรมศาสตร์");
    expect(getCategoryName(blank, "vi")).toBe("วิศวกรรมศาสตร์");
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
  ])("falls back to Thai when the English name is %s", (_label, value) => {
    expect(getCategoryName({ ...category, nameEn: value }, "en")).toBe("วิศวกรรมศาสตร์");
  });

  it("does not use one locale's translation for another", () => {
    expect(getCategoryName({ ...category, nameLo: null }, "lo")).toBe("วิศวกรรมศาสตร์");
    expect(getCategoryName({ ...category, nameVi: null }, "lo")).toBe("lo-name");
  });

  it("trims stored names", () => {
    expect(getCategoryName({ ...category, nameLo: "  lo-name  " }, "lo")).toBe("lo-name");
  });
});
