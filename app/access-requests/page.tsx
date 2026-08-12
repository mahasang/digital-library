import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import StatusFilterSelect from "@/components/access-requests/StatusFilterSelect";
import CancelRequestButton from "@/components/access-requests/CancelRequestButton";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getMyAccessRequests } from "@/lib/data/access-requests.server";
import { accessRequestStatusLabels, accessRequestTypeLabels } from "@/lib/labels";
import type { AccessRequestStatus } from "@/types/research";

export const metadata: Metadata = {
  title: "คำขอเข้าถึงเอกสารของฉัน",
  description: "ติดตามสถานะคำขอเข้าถึง/ดาวน์โหลดเอกสารที่คุณส่งไป",
};

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

  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/access-requests");

  const { status: statusRaw } = await searchParams;
  const status = VALID_STATUSES.includes(statusRaw as AccessRequestStatus)
    ? (statusRaw as AccessRequestStatus)
    : undefined;

  const requests = await getMyAccessRequests(status);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">คำขอเข้าถึงเอกสารของฉัน</h1>
            <p className="mt-1 text-sm text-gray-500">
              ติดตามสถานะคำขออ่าน/ดาวน์โหลดเอกสารที่คุณส่งไปยังเจ้าหน้าที่
            </p>
          </div>
          <StatusFilterSelect basePath="/access-requests" currentStatus={status ?? ""} />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center">
              <FileQuestion className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">ยังไม่มีคำขอเข้าถึงเอกสาร</p>
              <p className="text-sm text-gray-500">
                ส่งคำขอได้จากหน้ารายละเอียดงานวิจัยที่คุณไม่มีสิทธิ์อ่าน/ดาวน์โหลด
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
                    <Badge tone={STATUS_TONE[req.status]}>{accessRequestStatusLabels[req.status]}</Badge>
                    <Badge tone="gray">{accessRequestTypeLabels[req.requestType]}</Badge>
                  </div>
                  <Link
                    href={`/research/${req.researchSlug}`}
                    className="text-sm font-semibold text-gray-900 hover:text-brand-700"
                  >
                    {req.researchTitleTh}
                  </Link>
                  <p className="text-xs text-gray-500">วัตถุประสงค์: {req.purpose}</p>
                  {req.reviewerNote && (
                    <p className="text-xs text-blue-700">หมายเหตุจากเจ้าหน้าที่: {req.reviewerNote}</p>
                  )}
                  {req.status === "approved" && (
                    <p className="text-xs text-green-700">
                      {req.accessExpiresAt
                        ? `สิทธิ์นี้หมดอายุวันที่ ${new Date(req.accessExpiresAt).toLocaleDateString("th-TH")}`
                        : "สิทธิ์นี้ไม่มีวันหมดอายุ"}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    ส่งคำขอเมื่อ {new Date(req.createdAt).toLocaleDateString("th-TH")}
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
