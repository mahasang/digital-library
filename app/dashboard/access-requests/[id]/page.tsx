import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar, FileText, Mail, Target, User } from "lucide-react";
import Badge from "@/components/ui/Badge";
import AccessBadge from "@/components/research/AccessBadge";
import AccessRequestActionsPanel from "@/components/dashboard/AccessRequestActionsPanel";
import RevokeGrantButton from "@/components/dashboard/RevokeGrantButton";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import {
  getAccessRequestDetailForStaff,
  getGrantsForUserAndItem,
  getPriorRequestsForRequesterAndItem,
} from "@/lib/data/access-requests-admin.server";
import { accessRequestStatusLabels, accessRequestTypeLabels } from "@/lib/labels";
import type { AccessRequestStatus } from "@/types/research";

export const metadata: Metadata = { title: "รายละเอียดคำขอเข้าถึงเอกสาร" };

const OPEN_STATUSES: AccessRequestStatus[] = ["pending", "under_review", "more_information_required"];

const STATUS_TONE: Record<AccessRequestStatus, "brand" | "green" | "amber" | "red" | "gray" | "purple"> = {
  pending: "amber",
  under_review: "amber",
  approved: "green",
  rejected: "red",
  more_information_required: "purple",
  cancelled: "gray",
  expired: "gray",
};

export default async function AccessRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/dashboard/access-requests/${id}`);

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const request = await getAccessRequestDetailForStaff(id);
  if (!request) notFound();

  const [priorRequests, grants] = await Promise.all([
    getPriorRequestsForRequesterAndItem(request.requesterId, request.researchItemId, request.id),
    getGrantsForUserAndItem(request.researchItemId, request.requesterId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/access-requests"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายการคำขอเข้าถึงเอกสาร
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[request.status]}>{accessRequestStatusLabels[request.status]}</Badge>
        <Badge tone="gray">{accessRequestTypeLabels[request.requestType]}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <FileText className="h-4 w-4 text-accent" />
              เอกสารที่ขอเข้าถึง
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href={`/research/${request.researchSlug}`}
                target="_blank"
                className="text-sm font-medium text-accent hover:underline"
              >
                {request.researchTitleTh}
              </Link>
              <AccessBadge accessLevel={request.researchAccessLevel} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <User className="h-4 w-4 text-accent" />
              ผู้ขอ
            </h2>
            <p className="text-sm text-gray-900">{request.requesterName}</p>
            <p className="flex items-center gap-1 text-xs text-gray-500">
              <Mail className="h-3 w-3" />
              {request.requesterEmail}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <Target className="h-4 w-4 text-accent" />
              วัตถุประสงค์การใช้งาน
            </h2>
            <p className="text-sm leading-relaxed text-gray-700">{request.purpose}</p>
            {request.requesterNote && (
              <>
                <h3 className="mb-1 mt-3 text-xs font-semibold text-gray-500">รายละเอียดเพิ่มเติม</h3>
                <p className="text-sm leading-relaxed text-gray-600">{request.requesterNote}</p>
              </>
            )}
            {request.reviewerNote && (
              <>
                <h3 className="mb-1 mt-3 text-xs font-semibold text-gray-500">หมายเหตุจากเจ้าหน้าที่ล่าสุด</h3>
                <p className="text-sm leading-relaxed text-blue-700">{request.reviewerNote}</p>
              </>
            )}
          </div>

          {grants.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">สิทธิ์ที่เคยออกให้ผู้ใช้นี้สำหรับเอกสารนี้</h2>
              <div className="flex flex-col gap-2">
                {grants.map((grant) => {
                  const isActive =
                    !grant.revokedAt && (!grant.expiresAt || new Date(grant.expiresAt) > new Date());
                  return (
                    <div
                      key={grant.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Badge tone={isActive ? "green" : "gray"}>
                          {accessRequestTypeLabels[grant.accessType]}
                        </Badge>
                        <span className="text-gray-500">
                          {grant.revokedAt
                            ? "ถูกเพิกถอนแล้ว"
                            : grant.expiresAt
                              ? `หมดอายุ ${new Date(grant.expiresAt).toLocaleDateString("th-TH")}`
                              : "ถาวร"}
                        </span>
                      </span>
                      {isActive && <RevokeGrantButton grantId={grant.id} requestId={request.id} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {priorRequests.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-surface p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <Calendar className="h-4 w-4 text-accent" />
                ประวัติคำขอเดิมของผู้ใช้นี้สำหรับเอกสารนี้
              </h2>
              <div className="flex flex-col gap-2">
                {priorRequests.map((prior) => (
                  <div key={prior.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {accessRequestTypeLabels[prior.requestType]} —{" "}
                      {accessRequestStatusLabels[prior.status]}
                    </span>
                    <span className="text-gray-500">
                      {new Date(prior.createdAt).toLocaleDateString("th-TH")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {OPEN_STATUSES.includes(request.status) ? (
            <AccessRequestActionsPanel requestId={request.id} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-surface p-5 text-sm text-gray-500">
              คำขอนี้ถูกตรวจสอบเรียบร้อยแล้ว ({accessRequestStatusLabels[request.status]})
              {request.reviewedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  เมื่อ {new Date(request.reviewedAt).toLocaleString("th-TH")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
