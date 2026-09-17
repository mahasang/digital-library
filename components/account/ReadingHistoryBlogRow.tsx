"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BookOpenText, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReadingHistoryBlogPost } from "@/lib/data/favorites.server";

function getLocalizedField(
  item: ReadingHistoryBlogPost,
  field: "title" | "excerpt",
  locale: string
): string {
  const map = {
    title: { lo: item.titleLo, th: item.titleTh, en: item.titleEn, vi: item.titleVi },
    excerpt: { lo: item.excerptLo, th: item.excerptTh, en: item.excerptEn, vi: item.excerptVi },
  };
  const values = map[field];
  return values[locale as keyof typeof values] || values.lo || values.th || values.en || values.vi || "";
}

/**
 * แถวรายการบทความ blog สำหรับหน้าประวัติการอ่านโดยเฉพาะ — คู่กับ
 * AccountResearchRow (โครงสร้าง/สไตล์เดียวกันเพื่อให้ mixed timeline ดู
 * สอดคล้องกัน) ไม่ใช่ตัวเดียวกับ AccountBlogRow.tsx ซึ่งเป็นคนละ component
 * ที่มีอยู่ก่อนแล้วสำหรับหน้า /favorites (รับ props ต่างกัน: post/locale
 * ไม่มี readAt, ไม่มี excerpt) — ตั้งชื่อแยกกันชัดเจนเพื่อไม่ให้ชนกัน
 */
export default function ReadingHistoryBlogRow({
  item,
  readAt,
}: {
  item: ReadingHistoryBlogPost;
  readAt?: string;
}) {
  const t = useTranslations("accountBlogRow");
  const locale = useLocale();
  const title = getLocalizedField(item, "title", locale);
  const excerpt = getLocalizedField(item, "excerpt", locale);

  return (
    <div className="group relative flex gap-3 rounded-xl border border-gray-200 bg-surface p-3 transition-shadow hover:shadow-elevated-sm sm:gap-4 sm:p-4">
      <div className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-28 sm:w-20">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={t("coverAlt", { title })}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <BookOpenText className="h-6 w-6 text-brand-300" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
        <div>
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            <Link href={`/blog/${item.slug}`} className="static after:absolute after:inset-0">
              {title}
            </Link>
          </h2>
          {excerpt && <p className="mt-1 line-clamp-1 text-xs text-gray-500">{excerpt}</p>}
        </div>
        {readAt && (
          <span className="flex items-center gap-1 text-xs text-gray-500 sm:hidden">
            <Clock className="h-3.5 w-3.5" />
            {t("readAt")}{" "}
            {new Date(readAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}
      </div>

      {readAt && (
        <div className="hidden shrink-0 flex-col items-end justify-between gap-2 sm:flex">
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            {t("readAt")}{" "}
            {new Date(readAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <Link
            href={`/blog/${item.slug}`}
            aria-label={t("continueReadingAria", { title })}
            className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-soft-hover"
          >
            <BookOpenText className="h-3.5 w-3.5" />
            {t("continueReading")}
          </Link>
        </div>
      )}
    </div>
  );
}
