import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SubmitResearchForm from "@/components/submission/SubmitResearchForm";
import ExtractionStatusCard from "@/components/dashboard/ExtractionStatusCard";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getOrganizations } from "@/lib/data/organizations.server";
import { getCategories } from "@/lib/data/categories.server";
import { getSettings } from "@/lib/data/settings.server";
import { getSubmissionById } from "@/lib/data/submissions.server";
import { getExtractionStatus } from "@/lib/pdf/extraction-status.server";
import { adminUpdateResearchAction } from "@/app/[locale]/dashboard/research/[id]/edit/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.research.edit" });
  return { title: t("pageTitle") };
}

export default async function DashboardEditResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: `/login?redirect=/dashboard/research/${id}/edit`, locale });

  // rank ไม่ขึ้นกับ item (และในทางกลับกัน) — ยิงพร้อมกันได้ (Phase 3 — parallel
  // data fetching) แม้ user อาจไม่มีสิทธิ์พอ ก็เป็นแค่ query ที่ทำงานเกินความ
  // จำเป็นเล็กน้อยในกรณีนั้น ไม่ใช่ปัญหาความปลอดภัย เพราะยังตรวจ rank ก่อน
  // redirect เหมือนเดิมทุกประการก่อนใช้ข้อมูลของ item ต่อ
  const [rank, item] = await Promise.all([getCurrentUserRoleRank(), getSubmissionById(id)]);
  if (rank < 30) return redirect({ href: "/403", locale });
  if (!item) notFound();

  const [organizations, categories, settings, extraction] = await Promise.all([
    getOrganizations(),
    getCategories(),
    getSettings(),
    getExtractionStatus(item.id),
  ]);

  const t = await getTranslations("dashboard.research.edit");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/research"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backLink")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <ExtractionStatusCard
        researchId={item.id}
        status={extraction?.status ?? null}
        extractedAt={extraction?.extractedAt ?? null}
        errorMessage={extraction?.errorMessage ?? null}
        ocrStatus={extraction?.ocrStatus}
        ocrErrorMessage={extraction?.ocrErrorMessage}
        ocrProcessedAt={extraction?.ocrProcessedAt}
        ocrProvider={extraction?.ocrProvider}
        ocrConfidence={extraction?.ocrConfidence}
      />

      <SubmitResearchForm
        userId={user.id}
        organizations={organizations}
        categories={categories}
        submitAction={adminUpdateResearchAction}
        initialData={item}
        researchId={item.id}
        extraIntents={[{ value: "published", label: t("publishIntent") }]}
        fileLimits={{
          maxPdfSizeMb: settings.maxPdfSizeMb,
          maxCoverSizeMb: settings.maxCoverSizeMb,
          maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
        }}
      />
    </div>
  );
}
