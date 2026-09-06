import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { UserRole } from "@/types/research";

export interface ReportFilters {
  from?: string;
  to?: string;
  categoryId?: string;
}

export interface ResearchCountRow {
  researchId: string;
  slug: string;
  titleTh: string;
  count: number;
}

export interface PopularReportRow {
  slug: string;
  titleTh: string;
  views: number;
  downloads: number;
}

export interface MemberReportRow {
  fullName: string;
  email: string;
  organizationName: string;
  role: UserRole;
  createdAt: string;
}

async function resolveCategoryResearchIds(
  supabase: SupabaseClient<Database>,
  categorySlug: string
): Promise<string[]> {
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .maybeSingle();

  if (!category) return [];

  const { data: links } = await supabase
    .from("research_categories")
    .select("research_id")
    .eq("category_id", category.id);

  return (links ?? []).map((l) => l.research_id);
}

async function aggregateEventCounts(
  supabase: SupabaseClient<Database>,
  table: "download_logs" | "reading_history",
  dateColumn: string,
  filters: ReportFilters
): Promise<ResearchCountRow[]> {
  if (!isSupabaseConfigured()) return [];

  let researchIds: string[] | undefined;
  if (filters.categoryId) {
    researchIds = await resolveCategoryResearchIds(supabase, filters.categoryId);
    if (researchIds.length === 0) return [];
  }

  let query = supabase.from(table).select(`research_id, ${dateColumn}`);
  if (filters.from) query = query.gte(dateColumn, filters.from);
  if (filters.to) query = query.lt(dateColumn, filters.to);
  if (researchIds) query = query.in("research_id", researchIds);

  const { data: rawEvents, error } = await query;
  if (error) {
    throw new Error(toSafeErrorMessage(error, "ไม่สามารถดึงข้อมูลรายงานได้", "aggregateEventCounts failed"));
  }
  const events = (rawEvents ?? []) as unknown as { research_id: string }[];

  const countByResearch = new Map<string, number>();
  for (const event of events) {
    countByResearch.set(
      event.research_id,
      (countByResearch.get(event.research_id) ?? 0) + 1
    );
  }

  if (countByResearch.size === 0) return [];

  const ids = [...countByResearch.keys()];
  const { data: items } = await supabase
    .from("research_items")
    .select("id, slug, title_th")
    .in("id", ids);

  return (items ?? [])
    .map((item) => ({
      researchId: item.id,
      slug: item.slug,
      titleTh: item.title_th,
      count: countByResearch.get(item.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** รายงานการเข้าชม (อ่านออนไลน์) — อ้างอิงจาก reading_history ซึ่งมี timestamp จริง */
export async function getViewsReport(filters: ReportFilters): Promise<ResearchCountRow[]> {
  const supabase = await createClient();
  return aggregateEventCounts(supabase, "reading_history", "read_at", filters);
}

/** รายงานการดาวน์โหลด — อ้างอิงจาก download_logs */
export async function getDownloadsReport(
  filters: ReportFilters
): Promise<ResearchCountRow[]> {
  const supabase = await createClient();
  return aggregateEventCounts(supabase, "download_logs", "downloaded_at", filters);
}

/** รายงานงานวิจัยยอดนิยม — เรียงตามยอดเข้าชมสะสม */
export async function getPopularReport(
  filters: Pick<ReportFilters, "categoryId">,
  limit = 50
): Promise<PopularReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  let researchIds: string[] | undefined;
  if (filters.categoryId) {
    researchIds = await resolveCategoryResearchIds(supabase, filters.categoryId);
    if (researchIds.length === 0) return [];
  }

  let query = supabase
    .from("research_items")
    .select("slug, title_th, views, downloads")
    .order("views", { ascending: false })
    .limit(limit);
  if (researchIds) query = query.in("id", researchIds);

  const { data, error } = await query;
  if (error) {
    throw new Error(toSafeErrorMessage(error, "ไม่สามารถดึงข้อมูลรายงานได้", "getPopularReport failed"));
  }

  return (data ?? []).map((r) => ({
    slug: r.slug,
    titleTh: r.title_th,
    views: r.views ?? 0,
    downloads: r.downloads ?? 0,
  }));
}

/** รายงานสมาชิก — กรองตามวันที่สมัครและประเภทผู้ใช้ */
export async function getMembersReport(
  filters: Pick<ReportFilters, "from" | "to"> & { role?: UserRole }
): Promise<MemberReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, organization_name, created_at")
    .order("created_at", { ascending: false });
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lt("created_at", filters.to);

  const { data: profiles, error } = await query;
  if (error) {
    throw new Error(toSafeErrorMessage(error, "ไม่สามารถดึงข้อมูลรายงานได้", "getMembersReport failed"));
  }

  const [userRolesRes, rolesRes] = await Promise.all([
    supabase.from("user_roles").select("user_id, role_id"),
    supabase.from("roles").select("id, name, rank"),
  ]);

  const roleById = new Map((rolesRes.data ?? []).map((r) => [r.id, r]));
  const maxRankByUser = new Map<string, { name: UserRole; rank: number }>();
  for (const ur of userRolesRes.data ?? []) {
    const role = roleById.get(ur.role_id);
    if (!role) continue;
    const current = maxRankByUser.get(ur.user_id);
    if (!current || role.rank > current.rank) {
      maxRankByUser.set(ur.user_id, { name: role.name as UserRole, rank: role.rank });
    }
  }

  return (profiles ?? [])
    .map((p) => ({
      fullName: p.full_name || "ไม่ระบุชื่อ",
      email: p.email || "",
      organizationName: p.organization_name || "",
      role: maxRankByUser.get(p.id)?.name ?? ("member" as UserRole),
      createdAt: p.created_at,
    }))
    .filter((m) => !filters.role || m.role === filters.role);
}


/** สถิติ views รายวัน/สัปดาห์/เดือน จาก research_view_logs */
export interface ViewStatRow {
  date: string;
  count: number;
}

export interface ViewsOverviewStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  daily: ViewStatRow[];
}

export async function getViewsOverview(): Promise<ViewsOverviewStats> {
  if (!isSupabaseConfigured()) return { today: 0, thisWeek: 0, thisMonth: 0, daily: [] };
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // ดึง logs 30 วันย้อนหลัง
  const { data, error } = await supabase
    .from("research_view_logs")
    .select("viewed_at")
    .gte("viewed_at", monthStart);

  if (error) {
    console.error("[getViewsOverview] error:", error.message);
    return { today: 0, thisWeek: 0, thisMonth: 0, daily: [] };
  }

  const logs = data ?? [];

  // นับ today / week / month
  const today = logs.filter((l) => l.viewed_at >= todayStart).length;
  const thisWeek = logs.filter((l) => l.viewed_at >= weekStart).length;
  const thisMonth = logs.length;

  // group by date สำหรับกราฟ
  const countByDate = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    countByDate.set(key, 0);
  }
  for (const log of logs) {
    const key = log.viewed_at.slice(0, 10);
    if (countByDate.has(key)) {
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }
  }

  const daily = Array.from(countByDate.entries()).map(([date, count]) => ({ date, count }));

  return { today, thisWeek, thisMonth, daily };
}

/** top viewed รายงานจาก view logs (แทน reading_history) */
export async function getViewLogsReport(filters: ReportFilters): Promise<ResearchCountRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  let researchIds: string[] | undefined;
  if (filters.categoryId) {
    researchIds = await resolveCategoryResearchIds(supabase, filters.categoryId);
    if (researchIds.length === 0) return [];
  }

  let query = supabase
    .from("research_view_logs")
    .select("research_id, viewed_at");

  if (filters.from) query = query.gte("viewed_at", filters.from);
  if (filters.to)   query = query.lt("viewed_at", filters.to);
  if (researchIds)  query = query.in("research_id", researchIds);

  const { data: rawLogs, error } = await query;
  if (error) {
    console.error("[getViewLogsReport] error:", error.message);
    return [];
  }

  const countByResearch = new Map<string, number>();
  for (const log of rawLogs ?? []) {
    countByResearch.set(log.research_id, (countByResearch.get(log.research_id) ?? 0) + 1);
  }
  if (countByResearch.size === 0) return [];

  const { data: items } = await supabase
    .from("research_items")
    .select("id, slug, title_th")
    .in("id", [...countByResearch.keys()]);

  return (items ?? [])
    .map((item) => ({
      researchId: item.id,
      slug: item.slug,
      titleTh: item.title_th,
      count: countByResearch.get(item.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}