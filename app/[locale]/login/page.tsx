import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import AuthFormShell from "@/components/auth/AuthFormShell";
import LoginForm from "@/components/auth/LoginForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string;
    confirmed?: string;
    reset?: string;
    timeout?: string;
  }>;
}) {
  const params = await searchParams;
  const redirectTo =
    typeof params.redirect === "string" && params.redirect.startsWith("/")
      ? params.redirect
      : "/";

  return (
    <AuthFormShell
      title="เข้าสู่ระบบ"
      description="เข้าสู่ระบบเพื่อเข้าถึงงานวิจัยระดับสมาชิกและบันทึกรายการโปรด"
      footer={
        <>
          ยังไม่มีบัญชีผู้ใช้?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <>
          {params.confirmed === "1" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบ</p>
            </div>
          )}
          {params.timeout === "1" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>ระบบออกจากระบบให้อัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 10 นาที กรุณาเข้าสู่ระบบใหม่</p>
            </div>
          )}
          {params.reset === "success" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>
            </div>
          )}
          <LoginForm redirectTo={redirectTo} />
        </>
      )}
    </AuthFormShell>
  );
}
