import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import AuthFormShell from "@/components/auth/AuthFormShell";
import LoginForm from "@/components/auth/LoginForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string;
    confirmed?: string;
    reset?: string;
    timeout?: string;
  }>;
}) {
  const t = await getTranslations("login");
  const params = await searchParams;
  const redirectTo =
    typeof params.redirect === "string" && params.redirect.startsWith("/")
      ? params.redirect
      : "/";

  return (
    <AuthFormShell
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            {t("registerLink")}
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <>
          {params.confirmed === "1" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("confirmedEmail")}</p>
            </div>
          )}
          {params.timeout === "1" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("sessionTimeout")}</p>
            </div>
          )}
          {params.reset === "success" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("passwordResetSuccess")}</p>
            </div>
          )}
          <LoginForm redirectTo={redirectTo} />
        </>
      )}
    </AuthFormShell>
  );
}
