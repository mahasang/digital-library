import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/ui/Container";
import SubmissionDetailView from "@/components/submission/SubmissionDetailView";
import ApprovalActions from "@/components/dashboard/ApprovalActions";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getApprovalLogs, getSubmissionById } from "@/lib/data/submissions.server";
import {
  getResearchDocumentPreviewUrl,
  getAttachmentPreviewUrl,
} from "@/lib/storage/signed-url.server";

export const metadata: Metadata = { title: "ตรวจสอบงานวิจัย" };

export default async function ApprovalDetailPage({
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
  if (!user) redirect(`/login?redirect=/dashboard/approvals/${id}`);

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const item = await getSubmissionById(id);
  if (!item) notFound();

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
          href="/dashboard/approvals"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้าอนุมัติงานวิจัย
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <SubmissionDetailView
            item={item}
            logs={logs}
            documentUrl={documentPreview.url}
            attachmentUrl={attachmentPreview.url}
          />
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ApprovalActions researchId={item.id} status={item.status} />
          </div>
        </div>
      </Container>
    </div>
  );
}
