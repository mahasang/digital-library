"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toggleFavoriteAction } from "@/app/research/[id]/actions";

export default function FavoriteButton({
  researchSlug,
  initialFavorited,
  isLoggedIn,
  variant = "default",
}: {
  researchSlug: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  /** "compact" ใช้ในแถว action รอง (tertiary) — เปลี่ยนเฉพาะขนาด/รูปแบบ
   * การแสดงผล ไม่มีผลต่อ logic การเพิ่ม/ลบรายการโปรดใดๆ */
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/research/${researchSlug}`);
      return;
    }

    setError(null);
    setIsPending(true);
    const result = await toggleFavoriteAction(researchSlug);
    setIsPending(false);

    if (result.error || result.favorited === null) {
      setError(result.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    setFavorited(result.favorited);
    router.refresh();
  }

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          aria-pressed={favorited}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            favorited
              ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Heart className={`h-3.5 w-3.5 ${favorited ? "fill-red-600" : ""}`} />
          )}
          {favorited ? "อยู่ในรายการโปรด" : "เพิ่มรายการโปรด"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={favorited}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
          favorited
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`h-4 w-4 ${favorited ? "fill-red-600" : ""}`} />
        )}
        {favorited ? "อยู่ในรายการโปรด" : "เพิ่มในรายการโปรด"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
