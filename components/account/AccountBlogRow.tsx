import Image from "next/image";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import type { FavoriteBlogPost } from "@/lib/data/favorites.server";

export default function AccountBlogRow({
  post,
  locale,
}: {
  post: FavoriteBlogPost;
  locale: string;
}) {
  const title =
    locale === "lo"
      ? post.titleLo
      : locale === "th"
      ? post.titleTh
      : locale === "vi"
      ? post.titleVi
      : post.titleEn || post.titleLo;

  return (
    <div className="group relative flex gap-3 rounded-xl border border-gray-200 bg-surface p-3 transition-shadow hover:shadow-elevated-sm sm:gap-4 sm:p-4">
      {/* Cover */}
      <div className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-28 sm:w-20">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={title}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-50">
            <Newspaper className="h-7 w-7 text-brand-300" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
        <div>
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            <Link
              href={`/blog/${post.slug}`}
              className="static after:absolute after:inset-0"
            >
              {title || post.slug}
            </Link>
          </h2>
          {post.publishedAt && (
            <p className="mt-1 text-xs text-gray-500">
              {new Date(post.publishedAt).toLocaleDateString("lo-LA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
          <Newspaper className="h-3 w-3" />
          ບົດຄວາມ
        </span>
      </div>
    </div>
  );
}
