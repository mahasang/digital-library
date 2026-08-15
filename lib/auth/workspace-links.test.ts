import { describe, expect, it } from "vitest";
import { buildWorkspaceLinks, ROLE_RANK } from "@/lib/auth/workspace-links";
import type { SessionUser } from "@/lib/supabase/session";
import type { UserRole } from "@/types/research";

function makeUser(role: UserRole): SessionUser {
  return {
    id: `user-${role}`,
    email: `${role}@example.com`,
    fullName: null,
    role,
    hasVerifiedMfa: false,
  };
}

describe("buildWorkspaceLinks", () => {
  it("returns no links for a guest (no session)", () => {
    expect(buildWorkspaceLinks(null)).toEqual([]);
  });

  it("returns favorites + access-requests for member", () => {
    const links = buildWorkspaceLinks(makeUser("member"));
    expect(links.map((l) => l.href)).toEqual(["/favorites", "/access-requests"]);
  });

  it("adds submit-research + my-submissions for staff", () => {
    const links = buildWorkspaceLinks(makeUser("staff"));
    expect(links.map((l) => l.href)).toEqual([
      "/favorites",
      "/access-requests",
      "/submit-research",
      "/my-submissions",
    ]);
  });

  it("adds dashboard for librarian", () => {
    const links = buildWorkspaceLinks(makeUser("librarian"));
    expect(links.map((l) => l.href)).toEqual([
      "/favorites",
      "/access-requests",
      "/submit-research",
      "/my-submissions",
      "/dashboard",
    ]);
  });

  it("admin sees the same links as librarian (no superadmin link)", () => {
    const links = buildWorkspaceLinks(makeUser("admin"));
    expect(links.map((l) => l.href)).toEqual([
      "/favorites",
      "/access-requests",
      "/submit-research",
      "/my-submissions",
      "/dashboard",
    ]);
  });

  it("super_admin sees all links including the superadmin overview, in a fixed order", () => {
    const links = buildWorkspaceLinks(makeUser("super_admin"));
    expect(links.map((l) => l.href)).toEqual([
      "/favorites",
      "/access-requests",
      "/submit-research",
      "/my-submissions",
      "/dashboard",
      "/superadmin/overview",
    ]);
  });

  it("produces plain serializable objects (href/labelKey/iconKey strings only)", () => {
    const links = buildWorkspaceLinks(makeUser("super_admin"));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(Object.keys(link).sort()).toEqual(["href", "iconKey", "labelKey"]);
      expect(typeof link.href).toBe("string");
      expect(typeof link.labelKey).toBe("string");
      expect(typeof link.iconKey).toBe("string");
    }
  });

  it("ROLE_RANK is monotonically increasing guest -> super_admin", () => {
    expect(ROLE_RANK.guest).toBeLessThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeLessThan(ROLE_RANK.staff);
    expect(ROLE_RANK.staff).toBeLessThan(ROLE_RANK.librarian);
    expect(ROLE_RANK.librarian).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.super_admin);
  });
});
