"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllNotificationsReadAction } from "@/components/layout/notification-actions";

export default function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => markAllNotificationsReadAction())}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      <CheckCheck className="h-3.5 w-3.5" />
      ทำเครื่องหมายว่าอ่านทั้งหมด
    </button>
  );
}
