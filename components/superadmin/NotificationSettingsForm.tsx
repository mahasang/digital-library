"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { updateNotificationSettingsAction } from "@/app/[locale]/superadmin/notifications/actions";
import { idleActionResult } from "@/lib/actions/types";
import type { AppSettings } from "@/types/research";

export default function NotificationSettingsForm({
  settings,
  emailProviderConfigured,
}: {
  settings: AppSettings;
  emailProviderConfigured: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationSettingsAction,
    idleActionResult
  );
  const [inApp, setInApp] = useState(settings.notificationsInAppEnabled);
  const [email, setEmail] = useState(settings.notificationsEmailEnabled);

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
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium text-gray-900">การแจ้งเตือนในระบบ (in-app)</span>
            <p className="text-xs text-gray-500">
              แจ้งเตือนผู้ส่งงานวิจัยในระบบทันทีเมื่อสถานะงานวิจัยเปลี่ยนแปลง
            </p>
          </div>
          <ToggleInput name="notificationsInAppEnabled" checked={inApp} onChange={setInApp} />
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium text-gray-900">การแจ้งเตือนทางอีเมล</span>
            <p className="text-xs text-gray-500">
              ส่งอีเมลแจ้งผู้ส่งงานวิจัยเมื่อสถานะงานวิจัยเปลี่ยนแปลง
            </p>
          </div>
          <ToggleInput name="notificationsEmailEnabled" checked={email} onChange={setEmail} />
        </label>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              emailProviderConfigured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {emailProviderConfigured ? "ตั้งค่าผู้ให้บริการอีเมลแล้ว" : "ยังไม่ได้ตั้งค่าผู้ให้บริการอีเมล"}
          </span>
        </div>
        {email && !emailProviderConfigured && (
          <p className="mt-2 text-xs text-amber-700">
            เปิดไว้แต่ยังไม่ได้ตั้งค่า RESEND_API_KEY — จะไม่มีการส่งอีเมลจริงจนกว่าจะตั้งค่า
            (ดูวิธีตั้งค่าใน docs/superadmin-guide.md)
          </p>
        )}
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

function ToggleInput({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600" />
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-surface transition-transform peer-checked:translate-x-5" />
    </span>
  );
}
