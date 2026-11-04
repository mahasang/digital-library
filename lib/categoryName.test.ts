import { describe, expect, it } from "vitest";
import { getCategoryName } from "./categoryName";

const category = { nameTh: "วิศวกรรมศาสตร์", nameEn: "Engineering" };

describe("getCategoryName", () => {
  it("returns the English name for en", () => {
    expect(getCategoryName(category, "en")).toBe("Engineering");
  });

  it("returns the Thai name for th", () => {
    expect(getCategoryName(category, "th")).toBe("วิศวกรรมศาสตร์");
  });

  it("falls back to Thai for locales with no stored translation", () => {
    expect(getCategoryName(category, "lo")).toBe("วิศวกรรมศาสตร์");
    expect(getCategoryName(category, "vi")).toBe("วิศวกรรมศาสตร์");
  });

  it("falls back to Thai when the English name is blank", () => {
    expect(getCategoryName({ ...category, nameEn: "" }, "en")).toBe("วิศวกรรมศาสตร์");
    expect(getCategoryName({ ...category, nameEn: "   " }, "en")).toBe("วิศวกรรมศาสตร์");
  });
});
