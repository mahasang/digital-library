"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { updateOcrSettingsAction } from "@/app/superadmin/ocr/actions";
import { idleActionResult } from "@/lib/actions/types";
import { accessLevelLabels } from "@/lib/labels";
import type { AppSettings, AccessLevel } from "@/types/research";

const ACCESS_LEVELS: AccessLevel[] = ["public", "member_only", "staff_only", "read_only", "metadata_only"];

export default function OcrSettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, isPending] = useActionState(updateOcrSettingsAction, idleActionResult);
  const [dailyQuotaEnabled, setDailyQuotaEnabled] = useState(settings.ocrDailyQuotaEnabled);
  const [providerEnabled, setProviderEnabled] = useState(settings.ocrProviderEnabled);
  const [allowedLevels, setAllowedLevels] = useState<string[]>(settings.ocrAllowedAccessLevels);

  function toggleLevel(level: string) {
    setAllowedLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  }

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
        <h2 className="mb-2 text-sm font-semibold text-gray-900">สวิตช์เปิด/ปิด OCR</h2>
        <p className="mb-4 text-xs text-gray-500">
          แยกจาก environment variable (OCR_PROVIDER/OCR_PROVIDER_BASE_URL/OCR_ENABLED) — ปิดที่นี่ได้ทันทีโดยไม่ต้อง deploy ใหม่
          ทุกชั้นต้องเปิดพร้อมกันจึงจะสร้างงาน OCR ได้
        </p>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm text-gray-700">เปิดใช้งาน OCR</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={providerEnabled}
              onChange={(e) => setProviderEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <input type="hidden" name="ocrProviderEnabled" value={providerEnabled ? "true" : "false"} />
            <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600" />
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-surface transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ขนาดและจำนวนหน้าสูงสุด</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="ขนาดไฟล์ PDF สูงสุด (MB)"
            name="ocrMaxFileSizeMb"
            defaultValue={settings.ocrMaxFileSizeMb}
            min={1}
            max={500}
          />
          <NumberField
            label="จำนวนหน้าสูงสุด"
            name="ocrMaxPages"
            defaultValue={settings.ocrMaxPages}
            min={1}
            max={2000}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          ไฟล์ที่เกินขนาดหรือจำนวนหน้าจะถูกปฏิเสธก่อนสร้างงาน OCR เสมอ (ไม่มีการสร้างงานค้างในคิว) — พร้อมข้อความแนะนำให้แบ่งไฟล์หรือดำเนินการตามนโยบาย
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">โควตาต่อผู้ใช้ต่อวัน</h2>
        <label className="mb-4 flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm text-gray-700">จำกัดจำนวนงาน OCR ต่อผู้ใช้ต่อวัน</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={dailyQuotaEnabled}
              onChange={(e) => setDailyQuotaEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <input type="hidden" name="ocrDailyQuotaEnabled" value={dailyQuotaEnabled ? "true" : "false"} />
            <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600" />
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-surface transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
        {dailyQuotaEnabled && (
          <NumberField
            label="จำนวนงาน OCR สูงสุดต่อผู้ใช้ต่อวัน"
            name="ocrMaxJobsPerUserPerDay"
            defaultValue={settings.ocrMaxJobsPerUserPerDay}
            min={1}
            max={1000}
          />
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">ระดับการเข้าถึงเอกสารที่อนุญาตให้ส่ง OCR</h2>
        <p className="mb-4 text-xs text-gray-500">
          ค่าเริ่มต้นอนุญาตเฉพาะ &quot;เข้าถึงสาธารณะ&quot; เท่านั้น (เข้มงวดที่สุด) — ต้องเลือกเพิ่มเองหากต้องการอนุญาตระดับอื่น
          ป้องกันการส่งเอกสารที่จำกัดสิทธิ์ไปยังผู้ให้บริการ OCR ภายนอกโดยไม่ตั้งใจ
        </p>
        <div className="flex flex-col gap-2">
          {ACCESS_LEVELS.map((level) => (
            <label key={level} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="ocrAllowedAccessLevels"
                value={level}
                checked={allowedLevels.includes(level)}
                onChange={() => toggleLevel(level)}
                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-brand-500"
              />
              {accessLevelLabels[level]}
            </label>
          ))}
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
