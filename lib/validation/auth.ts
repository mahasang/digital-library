import { z } from "zod";
import type { useTranslations } from "next-intl";

type TFunction = ReturnType<typeof useTranslations<"validation">>;

export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.string().min(1, t("common.emailRequired")).email(t("common.emailInvalid")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });
}

export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>;

export function createRegisterSchema(t: TFunction) {
  return z
    .object({
      fullName: z
        .string()
        .min(2, t("common.nameTooShort"))
        .max(120, t("common.nameTooLong")),
      organization: z.string().max(200, t("common.organizationTooLong")).optional(),
      phone: z
        .string()
        .regex(/^[0-9+\-\s()]{6,20}$/, t("common.phoneInvalid"))
        .optional()
        .or(z.literal("")),
      email: z.string().min(1, t("common.emailRequired")).email(t("common.emailInvalid")),
      password: z
        .string()
        .min(8, t("common.passwordTooShort"))
        .max(72, t("common.passwordTooLong")),
      confirmPassword: z.string().min(1, t("common.confirmPasswordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("common.passwordMismatchConfirm"),
      path: ["confirmPassword"],
    });
}

export type RegisterInput = z.infer<ReturnType<typeof createRegisterSchema>>;

export function createForgotPasswordSchema(t: TFunction) {
  return z.object({
    email: z.string().min(1, t("common.emailRequired")).email(t("common.emailInvalid")),
  });
}

export type ForgotPasswordInput = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

export function createResetPasswordSchema(t: TFunction) {
  return z
    .object({
      password: z
        .string()
        .min(8, t("common.passwordTooShort"))
        .max(72, t("common.passwordTooLong")),
      confirmPassword: z.string().min(1, t("common.confirmPasswordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("common.passwordMismatchConfirm"),
      path: ["confirmPassword"],
    });
}

export type ResetPasswordInput = z.infer<ReturnType<typeof createResetPasswordSchema>>;
