import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAdminUserList } from "@/lib/data/admin-users.server";
import UserManager from "@/components/dashboard/UserManager";

export const metadata: Metadata = { title: "จัดการผู้ใช้งาน" };

export default async function DashboardUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/users");

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) redirect("/403");

  const users = await getAdminUserList();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">จัดการผู้ใช้งาน</h1>
        <p className="mt-1 text-sm text-gray-500">
          กำหนดบทบาท (Member/Staff/Librarian/Admin) และเปิด/ปิดสถานะบัญชีโดยไม่ลบข้อมูล
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-16 text-center text-sm text-gray-500">
          ยังไม่มีผู้ใช้งานในระบบ
        </div>
      ) : (
        <UserManager users={users} currentUserId={user.id} />
      )}
    </div>
  );
}
