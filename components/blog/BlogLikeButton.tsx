"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Heart, Loader2 } from "lucide-react";
import { toggleBlogFavoriteAction } from "@/app/[locale]/blog/[slug]/actions";

export function BlogLikeButton({
  blogPostId,
  initialFavorited,
  initialCount,
  isLoggedIn,
}: {
  blogPostId: string;
  initialFavorited: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }

    setError(null);
    setIsPending(true);
    const result = await toggleBlogFavoriteAction(blogPostId, locale);
    setIsPending(false);

    if (result.error || result.favorited === null) {
      setError(result.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    setFavorited(result.favorited);
    setCount((prev) => (result.favorited ? prev + 1 : Math.max(0, prev - 1)));
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={favorited}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          favorited
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
            : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Heart
            className={`h-4 w-4 ${favorited ? "fill-red-600 dark:fill-red-400" : ""}`}
            aria-hidden="true"
          />
        )}
        <span>{favorited ? "ຖືກໃຈແລ້ວ" : "ຖືກໃຈ"}</span>
        {count > 0 && (
          <span className="text-xs opacity-70">({count})</span>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
