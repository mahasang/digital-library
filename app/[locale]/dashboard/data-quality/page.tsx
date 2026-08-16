import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { AlertCircle, Building2, Calendar, Users } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getDataQualityReport, type DataQualityIssueItem } from "@/lib/data/data-quality.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("dataQuality.pageTitle") };
}

export default async function DataQualityPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/data-quality", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const t = await getTranslations("dashboard");
  const report = await getDataQualityReport();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("dataQuality.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("dataQuality.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label={t("dataQuality.authorsMissingOrcid")} value={report.authorsMissingOrcid} icon={Users} />
        <SummaryCard label={t("dataQuality.researchMissingAuthors")} value={report.missingAuthors.length} icon={Users} />
        <SummaryCard label={t("dataQuality.researchMissingOrg")} value={report.missingOrganization.length} icon={Building2} />
      </div>

      <IssueSection
        title={t("dataQuality.issueMissingAuthorsTitle")}
        description={t("dataQuality.issueMissingAuthorsDesc")}
        items={report.missingAuthors}
      />
      <IssueSection
        title={t("dataQuality.issueMissingOrgTitle")}
        description={t("dataQuality.issueMissingOrgDesc")}
        items={report.missingOrganization}
      />
      <IssueSection
        title={t("dataQuality.issueMissingDateTitle")}
        description={t("dataQuality.issueMissingDateDesc")}
        items={report.missingPublishedDate}
        icon={Calendar}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString("th-TH")}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

async function IssueSection({
  title,
  description,
  items,
  icon: Icon = AlertCircle,
}: {
  title: string;
  description: string;
  items: DataQualityIssueItem[];
  icon?: typeof AlertCircle;
}) {
  const t = await getTranslations("dashboard");

  return (
    <section className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">
          {title} <span className="ml-1 font-normal text-gray-500">({items.length})</span>
        </h2>
      </div>
      <p className="mb-3 text-xs text-gray-500">{description}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{t("dataQuality.noItems")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/research/${item.id}/edit`}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <span className="line-clamp-1 text-gray-700">{item.titleTh}</span>
              <span className="shrink-0 text-xs text-gray-500">{item.status}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
