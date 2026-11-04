"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight, LayoutList, LayoutGrid, X } from "lucide-react";
import FilterBar from "@/components/research/FilterBar";
import ResearchGrid from "@/components/research/ResearchGrid";
import type { SortOption } from "@/lib/search";
import type { ResearchSearchResult, SearchMode } from "@/lib/data/research-search.server";
import type { Category } from "@/types/research";

/** หน่วงหลังหยุดพิมพ์ก่อนค้นหา — ทุกครั้งที่ URL เปลี่ยน เซิร์ฟเวอร์ต้อง render ใหม่
 * (รวมการค้นเนื้อหา PDF) จึงไม่ควรยิงทุกตัวอักษร */
const SEARCH_DEBOUNCE_MS = 400;

const isActiveValue = (value: string) => value !== "" && value !== "all";

/**
 * แสดงผลการค้นหาที่คำนวณจากเซิร์ฟเวอร์แล้ว (app/research/page.tsx เรียก
 * searchResearchServer() ตอน render) — component นี้ไม่ fetch/กรอง/เรียงลำดับ
 * ข้อมูลเองอีกต่อไป (ต่างจากเดิมที่โหลดงานวิจัยทั้งหมดมากรองฝั่ง Client ซึ่งทำ
 * ไม่ได้อีกแล้วสำหรับการค้นหาเนื้อหา PDF — ต้องตรวจสิทธิ์ที่เซิร์ฟเวอร์เสมอ)
 * หน้าที่เดียวของ component นี้คือรับ input แล้วอัปเดต URL — Next.js จะ
 * re-render หน้า (Server Component) พร้อมผลลัพธ์ใหม่ให้อัตโนมัติ
 */
export default function ResearchExplorer({
  categories,
  result,
  query,
  mode,
  categoryId,
  year,
  accessLevel,
  sort,
}: {
  categories: Category[];
  result: ResearchSearchResult;
  query: string;
  mode: SearchMode;
  categoryId: string;
  year: string;
  accessLevel: string;
  sort: SortOption;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("research");
  const locale = useLocale();
  const [view, setView] = useState<"list" | "grid">("list");
  // true ตั้งแต่สั่งเปลี่ยน URL จนกว่าเซิร์ฟเวอร์จะ render ผลลัพธ์ชุดใหม่เสร็จ
  const [isPending, startTransition] = useTransition();

  // ข้อความในช่องค้นหาแยกจาก `query` (ค่าใน URL) เพื่อให้พิมพ์ลื่นระหว่างรอ debounce/เซิร์ฟเวอร์
  const [draft, setDraft] = useState(query);
  const lastSentQuery = useRef(query);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // พารามิเตอร์ล่าสุดที่ "ตั้งใจ" จะให้เป็น — การนำทางใหม่จะยกเลิกอันที่ค้างอยู่ ดังนั้นถ้าเปลี่ยน
  // ตัวกรองแล้วพิมพ์ต่อทันที ต้องต่อยอดจากค่านี้ ไม่ใช่ searchParams ที่ยังไม่ทันอัปเดต
  const pendingParams = useRef(new URLSearchParams(searchParams.toString()));
  const searchParamsString = searchParams.toString();
  useEffect(() => {
    pendingParams.current = new URLSearchParams(searchParamsString);
  }, [searchParamsString]);

  // URL เปลี่ยนจากภายนอก (ไม่ใช่ที่เราส่งไปเอง) → ให้ช่องค้นหาตามค่าใน URL
  // แต่ถ้าผู้ใช้ยังพิมพ์ค้างอยู่ (timer ยังเดิน) ให้ถือข้อความที่พิมพ์เป็นหลัก
  useEffect(() => {
    if (query === lastSentQuery.current || debounceTimer.current) return;
    lastSentQuery.current = query;
    setDraft(query);
  }, [query]);

  // ออกจากหน้าแล้วอย่าให้ timer ที่ค้างอยู่ไปสั่งเปลี่ยน URL ทีหลัง
  useEffect(() => {
    const timerRef = debounceTimer;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function cancelDebounce() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }

  function navigate(params: URLSearchParams, method: "replace" | "push", scroll: boolean) {
    pendingParams.current = params;
    const href = `/research${params.toString() ? `?${params.toString()}` : ""}`;
    startTransition(() => {
      if (method === "push") router.push(href, { scroll });
      else router.replace(href, { scroll });
    });
  }

  function updateUrl(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(pendingParams.current.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // เปลี่ยนตัวกรองใดๆ ให้กลับไปหน้า 1 เสมอ (ผลลัพธ์ชุดใหม่)
    params.delete("page");
    navigate(params, "replace", false);
  }

  function commitQuery(value: string) {
    cancelDebounce();
    const next = value.trim();
    if (next === lastSentQuery.current) return;
    lastSentQuery.current = next;
    updateUrl({ q: next });
  }

  function handleQueryChange(value: string) {
    setDraft(value);
    cancelDebounce();
    // ล้างช่อง (รวมปุ่ม × ของ input type=search) → กลับไปแสดงทั้งหมดทันที ไม่ต้องรอ
    if (value.trim() === "") {
      commitQuery(value);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      commitQuery(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearAll() {
    cancelDebounce();
    lastSentQuery.current = "";
    setDraft("");
    // ล้างทุกอย่างยกเว้นการเรียงลำดับ (เป็นความชอบของผู้ใช้ ไม่ใช่ตัวกรอง)
    updateUrl({
      q: undefined,
      mode: undefined,
      category: undefined,
      year: undefined,
      access: undefined,
    });
    // ปุ่มล้างจะหายไปหลังล้าง — ย้ายโฟกัสไปช่องค้นหาแทนที่จะหลุดไปที่ body
    searchInputRef.current?.focus();
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(pendingParams.current.toString());
    params.set("page", String(page));
    navigate(params, "push", true);
  }

  const activeFilterCount = [categoryId, year, accessLevel].filter(isActiveValue).length;
  const hasAnythingToClear =
    draft.trim() !== "" || query !== "" || mode !== "all" || activeFilterCount > 0;

  const viewButtonClass = (active: boolean) =>
    `inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors sm:h-8 sm:w-8 ${
      active ? "bg-accent-soft text-accent-ink" : "text-gray-500 hover:text-gray-700"
    }`;
  const pageButtonClass =
    "inline-flex min-h-11 items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 sm:min-h-0 sm:px-3";

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        query={draft}
        mode={mode}
        categoryId={categoryId}
        year={year}
        accessLevel={accessLevel}
        sort={sort}
        years={result.years}
        categories={categories}
        activeFilterCount={activeFilterCount}
        searchInputRef={searchInputRef}
        onQueryChange={handleQueryChange}
        onQuerySubmit={() => commitQuery(draft)}
        onModeChange={(value) => updateUrl({ mode: value === "all" ? undefined : value })}
        onCategoryChange={(value) => updateUrl({ category: value })}
        onYearChange={(value) => updateUrl({ year: value })}
        onAccessLevelChange={(value) => updateUrl({ access: value })}
        onSortChange={(value) => updateUrl({ sort: value })}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-100 pb-3">
        <p className="text-sm text-gray-600" aria-live="polite" aria-atomic="true">
          {t("resultsFoundBefore")}{" "}
          <span className="font-semibold text-gray-900">
            {result.total.toLocaleString(locale === "en" ? "en-US" : "th-TH")}
          </span>{" "}
          {t("resultsFoundAfter")}
        </p>
        <div className="flex items-center gap-3">
          {hasAnythingToClear && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-accent-ink underline-offset-4 hover:underline sm:min-h-0 sm:py-1"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t("clearFilters")}
            </button>
          )}
          <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label={t("viewAsList")}
              aria-pressed={view === "list"}
              className={viewButtonClass(view === "list")}
            >
              <LayoutList className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label={t("viewAsGrid")}
              aria-pressed={view === "grid"}
              className={viewButtonClass(view === "grid")}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        aria-busy={isPending}
        className={`flex flex-col gap-6 transition-opacity motion-reduce:transition-none ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <ResearchGrid items={result.items} categories={categories} view={view} />

        {result.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, result.page - 1))}
              disabled={result.page <= 1}
              className={pageButtonClass}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t("prevPage")}
            </button>
            <span className="text-sm font-medium text-gray-500">
              {t("pageOf", { page: result.page, totalPages: result.totalPages })}
            </span>
            <button
              type="button"
              onClick={() => goToPage(Math.min(result.totalPages, result.page + 1))}
              disabled={result.page >= result.totalPages}
              className={pageButtonClass}
            >
              {t("nextPage")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
