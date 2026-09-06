import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getBlogPostById } from "@/lib/data/blog.server";
import BlogPostForm from "../../BlogPostForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ແກ້ໄຂບົດຄວາມ" };

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/dashboard/blog/${id}/edit`);
    return null;
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) {
    redirect(`/${locale}/403`);
    return null;
  }

  const post = await getBlogPostById(id);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ແກ້ໄຂບົດຄວາມ</h1>
      </div>
      <BlogPostForm post={post} />
    </div>
  );
}