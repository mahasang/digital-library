import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getSettings } from "@/lib/data/settings.server";
import SettingsForm from "@/components/dashboard/SettingsForm";

export const metadata: Metadata = { title: "ตั้งค่าระบบ" };

export default async function DashboardSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/settings");

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) redirect("/403");

  const settings = await getSettings();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ตั้งค่าระบบ</h1>
        <p className="mt-1 text-sm text-gray-500">
          ชื่อองค์กร โลโก้ ข้อมูลติดต่อ ข้อความลิขสิทธิ์ และการแสดงผลพื้นฐานของหน้าแรก
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
