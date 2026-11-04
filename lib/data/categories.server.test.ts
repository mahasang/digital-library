import { describe, expect, it } from "vitest";
import { mapCategoryRow } from "./categories.server";

const row = {
  id: "uuid-1",
  slug: "engineering",
  name_th: "วิศวกรรมศาสตร์",
  name_en: "Engineering",
  description: null,
  icon: null,
  parent_id: null,
  is_active: true,
  sort_order: 0,
};

describe("mapCategoryRow", () => {
  it("carries stored Lao and Vietnamese names", () => {
    const mapped = mapCategoryRow({ ...row, name_lo: "lo-name", name_vi: "vi-name" });
    expect(mapped.nameLo).toBe("lo-name");
    expect(mapped.nameVi).toBe("vi-name");
  });

  it("accepts a row from before the migration, with no such columns", () => {
    const mapped = mapCategoryRow(row);
    expect(mapped.nameLo).toBeNull();
    expect(mapped.nameVi).toBeNull();
    expect(mapped.nameTh).toBe("วิศวกรรมศาสตร์");
  });
});
