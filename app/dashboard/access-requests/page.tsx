import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAccessRequestsForStaff } from "@/lib/data/access-requests-admin.server";
import { getCategories } from "@/lib/data/categories.server";
import { accessRequestStatusLabels, accessRequestTypeLabels } from "@/lib/labels";
import type { AccessRequestStatus, AccessRequestType } from "@/types/research";

export const metadata: Metadata = { title: "คำขอเข้าถึงเอกสาร" };

const STATUS_TONE: Record<AccessRequestStatus, "brand" | "green" | "amber" | "red" | "gray" | "purple"> = {
  pending: "amber",
  under_review: "amber",
  approved: "green",
  rejected: "red",
  more_information_required: "purple",
  cancelled: "gray",
  expired: "gray",
};

export default async function DashboardAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    category?: string;
    requester?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/access-requests");

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const params = await searchParams;
  const [requests, categories] = await Promise.all([
    getAccessRequestsForStaff({
      status: params.status as AccessRequestStatus | undefined,
      requestType: params.type as AccessRequestType | undefined,
      categoryId: params.category,
      requesterQuery: params.requester,
      dateFrom: params.from,
      dateTo: params.to,
    }),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">คำขอเข้าถึงเอกสาร</h1>
        <p className="mt-1 text-sm text-gray-500">
          ตรวจสอบ อนุมัติ ปฏิเสธ หรือขอข้อมูลเพิ่มเติมสำหรับคำขออ่าน/ดาวน์โหลดเอกสารที่จำกัดสิทธิ์
        </p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 sm:min-w-[180px]">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            type="search"
            name="requester"
            defaultValue={params.requester}
            placeholder="ค้นหาชื่อ/อีเมลผู้ขอ..."
            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
          />
        </div>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(accessRequestStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={params.type ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกประเภทคำขอ</option>
          {Object.entries(accessRequestTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameTh}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={params.from}
          aria-label="จากวันที่"
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-600"
        />
        <input
          type="date"
          name="to"
          defaultValue={params.to}
          aria-label="ถึงวันที่"
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-600"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ค้นหา
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center text-sm text-gray-500">
            ไม่พบคำขอตามเงื่อนไขที่เลือก
          </div>
        ) : (
          requests.map((req) => (
            <Link
              key={req.id}
              href={`/dashboard/access-requests/${req.id}`}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-surface p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[req.status]}>{accessRequestStatusLabels[req.status]}</Badge>
                  <Badge tone="gray">{accessRequestTypeLabels[req.requestType]}</Badge>
                </div>
                <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{req.researchTitleTh}</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  ผู้ขอ: {req.requesterName} ({req.requesterEmail})
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">วัตถุประสงค์: {req.purpose}</p>
              </div>
              <span className="shrink-0 text-xs text-gray-500">
                {new Date(req.createdAt).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
