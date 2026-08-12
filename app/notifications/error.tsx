"use client";

import { useEffect } from "react";
import AccountShell from "@/components/account/AccountShell";
import AccountErrorState from "@/components/account/AccountErrorState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("notifications page error:", error);
  }, [error]);

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">การแจ้งเตือน</h1>
      <div className="mt-6">
        <AccountErrorState reset={reset} />
      </div>
    </AccountShell>
  );
}
