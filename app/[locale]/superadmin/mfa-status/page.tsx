import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getSuperAdminMfaOverview, type SuperAdminMfaStatus } from "@/lib/security/mfa-admin.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("mfaStatus.pageTitle") };
}
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<SuperAdminMfaStatus, "green" | "red" | "amber"> = {
  enabled: "green",
  not_configured: "red",
  reset_required: "amber",
};

const STATUS_ICON: Record<SuperAdminMfaStatus, typeof ShieldCheck> = {
  enabled: ShieldCheck,
  not_configured: ShieldAlert,
  reset_required: ShieldQuestion,
};

export default async function MfaStatusPage() {
  const result = await getSuperAdminMfaOverview();
  const locale = await getLocale();
  const t = await getTranslations("superadmin.mfaStatus");

  const STATUS_LABEL: Record<SuperAdminMfaStatus, string> = {
    enabled: t("statusEnabled"),
    not_configured: t("statusNotConfigured"),
    reset_required: t("statusResetRequired"),
  };

  if (!result.available) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("headingSimple")}</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          {t("unavailableDescBefore")}{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">.env.example</code>
        </div>
      </div>
    );
  }

  const rows = result.data;
  const notConfiguredCount = rows.filter((r) => r.mfaStatus !== "enabled").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      {notConfiguredCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {t("warningTitle", { count: notConfiguredCount })}
            </p>
            <p className="mt-1 text-xs text-red-700">
              {t("warningDescBefore")}{" "}
              <code className="rounded bg-red-100 px-1 py-0.5">/setup-mfa</code>{" "}
              {t("warningDescAfter")}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="px-4 py-3">{t("colName")}</th>
              <th className="px-4 py-3">{t("colEmail")}</th>
              <th className="px-4 py-3">{t("colMfaStatus")}</th>
              <th className="px-4 py-3">{t("colLastVerified")}</th>
              <th className="px-4 py-3">{t("colAccountStatus")}</th>
              <th className="px-4 py-3">{t("colManage")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const Icon = STATUS_ICON[row.mfaStatus];
              return (
                <tr key={row.userId} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{row.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[row.mfaStatus]}>
                      <Icon className="h-3 w-3" />
                      {STATUS_LABEL[row.mfaStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {row.lastVerifiedAt ? new Date(row.lastVerifiedAt).toLocaleString(locale === "en" ? "en-US" : "th-TH") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.isActive ? (
                      <span className="text-green-700">{t("accountActive")}</span>
                    ) : (
                      <span className="text-red-600">{t("accountSuspended")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/superadmin/users/${row.userId}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {t("manageLink")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
