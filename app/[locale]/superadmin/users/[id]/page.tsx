import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Building2, Calendar, ScrollText, History } from "lucide-react";
import {
  getSuperAdminUserDetail,
  getUserActivityHistory,
} from "@/lib/data/superadmin-users.server";
import { getAuditLogs } from "@/lib/data/audit-logs.server";
import { getUserMfaFactors } from "@/lib/security/mfa-admin.server";
import { getSessionUser } from "@/lib/supabase/session";
import UserRolesEditor from "@/components/superadmin/UserRolesEditor";
import UserStatusControl from "@/components/superadmin/UserStatusControl";
import MfaResetControl from "@/components/superadmin/MfaResetControl";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin.users.detail" });
  return { title: t("pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function SuperAdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detailResult, activityResult, accountHistoryResult, currentUser, mfaResult] =
    await Promise.all([
      getSuperAdminUserDetail(id),
      getUserActivityHistory(id),
      getAuditLogs({ entityId: id, entityType: "profiles", pageSize: 20 }),
      getSessionUser(),
      getUserMfaFactors(id),
    ]);

  if (!detailResult.available) notFound();
  const user = detailResult.data;
  const isSelf = currentUser?.id === user.id;

  const locale = await getLocale();
  const t = await getTranslations("superadmin.users.detail");
  const tAuditActions = await getTranslations("auditActions");
  const dateLocale = locale === "en" ? "en-US" : "th-TH";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/superadmin/users"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backLink")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{user.fullName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {user.email || t("notSpecifiedEmail")}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {user.organizationName || t("notSpecifiedOrg")}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {t("joinedLabel", { date: new Date(user.createdAt).toLocaleDateString(dateLocale) })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">{t("rolesTitle")}</h2>
          <p className="mb-3 text-xs text-gray-500">
            {t("rolesDesc")}
          </p>
          <UserRolesEditor
            userId={user.id}
            userName={user.fullName}
            userEmail={user.email}
            currentRoles={user.roles}
            isSelf={isSelf}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">{t("accountStatusTitle")}</h2>
          <UserStatusControl
            userId={user.id}
            isActive={user.isActive}
            isSelf={isSelf}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-surface p-5 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">
            {t("mfaTitle")}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {t("mfaDesc")}
          </p>
          <MfaResetControl
            userId={user.id}
            userName={user.fullName}
            userEmail={user.email}
            isSelf={isSelf}
            available={mfaResult.available}
            factors={mfaResult.available ? mfaResult.data : []}
          />
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ScrollText className="h-4 w-4 text-accent" />
          {t("activityTitle")}
        </h2>
        {!activityResult.available ? (
          <p className="py-6 text-center text-sm text-gray-500">{t("activityUnavailable")}</p>
        ) : activityResult.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">{t("activityEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="pb-2 font-medium">{t("colAction")}</th>
                  <th className="pb-2 font-medium">{t("colEntityType")}</th>
                  <th className="pb-2 font-medium">{t("colDateTime")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activityResult.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 text-gray-700">{entry.action}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{entry.entityType}</td>
                    <td className="py-2.5 text-gray-500">
                      {new Date(entry.createdAt).toLocaleString(dateLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <History className="h-4 w-4 text-accent" />
          {t("accountHistoryTitle")}
        </h2>
        {!accountHistoryResult.available ? (
          <p className="py-6 text-center text-sm text-gray-500">{t("accountHistoryUnavailable")}</p>
        ) : accountHistoryResult.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">{t("accountHistoryEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t("colAction")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colActor")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colReason")}</th>
                  <th className="pb-2 font-medium">{t("colDateTime")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accountHistoryResult.rows.map((entry) => {
                  const reason =
                    typeof entry.metadata?.reason === "string" ? entry.metadata.reason : null;
                  const isSuperAdminChange =
                    entry.action === "super_admin_grant" || entry.action === "super_admin_revoke";
                  return (
                    <tr key={entry.id}>
                      <td className="py-2.5 pr-4">
                        <span
                          className={
                            isSuperAdminChange ? "font-medium text-amber-700" : "text-gray-700"
                          }
                        >
                          {tAuditActions.has(entry.action) ? tAuditActions(entry.action) : entry.action}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{entry.actorName}</td>
                      <td className="max-w-xs truncate py-2.5 pr-4 text-xs text-gray-500">
                        {reason || "—"}
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(entry.createdAt).toLocaleString(dateLocale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
