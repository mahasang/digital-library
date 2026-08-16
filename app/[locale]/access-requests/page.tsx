import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { FileQuestion } from "lucide-react";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import StatusFilterSelect from "@/components/access-requests/StatusFilterSelect";
import CancelRequestButton from "@/components/access-requests/CancelRequestButton";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getMyAccessRequests } from "@/lib/data/access-requests.server";
import type { AccessRequestStatus } from "@/types/research";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "myAccessRequestsPage" });
  return { title: t("pageTitle"), description: t("pageDescription") };
}

const VALID_STATUSES: AccessRequestStatus[] = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "more_information_required",
  "cancelled",
  "expired",
];

const STATUS_TONE: Record<AccessRequestStatus, "brand" | "green" | "amber" | "red" | "gray" | "purple"> = {
  pending: "amber",
  under_review: "amber",
  approved: "green",
  rejected: "red",
  more_information_required: "purple",
  cancelled: "gray",
  expired: "gray",
};

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
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
  if (!user) return redirect({ href: "/login?redirect=/access-requests", locale });

  const { status: statusRaw } = await searchParams;
  const status = VALID_STATUSES.includes(statusRaw as AccessRequestStatus)
    ? (statusRaw as AccessRequestStatus)
    : undefined;

  const requests = await getMyAccessRequests(status);
  const t = await getTranslations("myAccessRequestsPage");
  const tStatuses = await getTranslations("accessRequestStatuses");
  const tTypes = await getTranslations("accessRequestTypes");
  const dateLocale = locale === "en" ? "en-US" : "th-TH";

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("subtitle")}
            </p>
          </div>
          <StatusFilterSelect basePath="/access-requests" currentStatus={status ?? ""} />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center">
              <FileQuestion className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">{t("emptyTitle")}</p>
              <p className="text-sm text-gray-500">
                {t("emptyDesc")}
              </p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[req.status]}>{tStatuses(req.status)}</Badge>
                    <Badge tone="gray">{tTypes(req.requestType)}</Badge>
                  </div>
                  <Link
                    href={`/research/${req.researchSlug}`}
                    className="text-sm font-semibold text-gray-900 hover:text-brand-700"
                  >
                    {req.researchTitleTh}
                  </Link>
                  <p className="text-xs text-gray-500">{t("purposeLabel", { purpose: req.purpose })}</p>
                  {req.reviewerNote && (
                    <p className="text-xs text-blue-700">{t("reviewerNoteLabel", { note: req.reviewerNote })}</p>
                  )}
                  {req.status === "approved" && (
                    <p className="text-xs text-green-700">
                      {req.accessExpiresAt
                        ? t("accessExpiresOn", { date: new Date(req.accessExpiresAt).toLocaleDateString(dateLocale) })
                        : t("accessNoExpiry")}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {t("submittedOn", { date: new Date(req.createdAt).toLocaleDateString(dateLocale) })}
                  </p>
                </div>
                {req.status === "pending" && <CancelRequestButton requestId={req.id} />}
              </div>
            ))
          )}
        </div>
      </Container>
    </div>
  );
}
