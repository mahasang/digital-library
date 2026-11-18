import { describe, expect, it } from "vitest";
import { createSubmissionSchema } from "@/lib/validation/submission";

/**
 * เฟส 2: ลดช่องบังคับ — คำสำคัญและหมายเหตุลิขสิทธิ์ไม่บังคับแล้ว
 * ส่วนด่านที่ต้องคงไว้ (ติ๊กยืนยันลิขสิทธิ์ ผู้วิจัย ไฟล์ PDF ฯลฯ) ยังต้องบังคับเหมือนเดิม
 */

const t = ((key: string) => key) as unknown as Parameters<typeof createSubmissionSchema>[0];
const schema = createSubmissionSchema(t);

const valid = {
  titleTh: "ชื่อเรื่องทดสอบ",
  abstract: "ก".repeat(60),
  organizationId: "org-1",
  year: 2026,
  categoryId: "science",
  keywords: ["วิทยาศาสตร์"],
  researchers: [{ name: "สมชาย ใจดี" }],
  accessLevel: "public" as const,
  copyrightNote: "ข้าพเจ้าเป็นเจ้าของลิขสิทธิ์",
  copyrightConfirmed: true,
  pdfPath: "user-1/draft-1/paper.pdf",
};

function errorsOf(input: unknown) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? {} : result.error.flatten().fieldErrors;
}

describe("submission schema — optional fields (phase 2)", () => {
  it("accepts a complete submission", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("accepts a submission with no keywords", () => {
    const result = schema.safeParse({ ...valid, keywords: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.keywords).toEqual([]);
  });

  it("still limits keywords to 20", () => {
    const keywords = Array.from({ length: 21 }, (_, i) => `kw${i}`);
    expect(errorsOf({ ...valid, keywords }).keywords).toEqual(["submission.keywordsTooMany"]);
  });

  it.each([
    ["omitted", undefined],
    ["an empty string", ""],
    ["whitespace only", "   \n "],
    ["null", null],
  ])("treats a copyright note that is %s as not provided", (_label, copyrightNote) => {
    const input: Record<string, unknown> = { ...valid };
    if (copyrightNote === undefined) delete input.copyrightNote;
    else input.copyrightNote = copyrightNote;
    const result = schema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.copyrightNote).toBeUndefined();
  });

  it("keeps a short copyright note and trims surrounding whitespace", () => {
    const result = schema.safeParse({ ...valid, copyrightNote: "  ok  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.copyrightNote).toBe("ok");
  });

  it("still limits the copyright note to 2000 characters", () => {
    expect(errorsOf({ ...valid, copyrightNote: "x".repeat(2001) }).copyrightNote).toEqual([
      "submission.copyrightNoteTooLong",
    ]);
  });
});

describe("submission schema — gates that must stay required", () => {
  it("rejects when the copyright confirmation is not ticked", () => {
    expect(errorsOf({ ...valid, copyrightConfirmed: false }).copyrightConfirmed).toEqual([
      "submission.copyrightConfirmRequired",
    ]);
  });

  it("rejects an empty researcher list and a too-short researcher name", () => {
    expect(errorsOf({ ...valid, researchers: [] }).researchers).toEqual(["submission.researchersRequired"]);
    expect(errorsOf({ ...valid, researchers: [{ name: "ก" }] })).toHaveProperty("researchers");
  });

  it("rejects a missing PDF, a short abstract and a short title", () => {
    // pdfPath ว่างได้ทั้งข้อความ "ต้องมีไฟล์" และ "ชนิดไฟล์ไม่ถูกต้อง" (พฤติกรรมเดิมของ schema)
    expect(errorsOf({ ...valid, pdfPath: "" }).pdfPath).toContain("submission.pdfRequired");
    expect(errorsOf({ ...valid, abstract: "สั้น" }).abstract).toEqual(["submission.abstractTooShort"]);
    expect(errorsOf({ ...valid, titleTh: "สั้น" }).titleTh).toEqual(["submission.titleThTooShort"]);
  });

  it("rejects a non-PDF work file", () => {
    expect(errorsOf({ ...valid, pdfPath: "user-1/draft-1/paper.docx" })).toHaveProperty("pdfPath");
  });
});
