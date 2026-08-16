import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { History } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getDeadLetterJobs, getResolvedDeadLetterJobs } from "@/lib/data/job-batches.server";
import { getJobConcurrencySettingsList } from "@/lib/data/job-type-settings.server";
import { getQueueHealth } from "@/lib/data/queue-health.server";
import { describeJobsForDisplay, JOB_TYPE_LABELS } from "@/lib/jobs/dlq.server";
import DeadLetterJobList from "@/components/superadmin/DeadLetterJobList";
import ConcurrencySettingsForm from "@/components/superadmin/ConcurrencySettingsForm";
import QueueHealthPanel from "@/components/superadmin/QueueHealthPanel";
import {
  retryDeadLetterJobAction,
  cancelDeadLetterJobAction,
  resolveDeadLetterJobAction,
  updateJobConcurrencyAction,
} from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("jobs.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function DeadLetterQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "resolved" ? "resolved" : "active";

  const [jobs, concurrencySettings, queueHealth] = await Promise.all([
    view === "resolved" ? getResolvedDeadLetterJobs() : getDeadLetterJobs(),
    getJobConcurrencySettingsList(),
    getQueueHealth(),
  ]);
  const infos = await describeJobsForDisplay(jobs);
  const locale = await getLocale();
  const t = await getTranslations("superadmin.jobs");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">{t("queueHealthTitle")}</h2>
        <p className="mb-3 text-xs text-gray-500">
          {t("queueHealthDesc")}
        </p>
        <QueueHealthPanel health={queueHealth} labels={JOB_TYPE_LABELS} />
      </section>

      <div className="flex gap-2 border-b border-gray-200">
        <Link
          href="/superadmin/jobs?view=active"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            view === "active" ? "border-brand-600 text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("tabActive")}
        </Link>
        <Link
          href="/superadmin/jobs?view=resolved"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            view === "resolved" ? "border-brand-600 text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("tabResolved")}
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        {view === "active" ? (
          <DeadLetterJobList
            jobs={jobs}
            infos={infos}
            retryAction={retryDeadLetterJobAction}
            cancelAction={cancelDeadLetterJobAction}
            resolveAction={resolveDeadLetterJobAction}
            emptyMessage={t("noPermanentlyFailed")}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.length === 0 ? (
              <EmptyState
                icon={History}
                title={t("emptyResolvedTitle")}
                description={t("emptyResolvedDesc")}
                compact
              />
            ) : (
              jobs.map((job, i) => (
                <div key={job.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
                  <p className="font-medium text-gray-800">{infos[i].safeSummary}</p>
                  <p className="mt-0.5 text-gray-500">
                    {job.status === "cancelled" ? t("statusCancelled") : t("statusResolved")} {t("atLabel")}{" "}
                    {job.resolvedAt ? new Date(job.resolvedAt).toLocaleString(locale === "en" ? "en-US" : "th-TH") : "-"}
                  </p>
                  {job.resolutionNote && <p className="mt-0.5 text-gray-600">{t("noteLabel")} {job.resolutionNote}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">{t("concurrencyTitle")}</h2>
        <p className="mb-3 text-xs text-gray-500">
          {t("concurrencyDesc")}
        </p>
        <ConcurrencySettingsForm
          settings={concurrencySettings}
          labels={JOB_TYPE_LABELS}
          action={updateJobConcurrencyAction}
        />
      </section>
    </div>
  );
}
