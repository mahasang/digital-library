
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import Container from "@/components/ui/Container";
import { getPublishedBlogPosts } from "@/lib/data/blog.server";
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
    title: { lo: post.titleLo, th: post.titleTh, en: post.titleEn, vi: post.titleVi },
    excerpt: { lo: post.excerptLo, th: post.excerptTh, en: post.excerptEn, vi: post.excerptVi },
  };
  const values = map[field];
  return (
    values[locale as keyof typeof values] ||
    values.lo || values.th || values.en || values.vi || "—"
  );
}

export default async function BlogPage() {
  const locale = await getLocale();
  const t = await getTranslations("blog");
  const posts = await getPublishedBlogPosts();

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t("heading")}</h1>
          <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
            <p className="font-medium text-gray-500">{t("noPosts")}</p>
            <p className="mt-1 text-sm text-gray-400">{t("noPostsHint")}</p>
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
      </Container>
    </div>
  );
}