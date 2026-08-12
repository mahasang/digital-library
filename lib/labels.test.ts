import { describe, expect, it } from "vitest";
import { canDownload, canReadOnline } from "./labels";
import type { AccessLevel } from "@/types/research";

// These two functions gate whether lib/storage/signed-url.server.ts will ever
// create a Signed URL for a document — a regression here is a direct
// confidentiality bug (see docs/production-readiness-report.md finding #1
// for what happens when a "no full content" access level leaks content).
describe("canReadOnline", () => {
  const shouldAllow: AccessLevel[] = ["public", "read_only", "member_only", "staff_only"];
  it.each(shouldAllow)("allows reading online for access level %s", (level) => {
    expect(canReadOnline(level)).toBe(true);
  });

  it("blocks metadata_only — the one level with no content access at all", () => {
    expect(canReadOnline("metadata_only")).toBe(false);
  });
});

describe("canDownload", () => {
  const shouldAllow: AccessLevel[] = ["public", "member_only", "staff_only"];
  it.each(shouldAllow)("allows downloading for access level %s", (level) => {
    expect(canDownload(level)).toBe(true);
  });

  const shouldBlock: AccessLevel[] = ["read_only", "metadata_only"];
  it.each(shouldBlock)("blocks downloading for access level %s", (level) => {
    expect(canDownload(level)).toBe(false);
  });
});
