import { z } from "zod";
import type { useTranslations } from "next-intl";
import { validateOrcid } from "@/lib/validation/orcid";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export function createAuthorSchema(t: TFunction) {
  return z.object({
    name: z.string().min(2, t("common.thaiNameTooShort")).max(200, t("common.nameGenericTooLong")),
    displayNameEn: z.string().max(200, t("common.nameGenericTooLong")).optional(),
    titlePrefixTh: z.string().max(50, t("author.titlePrefixTooLong")).optional(),
    titlePrefixEn: z.string().max(50, t("author.titlePrefixTooLong")).optional(),
    organizationId: z.string().uuid().optional().or(z.literal("")),
    orcid: z
      .string()
      .optional()
      .refine((v) => !v || validateOrcid(v).valid, {
        message: t("orcid.invalid"),
      }),
    biography: z.string().max(4000, t("author.biographyTooLong")).optional(),
    isActive: z.boolean().optional(),
  });
}

export type AuthorInput = z.infer<ReturnType<typeof createAuthorSchema>>;
