export const dynamic = "force-dynamic";
import { Link, redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

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

  const locale = await getLocale();
  const t = await getTranslations("notifications");
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/notifications", locale });

  const notifications = await getMyNotifications(FULL_LIST_LIMIT);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AccountShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-heading text-h1 font-semibold text-gray-900">{t("pageTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("recentCount", { limit: FULL_LIST_LIMIT })}
            {unreadCount > 0 && t("unreadSuffix", { count: unreadCount })}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {notifications.length === 0 ? (
          <AccountEmptyState
            icon={Bell}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Link
                href="/profile/notification-settings"
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("settingsLink")}
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
