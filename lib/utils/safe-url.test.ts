import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, safeUrlHostname } from "@/lib/utils/safe-url";

describe("isSafeHttpUrl", () => {
  it("accepts https and http URLs", () => {
    expect(isSafeHttpUrl("https://creativecommons.org/licenses/by/4.0/")).toBe(true);
    expect(isSafeHttpUrl("http://hdl.handle.net/10986/43340")).toBe(true);
  });

  it("rejects javascript:, data: and vbscript: URLs", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects dangerous protocols regardless of letter case", () => {
    expect(isSafeHttpUrl("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("DATA:text/html,x")).toBe(false);
  });

  it("accepts http(s) in any letter case", () => {
    expect(isSafeHttpUrl("HTTPS://example.org/a")).toBe(true);
  });

  it("rejects values with leading, trailing or inner whitespace", () => {
    expect(isSafeHttpUrl(" https://example.org")).toBe(false);
    expect(isSafeHttpUrl("https://example.org ")).toBe(false);
    expect(isSafeHttpUrl("https://exa mple.org")).toBe(false);
    expect(isSafeHttpUrl(" javascript:alert(1)")).toBe(false);
  });

  it("rejects protocol-relative and relative URLs", () => {
    expect(isSafeHttpUrl("//evil.com")).toBe(false);
    expect(isSafeHttpUrl("/relative/path")).toBe(false);
    expect(isSafeHttpUrl("example.org")).toBe(false);
  });

  it("rejects empty, null and undefined", () => {
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });

  it("rejects strings that cannot be parsed as a URL", () => {
    expect(isSafeHttpUrl("https://")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
  });
});

describe("safeUrlHostname", () => {
  it("returns the hostname for a safe URL", () => {
    expect(safeUrlHostname("https://www.gutenberg.org/ebooks/46559")).toBe("www.gutenberg.org");
  });

  it("returns null for unsafe or missing values", () => {
    expect(safeUrlHostname("javascript:alert(1)")).toBeNull();
    expect(safeUrlHostname(null)).toBeNull();
    expect(safeUrlHostname("")).toBeNull();
  });
});
