import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RefreshCw, ActivitySquare } from "lucide-react";
import { getCronMonitoringOverview, getRecentCronAlerts } from "@/lib/data/cron-monitoring.server";
import { CronMonitoringTable, RecentCronAlertsList } from "@/components/superadmin/CronMonitoringOverview";
import CronMonitoringSettingsForm from "@/components/superadmin/CronMonitoringSettingsForm";
import { updateCronMonitoringSettingsAction } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("cronMonitoring.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function CronMonitoringPage() {
  const [rows, alerts] = await Promise.all([getCronMonitoringOverview(), getRecentCronAlerts()]);
  const t = await getTranslations("superadmin.cronMonitoring");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <ActivitySquare className="h-6 w-6 text-accent" />
            {t("heading")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/superadmin/cron-monitoring"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t("refreshButton")}
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <strong>{t("realtimeNoticeStrong")}</strong> {t("realtimeNoticeRest")}
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">{t("latestStatusTitle")}</h2>
        <p className="mb-3 text-xs text-gray-500">
          {t("latestStatusBefore")}{" "}
          <Link href="/superadmin/jobs" className="text-accent hover:underline">
            {t("latestStatusLinkText")}
          </Link>{" "}
          {t("latestStatusAfter")}
        </p>
        <CronMonitoringTable rows={rows} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">{t("recentAlertsTitle")}</h2>
        <p className="mb-3 text-xs text-gray-500">{t("recentAlertsDesc")}</p>
        <RecentCronAlertsList alerts={alerts} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">{t("expectedFrequencyTitle")}</h2>
        <p className="mb-3 text-xs text-gray-500">
          {t("expectedFrequencyDesc")}
        </p>
        <CronMonitoringSettingsForm rows={rows} action={updateCronMonitoringSettingsAction} />
      </section>

      <p className="text-xs text-gray-500">
        {t("footerBefore")}{" "}
        <Link href="/superadmin/jobs" className="text-accent hover:underline">
          /superadmin/jobs
        </Link>
      </p>
    </div>
  );
}
