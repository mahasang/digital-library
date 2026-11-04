"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ShelfBook } from "@/components/home/shelf/types";

/** แถบชั้นเต็มความกว้าง กันความสูงไว้ตั้งแต่ HTML แรกเพื่อไม่ให้เกิด layout shift */
export default function HeroShelf({
  books,
  children,
}: {
  books: ShelfBook[];
  children: ReactNode;
}) {
  const t = useTranslations("home");

  return (
    <section
      data-testid="hero-shelf"
      data-shelf-count={books.length}
      aria-label={t("shelfLabel")}
      className="relative h-[260px] border-b-[10px] border-[#5A3A26] sm:h-[clamp(280px,38vh,420px)]"
    >
      {children}
    </section>
  );
}
