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

  const [memberCountRes, totalResearchRes, pendingReviewRes, allResearchRes] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("research_items")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("research_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase.from("research_items").select("id, slug, title_th, views, downloads"),
    ]);

  const allResearch = allResearchRes.data ?? [];
  const totalViews = allResearch.reduce((sum, r) => sum + (r.views ?? 0), 0);
  const totalDownloads = allResearch.reduce((sum, r) => sum + (r.downloads ?? 0), 0);
  const popularResearch = [...allResearch]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map((r) => ({
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
