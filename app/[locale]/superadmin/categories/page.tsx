import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CategoryOrderManager from "@/components/superadmin/CategoryOrderManager";
import { getAllCategoriesForAdmin } from "@/lib/data/categories.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("categories.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function SuperAdminCategoriesPage() {
  const categories = await getAllCategoriesForAdmin();
  const t = await getTranslations("superadmin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("categories.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("categories.subtitleBefore")}{" "}
          <Link href="/dashboard/categories" className="text-accent hover:underline">
            /dashboard/categories
          </Link>{" "}
          {t("categories.subtitleAfter")}
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          {t("categories.empty")}
        </div>
      ) : (
        <CategoryOrderManager categories={categories} />
      )}
    </div>
  );
}
