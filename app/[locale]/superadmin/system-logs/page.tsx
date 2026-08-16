import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FileWarning, ExternalLink, CheckCircle2 } from "lucide-react";
import { getLoggingProviderStatus } from "@/lib/logging/logger.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("systemLogs.pageTitle") };
}
export const dynamic = "force-dynamic";

const PROVIDER_DISPLAY_NAME: Record<string, string> = {
  sentry: "Sentry",
  betterstack: "Better Stack (Logtail)",
};

export default async function SuperAdminSystemLogsPage() {
  const { configured, providerName } = getLoggingProviderStatus();
  const t = await getTranslations("superadmin.systemLogs");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      {configured ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                {t("configuredTitle", { provider: providerName ? (PROVIDER_DISPLAY_NAME[providerName] ?? providerName) : "provider" })}
              </p>
              <p className="mt-1 text-sm text-green-700">
                {t("configuredDesc")}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {t("notConfiguredTitle")}
              </p>
              <p className="mt-1 text-sm text-amber-700">
                {t("notConfiguredDescBefore")} <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">LOG_PROVIDER</code>{" "}
                {t("notConfiguredDescAfter")}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          {t("currentLocationsTitle")}
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-gray-600">
          <li>
            <strong className="text-gray-800">{t("devLabel")}</strong> {t("devDescPart1")} <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">console.error</code>{" "}
            {t("devDescPart2")}{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">npm run dev</code>
          </li>
          <li>
            <strong className="text-gray-800">{t("prodLabel")}</strong> {t("prodDesc")}
          </li>
          <li>
            <strong className="text-gray-800">{t("userActionsLabel")}</strong> {t("userActionsDescBefore")}{" "}
            <Link href="/superadmin/audit-logs" className="text-accent hover:underline">
              /superadmin/audit-logs
            </Link>{" "}
            {t("userActionsDescAfter")}
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          {t("howToTitle")}
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          {t("howToDescPart1")}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">lib/logging/</code>{t("howToDescPart2")}{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">LOG_PROVIDER</code>{" "}
          {t("howToDescPart3")} <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.env.example</code>{t("howToDescPart4")}
        </p>
        <ul className="flex flex-col gap-3 text-sm">
          <li className="rounded-lg border border-gray-100 p-3">
            <p className="font-medium text-gray-800">{t("sentryTitlePrefix")} <code className="text-xs">LOG_PROVIDER=sentry</code></p>
            <p className="mt-1 text-xs text-gray-500">
              {t("sentryDescBefore")} <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">SENTRY_DSN</code>{" "}
              {t("sentryDescAfter")}
            </p>
          </li>
          <li className="rounded-lg border border-gray-100 p-3">
            <p className="font-medium text-gray-800">{t("betterstackTitlePrefix")} <code className="text-xs">LOG_PROVIDER=betterstack</code></p>
            <p className="mt-1 text-xs text-gray-500">
              {t("betterstackDescBefore")}{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">LOGGING_BETTERSTACK_SOURCE_TOKEN</code>{" "}
              {t("betterstackDescAfter")}
            </p>
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          {t("alternativesText")}
        </p>
        <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
          <ExternalLink className="h-3 w-3" />
          {t("officialLinksNote")}
        </p>
      </section>
    </div>
  );
}
