import { describe, expect, it } from "vitest";
import {
  LANGUAGE_OPTIONS,
  createBibliographicSchema,
  hasBibliographicFormData,
  readBibliographicFormData,
  toBibliographicColumns,
} from "@/lib/validation/bibliographic";

// Identity translator: error messages come back as their i18n keys.
const t = ((key: string) => key) as unknown as Parameters<typeof createBibliographicSchema>[0];
const schema = createBibliographicSchema(t);

function parse(input: Record<string, unknown>) {
  return schema.safeParse(input);
}

function errorFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = parse(input);
  if (result.success) return undefined;
  return result.error.flatten().fieldErrors[field as never]?.[0];
}

describe("createBibliographicSchema", () => {
  it("accepts a fully filled, valid set", () => {
    const result = parse({
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      sourceUrl: "http://hdl.handle.net/10986/43340",
      publisher: "World Bank, Washington DC",
      language: "en",
    });
    expect(result.success).toBe(true);
  });

  it("turns empty, blank and missing values into NULL columns", () => {
    const result = parse({ license: "", licenseUrl: "   ", sourceUrl: undefined, publisher: "\n", language: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(toBibliographicColumns(result.data)).toEqual({
        license: null,
        license_url: null,
        source_url: null,
        publisher: null,
        language: null,
      });
    }
  });

  it("trims text before saving", () => {
    const result = parse({ license: "  CC BY 4.0  ", publisher: "  Acme  ", language: " en " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.license).toBe("CC BY 4.0");
      expect(result.data.publisher).toBe("Acme");
      expect(result.data.language).toBe("en");
    }
  });

  it("rejects javascript:, data: and vbscript: URLs in both URL fields", () => {
    for (const field of ["licenseUrl", "sourceUrl"]) {
      expect(errorFor({ [field]: "javascript:alert(1)" }, field)).toBe("bibliographic.urlInvalid");
      expect(errorFor({ [field]: "JaVaScRiPt:alert(1)" }, field)).toBe("bibliographic.urlInvalid");
      expect(errorFor({ [field]: "data:text/html,<script>alert(1)</script>" }, field)).toBe(
        "bibliographic.urlInvalid"
      );
      expect(errorFor({ [field]: "vbscript:msgbox(1)" }, field)).toBe("bibliographic.urlInvalid");
    }
  });

  it("rejects relative, protocol-relative and scheme-without-slashes URLs", () => {
    expect(errorFor({ sourceUrl: "//evil.com" }, "sourceUrl")).toBe("bibliographic.urlInvalid");
    expect(errorFor({ sourceUrl: "/local/path" }, "sourceUrl")).toBe("bibliographic.urlInvalid");
    expect(errorFor({ sourceUrl: "example.org" }, "sourceUrl")).toBe("bibliographic.urlInvalid");
    // parses as a URL but would violate the DB CHECK (^https?://)
    expect(errorFor({ sourceUrl: "http:example.org" }, "sourceUrl")).toBe("bibliographic.urlInvalid");
  });

  it("rejects URLs containing whitespace", () => {
    expect(errorFor({ licenseUrl: "https://exa mple.org/a" }, "licenseUrl")).toBe("bibliographic.urlInvalid");
    expect(errorFor({ licenseUrl: "https://example.org/a b" }, "licenseUrl")).toBe("bibliographic.urlInvalid");
  });

  it("rejects over-long URLs", () => {
    const longUrl = `https://example.org/${"a".repeat(2001)}`;
    expect(errorFor({ sourceUrl: longUrl }, "sourceUrl")).toBe("bibliographic.urlTooLong");
  });

  it("enforces the 100-character license limit exactly like the DB CHECK", () => {
    expect(parse({ license: "x".repeat(100) }).success).toBe(true);
    expect(errorFor({ license: "x".repeat(101) }, "license")).toBe("bibliographic.licenseTooLong");
  });

  it("enforces the 300-character publisher limit exactly like the DB CHECK", () => {
    expect(parse({ publisher: "p".repeat(300) }).success).toBe(true);
    expect(errorFor({ publisher: "p".repeat(301) }, "publisher")).toBe("bibliographic.publisherTooLong");
  });

  it("accepts well-formed language codes and rejects malformed ones", () => {
    for (const ok of ["en", "lo", "th", "vi", "fil", "zh-Hans", "pt-BR"]) {
      expect(parse({ language: ok }).success, ok).toBe(true);
    }
    for (const bad of ["e", "english", "EN", "en_US", "en-", "en-1234", "e n", "1a", "<script>"]) {
      expect(errorFor({ language: bad }, "language"), bad).toBe("bibliographic.languageInvalid");
    }
  });

  it("offers only well-formed codes in the language select", () => {
    for (const code of LANGUAGE_OPTIONS) {
      expect(parse({ language: code }).success, code).toBe(true);
    }
  });
});

describe("FormData helpers", () => {
  it("detects whether any of the five fields was submitted", () => {
    expect(hasBibliographicFormData(new FormData())).toBe(false);
    const fd = new FormData();
    fd.set("titleTh", "x");
    expect(hasBibliographicFormData(fd)).toBe(false);
    fd.set("publisher", "");
    expect(hasBibliographicFormData(fd)).toBe(true);
  });

  it("reads missing keys as undefined (so they validate as NULL, never as a stray string)", () => {
    const fd = new FormData();
    fd.set("license", "CC0 1.0");
    const raw = readBibliographicFormData(fd);
    expect(raw).toEqual({
      license: "CC0 1.0",
      licenseUrl: undefined,
      sourceUrl: undefined,
      publisher: undefined,
      language: undefined,
    });
    expect(schema.safeParse(raw).success).toBe(true);
  });
});
