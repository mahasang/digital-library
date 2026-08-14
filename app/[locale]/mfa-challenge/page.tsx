import type { Metadata } from "next";
import AuthFormShell from "@/components/auth/AuthFormShell";
import MfaChallengeForm from "@/components/auth/MfaChallengeForm";

export const metadata: Metadata = {
  title: "ยืนยันตัวตนขั้นที่สอง",
};

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo =
    typeof params.redirect === "string" && params.redirect.startsWith("/")
      ? params.redirect
      : "/superadmin/overview";

  return (
    <AuthFormShell
      title="ยืนยันตัวตนขั้นที่สอง"
      description="บัญชีนี้ตั้งค่า MFA ไว้แล้ว กรุณากรอกรหัสจากแอปยืนยันตัวตนของคุณเพื่อเข้าถึงหน้า Super Admin"
    >
      <MfaChallengeForm redirectTo={redirectTo} />
    </AuthFormShell>
  );
}
