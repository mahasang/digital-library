import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import Container from "@/components/ui/Container";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import SupabaseNotConfiguredNotice from "@/components/auth/SupabaseNotConfiguredNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";


export default async function DashboardLayout({
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

  const locale = await getLocale();

  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
      <DashboardSidebar rank={rank} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
