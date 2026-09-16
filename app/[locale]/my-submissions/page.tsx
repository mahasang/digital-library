export const dynamic = "force-dynamic";
import { Link, redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Calendar, FileText, Plus } from "lucide-react";
import Container from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import StatusBadge from "@/components/research/StatusBadge";
import AccessBadge from "@/components/research/AccessBadge";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getOwnSubmissions } from "@/lib/data/submissions.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mySubmissions");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function MySubmissionsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-12">
        <Container className="max-w-2xl">
          <SupabaseNotConfiguredNotice />
        </Container>
      </div>
    );
  }

  const locale = await getLocale();
  const t = await getTranslations("mySubmissions");
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/my-submissions", locale });

  const submissions = await getOwnSubmissions(user.id);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("subtitle")}
            </p>
          </div>
          <LinkButton href="/submit-research" variant="primary">
            <Plus className="h-4 w-4" />
            {t("newSubmission")}
          </LinkButton>
        </div>

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center">
            <FileText className="h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">{t("emptyTitle")}</p>
            <p className="text-sm text-gray-500">{t("emptyDescription")}</p>
            <LinkButton href="/submit-research" variant="primary" size="sm" className="mt-2">
              <Plus className="h-4 w-4" />
              {t("newSubmission")}
            </LinkButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {submissions.map((item) => (
              <Link
                key={item.id}
                href={`/my-submissions/${item.id}`}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-1 text-sm font-semibold text-gray-900">
                    {item.titleTh}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <AccessBadge accessLevel={item.accessLevel} />
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("updatedAtLabel")}{" "}
                      {new Date(item.updatedAt).toLocaleDateString(locale, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
