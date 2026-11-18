import { z } from "zod";
import type { useTranslations } from "next-intl";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  COVER_ALLOWED_EXTENSIONS,
  PDF_ALLOWED_EXTENSIONS,
  isExtensionAllowed,
} from "@/lib/storage/limits";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export const accessLevelValues = [
  "public",
  "member_only",
  "staff_only",
  "read_only",
  "metadata_only",
] as const;

/**
 * ปีที่เผยแพร่เก็บเป็น ค.ศ. (CE) — ช่วงที่รับต้องตรงกับ CHECK ของคอลัมน์
 * research_items.year ในฐานข้อมูล (migration 20261111100000_research_year_gregorian.sql)
 * ถ้าแก้ค่าที่นี่ ต้องแก้ migration/ฐานข้อมูลให้ตรงกันด้วย
 */
export const SUBMISSION_YEAR_MIN = 1000;
export const SUBMISSION_YEAR_MAX = 2100;
const yearRange = { min: SUBMISSION_YEAR_MIN, max: SUBMISSION_YEAR_MAX };

export function createResearcherSchema(t: TFunction) {
  return z.object({
    name: z.string().min(2, t("submission.researcherNameRequired")),
    organization: z.string().max(200, t("common.organizationTooLong")).optional(),
  });
}

export type ResearcherInput = z.infer<ReturnType<typeof createResearcherSchema>>;

export function createSubmissionSchema(t: TFunction) {
  const researcherSchema = createResearcherSchema(t);
  return z.object({
    titleTh: z
      .string()
      .min(5, t("submission.titleThTooShort"))
      .max(500, t("submission.titleTooLong")),
    titleEn: z.string().max(500, t("submission.titleTooLong")).optional(),
    abstract: z
      .string()
      .min(50, t("submission.abstractTooShort"))
      .max(5000, t("submission.abstractTooLong")),
    organizationId: z.string().min(1, t("submission.organizationRequired")),
    year: z.coerce
      .number()
      .int(t("submission.yearInvalid"))
      .min(SUBMISSION_YEAR_MIN, t("submission.yearOutOfRange", yearRange))
      .max(SUBMISSION_YEAR_MAX, t("submission.yearOutOfRange", yearRange)),
    categoryId: z.string().min(1, t("submission.categoryRequired")),
    // ไม่บังคับ (เฟส 2): ฐานข้อมูลไม่มีขั้นต่ำและหน้าแสดงผลรับรายการว่างได้
    keywords: z
      .array(z.string().min(1))
      .max(20, t("submission.keywordsTooMany")),
    researchers: z
      .array(researcherSchema)
      .min(1, t("submission.researchersRequired"))
      .max(20, t("submission.researchersTooMany")),
    accessLevel: z.enum(accessLevelValues),
    // หมายเหตุลิขสิทธิ์ไม่บังคับ (เฟส 2) — ด่านจริงคือ copyrightConfirmed ด้านล่าง
    // ค่าว่าง/ช่องว่างล้วนถือเป็น "ไม่ระบุ" (undefined) ฝั่งบันทึกเก็บเป็น null
    copyrightNote: z
      .string()
      .max(2000, t("submission.copyrightNoteTooLong"))
      .nullish()
      .transform((value) => value?.trim() || undefined),
    copyrightConfirmed: z.boolean().refine((v) => v === true, {
      message: t("submission.copyrightConfirmRequired"),
    }),
    pdfPath: z
      .string()
      .min(1, t("submission.pdfRequired"))
      .refine((path) => isExtensionAllowed(path, PDF_ALLOWED_EXTENSIONS), {
        message: t("common.fileTypeInvalid", { fileType: "PDF" }),
      }),
    coverPath: z
      .string()
      .optional()
      .refine((path) => !path || isExtensionAllowed(path, COVER_ALLOWED_EXTENSIONS), {
        message: t("common.fileTypeInvalid", { fileType: t("common.fileTypeCover") }),
      }),
    attachmentPath: z
      .string()
      .optional()
      .refine((path) => !path || isExtensionAllowed(path, ATTACHMENT_ALLOWED_EXTENSIONS), {
        message: t("common.fileTypeInvalid", { fileType: t("common.fileTypeAttachment") }),
      }),
  });
}

export type SubmissionInput = z.infer<ReturnType<typeof createSubmissionSchema>>;
