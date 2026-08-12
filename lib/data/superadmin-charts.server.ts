import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DataResult } from "@/lib/data/superadmin-stats.server";

export type ChartGranularity = "day" | "month";

export interface TimeSeriesPoint {
  bucket: string;
  count: number;
}

export interface ViewsDownloadsPoint {
  bucket: string;
  views: number;
  downloads: number;
}

export interface CategoryCount {
  categoryName: string;
  count: number;
}

function bucketOf(dateStr: string, granularity: ChartGranularity): string {
  return granularity === "month" ? dateStr.slice(0, 7) : dateStr.slice(0, 10);
}

/** สร้างรายการ bucket ทุกช่วงในขอบเขตวันที่ (แม้ไม่มีข้อมูล) เพื่อให้กราฟต่อเนื่อง */
function allBuckets(from: string, toExclusive: string, granularity: ChartGranularity): string[] {
  const buckets: string[] = [];
  const start = new Date(from);
  const end = new Date(toExclusive);

  if (granularity === "month") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor < end) {
      buckets.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const cursor = new Date(start);
    while (cursor < end) {
      buckets.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return buckets;
}

/** สมาชิกใหม่รายวัน/รายเดือนในช่วงวันที่ที่เลือก */
export async function getNewMembersTimeSeries(
  from: string,
  toExclusive: string,
  granularity: ChartGranularity
): Promise<DataResult<TimeSeriesPoint[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", from)
      .lt("created_at", toExclusive);
    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const bucket = bucketOf(row.created_at, granularity);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    const series = allBuckets(from, toExclusive, granularity).map((bucket) => ({
      bucket,
      count: counts.get(bucket) ?? 0,
    }));

    return { available: true, data: series };
  } catch (error) {
    console.error("getNewMembersTimeSeries failed:", error);
    return { available: false };
  }
}

/** ยอดเข้าชม (reading_history) และดาวน์โหลด (download_logs) รายวัน/รายเดือน */
export async function getViewsDownloadsTimeSeries(
  from: string,
  toExclusive: string,
  granularity: ChartGranularity
): Promise<DataResult<ViewsDownloadsPoint[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const [readsRes, downloadsRes] = await Promise.all([
      supabase.from("reading_history").select("read_at").gte("read_at", from).lt("read_at", toExclusive),
      supabase
        .from("download_logs")
        .select("downloaded_at")
        .gte("downloaded_at", from)
        .lt("downloaded_at", toExclusive),
    ]);
    if (readsRes.error) throw readsRes.error;
    if (downloadsRes.error) throw downloadsRes.error;

    const viewCounts = new Map<string, number>();
    for (const row of readsRes.data ?? []) {
      const bucket = bucketOf(row.read_at, granularity);
      viewCounts.set(bucket, (viewCounts.get(bucket) ?? 0) + 1);
    }
    const downloadCounts = new Map<string, number>();
    for (const row of downloadsRes.data ?? []) {
      const bucket = bucketOf(row.downloaded_at, granularity);
      downloadCounts.set(bucket, (downloadCounts.get(bucket) ?? 0) + 1);
    }

    const series = allBuckets(from, toExclusive, granularity).map((bucket) => ({
      bucket,
      views: viewCounts.get(bucket) ?? 0,
      downloads: downloadCounts.get(bucket) ?? 0,
    }));

    return { available: true, data: series };
  } catch (error) {
    console.error("getViewsDownloadsTimeSeries failed:", error);
    return { available: false };
  }
}

/** จำนวนงานวิจัย (ทุกสถานะ) แยกตามหมวดหมู่ */
export async function getResearchCountByCategory(): Promise<DataResult<CategoryCount[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const [linksRes, categoriesRes] = await Promise.all([
      supabase.from("research_categories").select("category_id"),
      supabase.from("categories").select("id, name_th"),
    ]);
    if (linksRes.error) throw linksRes.error;
    if (categoriesRes.error) throw categoriesRes.error;

    const nameById = new Map((categoriesRes.data ?? []).map((c) => [c.id, c.name_th]));
    const counts = new Map<string, number>();
    for (const link of linksRes.data ?? []) {
      counts.set(link.category_id, (counts.get(link.category_id) ?? 0) + 1);
    }

    const result = [...counts.entries()]
      .map(([categoryId, count]) => ({
        categoryName: nameById.get(categoryId) ?? "ไม่ทราบหมวดหมู่",
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return { available: true, data: result };
  } catch (error) {
    console.error("getResearchCountByCategory failed:", error);
    return { available: false };
  }
}
