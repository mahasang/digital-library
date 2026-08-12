"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { registerAction } from "@/app/register/actions";
import { idleActionResult } from "@/lib/actions/types";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

export default function RegisterForm({
  captchaSiteKey,
}: {
  captchaSiteKey?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    idleActionResult
  );
  const [captchaToken, setCaptchaToken] = useState("");

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="text-sm font-semibold text-green-800">สมัครสมาชิกสำเร็จ</p>
        <p className="text-xs leading-relaxed text-green-700">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullname" className="text-sm font-medium text-gray-700">
          ชื่อ-นามสกุล
        </label>
        <input
          id="fullname"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          placeholder="กรอกชื่อ-นามสกุล"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {state.status === "error" && state.fieldErrors?.fullName && (
          <p className="text-xs text-red-600">{state.fieldErrors.fullName[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="org" className="text-sm font-medium text-gray-700">
          หน่วยงาน/สังกัด
        </label>
        <input
          id="org"
          name="organization"
          type="text"
          placeholder="เช่น คณะวิศวกรรมศาสตร์"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-email" className="text-sm font-medium text-gray-700">
          อีเมล
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {state.status === "error" && state.fieldErrors?.email && (
          <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-password" className="text-sm font-medium text-gray-700">
            รหัสผ่าน
          </label>
          <input
            id="reg-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {state.status === "error" && state.fieldErrors?.password && (
            <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-confirm" className="text-sm font-medium text-gray-700">
            ยืนยันรหัสผ่าน
          </label>
          <input
            id="reg-confirm"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {state.status === "error" && state.fieldErrors?.confirmPassword && (
            <p className="text-xs text-red-600">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-500">
        <input type="checkbox" required className="mt-0.5 rounded border-gray-300" />
        ฉันยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวของห้องสมุดดิจิทัล
      </label>

      {captchaSiteKey && (
        <TurnstileWidget siteKey={captchaSiteKey} onToken={setCaptchaToken} />
      )}

      <button
        type="submit"
        disabled={isPending || (Boolean(captchaSiteKey) && !captchaToken)}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" />
        {isPending ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
      </button>
    </form>
  );
}
