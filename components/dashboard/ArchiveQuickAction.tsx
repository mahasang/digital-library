"use client";

import { useActionState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { archiveAction } from "@/app/dashboard/approvals/[id]/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function ArchiveQuickAction({ researchId }: { researchId: string }) {
  const [state, formAction, isPending] = useActionState(archiveAction, idleActionResult);

  return (
    <form action={formAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="researchId" value={researchId} />
      <button
        type="submit"
        disabled={isPending}
        title="จัดเก็บถาวร"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Archive className="h-3.5 w-3.5" />
        )}
        เก็บถาวร
      </button>
      {state.status === "error" && (
        <span className="text-xs text-red-600">{state.message}</span>
      )}
    </form>
  );
}
