import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Download } from "lucide-react";
import SharedEmptyState from "@/components/ui/EmptyState";
import {
  getDownloadsReport,
  getMembersReport,
  getPopularReport,
  getViewsReport,
} from "@/lib/data/reports.server";
import { getCategories } from "@/lib/data/categories.server";
import type { UserRole } from "@/types/research";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("reports.pageTitle") };
}

type ReportTab = "views" | "downloads" | "popular" | "members";

const ASSIGNABLE_ROLES: UserRole[] = ["member", "staff", "librarian", "admin"];

export default async function DashboardReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    category?: string;
    role?: string;
  }>;
}) {
  const t = await getTranslations("dashboard");
  const tRoles = await getTranslations("roles");
  const TABS: { value: ReportTab; label: string }[] = [
    { value: "views", label: t("reports.tabViews") },
    { value: "downloads", label: t("reports.tabDownloads") },
    { value: "popular", label: t("reports.tabPopular") },
    { value: "members", label: t("reports.tabMembers") },
  ];
  const params = await searchParams;
  const tab: ReportTab = (
    ["views", "downloads", "popular", "members"].includes(params.tab ?? "")
      ? params.tab
      : "views"
  ) as ReportTab;

  const categories = await getCategories();

  const filters = {
    from: params.from,
    to: params.to,
    categoryId: params.category,
  };

  function buildTabUrl(nextTab: ReportTab) {
    const sp = new URLSearchParams();
    sp.set("tab", nextTab);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.category) sp.set("category", params.category);
    if (params.role) sp.set("role", params.role);
    return `/dashboard/reports?${sp.toString()}`;
  }

  function buildExportUrl() {
    const sp = new URLSearchParams();
    sp.set("type", tab);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.category) sp.set("category", params.category);
    if (params.role) sp.set("role", params.role);
    return `/dashboard/reports/export?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("reports.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("reports.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((tabItem) => (
          <Link
            key={tabItem.value}
            href={buildTabUrl(tabItem.value)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === tabItem.value
                ? "border-b-2 border-brand-600 text-accent"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tabItem.label}
          </Link>
        ))}
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-surface p-4 text-sm"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          {t("reports.dateFrom")}
          <input
            type="date"
            name="from"
            defaultValue={params.from}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          {t("reports.dateTo")}
          <input
            type="date"
            name="to"
            defaultValue={params.to}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
          />
        </label>
        {tab !== "members" && (
          <select
            name="category"
            defaultValue={params.category ?? ""}
            aria-label={t("reports.filterByCategory")}
            className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">{t("reports.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameTh}
              </option>
            ))}
          </select>
        )}
        {tab === "members" && (
          <select
            name="role"
            defaultValue={params.role ?? ""}
            aria-label={t("reports.filterByRole")}
            className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">{t("reports.allRoles")}</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          {t("reports.filterButton")}
        </button>
        <a
          href={buildExportUrl()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />
          {t("reports.exportCsv")}
        </a>
      </form>

      {tab === "views" && <EventReportTable rows={await getViewsReport(filters)} label={t("reports.countViews")} />}
      {tab === "downloads" && (
        <EventReportTable rows={await getDownloadsReport(filters)} label={t("reports.countDownloads")} />
      )}
      {tab === "popular" && <PopularReportTable filters={filters} />}
      {tab === "members" && (
        <MembersReportTable
          filters={{ from: params.from, to: params.to, role: params.role as UserRole | undefined }}
        />
      )}
    </div>
  );
}

async function PopularReportTable({
  filters,
}: {
  filters: { categoryId?: string };
}) {
  const rows = await getPopularReport(filters);
  const t = await getTranslations("dashboard");
  if (rows.length === 0) {
    return <SharedEmptyState title={t("reports.noResults")} description={t("reports.noResultsHint")} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">{t("reports.colTitle")}</th>
            <th className="px-4 py-3 font-medium">{t("reports.colViews")}</th>
            <th className="px-4 py-3 font-medium">{t("reports.colDownloads")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.slug}>
              <td className="max-w-md truncate px-4 py-2.5">
                <Link href={`/research/${r.slug}`} className="text-accent hover:underline">
                  {r.titleTh}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{r.views.toLocaleString("th-TH")}</td>
              <td className="px-4 py-2.5 text-gray-600">{r.downloads.toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function MembersReportTable({
  filters,
}: {
  filters: { from?: string; to?: string; role?: UserRole };
}) {
  const rows = await getMembersReport(filters);
  const t = await getTranslations("dashboard");
  const tRoles = await getTranslations("roles");
  if (rows.length === 0) {
    return <SharedEmptyState title={t("reports.noResults")} description={t("reports.noResultsHint")} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">{t("reports.colName")}</th>
            <th className="px-4 py-3 font-medium">{t("reports.colEmail")}</th>
            <th className="px-4 py-3 font-medium">{t("reports.colOrganization")}</th>
            <th className="px-4 py-3 font-medium">{t("reports.colRole")}</th>
            <th className="px-4 py-3 font-medium">{t("reports.colJoinedDate")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2.5">{r.fullName}</td>
              <td className="px-4 py-2.5 text-gray-500">{r.email}</td>
              <td className="px-4 py-2.5 text-gray-500">{r.organizationName || "—"}</td>
              <td className="px-4 py-2.5 text-gray-500">{tRoles(r.role)}</td>
              <td className="px-4 py-2.5 text-gray-500">
                {new Date(r.createdAt).toLocaleDateString("th-TH")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function EventReportTable({
  rows,
  label,
}: {
  rows: { researchId: string; slug: string; titleTh: string; count: number }[];
  label: string;
}) {
  const t = await getTranslations("dashboard");
  if (rows.length === 0) {
    return <SharedEmptyState title={t("reports.noResults")} description={t("reports.noResultsHint")} />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">{t("reports.colTitle")}</th>
            <th className="px-4 py-3 font-medium">{label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.researchId}>
              <td className="max-w-md truncate px-4 py-2.5">
                <Link href={`/research/${r.slug}`} className="text-accent hover:underline">
                  {r.titleTh}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{r.count.toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
