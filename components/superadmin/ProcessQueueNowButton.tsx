"use client";

import { useActionState } from "react";
import { Loader2, PlayCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { processQueueNowAction } from "@/lib/jobs/process-now.action.server";
import { idleActionResult } from "@/lib/actions/types";

/**
 * ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" — ใช้ตอน dev/ยังไม่ได้ตั้งค่า Cron จริง หรือ
 * Super Admin ต้องการเร่งประมวลผลโดยไม่รอรอบ Cron ถัดไป (ดู docs/background-jobs.md)
 */
export default function ProcessQueueNowButton() {
  const [state, formAction, pending] = useActionState(processQueueNowAction, idleActionResult);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
        ประมวลผลคิวเดี๋ยวนี้
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
