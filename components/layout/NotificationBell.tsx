"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/components/layout/notification-actions";
import type { AppNotification } from "@/types/research";

const TYPE_DOT: Record<AppNotification["type"], string> = {
  info: "bg-blue-400",
  success: "bg-green-500",
  warning: "bg-amber-500",
};

export default function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: AppNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="การแจ้งเตือน"
        className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">การแจ้งเตือน</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => markAllNotificationsReadAction())}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  อ่านทั้งหมด
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">ยังไม่มีการแจ้งเตือน</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.readAt) startTransition(() => markNotificationReadAction(n.id));
                    }}
                    className={`flex w-full items-start gap-2 border-b border-gray-50 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50 ${
                      !n.readAt ? "bg-accent-soft" : ""
                    }`}
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[n.type]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-gray-900">{n.title}</span>
                      <span className="block truncate text-xs text-gray-600">{n.message}</span>
                      <span className="block text-[10px] text-gray-600">
                        {new Date(n.createdAt).toLocaleString("th-TH")}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-accent hover:underline"
              >
                ดูการแจ้งเตือนทั้งหมด
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
