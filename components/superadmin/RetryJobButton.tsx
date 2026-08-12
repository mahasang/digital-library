"use client";

import { useActionState } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";

export default function RetryJobButton({
  jobId,
  action,
}: {
  jobId: string;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, idleActionResult);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        ลองใหม่
      </button>
      {state.status === "error" && (
        <p className="flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}
