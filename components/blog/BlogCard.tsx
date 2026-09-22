import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import type { BlogPost } from "@/lib/data/blog.server";

function getLocalizedField(
  post: BlogPost,
  field: "title" | "excerpt",
  locale: string
): string {
  const map = {
    title:   { lo: post.titleLo,   th: post.titleTh,   en: post.titleEn,   vi: post.titleVi },
    excerpt: { lo: post.excerptLo, th: post.excerptTh, en: post.excerptEn, vi: post.excerptVi },
  };
  const values = map[field];
  return (
    values[locale as keyof typeof values] ||
    values.lo || values.th || values.en || values.vi || "—"
  );
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(
    locale === "lo" ? "lo-LA" : locale === "th" ? "th-TH" : "en-GB",
    { day: "2-digit", month: "short", year: "numeric" }
  );
}

export default function BlogCard({
  post,
  locale,
  readMoreLabel,
}: {
  post: BlogPost;
  locale: string;
  readMoreLabel: string;
}) {
  const title  = getLocalizedField(post, "title", locale);
  const tags   = post.tags?.slice(0, 2) ?? [];
  const date   = formatDate(post.publishedAt, locale);
  const author = post.authors?.[0] ?? null;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg">

      {/* ── Cover image ── */}
      <Link href={`/blog/${post.slug}`} className="block overflow-hidden">
        {post.coverImage ? (
          <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
            <Image
              src={post.coverImage}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-gradient-to-br from-indigo-100 via-blue-50 to-violet-100" />
        )}
      </Link>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4">

        {/* Tags + Date */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 items-center gap-1 font-medium text-brand-600">
            {tags.length > 0 ? (
              tags.map((tag, i) => (
                <span key={tag} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-300">|</span>}
                  <span className="truncate">{tag}</span>
                </span>
              ))
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </div>
          {date && (
            <div className="flex shrink-0 items-center gap-1 text-gray-400">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{date}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <Link href={`/blog/${post.slug}`}>
          <h2 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-brand-700">
            {title}
          </h2>
        </Link>

        {/* Author */}
        {author && (
          <div className="flex items-center gap-2">
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={author.fullName ?? ""}
                width={24}
                height={24}
                className="rounded-full object-cover ring-1 ring-gray-200"
              />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 ring-1 ring-gray-200">
                {(author.fullName ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs text-gray-500">
              By{" "}
              <span className="font-medium text-gray-700">
                {author.fullName ?? "—"}
              </span>
            </span>
          </div>
        )}

        {/* Divider + Read More */}
        <div className="mt-auto border-t border-dashed border-gray-200 pt-3">
          <Link
            href={`/blog/${post.slug}`}
            className="inline-block rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-brand-600 hover:text-brand-700"
          >
            {readMoreLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}