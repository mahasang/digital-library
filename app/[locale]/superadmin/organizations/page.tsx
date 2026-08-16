import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import OrganizationOrderManager from "@/components/superadmin/OrganizationOrderManager";
import { getAllOrganizationsForAdmin } from "@/lib/data/organizations.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("organizations.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function SuperAdminOrganizationsPage() {
  const organizations = await getAllOrganizationsForAdmin();
  const t = await getTranslations("superadmin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("organizations.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("organizations.subtitleBefore")}{" "}
          <Link href="/dashboard/organizations" className="text-accent hover:underline">
            /dashboard/organizations
          </Link>{" "}
          {t("organizations.subtitleAfter")}
        </p>
      </div>

      {organizations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          {t("organizations.empty")}
        </div>
      ) : (
        <OrganizationOrderManager organizations={organizations} />
      )}
    </div>
  );
}
