"use client";

import { Search, SlidersHorizontal, BookText, FileSearch, Layers } from "lucide-react";
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

interface FilterBarProps {
  query: string;
  mode: SearchMode;
  categoryId: string;
  year: string;
  accessLevel: string;
  sort: SortOption;
  years: number[];
  categories: Category[];
  onQueryChange: (value: string) => void;
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
  onQueryChange,
  onModeChange,
  onCategoryChange,
  onYearChange,
  onAccessLevelChange,
  onSortChange,
}: FilterBarProps) {
  const t = useTranslations("research");
  const tAccessLevels = useTranslations("accessLevels");
  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-4 shadow-elevated-sm sm:p-5">
      <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-brand-400 focus-within:bg-surface focus-within:ring-1 focus-within:ring-brand-400">
        <Search className="h-5 w-5 shrink-0 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0 sm:text-base"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MODE_VALUES.map((value) => {
          const Icon = MODE_ICONS[value];
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(MODE_LABEL_KEYS[value])}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
          <SlidersHorizontal className="h-4 w-4" />
          {t("filterResultsLabel")}
        </div>

        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label={t("filterByCategoryAriaLabel")}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">{t("allYears")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {t("yearPrefix")} {y}
            </option>
          ))}
        </select>

        <select
          value={accessLevel}
          onChange={(e) => onAccessLevelChange(e.target.value)}
          aria-label={t("filterByAccessAriaLabel")}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">{t("allAccess")}</option>
          {ACCESS_LEVEL_VALUES.map((value) => (
            <option key={value} value={value}>
              {tAccessLevels(value)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 sm:ml-auto sm:border-l sm:border-gray-200 sm:pl-3">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label={t("sortResultsAriaLabel")}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
