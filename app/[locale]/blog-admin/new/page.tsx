import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import BlogPostForm from "@/components/blog-admin/BlogPostForm";

export const dynamic = "force-dynamic";

export default async function BlogAdminNewPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login", locale });
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ສ້າງບົດຄວາມໃໝ່</h1>
        <p className="mt-1 text-sm text-gray-500">ຂຽນ ແລະເຜີຍແຜ່ບົດຄວາມ</p>
      </div>
      <BlogPostForm />
    </div>
  );
}