"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { updateNotificationSettingsAction } from "@/app/profile/notification-settings/actions";
import { idleActionResult } from "@/lib/actions/types";
import type { NotificationPreferences } from "@/lib/data/notification-preferences.server";

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-brand-500 disabled:opacity-50"
      />
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  );
}

export default function NotificationSettingsForm({
  preferences,
  categories,
  subscribedCategoryIds,
  emailProviderConfigured,
}: {
  preferences: NotificationPreferences;
  categories: { id: string; nameTh: string; nameEn: string }[];
  subscribedCategoryIds: string[];
  emailProviderConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateNotificationSettingsAction, idleActionResult);
  const subscribedSet = new Set(subscribedCategoryIds);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">แจ้งเตือนงานวิจัยใหม่ตามหมวดหมู่</h2>
        <div className="flex flex-col gap-2">
          <ToggleRow
            name="newResearchInAppEnabled"
            label="แจ้งเตือนในระบบ"
            description="แสดงในกระดิ่งแจ้งเตือนเมื่อมีงานวิจัยใหม่ในหมวดหมู่ที่คุณติดตาม"
            defaultChecked={preferences.newResearchInAppEnabled}
          />
          <ToggleRow
            name="newResearchEmailEnabled"
            label="แจ้งเตือนทางอีเมล"
            description={
              emailProviderConfigured
                ? "ส่งอีเมลเมื่อมีงานวิจัยใหม่ในหมวดหมู่ที่คุณติดตาม"
                : "ระบบยังไม่ได้ตั้งค่าผู้ให้บริการอีเมล — เปิดไว้ได้แต่จะยังไม่มีอีเมลส่งจริงจนกว่าผู้ดูแลระบบจะตั้งค่า"
            }
            defaultChecked={preferences.newResearchEmailEnabled}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-gray-900">หมวดหมู่ที่ติดตาม</h2>
        <p className="mb-3 text-xs text-gray-500">เลือกหมวดหมู่งานวิจัยที่ต้องการรับแจ้งเตือนเมื่อมีงานใหม่เผยแพร่</p>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีหมวดหมู่ในระบบ</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={subscribedSet.has(category.id)}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-brand-500"
                />
                {category.nameTh}
              </label>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">แจ้งเตือนคำขอเข้าถึงเอกสาร</h2>
        <div className="flex flex-col gap-2">
          <ToggleRow
            name="accessRequestInAppEnabled"
            label="แจ้งเตือนในระบบ"
            description="แสดงในกระดิ่งแจ้งเตือนเมื่อคำขอของคุณได้รับการอนุมัติ ถูกปฏิเสธ หรือหมดอายุ"
            defaultChecked={preferences.accessRequestInAppEnabled}
          />
          <ToggleRow
            name="accessRequestEmailEnabled"
            label="แจ้งเตือนทางอีเมล"
            description={
              emailProviderConfigured
                ? "ส่งอีเมลเมื่อคำขอของคุณได้รับการอนุมัติ ถูกปฏิเสธ หรือเจ้าหน้าที่ขอข้อมูลเพิ่ม"
                : "ระบบยังไม่ได้ตั้งค่าผู้ให้บริการอีเมล — เปิดไว้ได้แต่จะยังไม่มีอีเมลส่งจริงจนกว่าผู้ดูแลระบบจะตั้งค่า"
            }
            defaultChecked={preferences.accessRequestEmailEnabled}
          />
        </div>
      </section>

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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        บันทึกการตั้งค่า
      </button>
    </form>
  );
}
