import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import Badge from "@/components/ui/Badge";
import StatusBadge from "@/components/research/StatusBadge";
import AuthorEditForm from "@/components/dashboard/AuthorEditForm";
import {
  OrcidPanel,
  OrcidApiCheckPanel,
  AuthorActiveToggle,
  MergeAuthorDialog,
  LinkProfilePanel,
} from "@/components/dashboard/AuthorSidebarActions";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAuthorDetailForAdmin, getActiveAuthorOptions } from "@/lib/data/authors-admin.server";
import { getOrganizations } from "@/lib/data/organizations.server";
import { isOrcidPublicApiConfigured } from "@/lib/orcid/orcid-public-api.server";

export const metadata: Metadata = { title: "รายละเอียดผู้วิจัย" };

const AUTHOR_ROLE_LABELS: Record<string, string> = {
  principal_investigator: "ผู้วิจัยหลัก",
  co_investigator: "ผู้ร่วมวิจัย",
};

export default async function AuthorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/dashboard/authors/${id}`);

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const [author, organizations, mergeCandidates] = await Promise.all([
    getAuthorDetailForAdmin(id),
    getOrganizations(),
    getActiveAuthorOptions(id),
  ]);

  if (!author) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/authors"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายการผู้วิจัย
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{author.name}</h1>
        <Badge tone={author.isActive ? "green" : "gray"}>{author.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge>
        {author.mergedIntoAuthorId && <Badge tone="gray">ถูกรวมข้อมูลแล้ว</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <AuthorEditForm author={author} organizations={organizations} />

          <div className="rounded-xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <FileText className="h-4 w-4 text-accent" />
              งานวิจัยของผู้วิจัยคนนี้ ({author.researchItems.length})
            </h2>
            {author.researchItems.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีงานวิจัย</p>
            ) : (
              <div className="flex flex-col gap-2">
                {author.researchItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/research/${item.id}/edit`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <span className="flex items-center gap-2">
                      <StatusBadge status={item.status} />
                      {item.titleTh}
                    </span>
                    <span className="text-xs text-gray-500">
                      {AUTHOR_ROLE_LABELS[item.authorRole] ?? item.authorRole} · {item.year}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">ORCID</h2>
            <OrcidPanel
              authorId={author.id}
              orcid={author.orcid}
              orcidVerifiedAt={author.orcidVerifiedAt}
              orcidOauthVerifiedAt={author.orcidOauthVerifiedAt}
            />
            <OrcidApiCheckPanel
              authorId={author.id}
              orcid={author.orcid}
              displayNameEn={author.displayNameEn}
              orcidApiCheckedAt={author.orcidApiCheckedAt}
              orcidApiPublicName={author.orcidApiPublicName}
              isConfigured={isOrcidPublicApiConfigured()}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">บัญชีผู้ใช้ที่เชื่อมไว้</h2>
            <LinkProfilePanel
              authorId={author.id}
              linkedProfileEmail={author.linkedProfileEmail}
              linkedProfileName={author.linkedProfileName}
            />
          </div>

          {author.organizationName && !author.organizationId && (
            <div className="rounded-xl border border-gray-200 bg-surface p-5 text-sm text-gray-600">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <Mail className="h-3.5 w-3.5" />
                หน่วยงาน (ข้อความอิสระจากฟอร์มส่งงานวิจัยเดิม)
              </p>
              {author.organizationName}
            </div>
          )}

          {!author.mergedIntoAuthorId && (
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-surface p-5">
              <h2 className="text-sm font-semibold text-gray-900">การจัดการ</h2>
              <AuthorActiveToggle authorId={author.id} isActive={author.isActive} />
              <MergeAuthorDialog authorId={author.id} authorName={author.name} candidates={mergeCandidates} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
