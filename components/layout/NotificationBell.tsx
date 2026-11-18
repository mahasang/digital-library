"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  markNotificationReadAction,
  markNotificationsReadAction,
  markAllNotificationsReadAction,
} from "@/components/layout/notification-actions";
import {
  displayUnreadCount,
  isShownAsUnread,
  unreadIdsToMark,
} from "@/components/layout/notification-state";
import { useDismissable } from "@/components/layout/useDismissable";
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
  // id ที่ยังไม่อ่านตอนเปิดแผง — คงไฮไลต์ไว้จนกว่าจะปิดแผง ผู้ใช้จะได้เห็นว่าอันไหนใหม่
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(() => new Set());
  // id ที่ client สั่ง "อ่านแล้ว" ไปแล้ว — ใช้ลดตัวเลขบนกระดิ่งทันที ไม่รอเซิร์ฟเวอร์ส่งข้อมูลใหม่
  const [locallyRead, setLocallyRead] = useState<ReadonlySet<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("notifications.bell");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const shownUnreadCount = displayUnreadCount(unreadCount, notifications, locallyRead);

  function closePanel() {
    setOpen(false);
    setHighlightedIds(new Set());
  }

  function togglePanel() {
    if (open) {
      closePanel();
      return;
    }
    setOpen(true);

    // เปิดกระดิ่ง = ถือว่าเห็นรายการที่แสดงอยู่แล้ว (สูงสุด 10 รายการล่าสุด)
    // ทำเครื่องหมายอ่านแล้วให้ รายการที่เหลือ (เกิน 10) ยังนับเป็นยังไม่อ่านตามเดิม
    const idsToMark = unreadIdsToMark(notifications, locallyRead);
    if (idsToMark.length === 0) return;

    setHighlightedIds(new Set(idsToMark));
    setLocallyRead((prev) => new Set([...prev, ...idsToMark]));
    startTransition(async () => {
      const ok = await markNotificationsReadAction(idsToMark);
      if (!ok) {
        // บันทึกไม่สำเร็จ — คืนตัวเลขเดิม และให้ลองใหม่ได้ตอนเปิดครั้งหน้า
        setLocallyRead((prev) => {
          const next = new Set(prev);
          for (const id of idsToMark) next.delete(id);
          return next;
        });
      }
    });
  }

  useDismissable(containerRef, open, (reason) => {
    closePanel();
    if (reason === "escape") triggerRef.current?.focus();
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePanel}
        aria-label={t("ariaLabel")}
        aria-expanded={open}
        className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <Bell className="h-5 w-5" />
        {shownUnreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {shownUnreadCount > 9 ? "9+" : shownUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">{t("title")}</p>
            {shownUnreadCount > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => markAllNotificationsReadAction())}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3 w-3" />
                {t("readAll")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">{t("empty")}</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    // ปกติถูก mark ไปแล้วตอนเปิดแผง — เหลือไว้กรณีรายการที่ยังไม่ถูก mark เท่านั้น
                    if (!n.readAt && !locallyRead.has(n.id)) {
                      startTransition(() => markNotificationReadAction(n.id));
                    }
                  }}
                  className={`flex w-full items-start gap-2 border-b border-gray-50 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50 ${
                    isShownAsUnread(n, highlightedIds) ? "bg-accent-soft" : ""
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
              onClick={closePanel}
              className="text-xs font-medium text-accent hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
