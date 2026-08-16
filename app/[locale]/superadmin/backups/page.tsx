import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DatabaseBackup, HelpCircle, BookOpen } from "lucide-react";
import { getBackupStatus } from "@/lib/data/superadmin-stats.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("backups.pageTitle") };
}

export default async function SuperAdminBackupsPage() {
  const status = getBackupStatus();
  const t = await getTranslations("superadmin.backups");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
            <DatabaseBackup className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{t("latestStatusTitle")}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                <HelpCircle className="h-3 w-3" />
                {t("unavailableBadge")}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{t(status.reasonKey)}</p>
            <p className="mt-1 text-sm text-gray-600">{t(status.guidanceKey)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              {t("fullGuideTitle")}
            </p>
            <p className="mt-1 text-sm text-blue-700">
              {t("fullGuideDescBefore")}{" "}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs">pg_dump</code>
              {t("fullGuideDescMiddle")}{" "}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs">
                docs/backup-and-recovery.md
              </code>{" "}
              {t("fullGuideDescAfter")}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{t("noBackupButtonTitle")}</h2>
        <p className="text-sm text-gray-600">
          {t("noBackupButtonDesc")}
        </p>
      </section>
    </div>
  );
}
