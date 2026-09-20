import { Link } from "@/i18n/navigation";
import Image from "next/image";
import type { BlogPost } from "@/lib/data/blog.server";

function getLocalizedField(post: BlogPost, field: "title" | "excerpt", locale: string): string {
  const map = {
    title:   { lo: post.titleLo,   th: post.titleTh,   en: post.titleEn,   vi: post.titleVi },
    excerpt: { lo: post.excerptLo, th: post.excerptTh, en: post.excerptEn, vi: post.excerptVi },
  };
  const values = map[field];
  return values[locale as keyof typeof values] || values.lo || values.th || values.en || values.vi || "—";
}

/**
 * การ์ดบทความ 1 ชิ้นในหน้ารายการ blog — แยกออกมาจาก app/[locale]/blog/page.tsx
 * (เดิมเขียน inline) ให้เป็น component ต่างหากเหมือน ResearchCard.tsx —
 * shadow ใช้ shadow-elevated-md (ไม่ใช่ shadow-md ของ Tailwind ตรงๆ อย่างที่
 * เคยเป็น) ให้ theme-aware เหมือน ResearchCard ทุกประการ, fallback ไม่มีปก
 * ใช้ accent-soft/surface-muted (ตัวแปร CSS ตาม theme) แทน brand-50/100 เดิม
 * ที่เป็นสีคงที่ไม่เปลี่ยนตามธีม
 */
export default function BlogCard({
  post,
  locale,
  readMoreLabel,
}: {
  post: BlogPost;
  locale: string;
  readMoreLabel: string;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated-md"
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
        <div className="aspect-video w-full bg-gradient-to-br from-accent-soft to-surface-muted" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                #{tag}
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
            {readMoreLabel} →
          </span>
        </div>
      </div>
    </Link>
  );
}
