import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface DashboardStats {
  memberCount: number;
  totalResearch: number;
  pendingReview: number;
  totalViews: number;
  totalDownloads: number;
  popularResearch: { id: string; titleTh: string; views: number; downloads: number }[];
}

export interface DateRangeStats {
  downloadsInRange: number;
  readsInRange: number;
  newMembersInRange: number;
}

/** สถิติภาพรวมสำหรับหน้า /dashboard — ไม่มี Mock fallback (ต้องเชื่อมต่อ Supabase) */
export async function getDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) {
    return {
      memberCount: 0,
      totalResearch: 0,
      pendingReview: 0,
      totalViews: 0,
      totalDownloads: 0,
      popularResearch: [],
    };
  }

  const supabase = await createClient();

  // เดิม select("id, slug, title_th, views, downloads") ดึงทุกแถวของ
  // research_items มาเพื่อ reduce() หา SUM และ sort()+slice() หา top-5 ใน JS
  // ฝั่งแอป (ยิ่งงานวิจัยเยอะยิ่งโอนข้อมูลเยอะโดยไม่จำเป็น) เปลี่ยนเป็น 2
  // queries ที่ให้ Postgres คำนวณให้แทน: SUM(views)/SUM(downloads) ผ่าน
  // PostgREST aggregate select (เปิดใช้งานแล้วที่ระดับ role `authenticator`
  // ผ่าน `ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'true'`
  // — ยืนยันแล้วว่าใช้งานได้จริงกับ production DB) และ ORDER BY views DESC
  // LIMIT 5 สำหรับ top-5 — ใส่ alias `views_sum`/`downloads_sum` เอง
  // (ไม่พึ่งชื่อ key เริ่มต้นที่ PostgREST เลือกให้ เพราะถ้า select สอง
  // aggregate พร้อมกันโดยไม่ตั้งชื่อ อาจชนกันหรือได้ชื่อที่คาดเดาไม่ได้)
  const [memberCountRes, totalResearchRes, pendingReviewRes, aggregateRes, top5Res] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("research_items")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("research_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("research_items")
        .select("views_sum:views.sum(), downloads_sum:downloads.sum()")
        .single(),
      supabase
        .from("research_items")
        .select("id, slug, title_th, views, downloads")
        .order("views", { ascending: false })
        .limit(5),
    ]);

  const aggData = aggregateRes.data as
    | { views_sum: number | null; downloads_sum: number | null }
    | null;
  const totalViews = aggregateRes.error ? 0 : (aggData?.views_sum ?? 0);
  const totalDownloads = aggregateRes.error ? 0 : (aggData?.downloads_sum ?? 0);
  if (aggregateRes.error) {
    console.error("getDashboardStats: aggregate query failed:", aggregateRes.error.message);
  }

  const popularResearch = (top5Res.data ?? []).map((r) => ({
    id: r.slug,
    titleTh: r.title_th,
    views: r.views ?? 0,
    downloads: r.downloads ?? 0,
  }));

  return {
    memberCount: memberCountRes.count ?? 0,
    totalResearch: totalResearchRes.count ?? 0,
    pendingReview: pendingReviewRes.count ?? 0,
    totalViews,
    totalDownloads,
    popularResearch,
  };
}

/** สถิติแบบเลือกช่วงวันที่ — นับจากตารางที่มี timestamp จริง (download_logs/reading_history/profiles) */
export async function getDateRangeStats(
  fromDate: string,
  toDateExclusive: string
): Promise<DateRangeStats> {
  if (!isSupabaseConfigured()) {
    return { downloadsInRange: 0, readsInRange: 0, newMembersInRange: 0 };
  }

  const supabase = await createClient();

  const [downloadsRes, readsRes, membersRes] = await Promise.all([
    supabase
      .from("download_logs")
      .select("id", { count: "exact", head: true })
      .gte("downloaded_at", fromDate)
      .lt("downloaded_at", toDateExclusive),
    supabase
      .from("reading_history")
      .select("id", { count: "exact", head: true })
      .gte("read_at", fromDate)
      .lt("read_at", toDateExclusive),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromDate)
      .lt("created_at", toDateExclusive),
  ]);

  return {
    downloadsInRange: downloadsRes.count ?? 0,
    readsInRange: readsRes.count ?? 0,
    newMembersInRange: membersRes.count ?? 0,
  };
}
