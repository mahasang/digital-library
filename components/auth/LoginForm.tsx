"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/app/[locale]/login/actions";
import { idleActionResult } from "@/lib/actions/types";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

export default function LoginForm({
  redirectTo,
  captchaSiteKey,
}: {
  redirectTo: string;
  captchaSiteKey?: string;
}) {
  const t = useTranslations("auth");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(loginAction, idleActionResult);
  const [captchaToken, setCaptchaToken] = useState("");

  const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          {t("email")}
        </label>
        <input
          id="email"
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
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          {t("password")}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? "ຊ່ອນລະຫັດຜ່ານ" : "ສະແດງລະຫັດຜ່ານ"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state.status === "error" && state.fieldErrors?.password && (
          <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      {/* Forgot password */}
      <div className="flex justify-end">
        <Link href="/auth/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
          {t("forgotPassword")}
        </Link>
      </div>

      {captchaSiteKey && (
        <TurnstileWidget siteKey={captchaSiteKey} onToken={setCaptchaToken} />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || (Boolean(captchaSiteKey) && !captchaToken)}
        className="mt-1 w-full rounded-xl bg-[#1a5276] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#154360] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t("loginSubmitting") : t("loginSubmit")}
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

      {/* Social */}
      <GoogleSignInButton />
    </form>
  );
}