import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface DataQualityIssueItem {
  id: string;
  slug: string;
  titleTh: string;
  status: string;
}

export interface DataQualityReport {
  missingAuthors: DataQualityIssueItem[];
  missingOrganization: DataQualityIssueItem[];
  missingPublishedDate: DataQualityIssueItem[];
  authorsMissingOrcid: number;
}

const ISSUE_COLUMNS = "id, slug, title_th, status";

/** รายงานข้อมูลขาดหาย — ไม่นับงานที่ archived/rejected/merged (ไม่ใช่เป้าหมาย
 * ของการแก้ไขข้อมูลต่อแล้ว) จำกัดผลลัพธ์ต่อประเภทไว้ 100 รายการเพื่อกันหน้า
 * โหลดหนักเกินไปหากมีข้อมูลขาดหายจำนวนมาก (สเกลของระบบห้องสมุดนี้ไม่ใหญ่มาก) */
export async function getDataQualityReport(): Promise<DataQualityReport> {
  if (!isSupabaseConfigured()) {
    return {
      missingAuthors: [],
      missingOrganization: [],
      missingPublishedDate: [],
      authorsMissingOrcid: 0,
    };
  }

  const supabase = await createClient();
  const EXCLUDE_STATUSES = ["archived", "rejected", "merged"];

  const [allItemsRes, linkedAuthorsRes, missingOrgRes, missingPublishedRes, authorsRes] = await Promise.all([
    supabase.from("research_items").select(ISSUE_COLUMNS).not("status", "in", `(${EXCLUDE_STATUSES.join(",")})`),
    supabase.from("research_authors").select("research_id"),
    supabase
      .from("research_items")
      .select(ISSUE_COLUMNS)
      .not("status", "in", `(${EXCLUDE_STATUSES.join(",")})`)
      .is("organization_id", null)
      .limit(100),
    supabase
      .from("research_items")
      .select(ISSUE_COLUMNS)
      .eq("status", "published")
      .is("published_at", null)
      .limit(100),
    supabase.from("authors").select("id", { count: "exact", head: true }).is("orcid", null).eq("is_active", true),
  ]);

  const linkedResearchIds = new Set((linkedAuthorsRes.data ?? []).map((r) => r.research_id));
  const missingAuthors = (allItemsRes.data ?? [])
    .filter((item) => !linkedResearchIds.has(item.id))
    .slice(0, 100)
    .map((row) => ({ id: row.id, slug: row.slug, titleTh: row.title_th, status: row.status }));

  const mapIssue = (rows: { id: string; slug: string; title_th: string; status: string }[] | null) =>
    (rows ?? []).map((row) => ({ id: row.id, slug: row.slug, titleTh: row.title_th, status: row.status }));

  return {
    missingAuthors,
    missingOrganization: mapIssue(missingOrgRes.data),
    missingPublishedDate: mapIssue(missingPublishedRes.data),
    authorsMissingOrcid: authorsRes.count ?? 0,
  };
}
