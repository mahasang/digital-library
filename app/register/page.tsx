import type { Metadata } from "next";
import Link from "next/link";
import AuthFormShell from "@/components/auth/AuthFormShell";
import RegisterForm from "@/components/auth/RegisterForm";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isCaptchaConfigured } from "@/lib/captcha.server";
import { getSettings } from "@/lib/data/settings.server";

export const metadata: Metadata = {
  title: "สมัครสมาชิก",
  description: "สมัครสมาชิกห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
};

export default async function RegisterPage() {
  const settings = isSupabaseConfigured() ? await getSettings() : null;
  const captchaSiteKey =
    settings?.captchaEnabled && isCaptchaConfigured()
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  return (
    <AuthFormShell
      title="สมัครสมาชิก"
      description="สมัครสมาชิกเพื่อเข้าถึงงานวิจัยและฟีเจอร์เพิ่มเติมของห้องสมุดดิจิทัล"
      footer={
        <>
          มีบัญชีผู้ใช้อยู่แล้ว?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <RegisterForm captchaSiteKey={captchaSiteKey} />
      )}
    </AuthFormShell>
  );
}
