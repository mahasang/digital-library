"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { signOutAllDevicesAction } from "@/app/[locale]/account/actions";

export default function SignOutAllDevicesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await signOutAllDevicesAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        ออกจากระบบทุกอุปกรณ์
      </button>
    </div>
  );
}
