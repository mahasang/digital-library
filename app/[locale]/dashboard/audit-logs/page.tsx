import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAuditLogs } from "@/lib/data/audit-logs.server";
import { auditActionLabels } from "@/lib/labels";

export const metadata: Metadata = { title: "Audit Log" };

export default async function DashboardAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; entity?: string; page?: string }>;
}) {
  const params = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/audit-logs");

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) redirect("/403");

  const page = Number(params.page) || 1;
  const { available, rows, total, totalPages } = await getAuditLogs({
    from: params.from,
    to: params.to,
    entityType: params.entity,
    page,
  });

  function buildUrl(targetPage: number) {
    const sp = new URLSearchParams();
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.entity) sp.set("entity", params.entity);
    sp.set("page", String(targetPage));
    return `/dashboard/audit-logs?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <ScrollText className="h-6 w-6 text-accent" />
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          ประวัติการกระทำสำคัญทั้งหมดในระบบ — ผู้กระทำ รายการที่เปลี่ยนแปลง วันเวลา และรายละเอียด
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-surface p-4 text-sm"
      >
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          จาก
          <input
            type="date"
            name="from"
            defaultValue={params.from}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          ถึง
          <input
            type="date"
            name="to"
            defaultValue={params.to}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
          />
        </label>
        <select
          name="entity"
          defaultValue={params.entity ?? ""}
          className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
        >
          <option value="">ทุกประเภทรายการ</option>
          <option value="research_items">งานวิจัย</option>
          <option value="categories">หมวดหมู่</option>
          <option value="organizations">หน่วยงาน</option>
          <option value="profiles">ผู้ใช้งาน</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          กรอง
        </button>
      </form>

      <p className="text-sm text-gray-500">
        พบ <span className="font-semibold text-gray-900">{total}</span> รายการ
      </p>

      {!available ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center text-sm text-gray-500">
          ไม่พร้อมใช้งาน — ไม่สามารถดึงข้อมูล Audit Log ได้ในขณะนี้
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ไม่พบข้อมูลตามเงื่อนไขที่เลือก
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ผู้กระทำ</th>
                <th className="px-4 py-3 font-medium">การกระทำ</th>
                <th className="px-4 py-3 font-medium">ประเภทรายการ</th>
                <th className="px-4 py-3 font-medium">รายละเอียด</th>
                <th className="px-4 py-3 font-medium">วันเวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{log.actorName}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {auditActionLabels[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{log.entityType}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-xs text-gray-500">
                    {Object.keys(log.metadata).length > 0
                      ? JSON.stringify(log.metadata)
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={buildUrl(Math.max(1, page - 1))}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
              page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            ก่อนหน้า
          </Link>
          <span className="text-sm text-gray-500">
            หน้า {page} / {totalPages}
          </span>
          <Link
            href={buildUrl(Math.min(totalPages, page + 1))}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
              page >= totalPages
                ? "pointer-events-none text-gray-300"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            ถัดไป
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
