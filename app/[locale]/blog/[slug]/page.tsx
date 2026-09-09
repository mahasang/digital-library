export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Container from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import ReactMarkdown from "react-markdown";
import {
  getPublishedBlogPostBySlug,
  getRelatedBlogPosts,
} from "@/lib/data/blog.server";
import type { BlogPost } from "@/lib/data/blog.server";
import { BlogCommentSection } from "@/components/blog/BlogCommentSection";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) return {};
  const title =
    locale === "lo" ? post.titleLo :
    locale === "th" ? post.titleTh :
    locale === "vi" ? post.titleVi : post.titleEn;
  return { title: title || post.titleLo };
}

function getLocalizedField(post: BlogPost, field: "title" | "excerpt" | "content", locale: string): string {
  const map = {
    title:   { lo: post.titleLo,   th: post.titleTh,   en: post.titleEn,   vi: post.titleVi },
    excerpt: { lo: post.excerptLo, th: post.excerptTh, en: post.excerptEn, vi: post.excerptVi },
    content: { lo: post.contentLo, th: post.contentTh, en: post.contentEn, vi: post.contentVi },
  };
  const values = map[field];
  return values[locale as keyof typeof values] || values.lo || values.th || values.en || values.vi || "";
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations("blog");
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();

  const title   = getLocalizedField(post, "title", locale);
  const content = getLocalizedField(post, "content", locale);

  const related = await getRelatedBlogPosts(slug, post.tags ?? [], 3);

  const supabase = await createClient();
  const { data: commentsData } = await supabase.rpc("get_blog_comments", {
    p_blog_post_id: post.id,
    p_limit: 100,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  type BlogCommentRow = {
    id: string;
    content: string;
    created_at: string;
    updated_at?: string | null;
    user_id: string;
    author_name: string;
    author_avatar_url: string | null;
  };
  const initialComments = (commentsData ?? []) as BlogCommentRow[];

  return (
    <div className="py-12 sm:py-16">
      <Container className="max-w-3xl">
        <Link href="/blog" className="mb-6 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          ← {t("heading")}
        </Link>

        {post.coverImage && (
          <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-2xl bg-gray-100">
            <Image src={post.coverImage} alt={title} fill className="object-cover" />
          </div>
        )}

        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>

        {post.publishedAt && (
          <p className="mt-2 text-sm text-gray-400">
            {t("publishedOn")}{" "}
            {new Date(post.publishedAt).toLocaleDateString("lo-LA", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        )}

        {/* ── Tags ── */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div className="prose prose-gray prose-headings:font-bold prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline mt-8 max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {/* ── Related posts ── */}
        {related.length > 0 && (
          <div className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="mb-4 text-lg font-bold text-gray-900">{t("relatedPosts")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/blog/${rel.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  {rel.coverImage ? (
                    <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                      <Image
                        src={rel.coverImage}
                        alt={getLocalizedField(rel, "title", locale)}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-brand-50 to-brand-100" />
                  )}
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-brand-700">
                      {getLocalizedField(rel, "title", locale)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <BlogCommentSection
          blogPostId={post.id}
          initialComments={initialComments}
          currentUserId={currentUserId}
        />
      </Container>
    </div>
  );
}