"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { registerAction } from "@/app/[locale]/register/actions";
import { idleActionResult } from "@/lib/actions/types";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function RegisterForm({
  captchaSiteKey,
}: {
  captchaSiteKey?: string;
}) {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(registerAction, idleActionResult);
  const [captchaToken, setCaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors";

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="text-sm font-semibold text-green-800">{t("registerSuccess")}</p>
        <p className="text-xs leading-relaxed text-green-700">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      {/* Full name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullname" className="text-sm font-medium text-gray-700">
          {t("fullName")}
        </label>
        <input
          id="fullname"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          placeholder={t("fullNamePlaceholder")}
          className={inputCls}
        />
        {state.status === "error" && state.fieldErrors?.fullName && (
          <p className="text-xs text-red-600">{state.fieldErrors.fullName[0]}</p>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          {t("phone")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder={t("phonePlaceholder")}
          className={inputCls}
        />
        {state.status === "error" && state.fieldErrors?.phone && (
          <p className="text-xs text-red-600">{state.fieldErrors.phone[0]}</p>
        )}
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-email" className="text-sm font-medium text-gray-700">
          {t("email")}
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="example@gmail.com"
          className={inputCls}
        />
        {state.status === "error" && state.fieldErrors?.email && (
          <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-password" className="text-sm font-medium text-gray-700">
          {t("password")}
        </label>
        <div className="relative">
          <input
            id="reg-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="Choose a password"
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state.status === "error" && state.fieldErrors?.password && (
          <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-confirm" className="text-sm font-medium text-gray-700">
          {t("confirmPassword")}
        </label>
        <div className="relative">
          <input
            id="reg-confirm"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className={`${inputCls} pr-11`}
          />
        </div>
        {state.status === "error" && state.fieldErrors?.confirmPassword && (
          <p className="text-xs text-red-600">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      {/* Terms */}
      <label className="flex items-start gap-2 text-xs text-gray-500">
        <input type="checkbox" required className="mt-0.5 rounded border-gray-300" />
        {t("acceptTerms")}
      </label>

      {captchaSiteKey && (
        <TurnstileWidget siteKey={captchaSiteKey} onToken={setCaptchaToken} />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || (Boolean(captchaSiteKey) && !captchaToken)}
        className="mt-1 w-full rounded-xl bg-[#1a5276] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#154360] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t("registerSubmitting") : t("registerSubmit")}
      </button>

      {/* Divider */}
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-3 text-gray-400">{t("orContinueWith")}</span>
        </div>
      </div>

      <GoogleSignInButton />
    </form>
  );
}