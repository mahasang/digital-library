import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, Building2, Calendar, ScrollText, History } from "lucide-react";
import {
  getSuperAdminUserDetail,
  getUserActivityHistory,
} from "@/lib/data/superadmin-users.server";
import { getAuditLogs } from "@/lib/data/audit-logs.server";
import { getUserMfaFactors } from "@/lib/security/mfa-admin.server";
import { getSessionUser } from "@/lib/supabase/session";
import { auditActionLabels } from "@/lib/labels";
import UserRolesEditor from "@/components/superadmin/UserRolesEditor";
import UserStatusControl from "@/components/superadmin/UserStatusControl";
import MfaResetControl from "@/components/superadmin/MfaResetControl";

export const metadata: Metadata = { title: "รายละเอียดผู้ใช้ — Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detailResult, activityResult, accountHistoryResult, currentUser, mfaResult] =
    await Promise.all([
      getSuperAdminUserDetail(id),
      getUserActivityHistory(id),
      getAuditLogs({ entityId: id, entityType: "profiles", pageSize: 20 }),
      getSessionUser(),
      getUserMfaFactors(id),
    ]);

  if (!detailResult.available) notFound();
  const user = detailResult.data;
  const isSelf = currentUser?.id === user.id;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/superadmin/users"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายชื่อผู้ใช้
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{user.fullName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {user.email || "ไม่ระบุ"}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {user.organizationName || "ไม่ระบุหน่วยงาน"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            สมัครเมื่อ {new Date(user.createdAt).toLocaleDateString("th-TH")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">บทบาท</h2>
          <p className="mb-3 text-xs text-gray-500">
            เลือกได้หลายบทบาทพร้อมกัน — บทบาท Super Admin ต้องยืนยันด้วยข้อความก่อนทุกครั้ง
            และการถอดถอนบทบาท Super Admin คนสุดท้ายในระบบจะถูกปฏิเสธเสมอ
          </p>
          <UserRolesEditor
            userId={user.id}
            userName={user.fullName}
            userEmail={user.email}
            currentRoles={user.roles}
            isSelf={isSelf}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">สถานะบัญชี</h2>
          <UserStatusControl
            userId={user.id}
            isActive={user.isActive}
            isSelf={isSelf}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-surface p-5 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">
            ยืนยันตัวตนสองขั้นตอน (MFA)
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            ใช้เมื่อผู้ใช้ทำอุปกรณ์ยืนยันตัวตนหาย — รีเซ็ตแล้วผู้ใช้ต้องตั้งค่าอุปกรณ์ใหม่เองที่
            หน้าบัญชีของฉัน
          </p>
          <MfaResetControl
            userId={user.id}
            userName={user.fullName}
            userEmail={user.email}
            isSelf={isSelf}
            available={mfaResult.available}
            factors={mfaResult.available ? mfaResult.data : []}
          />
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ScrollText className="h-4 w-4 text-accent" />
          ประวัติการทำงาน
        </h2>
        {!activityResult.available ? (
          <p className="py-6 text-center text-sm text-gray-500">ไม่พร้อมใช้งาน</p>
        ) : activityResult.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">ยังไม่มีประวัติการทำงาน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="pb-2 font-medium">การกระทำ</th>
                  <th className="pb-2 font-medium">ประเภทข้อมูล</th>
                  <th className="pb-2 font-medium">วันที่/เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activityResult.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 text-gray-700">{entry.action}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{entry.entityType}</td>
                    <td className="py-2.5 text-gray-500">
                      {new Date(entry.createdAt).toLocaleString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <History className="h-4 w-4 text-accent" />
          ประวัติที่ถูกดำเนินการกับบัญชีนี้
        </h2>
        {!accountHistoryResult.available ? (
          <p className="py-6 text-center text-sm text-gray-500">ไม่พร้อมใช้งาน</p>
        ) : accountHistoryResult.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">การกระทำ</th>
                  <th className="pb-2 pr-4 font-medium">ผู้กระทำ</th>
                  <th className="pb-2 pr-4 font-medium">เหตุผล</th>
                  <th className="pb-2 font-medium">วันที่/เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accountHistoryResult.rows.map((entry) => {
                  const reason =
                    typeof entry.metadata?.reason === "string" ? entry.metadata.reason : null;
                  const isSuperAdminChange =
                    entry.action === "super_admin_grant" || entry.action === "super_admin_revoke";
                  return (
                    <tr key={entry.id}>
                      <td className="py-2.5 pr-4">
                        <span
                          className={
                            isSuperAdminChange ? "font-medium text-amber-700" : "text-gray-700"
                          }
                        >
                          {auditActionLabels[entry.action] ?? entry.action}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{entry.actorName}</td>
                      <td className="max-w-xs truncate py-2.5 pr-4 text-xs text-gray-500">
                        {reason || "—"}
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(entry.createdAt).toLocaleString("th-TH")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
