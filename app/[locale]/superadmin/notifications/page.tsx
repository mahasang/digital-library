import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/data/settings.server";
import { isEmailProviderConfigured } from "@/lib/notifications/email.server";
import NotificationSettingsForm from "@/components/superadmin/NotificationSettingsForm";
import AccessExpirationWarningSettingsForm from "@/components/superadmin/AccessExpirationWarningSettingsForm";
import ProcessAccessExpirationNowButton from "@/components/superadmin/ProcessAccessExpirationNowButton";
import { RecentJobsList, FailedJobList } from "@/components/superadmin/JobBatchList";
import { getRecentJobs, getFailedJobs } from "@/lib/data/job-batches.server";
import { retryFailedNotificationJobAction } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("notifications.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function SuperAdminNotificationsPage() {
  const [settings, recentExpirationJobs, recentNotificationJobs, failedNotificationJobs] =
    await Promise.all([
      getSettings(),
      getRecentJobs("access_expiration", 10),
      getRecentJobs("category_notification", 10),
      getFailedJobs("category_notification", 50),
    ]);
  const t = await getTranslations("superadmin");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("notifications.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("notifications.subtitle")}
        </p>
      </div>

      <NotificationSettingsForm
        settings={settings}
        emailProviderConfigured={isEmailProviderConfigured()}
      />

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t("notifications.accessExpirationTitle")}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {t("notifications.accessExpirationDesc")}
            </p>
          </div>
          <ProcessAccessExpirationNowButton />
        </div>
        <AccessExpirationWarningSettingsForm
          settings={settings}
          emailProviderConfigured={isEmailProviderConfigured()}
        />
        <div className="mt-4">
          <RecentJobsList jobs={recentExpirationJobs} emptyMessage={t("notifications.noExpirationJobs")} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          {t("notifications.categoryNotificationTitle")}
        </h2>
        <RecentJobsList
          jobs={recentNotificationJobs}
          emptyMessage={t("notifications.noCategoryNotifications")}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          {t("notifications.failedJobsTitle")}
        </h2>
        <FailedJobList
          jobs={failedNotificationJobs}
          retryAction={retryFailedNotificationJobAction}
          emptyMessage={t("notifications.noFailedJobs")}
        />
      </section>
    </div>
  );
}
