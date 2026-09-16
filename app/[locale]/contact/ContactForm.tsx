"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitContactAction, type ContactFormState } from "./actions";

const initialState: ContactFormState = { status: "idle" };

export default function ContactForm() {
  const t = useTranslations("contactForm");
  const [state, formAction, isPending] = useActionState(
    submitContactAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">
            {t("firstNameLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            name="first_name"
            type="text"
            placeholder={t("firstNamePlaceholder")}
            required
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">
            {t("lastNameLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            name="last_name"
            type="text"
            placeholder={t("lastNamePlaceholder")}
            required
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">
          {t("emailLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          name="email"
          type="email"
          placeholder="example@gmail.com"
          required
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">{t("phoneLabel")}</label>
        <input
          name="phone"
          type="tel"
          placeholder="+856 20 XXXX XXXX"
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">
          {t("messageLabel")} <span className="text-red-500">*</span>
        </label>
        <textarea
          name="message"
          rows={4}
          placeholder={t("messagePlaceholder")}
          required
          disabled={isPending}
          className="resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        />
      </div>

      {/* ── Feedback ── */}
      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {t("successMessage")}
        </p>
      )}

      <div className="flex justify-center mt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          {isPending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}