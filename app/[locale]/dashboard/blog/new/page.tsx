import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import BlogPostForm from "../BlogPostForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ສ້າງບົດຄວາມໃຫມ່" };

export default async function NewBlogPostPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/blog/new", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 40) return redirect({ href: "/403", locale });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ສ້າງບົດຄວາມໃຫມ່</h1>
      </div>
      <BlogPostForm />
    </div>
  );
}