"use client";

import { useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { markNotificationReadAction } from "@/components/layout/notification-actions";
import type { AppNotification } from "@/types/research";

const TYPE_CONFIG: Record<AppNotification["type"], { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "bg-blue-50 text-blue-600" },
  success: { icon: CheckCircle2, className: "bg-green-50 text-green-600" },
  warning: { icon: AlertTriangle, className: "bg-amber-50 text-amber-600" },
};

export default function NotificationRow({ notification }: { notification: AppNotification }) {
  const [isPending, startTransition] = useTransition();
  const isUnread = !notification.readAt;
  const { icon: TypeIcon, className: typeClassName } = TYPE_CONFIG[notification.type] ?? {
    icon: Bell,
    className: "bg-gray-100 text-gray-500",
  };

  function handleClick() {
    if (isUnread) startTransition(() => markNotificationReadAction(notification.id));
  }

  const content = (
    <div
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-brand-200 ${
        isUnread ? "border-gray-200 bg-accent-soft" : "border-gray-200 bg-surface"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${typeClassName}`}>
        <TypeIcon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
          {isUnread && (
            <span className="mt-1 flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">ยังไม่อ่าน</span>
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-600">{notification.message}</p>
        <p className="mt-1.5 text-xs text-gray-600">
          {new Date(notification.createdAt).toLocaleString("th-TH")}
        </p>
      </div>
    </div>
  );

  if (notification.researchId) {
    return (
      <Link href="/research" onClick={handleClick} className="block" aria-disabled={isPending}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" disabled={isPending} onClick={handleClick} className="block w-full text-left">
      {content}
    </button>
  );
}
