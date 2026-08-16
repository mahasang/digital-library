import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getSettings } from "@/lib/data/settings.server";
import SettingsForm from "@/components/dashboard/SettingsForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("settings.pageTitle") };
}

export default async function DashboardSettingsPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/settings", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) return redirect({ href: "/403", locale });

  const t = await getTranslations("dashboard");
  const settings = await getSettings();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("settings.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("settings.subtitle")}
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
