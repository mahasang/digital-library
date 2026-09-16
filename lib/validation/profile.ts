import { z } from "zod";
import type { useTranslations } from "next-intl";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

export function createProfileSchema(t: TFunction) {
  return z.object({
    fullName: z
      .string()
      .min(2, t("common.nameTooShort"))
      .max(120, t("common.nameTooLong")),
    organization: z.string().max(200, t("common.organizationTooLong")).optional(),
    phone: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^[0-9+\-\s()]{6,20}$/, t("common.phoneInvalid"))
        .optional()
    ),
    dateOfBirth: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .refine((val) => !Number.isNaN(Date.parse(val)), t("profile.dateOfBirthInvalid"))
        .refine((val) => new Date(val) <= new Date(), t("profile.dateOfBirthFuture"))
        .optional()
    ),
    address: z.preprocess(emptyToUndefined, z.string().max(500, t("common.addressTooLong")).optional()),
  });
}

export function createChangePasswordSchema(t: TFunction) {
  return z
    .object({
      newPassword: z.string().min(8, t("common.passwordTooShort")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("common.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export type ProfileInput = z.infer<ReturnType<typeof createProfileSchema>>;
export type ChangePasswordInput = z.infer<ReturnType<typeof createChangePasswordSchema>>;
