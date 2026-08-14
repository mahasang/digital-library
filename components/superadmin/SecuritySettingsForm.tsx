"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { updateSecuritySettingsAction } from "@/app/[locale]/superadmin/security/actions";
import { idleActionResult } from "@/lib/actions/types";
import type { AppSettings } from "@/types/research";

export default function SecuritySettingsForm({
  settings,
  captchaConfigured,
}: {
  settings: AppSettings;
  captchaConfigured: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateSecuritySettingsAction,
    idleActionResult
  );
  const [captchaEnabled, setCaptchaEnabled] = useState(settings.captchaEnabled);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}
      {state.status === "success" && (
        <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">CAPTCHA</h2>
        <p className="mb-4 text-xs text-gray-500">
          รองรับ Cloudflare Turnstile (ฟรี) — ต้องตั้งค่า `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
          และ `TURNSTILE_SECRET_KEY` ใน environment variables ก่อน ดูวิธีตั้งค่าใน
          docs/superadmin-guide.md
        </p>
        <div className="mb-4 flex items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              captchaConfigured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {captchaConfigured ? "ตั้งค่าคีย์แล้ว" : "ยังไม่ได้ตั้งค่าคีย์"}
          </span>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm text-gray-700">เปิดใช้งาน CAPTCHA</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={captchaEnabled}
              onChange={(e) => setCaptchaEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <input type="hidden" name="captchaEnabled" value={captchaEnabled ? "true" : "false"} />
            <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600" />
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-surface transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
        {captchaEnabled && !captchaConfigured && (
          <p className="mt-2 text-xs text-amber-700">
            เปิดไว้แต่ยังไม่ได้ตั้งค่าคีย์ — ฟีเจอร์นี้จะยังไม่ทำงานจริงจนกว่าจะตั้งค่า
            environment variables ให้ครบ
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Rate Limit</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3">
            <legend className="px-1 text-xs font-medium text-gray-500">สมัครสมาชิก</legend>
            <NumberField
              label="จำนวนครั้งสูงสุด"
              name="rateLimitRegisterMax"
              defaultValue={settings.rateLimitRegisterMax}
              min={1}
              max={100}
            />
            <NumberField
              label="ต่อระยะเวลา (วินาที)"
              name="rateLimitRegisterWindowSec"
              defaultValue={settings.rateLimitRegisterWindowSec}
              min={60}
              max={86400}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3">
            <legend className="px-1 text-xs font-medium text-gray-500">ส่งงานวิจัย</legend>
            <NumberField
              label="จำนวนครั้งสูงสุด"
              name="rateLimitSubmitMax"
              defaultValue={settings.rateLimitSubmitMax}
              min={1}
              max={100}
            />
            <NumberField
              label="ต่อระยะเวลา (วินาที)"
              name="rateLimitSubmitWindowSec"
              defaultValue={settings.rateLimitSubmitWindowSec}
              min={60}
              max={86400}
            />
          </fieldset>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        บันทึกการตั้งค่า
      </button>
    </form>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
