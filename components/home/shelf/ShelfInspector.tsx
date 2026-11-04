"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ShelfBook } from "@/components/home/shelf/types";

/** แผงข้อมูลในโหมดดูเล่ม อยู่ขวาบนจอกว้าง และเป็น bottom sheet บนจอเล็ก */
export default function ShelfInspector({
  book,
  onClose,
}: {
  book: ShelfBook;
  onClose(): void;
}) {
  const t = useTranslations("home");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div data-shelf-panel className="absolute inset-x-0 bottom-0 flex max-h-[48%] flex-col gap-5 overflow-y-auto bg-[#F4EEE2] p-6 text-[#2B2118] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[26rem] lg:justify-center lg:p-10">
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B2118]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("shelfClose")}
      </button>

      <div>
        {book.categoryName && <p className="text-sm text-[#5C4D3C]">{book.categoryName}</p>}
        <h2 className="mt-2 text-h2 font-medium">{book.title}</h2>
        <p className="mt-3 text-sm text-[#5C4D3C]">
          {book.authors && <span>{book.authors} · </span>}
          <span className="tabular-nums">{book.year}</span>
        </p>
      </div>

      {book.abstract && (
        <p data-testid="shelf-abstract" className="text-sm leading-relaxed">
          {book.abstract}
        </p>
      )}

      <Link
        href={`/research/${book.id}`}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-md bg-[#2B2118] px-5 text-sm font-medium text-[#F4EEE2] transition-colors hover:bg-[#46362A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B2118]"
      >
        {t("shelfRead")}
      </Link>
    </div>
  );
}
