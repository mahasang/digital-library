import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { HardDrive, Info, FileX2 } from "lucide-react";
import { getStorageUsage, getOrphanedFiles } from "@/lib/data/superadmin-stats.server";
import OrphanedFileRow from "@/components/superadmin/OrphanedFileRow";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("storage.pageTitle") };
}
export const dynamic = "force-dynamic";

const BUCKETS = ["research-documents", "research-covers", "submission-attachments"] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function SuperAdminStoragePage() {
  const [usageResult, ...orphanResults] = await Promise.all([
    getStorageUsage(),
    ...BUCKETS.map((b) => getOrphanedFiles(b)),
  ]);
  const locale = await getLocale();
  const t = await getTranslations("superadmin.storage");

  const BUCKET_LABELS: Record<(typeof BUCKETS)[number], string> = {
    "research-documents": t("bucketLabels.researchDocuments"),
    "research-covers": t("bucketLabels.researchCovers"),
    "submission-attachments": t("bucketLabels.submissionAttachments"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <Panel icon={HardDrive} title={t("usageTitle")}>
        {!usageResult.available ? (
          <EmptyState tone="unavailable" title={t("unavailableTitle")} description={t("unavailableDesc")} compact />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {usageResult.data.map((b) => (
              <div key={b.bucketId} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{b.bucketId}</p>
                <p
                  className={`mt-0.5 text-lg font-bold ${b.totalBytes === 0 ? "text-gray-500" : "text-gray-900"}`}
                >
                  {formatBytes(b.totalBytes)}
                </p>
                <p className="text-xs text-gray-500">{t("filesCount", { count: b.objectCount.toLocaleString(locale === "en" ? "en-US" : "th-TH") })}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t("orphanedInfo")}
        </p>
      </div>

      {BUCKETS.map((bucketId, i) => {
        const result = orphanResults[i];
        return (
          <Panel key={bucketId}>
            <h2 className="mb-1 text-sm font-semibold text-gray-900">
              {BUCKET_LABELS[bucketId]}
            </h2>
            <p className="mb-4 text-xs text-gray-500">{bucketId}</p>
            {!result.available ? (
              <EmptyState tone="unavailable" title={t("bucketUnavailable")} compact />
            ) : result.data.length === 0 ? (
              <EmptyState icon={FileX2} title={t("noOrphanedTitle")} description={t("noOrphanedDesc")} compact />
            ) : (
              <ul className="flex flex-col">
                {result.data.map((file) => (
                  <OrphanedFileRow key={file.name} bucketId={bucketId} file={file} />
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
