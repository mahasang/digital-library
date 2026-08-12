import type { Metadata } from "next";
import AuthFormShell from "@/components/auth/AuthFormShell";
import SetupMfaForm from "@/components/auth/SetupMfaForm";

export const metadata: Metadata = {
  title: "ตั้งค่ายืนยันตัวตนสองขั้นตอน",
};

export default async function SetupMfaPage({
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
      title="ตั้งค่ายืนยันตัวตนสองขั้นตอน (MFA)"
      description="บัญชี Super Admin ต้องตั้งค่า MFA ก่อนจึงจะเข้าถึงส่วนจัดการระบบได้ — ใช้แอปยืนยันตัวตน เช่น Google Authenticator หรือ Authy"
    >
      <SetupMfaForm redirectTo={redirectTo} />
    </AuthFormShell>
  );
}
