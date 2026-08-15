import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  Users,
  FileText,
  Clock,
  Eye,
  Download,
  TrendingUp,
  Calendar,
  ListChecks,
  BarChart3,
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import { getDashboardStats, getDateRangeStats } from "@/lib/data/admin-stats.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("pageTitle") };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const t = await getTranslations("dashboard");
  const params = await searchParams;

  const today = new Date();
  const defaultTo = isoDate(today);
  const defaultFrom = isoDate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));

  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;
  // ช่วงวันที่แบบไม่รวมวันสิ้นสุด (exclusive) — บวก 1 วันให้ครอบคลุมถึงสิ้นวันที่ "to"
  const toExclusive = isoDate(new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000));

  const [stats, rangeStats] = await Promise.all([
    getDashboardStats(),
    getDateRangeStats(from, toExclusive),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("pageSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {t("actionRequired")}
        </h2>
        <StatCard
          icon={Clock}
          label={t("pendingReview")}
          value={stats.pendingReview}
          tone="action"
          href="/dashboard/approvals"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          {t("referenceData")}
        </h2>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label={t("totalMembers")} value={stats.memberCount} />
          <StatCard icon={FileText} label={t("totalResearch")} value={stats.totalResearch} />
          <StatCard icon={Eye} label={t("totalViews")} value={stats.totalViews} />
          <StatCard icon={Download} label={t("totalDownloads")} value={stats.totalDownloads} />
        </div>

        <Panel
          icon={Calendar}
          title={t("dateRangeStats")}
          action={
            <form className="flex flex-wrap items-center gap-2 text-sm" method="get">
              <input
                type="date"
                name="from"
                defaultValue={from}
                max={to}
                aria-label={t("dateFrom")}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900"
              />
              <span className="text-gray-500">{t("dateToLabel")}</span>
              <input
                type="date"
                name="to"
                defaultValue={to}
                max={defaultTo}
                aria-label={t("dateTo")}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                {t("viewData")}
              </button>
            </form>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Eye} label={t("readsInRange")} value={rangeStats.readsInRange} />
            <StatCard
              icon={Download}
              label={t("downloadsInRange")}
              value={rangeStats.downloadsInRange}
            />
            <StatCard
              icon={Users}
              label={t("newMembersInRange")}
              value={rangeStats.newMembersInRange}
            />
          </div>
        </Panel>

        <Panel icon={TrendingUp} title={t("popularResearch")}>
          {stats.popularResearch.length === 0 ? (
            <EmptyState title={t("noData")} compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="pb-2 font-medium">{t("colTitle")}</th>
                    <th className="pb-2 font-medium">{t("colViews")}</th>
                    <th className="pb-2 font-medium">{t("colDownloads")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.popularResearch.map((r) => (
                    <tr key={r.id}>
                      <td className="max-w-xs truncate py-2.5 pr-4">
                        <Link
                          href={`/research/${r.id}`}
                          className="text-accent hover:underline"
                        >
                          {r.titleTh}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {r.views.toLocaleString("th-TH")}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {r.downloads.toLocaleString("th-TH")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
