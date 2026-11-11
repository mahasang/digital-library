import { describe, expect, it } from "vitest";
import { resolveInitialOrganizationId } from "@/lib/submission/form-defaults";

const organizations = [
  { id: "org-a", nameTh: "สถาบัน เอ" },
  { id: "org-b", nameTh: "สถาบัน บี" },
  { id: "org-c", nameTh: "สถาบัน ซี" },
];

describe("resolveInitialOrganizationId", () => {
  it("keeps the organization of the item being edited (not the first in the list)", () => {
    expect(resolveInitialOrganizationId(organizations, "สถาบัน ซี")).toBe("org-c");
  });

  it("ignores surrounding whitespace in the stored name", () => {
    expect(resolveInitialOrganizationId(organizations, "  สถาบัน บี ")).toBe("org-b");
  });

  it("falls back to the first organization for a new submission", () => {
    expect(resolveInitialOrganizationId(organizations, undefined)).toBe("org-a");
    expect(resolveInitialOrganizationId(organizations, "")).toBe("org-a");
    expect(resolveInitialOrganizationId(organizations, null)).toBe("org-a");
  });

  it("falls back to the first organization when the stored name is not in the list", () => {
    expect(resolveInitialOrganizationId(organizations, "หน่วยงานที่ถูกปิดใช้งาน")).toBe("org-a");
  });

  it("returns an empty string when there are no organizations at all", () => {
    expect(resolveInitialOrganizationId([], "สถาบัน เอ")).toBe("");
  });
});
