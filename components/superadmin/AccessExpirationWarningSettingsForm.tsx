"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { updateAccessExpirationWarningSettingsAction } from "@/app/superadmin/notifications/actions";
import { idleActionResult } from "@/lib/actions/types";
import type { AppSettings } from "@/types/research";

/** ฟอร์มตั้งค่าการแจ้งเตือนก่อนสิทธิ์เข้าถึงเอกสารหมดอายุ (ช่วงที่ 26) —
 * แยกจาก NotificationSettingsForm (มาสเตอร์สวิตช์รวม in-app/email ของทั้งระบบ)
 * โดยเจตนา ทั้งสองต้องเปิดพร้อมกันจึงจะแจ้งจริง (ดูคำอธิบายที่
 * lib/notifications/access-request-email.server.ts::notifyExpiringAccessGrantsByEmail) */
export default function AccessExpirationWarningSettingsForm({
  settings,
  emailProviderConfigured,
}: {
  settings: AppSettings;
  emailProviderConfigured: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateAccessExpirationWarningSettingsAction,
    idleActionResult
  );
  const [inApp, setInApp] = useState(settings.accessExpirationWarningInAppEnabled);
  const [email, setEmail] = useState(settings.accessExpirationWarningEmailEnabled);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
      <div>
        <label htmlFor="accessExpirationWarningDays" className="text-sm font-medium text-gray-900">
          จำนวนวันแจ้งเตือนก่อนสิทธิ์หมดอายุ
        </label>
        <p className="mb-2 text-xs text-gray-500">ตั้งได้ระหว่าง 1-30 วัน — ค่าเริ่มต้น 3 วัน</p>
        <input
          id="accessExpirationWarningDays"
          type="number"
          name="accessExpirationWarningDays"
          min={1}
          max={30}
          step={1}
          required
          defaultValue={settings.accessExpirationWarningDays}
          className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-gray-900">แจ้งเตือนแบบ in-app</span>
          <p className="text-xs text-gray-500">
            ต้องเปิด &quot;การแจ้งเตือนในระบบ (in-app)&quot; ด้านบนไว้ด้วยจึงจะแจ้งจริง
          </p>
        </div>
        <ToggleInput name="accessExpirationWarningInAppEnabled" checked={inApp} onChange={setInApp} />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-gray-900">แจ้งเตือนทางอีเมล</span>
          <p className="text-xs text-gray-500">
            ต้องเปิด &quot;การแจ้งเตือนทางอีเมล&quot; ด้านบนและตั้งค่าผู้ให้บริการอีเมลไว้ด้วยจึงจะส่งจริง
          </p>
        </div>
        <ToggleInput name="accessExpirationWarningEmailEnabled" checked={email} onChange={setEmail} />
      </label>
      {email && !emailProviderConfigured && (
        <p className="text-xs text-amber-700">
          เปิดไว้แต่ยังไม่ได้ตั้งค่าผู้ให้บริการอีเมล (RESEND_API_KEY) — จะไม่มีการส่งอีเมลจริงจนกว่าจะตั้งค่า
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกการตั้งค่า
        </button>
      </div>

      {settings.updatedAt && (
        <p className="text-xs text-gray-500">
          แก้ไขล่าสุดเมื่อ {new Date(settings.updatedAt).toLocaleString("th-TH")}
        </p>
      )}

      {state.status === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}
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
