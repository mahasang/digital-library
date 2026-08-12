import type { Metadata } from "next";
import Link from "next/link";
import AuthFormShell from "@/components/auth/AuthFormShell";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "ลืมรหัสผ่าน",
  description: "ขอลิงก์สำหรับตั้งรหัสผ่านใหม่",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="ลืมรหัสผ่าน"
      description="กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้"
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <ForgotPasswordForm />
      )}
    </AuthFormShell>
  );
}
