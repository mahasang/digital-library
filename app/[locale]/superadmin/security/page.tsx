import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShieldAlert, Mail, UserX } from "lucide-react";
import { getSettings } from "@/lib/data/settings.server";
import { getSuperAdminUserList } from "@/lib/data/superadmin-users.server";
import { getAuthPolicyStatus } from "@/lib/data/auth-policy.server";
import { isCaptchaConfigured } from "@/lib/captcha.server";
import SecuritySettingsForm from "@/components/superadmin/SecuritySettingsForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("security.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function SuperAdminSecurityPage() {
  const [settings, suspendedResult, authPolicyResult] = await Promise.all([
    getSettings(),
    getSuperAdminUserList({ status: "suspended" }),
    getAuthPolicyStatus(),
  ]);
  const t = await getTranslations("superadmin");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("security.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("security.subtitle")}
        </p>
      </div>

      <SecuritySettingsForm settings={settings} captchaConfigured={isCaptchaConfigured()} />

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Mail className="h-4 w-4 text-accent" />
          {t("security.emailPolicyTitle")}
        </h2>
        {!authPolicyResult.available ? (
          <p className="text-sm text-gray-500">{t("security.unavailableStatus")}</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-gray-600">
            <p>
              {t("security.currentStatus")}{" "}
              <span className="font-medium text-gray-900">
                {authPolicyResult.data.emailConfirmationRequired
                  ? t("security.emailConfirmRequired")
                  : t("security.emailConfirmNotRequired")}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              {t("security.emailPolicyNote")}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <UserX className="h-4 w-4 text-accent" />
          {t("security.suspendedAccountsTitle")}
        </h2>
        {!suspendedResult.available ? (
          <p className="text-sm text-gray-500">{t("security.unavailable")}</p>
        ) : suspendedResult.data.length === 0 ? (
          <p className="text-sm text-gray-500">{t("security.noSuspended")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {suspendedResult.data.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <Link
                    href={`/superadmin/users/${u.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {u.fullName}
                  </Link>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  <ShieldAlert className="h-3 w-3" />
                  {t("security.suspended")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
