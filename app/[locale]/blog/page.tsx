export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import Container from "@/components/ui/Container";
import { Search } from "lucide-react";
import {
  getPublishedBlogPostsPaginated,
  getAllBlogTags,
} from "@/lib/data/blog.server";
import type { BlogPost } from "@/lib/data/blog.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("pageTitle") };
}

function getLocalizedField(post: BlogPost, field: "title" | "excerpt", locale: string): string {
  const map = {
    title:   { lo: post.titleLo,   th: post.titleTh,   en: post.titleEn,   vi: post.titleVi },
    excerpt: { lo: post.excerptLo, th: post.excerptTh, en: post.excerptEn, vi: post.excerptVi },
  };
  const values = map[field];
  return values[locale as keyof typeof values] || values.lo || values.th || values.en || values.vi || "—";
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
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {post.coverImage ? (
                  <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                    <Image
                      src={post.coverImage}
                      alt={getLocalizedField(post, "title", locale)}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-gradient-to-br from-brand-50 to-brand-100" />
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.tags.slice(0, 3).map((tag_) => (
                        <span key={tag_} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                          #{tag_}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="line-clamp-2 font-semibold text-gray-900 group-hover:text-brand-700">
                    {getLocalizedField(post, "title", locale)}
                  </h2>
                  <p className="line-clamp-3 text-sm text-gray-500">
                    {getLocalizedField(post, "excerpt", locale)}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-400">
                    <span>
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("lo-LA", {
                            year: "numeric", month: "short", day: "numeric",
                          })
                        : ""}
                    </span>
                    <span className="text-brand-600 font-medium group-hover:underline">
                      {t("readMore")} →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/blog?page=${page - 1}${tag ? `&tag=${tag}` : ""}${search ? `&q=${search}` : ""}`}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← {t("prevPage")}
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/blog?page=${p}${tag ? `&tag=${tag}` : ""}${search ? `&q=${search}` : ""}`}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  p === page
                    ? "bg-brand-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p}
              </Link>
            ))}
            {page < totalPages && (
              <Link
                href={`/blog?page=${page + 1}${tag ? `&tag=${tag}` : ""}${search ? `&q=${search}` : ""}`}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t("nextPage")} →
              </Link>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}