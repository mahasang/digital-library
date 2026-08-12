import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import SuperAdminSidebar from "@/components/superadmin/SuperAdminSidebar";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank, SUPER_ADMIN_RANK } from "@/lib/supabase/roles";

/**
 * เลย์เอาต์ของ /superadmin — แยกออกจาก /dashboard (Admin Dashboard) โดยสิ้นเชิง
 * ทั้งการ์ดสิทธิ์ (ต้อง rank >= 50 คือ super_admin เท่านั้น — admin ปกติ
 * rank 40 เข้าไม่ได้ ถูกพาไปหน้า /403 เหมือนผู้ใช้ที่ไม่มีสิทธิ์รายอื่น)
 * และรูปลักษณ์ (SuperAdminSidebar สีทอง/amber แยกจาก DashboardSidebar)
 *
 * ตรวจสอบซ้ำที่นี่แม้ middleware.ts จะป้องกัน /superadmin ไว้ชั้นหนึ่งแล้ว
 * (ต้อง rank >= 50 และมี MFA verified แล้ว) ตามรูปแบบ RBAC สองชั้นที่ใช้ทั้ง
 * ระบบ — ไม่พึ่งพา middleware เพียงจุดเดียว การตรวจ MFA ที่นี่ใช้
 * `hasVerifiedMfa` (มี factor ที่ verified หรือไม่ — ไม่ได้ตรวจ aal2 ของ
 * เซสชันนี้ซ้ำ เพราะนั่นเป็นหน้าที่ของ middleware/mfa-challenge) จึงไม่มีทาง
 * ที่ผู้ใช้ซึ่งยังไม่เคยตั้งค่า MFA จะมาถึงจุดนี้ได้เลย (แบนเนอร์เตือนแบบเดิม
 * จึงถูกตัดออก ไม่ใช่ code ที่ไปถึงได้อีกต่อไป)
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-12">
        <Container className="max-w-2xl">
          <SupabaseNotConfiguredNotice />
        </Container>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/superadmin");

  const rank = await getCurrentUserRoleRank();
  if (rank < SUPER_ADMIN_RANK) redirect("/403");

  if (!user.hasVerifiedMfa) redirect("/setup-mfa?redirect=/superadmin");

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
      <SuperAdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
