import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/ui/Container";
import SubmitResearchForm from "@/components/submission/SubmitResearchForm";
import SubmissionDetailView from "@/components/submission/SubmissionDetailView";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getOrganizations } from "@/lib/data/organizations.server";
import { getCategories } from "@/lib/data/categories.server";
import { getSettings } from "@/lib/data/settings.server";
import { getApprovalLogs, getSubmissionById } from "@/lib/data/submissions.server";
import {
  getResearchDocumentPreviewUrl,
  getAttachmentPreviewUrl,
} from "@/lib/storage/signed-url.server";
import { updateSubmissionAction } from "@/app/[locale]/my-submissions/[id]/actions";

export const metadata: Metadata = { title: "รายละเอียดงานวิจัยที่ส่ง" };

const EDITABLE_STATUSES = ["draft", "revision_requested"];

export default async function MySubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/my-submissions/${id}`);

  const item = await getSubmissionById(id);
  if (!item) notFound();

  const isOwner = item.submittedBy === user.id;
  const isEditable = isOwner && EDITABLE_STATUSES.includes(item.status);

  if (isEditable) {
    const [organizations, categories, settings] = await Promise.all([
      getOrganizations(),
      getCategories(),
      getSettings(),
    ]);
    return (
      <div className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <Link
            href="/my-submissions"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับไปรายการงานวิจัยของฉัน
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">แก้ไขงานวิจัย</h1>
          <p className="mt-1 text-sm text-gray-500">
            {item.status === "revision_requested"
              ? "บรรณารักษ์ขอให้แก้ไขงานวิจัยนี้ก่อนส่งตรวจสอบอีกครั้ง"
              : "แก้ไขข้อมูลฉบับร่างแล้วบันทึกหรือส่งตรวจสอบได้ตามต้องการ"}
          </p>
          <div className="mt-8">
            <SubmitResearchForm
              userId={user.id}
              organizations={organizations}
              categories={categories}
              submitAction={updateSubmissionAction}
              initialData={item}
              researchId={item.id}
              fileLimits={{
                maxPdfSizeMb: settings.maxPdfSizeMb,
                maxCoverSizeMb: settings.maxCoverSizeMb,
                maxAttachmentSizeMb: settings.maxAttachmentSizeMb,
              }}
            />
          </div>
        </Container>
      </div>
    );
  }

  const [logs, documentPreview, attachmentPreview] = await Promise.all([
    getApprovalLogs(item.id),
    getResearchDocumentPreviewUrl(item.pdfFile),
    item.attachmentFile
      ? getAttachmentPreviewUrl(item.attachmentFile)
      : Promise.resolve({ url: null, error: null }),
  ]);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <Link
          href="/my-submissions"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปรายการงานวิจัยของฉัน
        </Link>

        <SubmissionDetailView
          item={item}
          logs={logs}
          documentUrl={documentPreview.url}
          attachmentUrl={attachmentPreview.url}
        />
      </Container>
    </div>
  );
}
