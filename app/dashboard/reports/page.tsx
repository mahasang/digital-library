import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import SharedEmptyState from "@/components/ui/EmptyState";
import {
  getDownloadsReport,
  getMembersReport,
  getPopularReport,
  getViewsReport,
} from "@/lib/data/reports.server";
import { getCategories } from "@/lib/data/categories.server";
import { roleLabels } from "@/lib/labels";
import type { UserRole } from "@/types/research";

export const metadata: Metadata = { title: "รายงาน" };

type ReportTab = "views" | "downloads" | "popular" | "members";

const TABS: { value: ReportTab; label: string }[] = [
  { value: "views", label: "การเข้าชม" },
  { value: "downloads", label: "การดาวน์โหลด" },
  { value: "popular", label: "งานวิจัยยอดนิยม" },
  { value: "members", label: "สมาชิก" },
];

const ASSIGNABLE_ROLES: UserRole[] = ["member", "staff", "librarian", "admin"];

export default async function DashboardReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    category?: string;
    role?: string;
  }>;
}) {
  const params = await searchParams;
  const tab: ReportTab = (
    ["views", "downloads", "popular", "members"].includes(params.tab ?? "")
      ? params.tab
      : "views"
  ) as ReportTab;

  const categories = await getCategories();

  const filters = {
    from: params.from,
    to: params.to,
    categoryId: params.category,
  };

  function buildTabUrl(nextTab: ReportTab) {
    const sp = new URLSearchParams();
    sp.set("tab", nextTab);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.category) sp.set("category", params.category);
    if (params.role) sp.set("role", params.role);
    return `/dashboard/reports?${sp.toString()}`;
  }

  function buildExportUrl() {
    const sp = new URLSearchParams();
    sp.set("type", tab);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.category) sp.set("category", params.category);
    if (params.role) sp.set("role", params.role);
    return `/dashboard/reports/export?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">รายงาน</h1>
        <p className="mt-1 text-sm text-gray-500">
          รายงานการเข้าชม การดาวน์โหลด งานวิจัยยอดนิยม และสมาชิก พร้อมส่งออก CSV
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={buildTabUrl(t.value)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === t.value
                ? "border-b-2 border-brand-600 text-accent"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-surface p-4 text-sm"
      >
        <input type="hidden" name="tab" value={tab} />
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
        {tab !== "members" && (
          <select
            name="category"
            defaultValue={params.category ?? ""}
            aria-label="กรองตามหมวดหมู่"
            className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameTh}
              </option>
            ))}
          </select>
        )}
        {tab === "members" && (
          <select
            name="role"
            defaultValue={params.role ?? ""}
            aria-label="กรองตามประเภทผู้ใช้"
            className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">ทุกประเภทผู้ใช้</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          กรอง
        </button>
        <a
          href={buildExportUrl()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />
          ส่งออก CSV
        </a>
      </form>

      {tab === "views" && <EventReportTable rows={await getViewsReport(filters)} label="ครั้งที่อ่าน" />}
      {tab === "downloads" && (
        <EventReportTable rows={await getDownloadsReport(filters)} label="ครั้งที่ดาวน์โหลด" />
      )}
      {tab === "popular" && <PopularReportTable filters={filters} />}
      {tab === "members" && (
        <MembersReportTable
          filters={{ from: params.from, to: params.to, role: params.role as UserRole | undefined }}
        />
      )}
    </div>
  );
}

async function PopularReportTable({
  filters,
}: {
  filters: { categoryId?: string };
}) {
  const rows = await getPopularReport(filters);
  if (rows.length === 0) {
    return <SharedEmptyState title="ไม่พบข้อมูลตามเงื่อนไขที่เลือก" description="ลองปรับช่วงวันที่หรือตัวกรองแล้วลองใหม่อีกครั้ง" />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">ชื่อเรื่อง</th>
            <th className="px-4 py-3 font-medium">เข้าชม</th>
            <th className="px-4 py-3 font-medium">ดาวน์โหลด</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.slug}>
              <td className="max-w-md truncate px-4 py-2.5">
                <Link href={`/research/${r.slug}`} className="text-accent hover:underline">
                  {r.titleTh}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{r.views.toLocaleString("th-TH")}</td>
              <td className="px-4 py-2.5 text-gray-600">{r.downloads.toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function MembersReportTable({
  filters,
}: {
  filters: { from?: string; to?: string; role?: UserRole };
}) {
  const rows = await getMembersReport(filters);
  if (rows.length === 0) {
    return <SharedEmptyState title="ไม่พบข้อมูลตามเงื่อนไขที่เลือก" description="ลองปรับช่วงวันที่หรือตัวกรองแล้วลองใหม่อีกครั้ง" />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">ชื่อ</th>
            <th className="px-4 py-3 font-medium">อีเมล</th>
            <th className="px-4 py-3 font-medium">หน่วยงาน</th>
            <th className="px-4 py-3 font-medium">บทบาท</th>
            <th className="px-4 py-3 font-medium">วันที่สมัคร</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2.5">{r.fullName}</td>
              <td className="px-4 py-2.5 text-gray-500">{r.email}</td>
              <td className="px-4 py-2.5 text-gray-500">{r.organizationName || "—"}</td>
              <td className="px-4 py-2.5 text-gray-500">{roleLabels[r.role]}</td>
              <td className="px-4 py-2.5 text-gray-500">
                {new Date(r.createdAt).toLocaleDateString("th-TH")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventReportTable({
  rows,
  label,
}: {
  rows: { researchId: string; slug: string; titleTh: string; count: number }[];
  label: string;
}) {
  if (rows.length === 0) {
    return <SharedEmptyState title="ไม่พบข้อมูลตามเงื่อนไขที่เลือก" description="ลองปรับช่วงวันที่หรือตัวกรองแล้วลองใหม่อีกครั้ง" />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">ชื่อเรื่อง</th>
            <th className="px-4 py-3 font-medium">{label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.researchId}>
              <td className="max-w-md truncate px-4 py-2.5">
                <Link href={`/research/${r.slug}`} className="text-accent hover:underline">
                  {r.titleTh}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{r.count.toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
