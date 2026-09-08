import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import BlogAdminNav from "@/components/blog-admin/BlogAdminNav";

export default async function BlogAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/blog-admin", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <BlogAdminNav />
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}