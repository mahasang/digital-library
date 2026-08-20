import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AlertTriangle } from "lucide-react";
import AuthFormShell from "@/components/auth/AuthFormShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("resetPasswordTitle") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  const configured = isSupabaseConfigured();
  let hasRecoverySession = false;

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasRecoverySession = Boolean(user);
  }

  return (
    <AuthFormShell
      title={t("resetPasswordTitle")}
      description={t("resetPasswordDescription")}
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("backToLogin")}
        </Link>
      }
    >
      {!configured ? (
        <SupabaseNotConfiguredNotice />
      ) : !hasRecoverySession ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">
            {t("resetLinkExpiredTitle")}
          </p>
          <p className="text-xs leading-relaxed text-amber-700">
            {t("resetLinkExpiredDescription")}{" "}
            <Link href="/auth/forgot-password" className="underline">
              {t("resetLinkForgotPasswordLink")}
            </Link>
          </p>
        </div>
      ) : (
        <ResetPasswordForm />
      )}
    </AuthFormShell>
  );
}
