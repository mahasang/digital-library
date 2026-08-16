import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Database, ShieldCheck, HardDrive, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { checkSystemHealth, type ServiceHealth } from "@/lib/data/system-health.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("systemHealth.pageTitle") };
}
export const dynamic = "force-dynamic";

const SERVICE_META = {
  database: { label: "Database (PostgreSQL)", icon: Database },
  auth: { label: "Supabase Auth", icon: ShieldCheck },
  storage: { label: "Supabase Storage", icon: HardDrive },
} as const;

export default async function SuperAdminSystemHealthPage() {
  const results = await checkSystemHealth();
  const locale = await getLocale();
  const t = await getTranslations("superadmin.systemHealth");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {results.map((result) => (
          <ServiceCard key={result.service} result={result} t={t} locale={locale} />
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {t("footerDescPart1")}{" "}
        <strong className="text-gray-500">{t("footerStrong")}</strong>{" "}
        {t("footerDescPart2")}{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/api/health</code> {t("footerDescPart3")}{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">docs/uptime-monitoring.md</code>{" "}
        {t("footerDescPart4")}
      </p>
    </div>
  );
}

function ServiceCard({
  result,
  t,
  locale,
}: {
  result: ServiceHealth;
  t: Awaited<ReturnType<typeof getTranslations>>;
  locale: string;
}) {
  const meta = SERVICE_META[result.service];
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-surface p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
          <StatusBadge status={result.status} t={t} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {result.status === "unknown" ? t("unknownStatusDesc") : result.detail}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {t("checkedAtLabel")}{" "}
          {new Date(result.checkedAt).toLocaleString(locale === "en" ? "en-US" : "th-TH", {
            dateStyle: "medium",
            timeStyle: "medium",
          })}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: ServiceHealth["status"];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        {t("statusOk")}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        <XCircle className="h-3 w-3" />
        {t("statusError")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      <HelpCircle className="h-3 w-3" />
      {t("statusUnknown")}
    </span>
  );
}
