export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AuthFormShell from "@/components/auth/AuthFormShell";
import SetupMfaForm from "@/components/auth/SetupMfaForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setupMfa");
  return { title: t("pageTitle") };
}

export default async function SetupMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("setupMfa");
  const redirectTo =
    typeof params.redirect === "string" && params.redirect.startsWith("/")
      ? params.redirect
      : "/superadmin/overview";

  return (
    <AuthFormShell
      title={t("formTitle")}
      description={t("formDescription")}
    >
      <SetupMfaForm redirectTo={redirectTo} />
    </AuthFormShell>
  );
}
