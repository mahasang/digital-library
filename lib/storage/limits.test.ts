import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  ATTACHMENT_ALLOWED_TYPES,
  COVER_ALLOWED_EXTENSIONS,
  COVER_ALLOWED_TYPES,
  PDF_ALLOWED_EXTENSIONS,
  PDF_ALLOWED_TYPES,
  SITE_ASSET_ALLOWED_EXTENSIONS,
  SITE_ASSET_ALLOWED_TYPES,
  isExtensionAllowed,
  isExtensionMatchingMimeType,
  validateFile,
} from "@/lib/storage/limits";

const MB = 1024 * 1024;
const file = (name: string, type: string) => new File(["x"], name, { type });

describe("ชนิดไฟล์ที่รับในฟอร์มส่งงานวิจัย", () => {
  it("ไฟล์งานหลักรับเฉพาะ PDF", () => {
    expect(PDF_ALLOWED_TYPES).toEqual(["application/pdf"]);
    expect(PDF_ALLOWED_EXTENSIONS).toEqual([".pdf"]);
  });

  it("ภาพปกรับเฉพาะภาพแรสเตอร์ (PNG/JPEG/WEBP) ไม่รับ SVG", () => {
    expect([...COVER_ALLOWED_TYPES].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(COVER_ALLOWED_TYPES).not.toContain("image/svg+xml");
    expect(isExtensionAllowed("cover.svg", COVER_ALLOWED_EXTENSIONS)).toBe(false);
    expect(isExtensionAllowed("COVER.SVG", COVER_ALLOWED_EXTENSIONS)).toBe(false);
    for (const ok of ["a.png", "a.jpg", "a.jpeg", "a.webp"]) {
      expect(isExtensionAllowed(ok, COVER_ALLOWED_EXTENSIONS)).toBe(true);
    }
  });

  it("เอกสารประกอบรับเฉพาะ PDF/PNG/JPEG ไม่รับ Word", () => {
    expect([...ATTACHMENT_ALLOWED_TYPES].sort()).toEqual([
      "application/pdf",
      "image/jpeg",
      "image/png",
    ]);
    for (const bad of ["a.doc", "a.docx", "a.svg", "a.webp", "a.exe"]) {
      expect(isExtensionAllowed(bad, ATTACHMENT_ALLOWED_EXTENSIONS)).toBe(false);
    }
    for (const ok of ["a.pdf", "a.png", "a.jpg", "a.jpeg"]) {
      expect(isExtensionAllowed(ok, ATTACHMENT_ALLOWED_EXTENSIONS)).toBe(true);
    }
  });

  it("รายการ MIME กับนามสกุลสอดคล้องกัน (ทุก MIME มีนามสกุลที่รับ และทุกนามสกุลมี MIME รองรับ)", () => {
    const pairs: Array<[readonly string[], readonly string[]]> = [
      [PDF_ALLOWED_TYPES, PDF_ALLOWED_EXTENSIONS],
      [COVER_ALLOWED_TYPES, COVER_ALLOWED_EXTENSIONS],
      [ATTACHMENT_ALLOWED_TYPES, ATTACHMENT_ALLOWED_EXTENSIONS],
    ];
    for (const [types, extensions] of pairs) {
      for (const type of types) {
        expect(extensions.some((ext) => isExtensionMatchingMimeType(`f${ext}`, type))).toBe(true);
      }
      for (const ext of extensions) {
        expect(types.some((type) => isExtensionMatchingMimeType(`f${ext}`, type))).toBe(true);
      }
    }
  });

  it("validateFile (ฝั่งเบราว์เซอร์) ปฏิเสธ SVG เป็นปก และ Word เป็นเอกสารประกอบ", () => {
    expect(validateFile(file("a.svg", "image/svg+xml"), COVER_ALLOWED_TYPES, 5 * MB)).not.toBeNull();
    expect(
      validateFile(
        file("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ATTACHMENT_ALLOWED_TYPES,
        20 * MB
      )
    ).not.toBeNull();
    expect(validateFile(file("a.doc", "application/msword"), ATTACHMENT_ALLOWED_TYPES, 20 * MB)).not.toBeNull();
    expect(validateFile(file("a.png", "image/png"), COVER_ALLOWED_TYPES, 5 * MB)).toBeNull();
    expect(validateFile(file("a.pdf", "application/pdf"), ATTACHMENT_ALLOWED_TYPES, 20 * MB)).toBeNull();
  });

  it("โลโก้/ไอคอนเว็บไซต์ (Super Admin) ยังรับ SVG ตามเดิม ไม่กระทบฟีเจอร์อื่น", () => {
    expect(SITE_ASSET_ALLOWED_TYPES).toContain("image/svg+xml");
    expect(isExtensionAllowed("logo.svg", SITE_ASSET_ALLOWED_EXTENSIONS)).toBe(true);
    expect(isExtensionMatchingMimeType("logo.svg", "image/svg+xml")).toBe(true);
  });
});
