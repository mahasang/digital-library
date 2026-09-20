export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Container from "@/components/ui/Container";
import Pagination from "@/components/ui/Pagination";
import BlogCard from "@/components/blog/BlogCard";
import { Search } from "lucide-react";
import {
  getPublishedBlogPostsPaginated,
  getAllBlogTags,
} from "@/lib/data/blog.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("pageTitle") };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string; q?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("blog");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1));
  const tag = params.tag?.trim() || undefined;
  const search = params.q?.trim() || undefined;

  const [{ posts, total, totalPages }, allTags] = await Promise.all([
    getPublishedBlogPostsPaginated({ page, tag, search }),
    getAllBlogTags(),
  ]);

  return (
    <div className="py-12 sm:py-16">
      <Container>
        {/* ── Header ── */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t("heading")}</h1>
          <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        {/* ── Search ── */}
        <form method="get" className="mb-6 flex gap-2">
          {tag && <input type="hidden" name="tag" value={tag} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            {t("search")}
          </button>
        </form>

        {/* ── Tags ── */}
        {allTags.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <Link
              href="/blog"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !tag ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t("allPosts")}
            </Link>
            {allTags.map((t_) => (
              <Link
                key={t_}
                href={`/blog?tag=${encodeURIComponent(t_)}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tag === t_ ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                #{t_}
              </Link>
            ))}
          </div>
        )}

        {/* ── Results info ── */}
        {(search || tag) && (
          <p className="mb-4 text-sm text-gray-500">
            {t("foundPosts", { count: total })}
            {tag && <span> #{tag}</span>}
            {search && <span> &quot;{search}&quot;</span>}
          </p>
        )}

        {/* ── Grid ── */}
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
            <p className="font-medium text-gray-500">{t("noPosts")}</p>
            <p className="mt-1 text-sm text-gray-400">{t("noPostsHint")}</p>
            {(search || tag) && (
              <Link href="/blog" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
                ← {t("allPosts")}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} locale={locale} readMoreLabel={t("readMore")} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          buildHref={(p) =>
            `/blog?page=${p}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`
          }
        />
      </Container>
    </div>
  );
}