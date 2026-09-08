import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getBlogPostById } from "@/lib/data/blog.server";
import BlogPostForm from "@/components/blog-admin/BlogPostForm";

export const dynamic = "force-dynamic";

export default async function BlogAdminEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login", locale });
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const post = await getBlogPostById(id);
  if (!post) notFound();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ແກ້ໄຂບົດຄວາມ</h1>
        <p className="mt-1 text-sm text-gray-500 font-mono">/{post.slug}</p>
      </div>
      <BlogPostForm post={post} />
    </div>
  );
}