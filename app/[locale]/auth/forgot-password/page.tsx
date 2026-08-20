import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AuthFormShell from "@/components/auth/AuthFormShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return {
    title: t("forgotPasswordTitle"),
    description: t("forgotPasswordDescription"),
  };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthFormShell
      title={t("forgotPasswordTitle")}
      description={t("forgotPasswordDescription")}
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("backToLogin")}
        </Link>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <ForgotPasswordForm />
      )}
    </AuthFormShell>
  );
}
