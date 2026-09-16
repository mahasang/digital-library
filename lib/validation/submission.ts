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
      .min(2400, t("submission.yearOutOfRange"))
      .max(2700, t("submission.yearOutOfRange")),
    categoryId: z.string().min(1, t("submission.categoryRequired")),
    keywords: z
      .array(z.string().min(1))
      .min(1, t("submission.keywordsRequired"))
      .max(20, t("submission.keywordsTooMany")),
    researchers: z
      .array(researcherSchema)
      .min(1, t("submission.researchersRequired"))
      .max(20, t("submission.researchersTooMany")),
    accessLevel: z.enum(accessLevelValues),
    copyrightNote: z
      .string()
      .min(10, t("submission.copyrightNoteTooShort"))
      .max(2000, t("submission.copyrightNoteTooLong")),
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
