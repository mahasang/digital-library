import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import SubmitResearchForm from "@/components/submission/SubmitResearchForm";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getOrganizations } from "@/lib/data/organizations.server";
import { getCategories } from "@/lib/data/categories.server";
import { getSettings } from "@/lib/data/settings.server";
import { adminCreateResearchAction } from "@/app/[locale]/dashboard/research/new/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.research.new" });
  return { title: t("pageTitle") };
}

export default async function DashboardNewResearchPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/research/new", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const [organizations, categories, settings] = await Promise.all([
    getOrganizations(),
    getCategories(),
    getSettings(),
  ]);

  const t = await getTranslations("dashboard.research.new");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/research"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backLink")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <SubmitResearchForm
        userId={user.id}
        organizations={organizations}
        categories={categories}
        submitAction={adminCreateResearchAction}
        extraIntents={[{ value: "published", label: t("publishNowIntent") }]}
        fileLimits={{
          maxPdfSizeMb: settings.maxPdfSizeMb,
          maxCoverSizeMb: settings.maxCoverSizeMb,
          maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
        }}
      />
    </div>
  );
}
