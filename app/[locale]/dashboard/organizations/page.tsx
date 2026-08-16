import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import OrganizationManager from "@/components/dashboard/OrganizationManager";
import { getAllOrganizationsForAdmin } from "@/lib/data/organizations.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("organizations.pageTitle") };
}

export default async function DashboardOrganizationsPage() {
  const organizations = await getAllOrganizationsForAdmin();
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("organizations.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("organizations.subtitle")}
        </p>
      </div>

      {organizations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          {t("organizations.empty")}
        </div>
      ) : (
        <OrganizationManager organizations={organizations} />
      )}
    </div>
  );
}
