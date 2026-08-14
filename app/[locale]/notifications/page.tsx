import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import AccountShell from "@/components/account/AccountShell";
import AccountEmptyState from "@/components/account/AccountEmptyState";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import NotificationRow from "@/components/notifications/NotificationRow";
import MarkAllReadButton from "@/components/notifications/MarkAllReadButton";
import Container from "@/components/ui/Container";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getMyNotifications } from "@/lib/data/notifications.server";

export const metadata: Metadata = {
  title: "การแจ้งเตือน",
  description: "การแจ้งเตือนทั้งหมดของคุณ",
};

const FULL_LIST_LIMIT = 50;

export default async function NotificationsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-12">
        <Container className="max-w-2xl">
          <SupabaseNotConfiguredNotice />
        </Container>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/notifications");

  const notifications = await getMyNotifications(FULL_LIST_LIMIT);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AccountShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 font-semibold text-gray-900">การแจ้งเตือน</h1>
          <p className="mt-1 text-sm text-gray-500">
            การแจ้งเตือนล่าสุด {FULL_LIST_LIMIT} รายการของคุณ
            {unreadCount > 0 && ` — ${unreadCount} รายการยังไม่อ่าน`}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {notifications.length === 0 ? (
          <AccountEmptyState
            icon={Bell}
            title="ยังไม่มีการแจ้งเตือน"
            description="ตั้งค่าติดตามหมวดหมู่งานวิจัยได้ที่หน้าตั้งค่าการแจ้งเตือน"
            action={
              <Link
                href="/profile/notification-settings"
                className="text-sm font-medium text-accent hover:underline"
              >
                ตั้งค่าการแจ้งเตือน
              </Link>
            }
          />
        ) : (
          notifications.map((n) => <NotificationRow key={n.id} notification={n} />)
        )}
      </div>
    </AccountShell>
  );
}
