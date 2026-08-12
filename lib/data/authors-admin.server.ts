import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DocumentStatus } from "@/types/research";
import type { AuthorRoleRow } from "@/lib/supabase/database.types";

export interface AdminAuthorRow {
  id: string;
  name: string;
  displayNameEn: string;
  titlePrefixTh: string;
  titlePrefixEn: string;
  organizationId: string | null;
  organizationNameTh: string | null;
  orcid: string | null;
  orcidVerifiedAt: string | null;
  isActive: boolean;
  mergedIntoAuthorId: string | null;
  researchCount: number;
  createdAt: string;
}

export interface AdminAuthorDetail extends AdminAuthorRow {
  biography: string;
  organizationName: string | null;
  orcidOauthVerifiedAt: string | null;
  orcidApiCheckedAt: string | null;
  orcidApiPublicName: string | null;
  linkedProfileId: string | null;
  linkedProfileEmail: string | null;
  linkedProfileName: string | null;
  researchItems: {
    id: string;
    slug: string;
    titleTh: string;
    year: number;
    status: DocumentStatus;
    authorRole: AuthorRoleRow;
  }[];
}

interface AuthorSearchFilters {
  query?: string;
  isActive?: boolean;
  hasOrcid?: boolean;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

/** ค้นหาผู้วิจัยทั้งหมด (มุมมองเจ้าหน้าที่) — รองรับค้นหาชื่อไทย/อังกฤษ กรอง
 * ตามสถานะเปิดใช้งาน/มี ORCID พร้อมแบ่งหน้า */
export async function searchAuthorsForAdmin(
  filters: AuthorSearchFilters = {}
): Promise<{ items: AdminAuthorRow[]; total: number; totalPages: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0, totalPages: 0 };

  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  let query = supabase
    .from("authors")
    .select(
      "id, name, display_name_en, title_prefix_th, title_prefix_en, organization_id, orcid, orcid_verified_at, is_active, merged_into_author_id, created_at, organizations ( name_th )",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (filters.query) {
    const safe = filters.query.replace(/[,()%]/g, " ").trim();
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,display_name_en.ilike.%${safe}%`);
    }
  }
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }
  if (filters.hasOrcid !== undefined) {
    query = filters.hasOrcid ? query.not("orcid", "is", null) : query.is("orcid", null);
  }

  const start = (page - 1) * pageSize;
  query = query.range(start, start + pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("searchAuthorsForAdmin failed:", error.message);
    return { items: [], total: 0, totalPages: 0 };
  }

  const authorIds = (data ?? []).map((row) => row.id);
  const { data: linkRows } =
    authorIds.length > 0
      ? await supabase.from("research_authors").select("author_id").in("author_id", authorIds)
      : { data: [] as { author_id: string }[] };
  const countByAuthor = new Map<string, number>();
  for (const link of linkRows ?? []) {
    countByAuthor.set(link.author_id, (countByAuthor.get(link.author_id) ?? 0) + 1);
  }

  const items: AdminAuthorRow[] = (
    data as unknown as {
      id: string;
      name: string;
      display_name_en: string | null;
      title_prefix_th: string | null;
      title_prefix_en: string | null;
      organization_id: string | null;
      orcid: string | null;
      orcid_verified_at: string | null;
      is_active: boolean;
      merged_into_author_id: string | null;
      created_at: string;
      organizations: { name_th: string } | null;
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    displayNameEn: row.display_name_en ?? "",
    titlePrefixTh: row.title_prefix_th ?? "",
    titlePrefixEn: row.title_prefix_en ?? "",
    organizationId: row.organization_id,
    organizationNameTh: row.organizations?.name_th ?? null,
    orcid: row.orcid,
    orcidVerifiedAt: row.orcid_verified_at,
    isActive: row.is_active,
    mergedIntoAuthorId: row.merged_into_author_id,
    researchCount: countByAuthor.get(row.id) ?? 0,
    createdAt: row.created_at,
  }));

  const total = count ?? 0;
  return { items, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAuthorDetailForAdmin(authorId: string): Promise<AdminAuthorDetail | null> {
  if (!isSupabaseConfigured() || !authorId) return null;

  const supabase = await createClient();
  const { data: author, error } = await supabase
    .from("authors")
    .select(
      "id, name, display_name_en, title_prefix_th, title_prefix_en, organization_id, organization_name, orcid, orcid_verified_at, orcid_oauth_verified_at, orcid_api_checked_at, orcid_api_public_name, profile_id, biography, is_active, merged_into_author_id, created_at, organizations ( name_th ), profiles ( email, full_name )"
    )
    .eq("id", authorId)
    .maybeSingle();

  if (error || !author) {
    if (error) console.error("getAuthorDetailForAdmin failed:", error.message);
    return null;
  }

  const { data: links } = await supabase
    .from("research_authors")
    .select("author_role, research_items ( id, slug, title_th, year, status )")
    .eq("author_id", authorId);

  const researchItems = ((links ?? []) as unknown as {
    author_role: AuthorRoleRow;
    research_items: { id: string; slug: string; title_th: string; year: number; status: DocumentStatus } | null;
  }[])
    .filter((row) => row.research_items)
    .map((row) => ({
      id: row.research_items!.id,
      slug: row.research_items!.slug,
      titleTh: row.research_items!.title_th,
      year: row.research_items!.year,
      status: row.research_items!.status,
      authorRole: row.author_role,
    }));

  const raw = author as unknown as {
    id: string;
    name: string;
    display_name_en: string | null;
    title_prefix_th: string | null;
    title_prefix_en: string | null;
    organization_id: string | null;
    organization_name: string | null;
    orcid: string | null;
    orcid_verified_at: string | null;
    orcid_oauth_verified_at: string | null;
    orcid_api_checked_at: string | null;
    orcid_api_public_name: string | null;
    profile_id: string | null;
    biography: string | null;
    is_active: boolean;
    merged_into_author_id: string | null;
    created_at: string;
    organizations: { name_th: string } | null;
    profiles: { email: string | null; full_name: string | null } | null;
  };

  return {
    id: raw.id,
    name: raw.name,
    displayNameEn: raw.display_name_en ?? "",
    titlePrefixTh: raw.title_prefix_th ?? "",
    titlePrefixEn: raw.title_prefix_en ?? "",
    organizationId: raw.organization_id,
    organizationNameTh: raw.organizations?.name_th ?? null,
    organizationName: raw.organization_name,
    orcid: raw.orcid,
    orcidVerifiedAt: raw.orcid_verified_at,
    orcidOauthVerifiedAt: raw.orcid_oauth_verified_at,
    orcidApiCheckedAt: raw.orcid_api_checked_at,
    orcidApiPublicName: raw.orcid_api_public_name,
    linkedProfileId: raw.profile_id,
    linkedProfileEmail: raw.profiles?.email ?? null,
    linkedProfileName: raw.profiles?.full_name ?? null,
    biography: raw.biography ?? "",
    isActive: raw.is_active,
    mergedIntoAuthorId: raw.merged_into_author_id,
    researchCount: researchItems.length,
    createdAt: raw.created_at,
    researchItems,
  };
}

/** ผู้วิจัยที่ชื่อคล้ายกันมาก — ใช้แสดงคำเตือนในฟอร์มเพิ่ม/แก้ไขผู้วิจัย
 * (ไม่เคยรวมอัตโนมัติ แค่เตือนให้เจ้าหน้าที่ตรวจสอบเอง) */
export async function findSimilarAuthors(
  nameTh: string,
  excludeId?: string
): Promise<{ id: string; name: string; similarity: number }[]> {
  if (!isSupabaseConfigured() || !nameTh.trim()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_similar_authors_by_name", {
    p_name_th: nameTh,
    p_exclude_id: excludeId ?? null,
  });

  if (error) {
    console.error("findSimilarAuthors failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({ id: row.id, name: row.name, similarity: row.sim }));
}

/** ผู้วิจัยที่เปิดใช้งานทั้งหมด — สำหรับตัวเลือกใน dropdown เลือกผู้วิจัยหลัก
 * ตอนรวมข้อมูล (ไม่รวมตัวเองและที่ถูกรวมไปแล้ว) */
export async function getActiveAuthorOptions(
  excludeId?: string
): Promise<{ id: string; name: string }[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  let query = supabase
    .from("authors")
    .select("id, name")
    .is("merged_into_author_id", null)
    .order("name");
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) {
    console.error("getActiveAuthorOptions failed:", error.message);
    return [];
  }
  return data ?? [];
}
