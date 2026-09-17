import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Plus, FileText, Eye, Edit, Search } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/session";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getAllBlogPostsPaginated, getBlogPostStats } from "@/lib/data/blog.server";
import DeletePostButton from "@/components/blog-admin/DeletePostButton";
import Pagination from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  scheduled: "bg-amber-100 text-amber-700",
  draft:     "bg-gray-100 text-gray-600",
  archived:  "bg-red-100 text-red-600",
};

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login?redirect=/blog-admin", locale });
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return redirect({ href: "/403", locale });

  const t = await getTranslations("blogAdmin.list");
  const STATUS_LABEL: Record<string, string> = {
    published: t("statusPublished"),
    scheduled: t("statusScheduled"),
    draft: t("statusDraft"),
    archived: t("statusArchived"),
  };

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const page = Math.max(1, Number(params.page ?? 1));

  const [{ posts, totalPages }, stats] = await Promise.all([
    getAllBlogPostsPaginated({ page, search: q }),
    getBlogPostStats(),
  ]);
  const { published, scheduled, draft } = stats;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("heading")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Link
          href="/blog-admin/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("newPostButton")}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t("statTotal"),     value: stats.total,  color: "bg-blue-50 text-blue-700" },
          { label: t("statPublished"), value: published,     color: "bg-green-50 text-green-700" },
          { label: t("statScheduled"), value: scheduled,     color: "bg-amber-50 text-amber-700" },
          { label: t("statDraft"),     value: draft,         color: "bg-gray-50 text-gray-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          {t("search")}
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("colTitle")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colDate")}</th>
              <th className="px-4 py-3 font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">{q ? t("noResults") : t("emptyState")}</p>
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
                    ? new Date(post.publishedAt).toLocaleDateString(locale)
                    : new Date(post.createdAt).toLocaleDateString(locale)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title={t("viewTitle")}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/blog-admin/${post.id}/edit`}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                      title={t("editTitle")}
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

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(p) => `/blog-admin?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
      />
    </div>
  );
}