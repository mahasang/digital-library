"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, ShieldOff } from "lucide-react";
import { revokeAccessGrantAction } from "@/app/[locale]/dashboard/access-requests/[id]/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function RevokeGrantButton({
  grantId,
  requestId,
}: {
  grantId: string;
  requestId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState(revokeAccessGrantAction, idleActionResult);

  if (state.status === "success") {
    return <span className="text-xs text-gray-500">เพิกถอนแล้ว</span>;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        <ShieldOff className="h-3 w-3" />
        เพิกถอนสิทธิ์
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="grantId" value={grantId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="text"
        name="revokeReason"
        required
        placeholder="เหตุผลในการเพิกถอน (จำเป็น)"
        disabled={pending}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          ยืนยันเพิกถอน
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="text-xs text-gray-500 hover:text-gray-600"
        >
          ยกเลิก
        </button>
      </div>
      {state.status === "error" && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {state.message}
        </p>
      )}
    </form>
  );
}
