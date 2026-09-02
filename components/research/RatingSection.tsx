"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star, Loader2 } from "lucide-react";
import { upsertRatingAction } from "@/app/[locale]/research/[id]/actions";

function StarButton({
  filled,
  onClick,
  onMouseEnter,
  onMouseLeave,
  disabled,
  label,
}: {
  filled: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      aria-label={label}
      className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Star
        className={`h-7 w-7 ${filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
      />
    </button>
  );
}

export default function RatingSection({
  researchId,
  avgScore,
  ratingCount,
  myRating,
  isLoggedIn,
}: {
  researchId: string;
  avgScore: number;
  ratingCount: number;
  myRating: number | null;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("research.detail.rating");
  const router = useRouter();
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(myRating ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRate(score: number) {
    if (!isLoggedIn) {
      router.push(`/login`);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await upsertRatingAction(researchId, score);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSelected(score);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">{t("title")}</h3>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        {/* Average */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-bold text-brand-600">
            {ratingCount > 0 ? avgScore.toFixed(1) : t("noRatings")}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i <= Math.round(avgScore) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {ratingCount} {t("count")}
          </span>
        </div>

        <div className="h-px bg-gray-200 sm:h-12 sm:w-px" />

        {/* Rate */}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">
            {isLoggedIn ? t("label") : t("loginPrompt")}
          </p>
          {isLoggedIn && (
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHovered(0)}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              ) : (
                [1, 2, 3, 4, 5].map((i) => (
                  <StarButton
                    key={i}
                    filled={i <= (hovered || selected)}
                    onClick={() => handleRate(i)}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    disabled={loading}
                    label={`${i}`}
                  />
                ))
              )}
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
