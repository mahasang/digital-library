"use client";

import { useActionState } from "react";
import { Loader2, TimerReset, CheckCircle2, AlertCircle } from "lucide-react";
import { processAccessExpirationNowAction } from "@/app/[locale]/superadmin/notifications/actions";
import { idleActionResult } from "@/lib/actions/types";

/** ปุ่ม "ประมวลผลสิทธิ์ที่หมดอายุทันที" — จำกัดเฉพาะ job ประเภท access_expiration เท่านั้น */
export default function ProcessAccessExpirationNowButton() {
  const [state, formAction, pending] = useActionState(processAccessExpirationNowAction, idleActionResult);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TimerReset className="h-3.5 w-3.5" />}
        ประมวลผลสิทธิ์ที่หมดอายุทันที
      </button>
      {state.status === "success" && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}
