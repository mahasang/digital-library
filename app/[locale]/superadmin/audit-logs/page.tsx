import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { getAuditLogs } from "@/lib/data/audit-logs.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("auditLogs.pageTitle") };
}
export const dynamic = "force-dynamic";

const ACTION_VALUES = [
  "research_create",
  "research_update",
  "research_status_change",
  "category_create",
  "category_update",
  "category_enable",
  "category_disable",
  "category_delete",
  "category_reorder",
  "category_move_parent",
  "organization_create",
  "organization_update",
  "organization_enable",
  "organization_disable",
  "organization_delete",
  "organization_reorder",
  "user_role_change",
  "user_role_add",
  "user_role_remove",
  "super_admin_grant",
  "super_admin_revoke",
  "user_enable",
  "user_disable",
  "user_suspend",
  "user_suspend_temporary",
  "settings_update",
  "system_settings_update",
  "security_settings_update",
  "notification_settings_update",
  "storage_file_delete",
  "file_upload_rejected",
  "mfa_reset",
  "research_text_reprocess",
  "access_request_approve",
  "access_request_reject",
  "access_request_more_info",
  "access_request_cancel",
  "access_grant_revoke",
  "author_create",
  "author_update",
  "author_enable",
  "author_disable",
  "author_orcid_verify",
  "author_merge",
  "organization_merge",
  "research_merge",
  "duplicate_review_confirm",
  "duplicate_review_dismiss",
];

export default async function SuperAdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    entity?: string;
    action?: string;
    actor?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const { available, rows, total, totalPages } = await getAuditLogs({
    from: params.from,
    to: params.to,
    entityType: params.entity,
    action: params.action,
    actorSearch: params.actor,
    page,
  });

  const locale = await getLocale();
  const t = await getTranslations("superadmin.auditLogs");
  const tAuditActions = await getTranslations("auditActions");

  function buildUrl(targetPage: number) {
    const sp = new URLSearchParams();
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.entity) sp.set("entity", params.entity);
    if (params.action) sp.set("action", params.action);
    if (params.actor) sp.set("actor", params.actor);
    sp.set("page", String(targetPage));
    return `/superadmin/audit-logs?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <ScrollText className="h-6 w-6 text-accent" />
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-surface p-4 text-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t("actorLabel")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              name="actor"
              defaultValue={params.actor}
              placeholder={t("actorSearchPlaceholder")}
              className="w-48 rounded-lg border border-gray-300 py-1.5 pl-7 pr-2 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t("actionLabel")}</label>
          <select
            name="action"
            defaultValue={params.action ?? ""}
            className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">{t("allActions")}</option>
            {ACTION_VALUES.map((a) => (
              <option key={a} value={a}>
                {tAuditActions.has(a) ? tAuditActions(a) : a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t("entityTypeLabel")}</label>
          <select
            name="entity"
            defaultValue={params.entity ?? ""}
            className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">{t("allEntityTypes")}</option>
            <option value="research_items">{t("entityResearch")}</option>
            <option value="categories">{t("entityCategories")}</option>
            <option value="organizations">{t("entityOrganizations")}</option>
            <option value="profiles">{t("entityProfiles")}</option>
            <option value="settings">{t("entitySettings")}</option>
            <option value="storage_objects">{t("entityStorage")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-log-from" className="text-xs text-gray-600">{t("filterFrom")}</label>
          <input
            id="audit-log-from"
            type="date"
            name="from"
            defaultValue={params.from}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-log-to" className="text-xs text-gray-600">{t("filterTo")}</label>
          <input
            id="audit-log-to"
            type="date"
            name="to"
            defaultValue={params.to}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          {t("filterButton")}
        </button>
      </form>

      <p className="text-sm text-gray-500">
        {t("resultsBefore")} <span className="font-semibold text-gray-900">{total}</span> {t("resultsAfter")}
      </p>

      {!available ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center text-sm text-gray-500">
          {t("unavailable")}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          {t("noResults")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colActor")}</th>
                <th className="px-4 py-3 font-medium">{t("colAction")}</th>
                <th className="px-4 py-3 font-medium">{t("colEntityType")}</th>
                <th className="px-4 py-3 font-medium">{t("colDetails")}</th>
                <th className="px-4 py-3 font-medium">{t("colDateTime")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{log.actorName}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {tAuditActions.has(log.action) ? tAuditActions(log.action) : log.action}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{log.entityType}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-xs text-gray-500">
                    {Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString(locale === "en" ? "en-US" : "th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={buildUrl(Math.max(1, page - 1))}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
              page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("prevPage")}
          </Link>
          <span className="text-sm text-gray-500">
            {t("pageOf", { page, totalPages })}
          </span>
          <Link
            href={buildUrl(Math.min(totalPages, page + 1))}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
              page >= totalPages
                ? "pointer-events-none text-gray-300"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t("nextPage")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
