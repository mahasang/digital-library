"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

const ROUND_BUTTON =
  "pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#2B2118]/25 text-[#2B2118] transition-colors hover:bg-[#2B2118]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2B2118] aria-disabled:opacity-35 aria-disabled:hover:bg-transparent";

/** แถบควบคุมใต้ชั้น ไม่รับ pointer ที่พื้นหลังเพื่อให้ลากชั้นผ่านได้ */
export default function ShelfControls({
  index,
  count,
  title,
  onChange,
}: {
  index: number;
  count: number;
  title: string;
  onChange(index: number): void;
}) {
  const t = useTranslations("home");
  const position = (current: number) => t("shelfPosition", { current, total: count });
  // ใช้ aria-disabled แทน disabled ปุ่มจึงไม่เสียโฟกัสเมื่อกดถึงเล่มสุดท้าย
  const move = (next: number) => {
    if (next >= 0 && next < count) onChange(next);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        aria-label={t("shelfPrevious")}
        aria-disabled={index === 0}
        onClick={() => move(index - 1)}
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
            className="group pointer-events-auto flex min-w-0 flex-1 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2B2118]"
          >
            <span
              className={`block w-px transition-all ${
                bookIndex === index
                  ? "h-5 bg-[#2B2118]"
                  : "h-2.5 bg-[#2B2118]/40 group-hover:h-4 group-hover:bg-[#2B2118]/70"
              }`}
            />
          </button>
        ))}
      </div>

      <span className="min-w-0 flex-1 text-center text-sm tabular-nums text-[#2B2118] sm:hidden">
        {position(index + 1)}
      </span>

      <button
        type="button"
        aria-label={t("shelfNext")}
        aria-disabled={index === count - 1}
        onClick={() => move(index + 1)}
        className={ROUND_BUTTON}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      <span className="sr-only" aria-live="polite">
        {`${position(index + 1)}: ${title}`}
      </span>
    </div>
  );
}
