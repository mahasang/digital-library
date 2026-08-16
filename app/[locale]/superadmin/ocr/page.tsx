import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ScanText, FileCog, ShieldCheck, FlaskConical } from "lucide-react";
import { getSettings } from "@/lib/data/settings.server";
import { getOcrConfigSummary } from "@/lib/ocr/ocr-provider.server";
import { getRecentJobs, getDeadLetterJobs } from "@/lib/data/job-batches.server";
import { listOcrTestFixtures } from "@/lib/ocr/test-fixtures.server";
import { getRecentOcrTestRuns } from "@/lib/data/ocr-test-runs.server";
import OcrSettingsForm from "@/components/superadmin/OcrSettingsForm";
import RecentJobsPoller from "@/components/superadmin/RecentJobsPoller";
import OcrConnectivityCheckButton from "@/components/superadmin/OcrConnectivityCheckButton";
import OcrTestRunsPanel from "@/components/superadmin/OcrTestRunsPanel";
import { checkOcrConnectivityAction, triggerOcrTestRunAction } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("ocr.pageTitle") };
}
export const dynamic = "force-dynamic";

const PROVIDER_KIND_LABEL: Record<string, string> = {
  self_hosted: "Self-hosted (synchronous)",
  external_api: "External API (async submit + poll)",
};

function StatusIndicator({
  label,
  ok,
  detail,
  readyLabel,
  notReadyLabel,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  readyLabel: string;
  notReadyLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
      <div>
        <span className="text-gray-700">{label}</span>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {ok ? readyLabel : notReadyLabel}
      </span>
    </div>
  );
}

export default async function SuperAdminOcrPage() {
  const [settings, recentJobs, deadLetterJobs, fixtures, recentTestRuns] = await Promise.all([
    getSettings(),
    getRecentJobs("ocr_processing", 20),
    getDeadLetterJobs(50),
    listOcrTestFixtures(),
    getRecentOcrTestRuns(20),
  ]);

  const config = getOcrConfigSummary();
  const lastOcrJob = recentJobs[0] ?? null;
  const lastOcrDlqEntry = deadLetterJobs.find((j) => j.jobType === "ocr_processing") ?? null;

  const fullyReady = config.enabled && config.configured && settings.ocrProviderEnabled;
  const t = await getTranslations("superadmin");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <ScanText className="h-6 w-6 text-accent" />
          {t("ocr.heading")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("ocr.subtitle")}
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ShieldCheck className="h-4 w-4 text-accent" />
          {t("ocr.readinessTitle")}
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          {t("ocr.readinessDesc")}
          {!fullyReady && t("ocr.readinessNotReadySuffix")}
        </p>
        <div className="flex flex-col gap-2">
          <StatusIndicator
            label={t("ocr.providerConfigured")}
            ok={config.configured}
            readyLabel={t("ocr.ready")}
            notReadyLabel={t("ocr.notReady")}
            detail={`OCR_PROVIDER=${config.providerKind ?? "none"} · OCR_PROVIDER_BASE_URL: ${
              config.baseUrlSet ? t("ocr.configuredValue") : t("ocr.notConfiguredValue")
            } · OCR_PROVIDER_API_KEY: ${config.apiKeySet ? t("ocr.configuredValue") : t("ocr.notConfiguredOptionalValue")}`}
          />
          <StatusIndicator
            label={t("ocr.ocrEnabledEnv")}
            ok={config.enabled}
            readyLabel={t("ocr.ready")}
            notReadyLabel={t("ocr.notReady")}
          />
          <StatusIndicator
            label={t("ocr.ocrEnabledSetting")}
            ok={settings.ocrProviderEnabled}
            readyLabel={t("ocr.ready")}
            notReadyLabel={t("ocr.notReady")}
          />
          <StatusIndicator
            label={t("ocr.testModeLabel")}
            ok={config.testModeEnabled}
            readyLabel={t("ocr.ready")}
            notReadyLabel={t("ocr.notReady")}
            detail={config.testModeEnabled ? t("ocr.testModeOnDetail") : t("ocr.testModeOffDetail")}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-2">
          <p>{t("ocr.providerLabel")} {config.providerKind ? (PROVIDER_KIND_LABEL[config.providerKind] ?? config.providerKind) : t("ocr.notConfiguredValue")}</p>
          <p>{t("ocr.timeoutLabel")} {(config.timeoutMs / 1000).toFixed(0)} {t("ocr.seconds")}</p>
          <p>
            {t("ocr.maxFileSizeLabel")} {settings.ocrMaxFileSizeMb} MB
            {config.envLimits.maxFileSizeMb !== null && ` ${t("ocr.envCeiling", { value: `${config.envLimits.maxFileSizeMb} MB` })}`}
          </p>
          <p>
            {t("ocr.maxPagesLabel")} {settings.ocrMaxPages} {t("ocr.pages")}
            {config.envLimits.maxPages !== null && ` ${t("ocr.envCeiling", { value: `${config.envLimits.maxPages} ${t("ocr.pages")}` })}`}
          </p>
          <p>
            {t("ocr.quotaPerUserLabel")} {settings.ocrDailyQuotaEnabled ? `${settings.ocrMaxJobsPerUserPerDay} ${t("ocr.jobs")}` : t("ocr.unlimited")}
            {config.envLimits.maxJobsPerDay !== null && ` ${t("ocr.envCeiling", { value: `${config.envLimits.maxJobsPerDay} ${t("ocr.jobs")}` })}`}
          </p>
          <p>
            {t("ocr.privateDocsPolicyLabel")}{" "}
            {config.privateDocumentsAllowed ? t("ocr.privateDocsAllowed") : t("ocr.privateDocsNotAllowed")}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <p>
            {t("ocr.lastOcrJobLabel")}{" "}
            {lastOcrJob
              ? `${lastOcrJob.status} — ${t("ocr.lastOcrJobStarted")} ${
                  lastOcrJob.startedAt ? new Date(lastOcrJob.startedAt).toLocaleString("th-TH") : "-"
                }`
              : t("ocr.noOcrJobs")}
          </p>
          <p>
            {t("ocr.lastDlqLabel")}{" "}
            {lastOcrDlqEntry
              ? `${t("ocr.lastDlqFailedAt")} ${new Date(lastOcrDlqEntry.createdAt).toLocaleString("th-TH")}`
              : t("ocr.noDlqEntries")}
          </p>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <OcrConnectivityCheckButton action={checkOcrConnectivityAction} />
          <p className="mt-2 text-xs text-gray-500">
            {t("ocr.connectivityCheckDesc")}
          </p>
        </div>
      </section>

      <OcrSettingsForm settings={settings} />

      {config.testModeEnabled && (
        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <FlaskConical className="h-4 w-4 text-accent" />
            {t("ocr.testSectionTitle")}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {t("ocr.testSectionDesc")}
          </p>
          <OcrTestRunsPanel fixtures={fixtures} initialRuns={recentTestRuns} triggerAction={triggerOcrTestRunAction} />
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <FileCog className="h-4 w-4 text-accent" />
          {t("ocr.trackingTitle")}
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          {t("ocr.trackingDesc")}
        </p>
        <RecentJobsPoller jobType="ocr_processing" initialJobs={recentJobs} emptyMessage={t("ocr.noOcrJobs")} />
        <Link
          href="/superadmin/pdf-processing?mode=ocr"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          {t("ocr.goToPdfProcessing")}
        </Link>
      </section>
    </div>
  );
}
