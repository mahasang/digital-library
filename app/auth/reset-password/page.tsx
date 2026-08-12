import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import AuthFormShell from "@/components/auth/AuthFormShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ตั้งรหัสผ่านใหม่",
  description: "ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ",
};

export default async function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  let hasRecoverySession = false;

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasRecoverySession = Boolean(user);
  }

  return (
    <AuthFormShell
      title="ตั้งรหัสผ่านใหม่"
      description="กรอกรหัสผ่านใหม่ที่ต้องการใช้เข้าสู่ระบบ"
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      {!configured ? (
        <SupabaseNotConfiguredNotice />
      ) : !hasRecoverySession ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">
            ลิงก์หมดอายุหรือไม่ถูกต้อง
          </p>
          <p className="text-xs leading-relaxed text-amber-700">
            กรุณาเปิดหน้านี้จากลิงก์ในอีเมลที่ได้รับ หรือขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
            ที่หน้า{" "}
            <Link href="/auth/forgot-password" className="underline">
              ลืมรหัสผ่าน
            </Link>
          </p>
        </div>
      ) : (
        <ResetPasswordForm />
      )}
    </AuthFormShell>
  );
}
