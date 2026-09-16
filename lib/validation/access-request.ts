import { z } from "zod";
import type { useTranslations } from "next-intl";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export const accessRequestTypeValues = ["read", "download"] as const;

export function createAccessRequestSchema(t: TFunction) {
  return z.object({
    researchSlug: z.string().min(1, t("accessRequest.researchNotFound")),
    requestType: z.enum(accessRequestTypeValues, {
      message: t("accessRequest.requestTypeRequired"),
    }),
    purpose: z
      .string()
      .min(10, t("accessRequest.purposeTooShort"))
      .max(1000, t("accessRequest.purposeTooLong")),
    requesterNote: z.string().max(2000, t("accessRequest.requesterNoteTooLong")).optional(),
    termsAccepted: z.boolean().refine((v) => v === true, {
      message: t("accessRequest.termsRequired"),
    }),
  });
}

export type AccessRequestInput = z.infer<ReturnType<typeof createAccessRequestSchema>>;
