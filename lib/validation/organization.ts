import { z } from "zod";
import type { useTranslations } from "next-intl";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export function createOrganizationAuthoritySchema(t: TFunction) {
  return z.object({
    nameTh: z.string().min(2, t("common.thaiNameTooShort")).max(300, t("common.nameGenericTooLong")),
    nameEn: z.string().max(300, t("common.nameGenericTooLong")).optional(),
    description: z.string().max(2000, t("organization.descriptionTooLong")).optional(),
    parentId: z.string().uuid().optional().or(z.literal("")),
    organizationCode: z.string().max(50, t("organization.organizationCodeTooLong")).optional(),
    websiteUrl: z
      .string()
      .max(500)
      .optional()
      .refine((v) => !v || /^https?:\/\/.+/i.test(v), {
        message: t("organization.websiteUrlInvalid"),
      }),
  });
}

export type OrganizationAuthorityInput = z.infer<ReturnType<typeof createOrganizationAuthoritySchema>>;
