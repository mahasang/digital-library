import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Container from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import ReactMarkdown from "react-markdown";
import { getPublishedBlogPostBySlug } from "@/lib/data/blog.server";
import type { BlogPost } from "@/lib/data/blog.server";

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
  return (
    values[locale as keyof typeof values] ||
    values.lo || values.th || values.en || values.vi || ""
  );
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

        <div className="prose prose-gray mt-8 max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </Container>
    </div>
  );
}