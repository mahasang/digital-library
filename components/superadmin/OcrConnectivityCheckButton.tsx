"use client";

import { useActionState } from "react";
import { Loader2, Wifi } from "lucide-react";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";

export default function OcrConnectivityCheckButton({
  action,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, idleActionResult);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
        ตรวจสอบการเชื่อมต่อ
      </button>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      {state.status === "success" && <p className="text-xs text-green-600">{state.message}</p>}
    </form>
  );
}
