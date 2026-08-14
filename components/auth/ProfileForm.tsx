"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { updateProfileAction } from "@/app/[locale]/account/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function ProfileForm({
  defaultFullName,
  defaultOrganization,
}: {
  defaultFullName: string;
  defaultOrganization: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    idleActionResult
  );

  const fullNameHasError = state.status === "error" && Boolean(state.fieldErrors?.fullName);

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
          ชื่อ-นามสกุล <span className="text-red-500">*</span>
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
        <p className="text-xs text-gray-500">ชื่อนี้จะแสดงเป็นชื่อผู้ส่งเมื่อคุณส่งงานวิจัยหรือคำขอเข้าถึงเอกสาร</p>
        {fullNameHasError && (
          <p id="fullName-error" className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {state.fieldErrors?.fullName?.[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="organization" className="text-sm font-medium text-gray-700">
          หน่วยงาน/สังกัด
        </label>
        <input
          id="organization"
          name="organization"
          type="text"
          defaultValue={defaultOrganization}
          placeholder="เช่น คณะวิศวกรรมศาสตร์"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="text-xs text-gray-500">ไม่บังคับกรอก — ช่วยให้เจ้าหน้าที่ระบุตัวตนของคุณได้ง่ายขึ้น</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 inline-flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
      </button>
    </form>
  );
}
