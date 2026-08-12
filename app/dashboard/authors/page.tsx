import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { searchAuthorsForAdmin } from "@/lib/data/authors-admin.server";
import AuthorCreateForm from "@/components/dashboard/AuthorCreateForm";
import { getOrganizations } from "@/lib/data/organizations.server";

export const metadata: Metadata = { title: "จัดการผู้วิจัย" };

export default async function DashboardAuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string; orcid?: string; page?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/authors");

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) redirect("/403");

  const params = await searchParams;
  const page = Number(params.page) || 1;

  const [{ items, total, totalPages }, organizations] = await Promise.all([
    searchAuthorsForAdmin({
      query: params.q,
      isActive: params.active === "true" ? true : params.active === "false" ? false : undefined,
      hasOrcid: params.orcid === "true" ? true : params.orcid === "false" ? false : undefined,
      page,
    }),
    getOrganizations(),
  ]);

  function buildPageUrl(targetPage: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.active) sp.set("active", params.active);
    if (params.orcid) sp.set("orcid", params.orcid);
    sp.set("page", String(targetPage));
    return `/dashboard/authors?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดการผู้วิจัย</h1>
          <p className="mt-1 text-sm text-gray-500">
            ค้นหา แก้ไข ปิดใช้งาน และรวมข้อมูลผู้วิจัยที่ซ้ำกัน — ทั้งหมด {total} คน
          </p>
        </div>
      </div>

      <AuthorCreateForm organizations={organizations} />

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
            placeholder="ค้นหาชื่อผู้วิจัย..."
            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
          />
        </div>
        <select
          name="active"
          defaultValue={params.active ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="true">เปิดใช้งาน</option>
          <option value="false">ปิดใช้งาน</option>
        </select>
        <select
          name="orcid"
          defaultValue={params.orcid ?? ""}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          <option value="">มี/ไม่มี ORCID</option>
          <option value="true">มี ORCID</option>
          <option value="false">ไม่มี ORCID</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ค้นหา
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3">หน่วยงาน</th>
              <th className="px-4 py-3">ORCID</th>
              <th className="px-4 py-3">งานวิจัย</th>
              <th className="px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  ไม่พบผู้วิจัยตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              items.map((author) => (
                <tr key={author.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/authors/${author.id}`} className="font-medium text-accent hover:underline">
                      {author.name}
                    </Link>
                    {author.displayNameEn && <p className="text-xs text-gray-500">{author.displayNameEn}</p>}
                    {author.mergedIntoAuthorId && (
                      <Badge tone="gray" className="mt-1">
                        ถูกรวมข้อมูลแล้ว
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{author.organizationNameTh ?? "-"}</td>
                  <td className="px-4 py-3">
                    {author.orcid ? (
                      <span className="flex items-center gap-1 font-mono text-xs text-gray-700">
                        {author.orcidVerifiedAt && <ShieldCheck className="h-3.5 w-3.5 text-green-600" />}
                        {author.orcid}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{author.researchCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={author.isActive ? "green" : "gray"}>
                      {author.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={buildPageUrl(Math.max(1, page - 1))}
            className={`rounded-lg border border-gray-200 p-2 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm text-gray-500">
            หน้า {page} จาก {totalPages}
          </span>
          <Link
            href={buildPageUrl(Math.min(totalPages, page + 1))}
            className={`rounded-lg border border-gray-200 p-2 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
