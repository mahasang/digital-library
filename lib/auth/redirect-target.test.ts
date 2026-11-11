import { describe, expect, it } from "vitest";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect-target";

describe("sanitizeRedirectTarget", () => {
  it("ตัด locale prefix ที่ middleware เติมให้ (บั๊ก /lo/lo)", () => {
    expect(sanitizeRedirectTarget("/lo/submit-research")).toBe("/submit-research");
    expect(sanitizeRedirectTarget("/th/dashboard/approvals/abc")).toBe("/dashboard/approvals/abc");
    expect(sanitizeRedirectTarget("/en/research/x/read")).toBe("/research/x/read");
    expect(sanitizeRedirectTarget("/vi/profile")).toBe("/profile");
  });

  it("คง path ที่ไม่มี locale prefix ไว้ตามเดิม", () => {
    expect(sanitizeRedirectTarget("/submit-research")).toBe("/submit-research");
    expect(sanitizeRedirectTarget("/dashboard/approvals/94a9dd52")).toBe(
      "/dashboard/approvals/94a9dd52"
    );
    expect(sanitizeRedirectTarget("/")).toBe("/");
  });

  it("คง query string และ hash ไว้", () => {
    expect(sanitizeRedirectTarget("/lo/search?q=ແຜນ&page=2")).toBe("/search?q=ແຜນ&page=2");
    expect(sanitizeRedirectTarget("/lo/research/x#abstract")).toBe("/research/x#abstract");
  });

  it("หน้าแรกที่มี locale ได้ /", () => {
    expect(sanitizeRedirectTarget("/lo")).toBe("/");
    expect(sanitizeRedirectTarget("/lo/")).toBe("/");
    expect(sanitizeRedirectTarget("/lo?x=1")).toBe("/?x=1");
    expect(sanitizeRedirectTarget("/th#top")).toBe("/#top");
  });

  it("ตัด prefix ที่ซ้ำกันอยู่แล้ว (ลิงก์เก่า /lo/lo/...)", () => {
    expect(sanitizeRedirectTarget("/lo/lo/submit-research")).toBe("/submit-research");
    expect(sanitizeRedirectTarget("/th/en/lo/profile")).toBe("/profile");
  });

  it("ไม่ตัดเซกเมนต์ที่แค่ขึ้นต้นเหมือน locale", () => {
    expect(sanitizeRedirectTarget("/login")).toBe("/login");
    expect(sanitizeRedirectTarget("/english-books")).toBe("/english-books");
    expect(sanitizeRedirectTarget("/lo-fi/music")).toBe("/lo-fi/music");
    expect(sanitizeRedirectTarget("/viet")).toBe("/viet");
  });

  it("ไม่ใช่ path ภายในเว็บ → /", () => {
    for (const raw of [
      "https://evil.example/x",
      "http://evil.example",
      "javascript:alert(1)",
      "evil.example",
      "submit-research",
      "",
      "   ",
    ]) {
      expect(sanitizeRedirectTarget(raw)).toBe("/");
    }
  });

  it("กัน protocol-relative / backslash / อักขระควบคุม → /", () => {
    for (const raw of [
      "//evil.example",
      "//evil.example/path",
      "/\\evil.example",
      "/lo//evil.example",
      "/lo/\\evil.example",
      "/path\r\nSet-Cookie: x=1",
      "/path\u0000",
    ]) {
      expect(sanitizeRedirectTarget(raw)).toBe("/");
    }
  });

  it("ค่าที่ไม่ใช่ string → /", () => {
    for (const raw of [undefined, null, 42, {}, ["/lo/x"]]) {
      expect(sanitizeRedirectTarget(raw)).toBe("/");
    }
  });

  it("ตัดช่องว่างหัวท้าย", () => {
    expect(sanitizeRedirectTarget("  /lo/profile  ")).toBe("/profile");
  });
});

describe("sanitizeRedirectTarget with custom fallback", () => {
  it("ใช้ fallback เมื่อไม่มี/ไม่ปลอดภัย (หน้า MFA ใช้ /superadmin/overview)", () => {
    expect(sanitizeRedirectTarget(undefined, "/superadmin/overview")).toBe("/superadmin/overview");
    expect(sanitizeRedirectTarget("https://evil.example", "/superadmin/overview")).toBe(
      "/superadmin/overview"
    );
    expect(sanitizeRedirectTarget("//evil.example", "/superadmin/overview")).toBe(
      "/superadmin/overview"
    );
    expect(sanitizeRedirectTarget("/lo//evil.example", "/superadmin/overview")).toBe(
      "/superadmin/overview"
    );
  });

  it("ค่าที่ถูกต้องไม่ถูกแทนด้วย fallback และยังตัด locale ให้", () => {
    expect(sanitizeRedirectTarget("/lo/superadmin/users", "/superadmin/overview")).toBe(
      "/superadmin/users"
    );
    expect(sanitizeRedirectTarget("/lo", "/superadmin/overview")).toBe("/");
  });
});
