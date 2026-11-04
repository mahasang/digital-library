"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

const ROUND_BUTTON =
  "pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-35 disabled:hover:bg-transparent";

/** แถบควบคุมวางบนไม้ชั้น ไม่รับ pointer ที่พื้นหลังเพื่อให้ลากชั้นผ่านได้ */
export default function ShelfControls({
  index,
  count,
  title,
  onChange,
  onInspect,
}: {
  index: number;
  count: number;
  title: string;
  onChange(index: number): void;
  onInspect(): void;
}) {
  const t = useTranslations("home");
  const position = (current: number) => t("shelfPosition", { current, total: count });

  return (
    <div className="pointer-events-none absolute inset-x-0 -bottom-[10px] mx-auto flex h-11 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        aria-label={t("shelfPrevious")}
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
        className={ROUND_BUTTON}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="hidden h-11 min-w-0 flex-1 items-stretch sm:flex">
        {Array.from({ length: count }, (_, bookIndex) => (
          <button
            key={bookIndex}
            type="button"
            aria-label={position(bookIndex + 1)}
            aria-current={bookIndex === index ? "true" : undefined}
            onClick={() => onChange(bookIndex)}
            className="group pointer-events-auto flex min-w-0 flex-1 items-center px-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span
              className={`block h-0.5 w-full transition-colors ${
                bookIndex === index ? "bg-white" : "bg-white/35 group-hover:bg-white/70"
              }`}
            />
          </button>
        ))}
      </div>

      <span className="min-w-0 flex-1 text-center text-sm tabular-nums text-white sm:hidden">
        {position(index + 1)}
      </span>

      <button
        type="button"
        aria-label={t("shelfNext")}
        disabled={index === count - 1}
        onClick={() => onChange(index + 1)}
        className={ROUND_BUTTON}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onInspect}
        className="pointer-events-auto inline-flex h-11 shrink-0 items-center px-2 text-sm font-medium text-white underline decoration-white/50 underline-offset-4 transition-colors hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        {t("shelfInspect")}
      </button>

      <span className="sr-only" aria-live="polite">
        {`${position(index + 1)}: ${title}`}
      </span>
    </div>
  );
}
