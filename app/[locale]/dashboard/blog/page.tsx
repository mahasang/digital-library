import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAllBlogPosts } from "@/lib/data/blog.server";
import { deleteBlogPostAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ຈັດການບົດຄວາມ" };

export default async function DashboardBlogPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/dashboard/blog", locale });

  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const posts = await getAllBlogPosts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ຈັດການບົດຄວາມ</h1>
        </div>
        <Link
          href="/dashboard/blog/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          ສ້າງບົດຄວາມໃໝ່
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ຫົວຂໍ້</th>
              <th className="px-4 py-3 font-medium">ສະຖານະ</th>
              <th className="px-4 py-3 font-medium">ວັນທີ</th>
              <th className="px-4 py-3 font-medium">ຈັດການ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  ຍັງບໍ່ມີບົດຄວາມ
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id}>
                  <td className="max-w-sm truncate px-4 py-2.5 font-medium text-gray-900">
                    {post.titleLo || post.titleTh || post.titleEn || post.slug}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      post.status === "published"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {post.status === "published" ? "ເຜີຍແຜ່ແລ້ວ" : "ຮ່າງ"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("lo-LA")
                      : new Date(post.createdAt).toLocaleDateString("lo-LA")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/blog/${post.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        ແກ້ໄຂ
                      </Link>
                      <form action={async () => { await deleteBlogPostAction(post.id); }}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          ລົບ
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}