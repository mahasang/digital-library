import { describe, expect, it } from "vitest";
import { validateOrcid, orcidProfileUrl } from "./orcid";

describe("validateOrcid", () => {
  it("accepts a real, correctly-checksummed ORCID iD", () => {
    // Known-valid ORCID iD (ISO 7064 MOD 11-2) used across ORCID's own docs/examples.
    const result = validateOrcid("0000-0002-1825-0097");
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe("0000-0002-1825-0097");
    expect(result.error).toBeNull();
  });

  it("accepts an ORCID iD whose checksum digit is X", () => {
    const result = validateOrcid("0000-0002-1694-233X");
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe("0000-0002-1694-233X");
  });

  it("strips a full https://orcid.org/ URL and still validates", () => {
    const result = validateOrcid("https://orcid.org/0000-0002-1825-0097");
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe("0000-0002-1825-0097");
  });

  it("accepts input with no dashes at all", () => {
    const result = validateOrcid("0000000218250097");
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe("0000-0002-1825-0097");
  });

  it("rejects a value with a single digit changed (bad checksum)", () => {
    const result = validateOrcid("0000-0002-1825-0098");
    expect(result.valid).toBe(false);
    expect(result.formatted).toBeNull();
    expect(result.error).toMatch(/checksum/);
  });

  it("rejects malformed input (wrong length)", () => {
    const result = validateOrcid("0000-0002-1825");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/รูปแบบ/);
  });

  it("rejects empty input", () => {
    const result = validateOrcid("");
    expect(result.valid).toBe(false);
  });

  it("rejects an X checksum digit appearing anywhere but the last position", () => {
    const result = validateOrcid("000X-0002-1825-0097");
    expect(result.valid).toBe(false);
  });
});

describe("orcidProfileUrl", () => {
  it("builds the public profile URL from a formatted ORCID iD", () => {
    expect(orcidProfileUrl("0000-0002-1825-0097")).toBe(
      "https://orcid.org/0000-0002-1825-0097"
    );
  });
});
