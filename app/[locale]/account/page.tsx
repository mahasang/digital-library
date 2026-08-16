import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { Bell, FileQuestion, Mail, ShieldCheck, UserCircle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import AccountShell from "@/components/account/AccountShell";
import ProfileForm from "@/components/auth/ProfileForm";
import LogoutButton from "@/components/auth/LogoutButton";
import MfaSettings from "@/components/account/MfaSettings";
import OrcidConnect from "@/components/account/OrcidConnect";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRole } from "@/lib/supabase/roles";
import { getMyOrcidStatus } from "@/lib/data/orcid-profile.server";
import { isOrcidOAuthConfigured } from "@/lib/orcid/orcid-oauth.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("pageTitle"), description: t("pageDescription") };
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ orcid?: string; reason?: string }>;
}) {
  const locale = await getLocale();

  if (!isSupabaseConfigured()) {
    return redirect({ href: "/login", locale });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect({ href: "/login?redirect=/account", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organization_name, email")
    .eq("id", user.id)
    .single();

  const role = await getCurrentUserRole();
  const params = await searchParams;
  const orcidStatus = await getMyOrcidStatus();
  const orcidConfigured = isOrcidOAuthConfigured();
  const t = await getTranslations("account");
  const tRoles = await getTranslations("roles");

  return (
    <AccountShell>
      <h1 className="text-h1 font-semibold text-gray-900">{t("heading")}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("subtitle")}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-surface p-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <UserCircle className="h-9 w-9" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {profile?.full_name || t("noName")}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
                <Mail className="h-3.5 w-3.5" />
                {profile?.email ?? user.email}
              </p>
            </div>
            <Badge tone="brand">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tRoles(role)}
            </Badge>
            <LogoutButton className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-surface p-4">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("quickLinks")}
            </p>
            <Link
              href="/access-requests"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileQuestion className="h-4 w-4 text-gray-500" />
              {t("myAccessRequests")}
            </Link>
            <Link
              href="/profile/notification-settings"
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Bell className="h-4 w-4 text-gray-500" />
              {t("notificationSettings")}
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-200 bg-surface p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("editProfile")}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {t("editProfileNote")}
            </p>
            <div className="mt-4">
              <ProfileForm
                defaultFullName={profile?.full_name ?? ""}
                defaultOrganization={profile?.organization_name ?? ""}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-surface p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("mfaSection")}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {t("mfaNote")}
            </p>
            <div className="mt-4">
              <MfaSettings isSuperAdmin={role === "super_admin"} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-surface p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("orcidSection")}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {t("orcidNote")}
            </p>
            <div className="mt-4">
              <OrcidConnect
                status={orcidStatus}
                isConfigured={orcidConfigured}
                redirectStatus={params.orcid}
                redirectReason={params.reason}
              />
            </div>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
