import { describe, expect, it } from "vitest";
import { detectFileSignature, validateFileSignature } from "@/lib/security/file-signature.server";
import {
  ATTACHMENT_ALLOWED_TYPES,
  COVER_ALLOWED_TYPES,
  PDF_ALLOWED_TYPES,
} from "@/lib/storage/limits";

const pad = (head: number[]) => new Uint8Array([...head, ...new Array(32).fill(0)]);
const PDF = pad([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP_DOCX = pad([0x50, 0x4b, 0x03, 0x04]);
const OLE2_DOC = pad([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("validateFileSignature กับชนิดไฟล์ที่รับหลังเฟส 3", () => {
  it("SVG ไม่ผ่านเป็นภาพปก แม้เนื้อไฟล์เป็น SVG จริงและประกาศชนิดตรงกัน", () => {
    const result = validateFileSignature(SVG, "image/svg+xml", COVER_ALLOWED_TYPES);
    expect(result.ok).toBe(false);
    expect(result.detectedType).toBe("image/svg+xml");
  });

  it("Word (.docx และ .doc) ไม่ผ่านเป็นเอกสารประกอบ", () => {
    expect(validateFileSignature(ZIP_DOCX, DOCX_MIME, ATTACHMENT_ALLOWED_TYPES).ok).toBe(false);
    expect(validateFileSignature(OLE2_DOC, "application/msword", ATTACHMENT_ALLOWED_TYPES).ok).toBe(false);
  });

  it("ชนิดที่ยังรับผ่านตามปกติ: PNG เป็นปก, PDF/PNG เป็นเอกสารประกอบ, PDF เป็นไฟล์งานหลัก", () => {
    expect(validateFileSignature(PNG, "image/png", COVER_ALLOWED_TYPES).ok).toBe(true);
    expect(validateFileSignature(PDF, "application/pdf", ATTACHMENT_ALLOWED_TYPES).ok).toBe(true);
    expect(validateFileSignature(PNG, "image/png", ATTACHMENT_ALLOWED_TYPES).ok).toBe(true);
    expect(validateFileSignature(PDF, "application/pdf", PDF_ALLOWED_TYPES).ok).toBe(true);
  });

  it("ไฟล์ที่เปลี่ยนชนิดหลอก (เนื้อ PDF แต่ประกาศเป็น PNG) ไม่ผ่านเป็นปก", () => {
    expect(validateFileSignature(PDF, "image/png", COVER_ALLOWED_TYPES).ok).toBe(false);
  });

  it("ยังตรวจจำแนกชนิดได้ครบ (ใช้ปฏิเสธและใช้กับโลโก้เว็บไซต์)", () => {
    expect(detectFileSignature(SVG)).toBe("image/svg+xml");
    expect(detectFileSignature(ZIP_DOCX)).toBe(DOCX_MIME);
    expect(detectFileSignature(OLE2_DOC)).toBe("application/msword");
    expect(detectFileSignature(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
