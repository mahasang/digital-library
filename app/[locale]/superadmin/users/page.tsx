import Link from "next/link";
import type { Metadata } from "next";
import { Search, ShieldCheck } from "lucide-react";
import { getSuperAdminUserList } from "@/lib/data/superadmin-users.server";
import { roleLabels } from "@/lib/labels";
import type { UserRole } from "@/types/research";

export const metadata: Metadata = { title: "จัดการผู้ใช้ — Super Admin" };
export const dynamic = "force-dynamic";

const ROLE_OPTIONS: UserRole[] = ["member", "staff", "librarian", "admin", "super_admin"];

export default async function SuperAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; role?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "active" || params.status === "suspended" ? params.status : undefined;
  const role = ROLE_OPTIONS.includes(params.role as UserRole) ? (params.role as UserRole) : undefined;

  const result = await getSuperAdminUserList({ search: params.search, status, role });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดการผู้ใช้งาน</h1>
        <p className="mt-1 text-sm text-gray-500">
          ค้นหา กรอง กำหนดหลายบทบาท และเปิด/ระงับการใช้งานบัญชี
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-surface p-4 text-sm"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            name="search"
            defaultValue={params.search}
            placeholder="ค้นหาชื่อหรืออีเมล"
            className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-xs"
          />
        </div>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
        >
          <option value="">ทุกสถานะ</option>
          <option value="active">ใช้งานได้</option>
          <option value="suspended">ถูกระงับ</option>
        </select>
        <select
          name="role"
          defaultValue={params.role ?? ""}
          className="rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-xs"
        >
          <option value="">ทุกบทบาท</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          กรอง
        </button>
      </form>

      {!result.available ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center text-sm text-gray-500">
          ไม่พร้อมใช้งาน — ไม่สามารถดึงรายชื่อผู้ใช้ได้ในขณะนี้
        </div>
      ) : result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ไม่พบผู้ใช้งานตามเงื่อนไขที่เลือก
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ผู้ใช้</th>
                <th className="px-4 py-3 font-medium">หน่วยงาน</th>
                <th className="px-4 py-3 font-medium">บทบาท</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.data.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/superadmin/users/${u.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {u.fullName}
                    </Link>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.organizationName || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-gray-500">ไม่มีบทบาท</span>
                      ) : (
                        u.roles.map((r) => (
                          <span
                            key={r}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r === "super_admin"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {roleLabels[r]}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {u.isActive ? "ใช้งานได้" : "ถูกระงับ"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
