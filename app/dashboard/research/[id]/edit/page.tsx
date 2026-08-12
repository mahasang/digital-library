import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
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
import { adminUpdateResearchAction } from "@/app/dashboard/research/[id]/edit/actions";

export const metadata: Metadata = { title: "แก้ไขงานวิจัย" };

export default async function DashboardEditResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/dashboard/research/${id}/edit`);

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const item = await getSubmissionById(id);
  if (!item) notFound();

  const [organizations, categories, settings, extraction] = await Promise.all([
    getOrganizations(),
    getCategories(),
    getSettings(),
    getExtractionStatus(item.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/research"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปจัดการงานวิจัย
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">แก้ไขงานวิจัย</h1>
        <p className="mt-1 text-sm text-gray-500">
          แก้ไขข้อมูล เปลี่ยนสิทธิ์การเข้าถึง หรือเผยแพร่ได้โดยตรง (Librarian/Admin)
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
        extraIntents={[{ value: "published", label: "เผยแพร่" }]}
        fileLimits={{
          maxPdfSizeMb: settings.maxPdfSizeMb,
          maxCoverSizeMb: settings.maxCoverSizeMb,
          maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
        }}
      />
    </div>
  );
}
