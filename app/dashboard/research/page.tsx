import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search } from "lucide-react";
import StatusBadge from "@/components/research/StatusBadge";
import AccessBadge from "@/components/research/AccessBadge";
import { LinkButton } from "@/components/ui/Button";
import { searchAdminResearch } from "@/lib/data/admin-research.server";
import { getCategories } from "@/lib/data/categories.server";
import { accessLevelLabels, statusLabels } from "@/lib/labels";
import ArchiveQuickAction from "@/components/dashboard/ArchiveQuickAction";
import type { AccessLevel, DocumentStatus } from "@/types/research";

export const metadata: Metadata = { title: "จัดการงานวิจัย" };

export default async function DashboardResearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    access?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const [{ items, total, totalPages }, categories] = await Promise.all([
    searchAdminResearch({
      query: params.q,
      status: params.status as DocumentStatus | undefined,
      accessLevel: params.access as AccessLevel | undefined,
      categoryId: params.category,
      page,
    }),
    getCategories(),
  ]);

  function buildPageUrl(targetPage: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status) sp.set("status", params.status);
    if (params.access) sp.set("access", params.access);
    if (params.category) sp.set("category", params.category);
    sp.set("page", String(targetPage));
    return `/dashboard/research?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดการงานวิจัย</h1>
          <p className="mt-1 text-sm text-gray-500">
            ค้นหา กรอง แก้ไข เปลี่ยนสิทธิ์ ปิดเผยแพร่ และเก็บถาวรงานวิจัยทุกสถานะ
          </p>
        </div>
        <LinkButton href="/dashboard/research/new" variant="primary">
          <Plus className="h-4 w-4" />
          เพิ่มงานวิจัย
        </LinkButton>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 sm:min-w-[200px]">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="ค้นหาชื่อเรื่อง..."
            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
          />
        </div>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="access"
          defaultValue={params.access ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกสิทธิ์การเข้าถึง</option>
          {Object.entries(accessLevelLabels).map(([value, label]) => (
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
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          กรอง
        </button>
      </form>

      <p className="text-sm text-gray-500">
        พบ <span className="font-semibold text-gray-900">{total}</span> รายการ
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ไม่พบงานวิจัยที่ตรงกับเงื่อนไข
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ชื่อเรื่อง</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">สิทธิ์</th>
                <th className="px-4 py-3 font-medium">ปี</th>
                <th className="px-4 py-3 font-medium">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-gray-900">
                    {item.titleTh}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    <AccessBadge accessLevel={item.accessLevel} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.year}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/research/${item.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไข
                      </Link>
                      {item.status !== "archived" && (
                        <ArchiveQuickAction researchId={item.id} />
                      )}
                    </div>
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
            href={buildPageUrl(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
              page <= 1
                ? "pointer-events-none text-gray-300"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            ก่อนหน้า
          </Link>
          <span className="text-sm text-gray-500">
            หน้า {page} / {totalPages}
          </span>
          <Link
            href={buildPageUrl(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
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

