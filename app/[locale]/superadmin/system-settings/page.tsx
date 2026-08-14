import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSettings } from "@/lib/data/settings.server";
import { getSessionUser } from "@/lib/supabase/session";
import SystemSettingsForm from "@/components/superadmin/SystemSettingsForm";

export const metadata: Metadata = { title: "ตั้งค่าระบบขั้นสูง — Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminSystemSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/superadmin/system-settings");

  const settings = await getSettings();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ตั้งค่าระบบขั้นสูง</h1>
        <p className="mt-1 text-sm text-gray-500">
          ชื่อระบบ โลโก้/favicon ข้อมูลติดต่อ การเปิด-ปิดฟีเจอร์หลัก และขนาดไฟล์สูงสุด
        </p>
      </div>

      <SystemSettingsForm settings={settings} userId={user.id} />
    </div>
  );
}
