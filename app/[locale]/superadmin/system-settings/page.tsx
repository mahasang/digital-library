import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSettings } from "@/lib/data/settings.server";
import { getSessionUser } from "@/lib/supabase/session";
import SystemSettingsForm from "@/components/superadmin/SystemSettingsForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "superadmin" });
  return { title: t("systemSettings.pageTitle") };
}
export const dynamic = "force-dynamic";

export default async function SuperAdminSystemSettingsPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/superadmin/system-settings", locale });

  const t = await getTranslations("superadmin");
  const settings = await getSettings();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("systemSettings.heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("systemSettings.subtitle")}
        </p>
      </div>

      <SystemSettingsForm settings={settings} userId={user.id} />
    </div>
  );
}
