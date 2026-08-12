"use client";

import { useActionState } from "react";
import { Loader2, X } from "lucide-react";
import { cancelAccessRequestAction } from "@/app/research/[id]/access-request-actions";
import { idleActionResult } from "@/lib/actions/types";

export default function CancelRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(cancelAccessRequestAction, idleActionResult);

  if (state.status === "success") {
    return <p className="text-xs text-gray-500">ยกเลิกคำขอแล้ว</p>;
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        ยกเลิกคำขอ
      </button>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
