"use client";

import { useActionState, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Power, Clock } from "lucide-react";
import { setUserStatusAction } from "@/app/[locale]/superadmin/users/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function UserStatusControl({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(setUserStatusAction, idleActionResult);
  const [days, setDays] = useState("7");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {isActive ? "ใช้งานได้" : "ถูกระงับ"}
        </span>
      </div>

      {isActive ? (
        <div className="flex flex-wrap items-center gap-2">
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="nextActive" value="false" />
            <button
              type="submit"
              disabled={pending || isSelf}
              title={isSelf ? "ไม่สามารถระงับบัญชีของตัวเองได้" : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5" />
              ระงับถาวร
            </button>
          </form>

          <form action={formAction} className="flex items-center gap-1.5">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="nextActive" value="false" />
            <Clock className="h-3.5 w-3.5 text-gray-500" />
            <input
              type="number"
              name="durationDays"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={isSelf}
              className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-gray-500">วัน</span>
            <button
              type="submit"
              disabled={pending || isSelf}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ระงับชั่วคราว
            </button>
          </form>
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="nextActive" value="true" />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
            เปิดใช้งานบัญชี
          </button>
        </form>
      )}

      {state.status === "error" && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
}
