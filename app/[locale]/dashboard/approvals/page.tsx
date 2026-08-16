import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Calendar, ClipboardList, Users } from "lucide-react";
import Container from "@/components/ui/Container";
import StatusBadge from "@/components/research/StatusBadge";
import AccessBadge from "@/components/research/AccessBadge";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getSubmissionsByStatus } from "@/lib/data/submissions.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return {
    title: t("approvals.pageTitle"),
    description: t("approvals.pageDescription"),
  };
}

export default async function ApprovalsDashboardPage() {
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
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/approvals", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const t = await getTranslations("dashboard");
  const [pending, revisionRequested, approved] = await Promise.all([
    getSubmissionsByStatus(["pending_review"]),
    getSubmissionsByStatus(["revision_requested"]),
    getSubmissionsByStatus(["approved"]),
  ]);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("approvals.heading")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("approvals.subtitle")}
          </p>
        </div>

        <ApprovalSection
          title={t("approvals.sectionPending")}
          description={t("approvals.sectionPendingDesc")}
          items={pending}
        />
        <ApprovalSection
          title={t("approvals.sectionRevision")}
          description={t("approvals.sectionRevisionDesc")}
          items={revisionRequested}
        />
        <ApprovalSection
          title={t("approvals.sectionApproved")}
          description={t("approvals.sectionApprovedDesc")}
          items={approved}
        />
      </Container>
    </div>
  );
}

async function ApprovalSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Awaited<ReturnType<typeof getSubmissionsByStatus>>;
}) {
  const t = await getTranslations("dashboard");

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-gray-900">
          {title} <span className="ml-1 text-sm font-normal text-gray-500">({items.length})</span>
        </h2>
      </div>
      <p className="mb-4 text-sm text-gray-500">{description}</p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center text-sm text-gray-500">
          {t("approvals.emptySection")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/approvals/${item.id}`}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">
                  {item.titleTh}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <AccessBadge accessLevel={item.accessLevel} />
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    {item.researchers.map((r) => r.name).join(", ") || t("approvals.noResearcher")}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(item.updatedAt).toLocaleDateString("th-TH", {
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
    </section>
  );
}
