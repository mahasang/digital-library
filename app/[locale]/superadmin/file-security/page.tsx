import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getFileSecurityCandidates,
  getFileSecurityCandidatesCount,
  type FileSecurityFilter,
} from "@/lib/data/file-security-candidates.server";
import { getRecentJobBatches, getFailedJobs } from "@/lib/data/job-batches.server";
import { getDefaultBatchSize } from "@/lib/data/job-type-settings.server";
import BulkJobSelector, { type BulkSelectItem } from "@/components/superadmin/BulkJobSelector";
import ProcessQueueNowButton from "@/components/superadmin/ProcessQueueNowButton";
import { FailedJobList } from "@/components/superadmin/JobBatchList";
import JobProgressPoller from "@/components/superadmin/JobProgressPoller";
import BulkAllMatchingFilterDialog from "@/components/superadmin/BulkAllMatchingFilterDialog";
import type { FileSecurityBulkFilter } from "@/lib/validation/bulk-filters";
import {
  bulkEnqueueFileRescanAction,
  retryFailedRescanJobAction,
  bulkEnqueueAllMatchingFilterAction,
  pauseBatchAction,
  resumeBatchAction,
  cancelBatchAction,
  retryFailedInBatchAction,
} from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("fileSecurity.pageTitle") };
}
export const dynamic = "force-dynamic";

const FILTER_VALUES: FileSecurityFilter[] = ["all", "pending", "error", "infected", "clean", "skipped"];
const FILE_KIND_VALUES = ["", "pdf", "attachment", "either"] as const;

export default async function FileSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    fileKind?: string;
    createdAfter?: string;
    createdBefore?: string;
    neverScanned?: string;
  }>;
}) {
  const params = await searchParams;
  const filter: FileSecurityFilter = FILTER_VALUES.includes(params.filter as FileSecurityFilter)
    ? (params.filter as FileSecurityFilter)
    : "all";
  const fileKind = params.fileKind || undefined;
  const createdAfter = params.createdAfter || undefined;
  const createdBefore = params.createdBefore || undefined;
  const neverScannedOnly = params.neverScanned === "1";

  const bulkAllFilter: FileSecurityBulkFilter = {
    scanStatus: filter === "all" ? undefined : filter,
    fileKind: fileKind as FileSecurityBulkFilter["fileKind"],
    createdAfter: createdAfter ? new Date(createdAfter).toISOString() : undefined,
    createdBefore: createdBefore ? new Date(createdBefore).toISOString() : undefined,
    neverScannedOnly,
  };

  const [candidates, batches, failedJobs, estimatedCount, defaultBatchSize] = await Promise.all([
    getFileSecurityCandidates(filter),
    getRecentJobBatches("file_security_rescan"),
    getFailedJobs("file_security_rescan"),
    getFileSecurityCandidatesCount(bulkAllFilter),
    getDefaultBatchSize("file_security_rescan"),
  ]);

  const t = await getTranslations("superadmin.fileSecurity");

  const FILTERS: { value: FileSecurityFilter; label: string }[] = FILTER_VALUES.map((value) => ({
    value,
    label: t(`filters.${value}`),
  }));
  const FILE_KIND_OPTIONS: { value: string; label: string }[] = FILE_KIND_VALUES.map((value) => ({
    value,
    label: t(`fileKindOptions.${value === "" ? "all" : value}`),
  }));
  const BADGE_BY_SCAN_STATUS: Record<
    string,
    { label: string; tone: "brand" | "green" | "amber" | "red" | "gray" | "purple" }
  > = {
    pending: { label: t("badge.pending"), tone: "amber" },
    clean: { label: t("badge.clean"), tone: "green" },
    infected: { label: t("badge.infected"), tone: "red" },
    error: { label: t("badge.error"), tone: "red" },
    skipped: { label: t("badge.skipped"), tone: "gray" },
  };

  const items: BulkSelectItem[] = candidates.map((c) => ({
    id: c.id,
    title: c.titleTh,
    meta: `${c.pdfFile}${c.scanReason ? ` · ${c.scanReason}` : ""}`,
    badge: BADGE_BY_SCAN_STATUS[c.scanStatus],
  }));

  const filterSummary: string[] = [];
  if (filter !== "all") filterSummary.push(t("filterSummaryStatus", { value: FILTERS.find((f) => f.value === filter)?.label ?? filter }));
  if (fileKind) filterSummary.push(t("filterSummaryFileKind", { value: FILE_KIND_OPTIONS.find((f) => f.value === fileKind)?.label ?? fileKind }));
  if (createdAfter) filterSummary.push(t("filterSummaryUploadedSince", { value: createdAfter }));
  if (createdBefore) filterSummary.push(t("filterSummaryUploadedBefore", { value: createdBefore }));
  if (neverScannedOnly) filterSummary.push(t("filterSummaryNeverScanned"));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <ProcessQueueNowButton />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/superadmin/file-security?filter=${f.value}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === f.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-xs">
        <input type="hidden" name="filter" value={filter} />
        <div className="flex flex-col gap-1">
          <label className="text-gray-500">{t("fileKindLabel")}</label>
          <select name="fileKind" defaultValue={params.fileKind ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5">
            {FILE_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="file-security-created-after" className="text-gray-600">{t("uploadedAfterLabel")}</label>
          <input id="file-security-created-after" type="date" name="createdAfter" defaultValue={params.createdAfter ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-900" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="file-security-created-before" className="text-gray-600">{t("uploadedBeforeLabel")}</label>
          <input id="file-security-created-before" type="date" name="createdBefore" defaultValue={params.createdBefore ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-900" />
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-gray-600">
          <input type="checkbox" name="neverScanned" value="1" defaultChecked={neverScannedOnly} />
          {t("neverScannedLabel")}
        </label>
        <button type="submit" className="rounded-lg bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-800">
          {t("applyFilterButton")}
        </button>
      </form>

      <BulkJobSelector
        items={items}
        action={bulkEnqueueFileRescanAction}
        submitLabel={t("bulkSubmitLabel")}
        emptyMessage={t("bulkEmptyMessage")}
      />

      <BulkAllMatchingFilterDialog
        action={bulkEnqueueAllMatchingFilterAction}
        hiddenFields={{
          ...(filter !== "all" ? { scanStatus: filter } : {}),
          ...(fileKind ? { fileKind } : {}),
          ...(createdAfter ? { createdAfter } : {}),
          ...(createdBefore ? { createdBefore } : {}),
          neverScannedOnly: neverScannedOnly ? "true" : "false",
        }}
        label={t("bulkAllLabel")}
        jobTypeLabel={t("bulkAllJobTypeLabel")}
        filterSummary={filterSummary}
        defaultBatchSize={defaultBatchSize}
        estimatedCount={estimatedCount}
      />

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t("recentBatchesTitle")}</h2>
        <JobProgressPoller
          jobType="file_security_rescan"
          initialBatches={batches}
          batchActions={{ pause: pauseBatchAction, resume: resumeBatchAction, cancel: cancelBatchAction, retryFailed: retryFailedInBatchAction }}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t("permanentlyFailedTitle")}</h2>
        <FailedJobList
          jobs={failedJobs}
          retryAction={retryFailedRescanJobAction}
          emptyMessage={t("noPermanentlyFailed")}
        />
      </section>
    </div>
  );
}
