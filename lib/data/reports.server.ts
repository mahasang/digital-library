import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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
    throw new Error(`ไม่สามารถดึงข้อมูลรายงานได้: ${error.message}`);
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
    throw new Error(`ไม่สามารถดึงข้อมูลรายงานได้: ${error.message}`);
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
    throw new Error(`ไม่สามารถดึงข้อมูลรายงานได้: ${error.message}`);
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
