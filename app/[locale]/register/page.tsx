import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AuthFormShell from "@/components/auth/AuthFormShell";
import RegisterForm from "@/components/auth/RegisterForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isCaptchaConfigured } from "@/lib/captcha.server";
import { getSettings } from "@/lib/data/settings.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "register" });
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function RegisterPage() {
  const t = await getTranslations("register");
  const settings = isSupabaseConfigured() ? await getSettings() : null;
  const captchaSiteKey =
    settings?.captchaEnabled && isCaptchaConfigured()
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  return (
    <AuthFormShell
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            {t("loginLink")}
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <RegisterForm captchaSiteKey={captchaSiteKey} />
      )}
    </AuthFormShell>
  );
}
