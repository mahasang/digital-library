export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/ui/Container";
import SubmissionDetailView from "@/components/submission/SubmissionDetailView";
import ApprovalActions from "@/components/dashboard/ApprovalActions";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getScanOverrideDecision } from "@/lib/submission/scan-override.server";
import { SCAN_OVERRIDE_MIN_RANK } from "@/lib/submission/scan-override";
import { canApproveAndPublish } from "@/lib/approvals/approve-flow";
import { getApprovalLogs, getSubmissionById } from "@/lib/data/submissions.server";
import {
  getResearchDocumentPreviewUrl,
  getAttachmentPreviewUrl,
} from "@/lib/storage/signed-url.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.approvals.detail" });
  return { title: t("pageTitle") };
}

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
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: `/login?redirect=/dashboard/approvals/${id}`, locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const item = await getSubmissionById(id);
  if (!item) notFound();

  const [logs, documentPreview, attachmentPreview] = await Promise.all([
    getApprovalLogs(item.id),
    getResearchDocumentPreviewUrl(item.pdfFile),
    item.attachmentFile
      ? getAttachmentPreviewUrl(item.attachmentFile)
      : Promise.resolve({ url: null, error: null }),
  ]);

  const t = await getTranslations("dashboard.approvals.detail");

  // ปุ่ม "เผยแพร่โดยยืนยันเอง" — admin ขึ้นไปเท่านั้น (server action ตัดสินซ้ำอีกครั้ง)
  let scanOverride:
    | { available: true; scanStatus: "pending" | "error" }
    | { available: false; waitMinutes?: number }
    | undefined;
  if (rank >= SCAN_OVERRIDE_MIN_RANK) {
    const decision = await getScanOverrideDecision({
      id: item.id,
      status: item.status,
      scanStatus: item.scanStatus,
    });
    scanOverride = decision.allowed
      ? { available: true, scanStatus: decision.scanStatus }
      : { available: false, waitMinutes: decision.waitMinutes };
  }

  // ปุ่ม "อนุมัติและเผยแพร่" — ขึ้นเฉพาะงานที่ไฟล์สแกนผ่านแล้ว (server action ตัดสินซ้ำอีกครั้ง)
  const approveAndPublishAllowed = canApproveAndPublish({
    status: item.status,
    scanStatus: item.scanStatus,
  }).allowed;

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <Link
          href="/dashboard/approvals"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backLink")}
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <SubmissionDetailView
            item={item}
            logs={logs}
            documentUrl={documentPreview.url}
            attachmentUrl={attachmentPreview.url}
          />
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ApprovalActions
              researchId={item.id}
              status={item.status}
              canApproveAndPublish={approveAndPublishAllowed}
              scanOverride={scanOverride}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
