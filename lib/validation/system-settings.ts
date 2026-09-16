import { z } from "zod";
import type { useTranslations } from "next-intl";
import { SITE_ASSET_ALLOWED_EXTENSIONS, isExtensionAllowed } from "@/lib/storage/limits";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export function createSystemSettingsSchema(t: TFunction) {
  return z.object({
    siteName: z.string().min(1, t("systemSettings.siteNameRequired")).max(200, t("systemSettings.siteNameTooLong")),
    contactEmail: z.string().email(t("common.emailInvalid")).optional().or(z.literal("")),
    contactPhone: z.string().max(50, t("systemSettings.contactPhoneTooLong")).optional(),
    contactAddress: z.string().max(500, t("common.addressTooLong")).optional(),
    socialFacebook: z.string().max(300, t("systemSettings.socialLinkTooLong")).optional(),
    socialTwitter: z.string().max(300, t("systemSettings.socialLinkTooLong")).optional(),
    socialLine: z.string().max(300, t("systemSettings.socialLinkTooLong")).optional(),
    copyrightText: z.string().max(300, t("systemSettings.copyrightTextTooLong")).optional(),
    homepageLatestCount: z.coerce.number().int().min(1).max(24),
    homepagePopularCount: z.coerce.number().int().min(1).max(24),
    registrationEnabled: z.boolean(),
    submissionEnabled: z.boolean(),
    defaultResearchStatus: z.enum(["draft", "pending_review"]),
    maxPdfSizeMb: z.coerce.number().int().min(1).max(200),
    maxCoverSizeMb: z.coerce.number().int().min(1).max(20),
    maxAttachmentSizeMb: z.coerce.number().int().min(1).max(100),
    logoPath: z
      .string()
      .optional()
      .refine((path) => !path || isExtensionAllowed(path, SITE_ASSET_ALLOWED_EXTENSIONS), {
        message: t("common.fileTypeInvalid", { fileType: t("common.fileTypeLogo") }),
      }),
    faviconPath: z
      .string()
      .optional()
      .refine((path) => !path || isExtensionAllowed(path, SITE_ASSET_ALLOWED_EXTENSIONS), {
        message: t("common.fileTypeInvalid", { fileType: t("common.fileTypeFavicon") }),
      }),
  });
}

export type SystemSettingsInput = z.infer<ReturnType<typeof createSystemSettingsSchema>>;
