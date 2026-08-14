import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert, Mail, UserX } from "lucide-react";
import { getSettings } from "@/lib/data/settings.server";
import { getSuperAdminUserList } from "@/lib/data/superadmin-users.server";
import { getAuthPolicyStatus } from "@/lib/data/auth-policy.server";
import { isCaptchaConfigured } from "@/lib/captcha.server";
import SecuritySettingsForm from "@/components/superadmin/SecuritySettingsForm";

export const metadata: Metadata = { title: "ความปลอดภัย — Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminSecurityPage() {
  const [settings, suspendedResult, authPolicyResult] = await Promise.all([
    getSettings(),
    getSuperAdminUserList({ status: "suspended" }),
    getAuthPolicyStatus(),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ความปลอดภัย</h1>
        <p className="mt-1 text-sm text-gray-500">
          CAPTCHA, Rate Limit, นโยบายการยืนยันอีเมล และบัญชีที่ถูกระงับ
        </p>
      </div>

      <SecuritySettingsForm settings={settings} captchaConfigured={isCaptchaConfigured()} />

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Mail className="h-4 w-4 text-accent" />
          นโยบายการยืนยันอีเมล
        </h2>
        {!authPolicyResult.available ? (
          <p className="text-sm text-gray-500">ไม่พร้อมใช้งาน — ไม่สามารถตรวจสอบสถานะได้ในขณะนี้</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-gray-600">
            <p>
              สถานะปัจจุบัน:{" "}
              <span className="font-medium text-gray-900">
                {authPolicyResult.data.emailConfirmationRequired
                  ? "บังคับยืนยันอีเมลก่อนเข้าสู่ระบบ"
                  : "ไม่บังคับยืนยันอีเมล (เข้าสู่ระบบได้ทันทีหลังสมัคร)"}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              ค่านี้ตั้งได้เฉพาะผ่าน Supabase Dashboard (Authentication &gt; Providers &gt; Email
              สำหรับ Cloud) หรือ `supabase/config.toml` หัวข้อ `[auth.email]` (สำหรับ local) เท่านั้น
              — แอปนี้ไม่มีสิทธิ์เปลี่ยนค่านี้เอง จึงแสดงผลแบบอ่านอย่างเดียว
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <UserX className="h-4 w-4 text-accent" />
          บัญชีที่ถูกระงับ
        </h2>
        {!suspendedResult.available ? (
          <p className="text-sm text-gray-500">ไม่พร้อมใช้งาน</p>
        ) : suspendedResult.data.length === 0 ? (
          <p className="text-sm text-gray-500">ไม่มีบัญชีที่ถูกระงับในขณะนี้</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {suspendedResult.data.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <Link
                    href={`/superadmin/users/${u.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {u.fullName}
                  </Link>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  <ShieldAlert className="h-3 w-3" />
                  ถูกระงับ
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
