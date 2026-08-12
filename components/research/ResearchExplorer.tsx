"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FilterBar from "@/components/research/FilterBar";
import ResearchGrid from "@/components/research/ResearchGrid";
import type { SortOption } from "@/lib/search";
import type { ResearchSearchResult, SearchMode } from "@/lib/data/research-search.server";
import type { Category } from "@/types/research";

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

  function updateUrl(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // เปลี่ยนตัวกรองใดๆ ให้กลับไปหน้า 1 เสมอ (ผลลัพธ์ชุดใหม่)
    params.delete("page");
    router.replace(`/research${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/research${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: true,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        query={query}
        mode={mode}
        categoryId={categoryId}
        year={year}
        accessLevel={accessLevel}
        sort={sort}
        years={result.years}
        categories={categories}
        onQueryChange={(value) => updateUrl({ q: value })}
        onModeChange={(value) => updateUrl({ mode: value === "all" ? undefined : value })}
        onCategoryChange={(value) => updateUrl({ category: value })}
        onYearChange={(value) => updateUrl({ year: value })}
        onAccessLevelChange={(value) => updateUrl({ access: value })}
        onSortChange={(value) => updateUrl({ sort: value })}
      />

      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <p className="text-sm text-gray-600">
          พบ <span className="font-semibold text-gray-900">{result.total.toLocaleString("th-TH")}</span> รายการ
        </p>
      </div>

      <ResearchGrid items={result.items} />

      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, result.page - 1))}
            disabled={result.page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            ก่อนหน้า
          </button>
          <span className="text-sm font-medium text-gray-500">
            หน้า {result.page} / {result.totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(result.totalPages, result.page + 1))}
            disabled={result.page >= result.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ถัดไป
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
