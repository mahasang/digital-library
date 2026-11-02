"use client";

import { useState, type FormEvent, type Ref } from "react";
import { Search, SlidersHorizontal, ChevronDown, BookText, FileSearch, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { sortOptions, type SortOption } from "@/lib/search";
import type { SearchMode } from "@/lib/data/research-search.server";
import type { AccessLevel, Category } from "@/types/research";

const ACCESS_LEVEL_VALUES: AccessLevel[] = ["public", "member_only", "staff_only", "read_only", "metadata_only"];

const MODE_VALUES: SearchMode[] = ["all", "bibliographic", "pdf"];
const MODE_ICONS: Record<SearchMode, typeof Layers> = {
  all: Layers,
  bibliographic: BookText,
  pdf: FileSearch,
};
const MODE_LABEL_KEYS: Record<SearchMode, string> = {
  all: "searchModeAll",
  bibliographic: "searchModeBibliographic",
  pdf: "searchModePdf",
};

// text-base (16px) บนมือถือ — iOS Safari ซูมหน้าเองเมื่อโฟกัสช่องที่ตัวอักษรเล็กกว่า 16px;
// min-h-11 (44px) ให้พื้นที่แตะพอ แล้วคืนขนาดกะทัดรัดเดิมตั้งแต่ breakpoint sm
const SELECT_CLASS =
  "min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-surface px-3 py-2 text-base text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:min-h-0 sm:w-auto sm:text-sm";

interface FilterBarProps {
  /** ข้อความที่ผู้ใช้กำลังพิมพ์ (draft) — การหน่วงเวลา/ส่งเข้า URL อยู่ที่ ResearchExplorer */
  query: string;
  mode: SearchMode;
  categoryId: string;
  year: string;
  accessLevel: string;
  sort: SortOption;
  years: number[];
  categories: Category[];
  /** จำนวนตัวกรอง (หมวดหมู่/ปี/สิทธิ์) ที่ใช้อยู่ — แสดงเป็นตัวเลขบนปุ่มพับ/กางในมือถือ */
  activeFilterCount: number;
  searchInputRef?: Ref<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onQuerySubmit: () => void;
  onModeChange: (value: SearchMode) => void;
  onCategoryChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onAccessLevelChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
}

export default function FilterBar({
  query,
  mode,
  categoryId,
  year,
  accessLevel,
  sort,
  years,
  categories,
  activeFilterCount,
  searchInputRef,
  onQueryChange,
  onQuerySubmit,
  onModeChange,
  onCategoryChange,
  onYearChange,
  onAccessLevelChange,
  onSortChange,
}: FilterBarProps) {
  const t = useTranslations("research");
  const tAccessLevels = useTranslations("accessLevels");
  // มือถือ: พับตัวกรองไว้ก่อน แต่ถ้าเข้ามาพร้อมตัวกรอง (เช่นลิงก์หมวดหมู่จากหน้าแรก)
  // ให้กางไว้ เพื่อให้เห็นว่ากำลังกรองอะไรอยู่ — ตั้งแต่ sm ขึ้นไปแสดงเสมอ (ไม่ขึ้นกับ state นี้)
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onQuerySubmit();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-4 shadow-elevated-sm sm:p-5">
      <form
        role="search"
        onSubmit={handleSubmit}
        className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-brand-400 focus-within:bg-surface focus-within:ring-1 focus-within:ring-brand-400"
      >
        <Search className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full border-0 bg-transparent text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0"
        />
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MODE_VALUES.map((value) => {
          const Icon = MODE_ICONS[value];
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t(MODE_LABEL_KEYS[value])}
            </button>
          );
        })}
      </div>

      {/*
        แถวตัวกรอง — มือถือ: ปุ่มตัวกรอง (n) แบบเต็มความกว้าง → กางหมวดหมู่/ปี/สิทธิ์ → เรียงลำดับ
        (เรียงลำดับไม่แชร์แถวกับปุ่ม เพราะข้อความ "เรียงตาม: …" ยาวเกินครึ่งจอ จะถูกตัดจนไม่เห็นค่าที่เลือก)
        เดสก์ท็อป (sm+): แถวเดียวเหมือนเดิม — แผงตัวกรองเป็น display:contents
        เพื่อให้ select ทั้งสามเป็นลูกของแถวนี้โดยตรง
      */}
      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="research-filter-panel"
          className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-surface px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:hidden"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {t("filterResultsLabel")}
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform motion-reduce:transition-none ${filtersOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <div className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 sm:flex">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("filterResultsLabel")}
        </div>

        <div
          id="research-filter-panel"
          className={`flex-col gap-3 sm:contents ${
            filtersOpen ? "flex" : "hidden"
          }`}
        >
          <select
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label={t("filterByCategoryAriaLabel")}
            className={SELECT_CLASS}
          >
            <option value="all">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameTh}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => onYearChange(e.target.value)}
            aria-label={t("filterByYearAriaLabel")}
            className={SELECT_CLASS}
          >
            <option value="all">{t("allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={accessLevel}
            onChange={(e) => onAccessLevelChange(e.target.value)}
            aria-label={t("filterByAccessAriaLabel")}
            className={SELECT_CLASS}
          >
            <option value="all">{t("allAccess")}</option>
            {ACCESS_LEVEL_VALUES.map((value) => (
              <option key={value} value={value}>
                {tAccessLevels(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto sm:border-l sm:border-gray-200 sm:pl-3">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label={t("sortResultsAriaLabel")}
            className={SELECT_CLASS}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t("sortByPrefix")} {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
