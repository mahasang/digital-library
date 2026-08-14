"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { updateSettingsAction } from "@/app/[locale]/dashboard/settings/actions";
import { idleActionResult } from "@/lib/actions/types";
import type { AppSettings } from "@/types/research";

export default function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, isPending] = useActionState(
    updateSettingsAction,
    idleActionResult
  );

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
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ข้อมูลองค์กร</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">ชื่อองค์กร</label>
            <input
              name="siteName"
              required
              defaultValue={settings.siteName}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">URL โลโก้</label>
            <input
              name="logoUrl"
              type="url"
              defaultValue={settings.logoUrl}
              placeholder="https://..."
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-500">
              เว้นว่างไว้เพื่อใช้ไอคอนเริ่มต้น — วางลิงก์ไฟล์ภาพที่โฮสต์ไว้แล้ว
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ข้อมูลติดต่อ</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">อีเมล</label>
            <input
              name="contactEmail"
              type="email"
              defaultValue={settings.contactEmail}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
            <input
              name="contactPhone"
              defaultValue={settings.contactPhone}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">ที่อยู่</label>
            <input
              name="contactAddress"
              defaultValue={settings.contactAddress}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">ข้อความลิขสิทธิ์</label>
            <input
              name="copyrightText"
              defaultValue={settings.copyrightText}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">การแสดงผลหน้าแรก</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              จำนวนงานวิจัยล่าสุดที่แสดง
            </label>
            <input
              name="homepageLatestCount"
              type="number"
              min={1}
              max={24}
              defaultValue={settings.homepageLatestCount}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              จำนวนงานวิจัยยอดนิยมที่แสดง
            </label>
            <input
              name="homepagePopularCount"
              type="number"
              min={1}
              max={24}
              defaultValue={settings.homepagePopularCount}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
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
