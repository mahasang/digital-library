"use client";

import { Search, SlidersHorizontal, BookText, FileSearch, Layers } from "lucide-react";
import { sortOptions, type SortOption } from "@/lib/search";
import type { SearchMode } from "@/lib/data/research-search.server";
import { accessLevelLabels } from "@/lib/labels";
import type { AccessLevel, Category } from "@/types/research";

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

const MODE_OPTIONS: { value: SearchMode; label: string; icon: typeof Layers }[] = [
  { value: "all", label: "ค้นหาทั้งหมด", icon: Layers },
  { value: "bibliographic", label: "ข้อมูลบรรณานุกรม", icon: BookText },
  { value: "pdf", label: "เนื้อหา PDF", icon: FileSearch },
];

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
  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-4 shadow-elevated-sm sm:p-5">
      <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-brand-400 focus-within:bg-surface focus-within:ring-1 focus-within:ring-brand-400">
        <Search className="h-5 w-5 shrink-0 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="ค้นหาชื่อเรื่อง ผู้วิจัย หน่วยงาน คำสำคัญ หรือเนื้อหาในเอกสาร..."
          className="w-full border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0 sm:text-base"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onModeChange(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
          <SlidersHorizontal className="h-4 w-4" />
          กรองผลลัพธ์
        </div>

        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="กรองตามหมวดหมู่"
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameTh}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          aria-label="กรองตามปี"
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">ทุกปี</option>
          {years.map((y) => (
            <option key={y} value={y}>
              พ.ศ. {y}
            </option>
          ))}
        </select>

        <select
          value={accessLevel}
          onChange={(e) => onAccessLevelChange(e.target.value)}
          aria-label="กรองตามระดับสิทธิ์"
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">ทุกระดับสิทธิ์</option>
          {(Object.entries(accessLevelLabels) as [AccessLevel, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 sm:ml-auto sm:border-l sm:border-gray-200 sm:pl-3">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label="เรียงลำดับผลลัพธ์"
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                เรียงตาม: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
