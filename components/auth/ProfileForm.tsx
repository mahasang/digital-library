"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { updateProfileAction } from "@/app/[locale]/account/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function ProfileForm({
  defaultFullName,
  defaultOrganization,
  defaultPhone,
  defaultDateOfBirth,
  defaultAddress,
}: {
  defaultFullName: string;
  defaultOrganization: string;
  defaultPhone: string;
  defaultDateOfBirth: string;
  defaultAddress: string;
}) {
  const t = useTranslations("account");
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    idleActionResult
  );

  const fullNameHasError = state.status === "error" && Boolean(state.fieldErrors?.fullName);
  const phoneHasError = state.status === "error" && Boolean(state.fieldErrors?.phone);
  const dobHasError = state.status === "error" && Boolean(state.fieldErrors?.dateOfBirth);
  const addressHasError = state.status === "error" && Boolean(state.fieldErrors?.address);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}
      {state.status === "success" && (
        <div className="flex items-start gap-2 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
          {t("fullName")} <span className="text-red-500">*</span>
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          aria-invalid={fullNameHasError || undefined}
          aria-describedby={fullNameHasError ? "fullName-error" : undefined}
          defaultValue={defaultFullName}
          className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
            fullNameHasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
          }`}
        />
        <p className="text-xs text-gray-500">{t("fullNameHelp")}</p>
        {fullNameHasError && (
          <p id="fullName-error" className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {state.fieldErrors?.fullName?.[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="organization" className="text-sm font-medium text-gray-700">
          {t("organization")}
        </label>
        <input
          id="organization"
          name="organization"
          type="text"
          defaultValue={defaultOrganization}
          placeholder={t("organizationPlaceholder")}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="text-xs text-gray-500">{t("organizationHelp")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          {t("phone")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          placeholder={t("phonePlaceholder")}
          aria-invalid={phoneHasError || undefined}
          className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
            phoneHasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
          }`}
        />
        {phoneHasError && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {state.fieldErrors?.phone?.[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700">
          {t("dateOfBirth")}
        </label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={defaultDateOfBirth}
          max={new Date().toISOString().slice(0, 10)}
          aria-invalid={dobHasError || undefined}
          className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
            dobHasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
          }`}
        />
        {dobHasError && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {state.fieldErrors?.dateOfBirth?.[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="address" className="text-sm font-medium text-gray-700">
          {t("address")}
        </label>
        <textarea
          id="address"
          name="address"
          rows={3}
          defaultValue={defaultAddress}
          placeholder={t("addressPlaceholder")}
          aria-invalid={addressHasError || undefined}
          className={`resize-none rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
            addressHasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
          }`}
        />
        {addressHasError && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {state.fieldErrors?.address?.[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 inline-flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {isPending ? t("savingProfile") : t("saveProfile")}
      </button>
    </form>
  );
}
