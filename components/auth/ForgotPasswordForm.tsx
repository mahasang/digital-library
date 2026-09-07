"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { forgotPasswordAction } from "@/app/[locale]/auth/forgot-password/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, idleActionResult);

  const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors";

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="text-sm font-semibold text-green-800">{t("forgotPasswordSuccess")}</p>
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          {t("forgotPasswordEmailLabel")}
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

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 w-full rounded-xl bg-[#1a5276] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#154360] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t("forgotPasswordSubmitting") : t("forgotPasswordSubmit")}
      </button>
    </form>
  );
}