export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AuthFormShell from "@/components/auth/AuthFormShell";
import MfaChallengeForm from "@/components/auth/MfaChallengeForm";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect-target";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mfaChallenge");
  return { title: t("pageTitle") };
}

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("mfaChallenge");
  const redirectTo = sanitizeRedirectTarget(params.redirect, "/superadmin/overview");

  return (
    <AuthFormShell
      title={t("formTitle")}
      description={t("formDescription")}
    >
      <MfaChallengeForm redirectTo={redirectTo} />
    </AuthFormShell>
  );
}
