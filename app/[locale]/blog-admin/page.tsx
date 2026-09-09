import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import Link from "next/link";
import { Plus, FileText, Eye, Edit } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAllBlogPosts } from "@/lib/data/blog.server";
import DeletePostButton from "@/components/blog-admin/DeletePostButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  published: "ເຜີຍແຜ່",
  scheduled: "ກຳນົດເວລາ",
  draft:     "ຮ່າງ",
  archived:  "ເກັບໄວ້",
};
const STATUS_COLOR: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-amber-100 text-amber-700",
  draft:     "bg-gray-100 text-gray-600",
  archived:  "bg-red-100 text-red-600",
};

export default async function BlogAdminPage() {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/blog-admin", locale });
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const posts = await getAllBlogPosts();
  const published = posts.filter((p) => p.status === "published").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const draft = posts.filter((p) => p.status === "draft").length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ບົດຄວາມທັງໝົດ</h1>
          <p className="mt-1 text-sm text-gray-500">ຈັດການບົດຄວາມຂອງທ່ານ</p>
        </div>
        <Link
          href={`/${locale}/blog-admin/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          ສ້າງບົດຄວາມໃໝ່
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "ທັງໝົດ",       value: posts.length, color: "bg-blue-50 text-blue-700" },
          { label: "ເຜີຍແຜ່ແລ້ວ", value: published,     color: "bg-green-50 text-green-700" },
          { label: "ກຳນົດເວລາ",   value: scheduled,     color: "bg-amber-50 text-amber-700" },
          { label: "ຮ່າງ",         value: draft,         color: "bg-gray-50 text-gray-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
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
                <td colSpan={4} className="px-4 py-12 text-center">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">ຍັງບໍ່ມີບົດຄວາມ</p>
                </td>
              </tr>
            ) : posts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 line-clamp-1">
                    {post.titleLo || post.titleTh || post.titleEn || post.slug}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">/{post.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[post.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[post.status] ?? post.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("lo-LA")
                    : new Date(post.createdAt).toLocaleDateString("lo-LA")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/${locale}/blog/${post.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title="ເບິ່ງ"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/${locale}/blog-admin/${post.id}/edit`}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                      title="ແກ້ໄຂ"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <DeletePostButton
                      postId={post.id}
                      postTitle={post.titleLo || post.titleTh || post.slug}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}