"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { forgotPasswordAction } from "@/app/auth/forgot-password/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    idleActionResult
  );

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="text-sm font-semibold text-green-800">ส่งคำขอสำเร็จ</p>
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
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          อีเมลที่ใช้สมัครสมาชิก
        </label>
        <input
          id="email"
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

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {isPending ? "กำลังส่งลิงก์..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
