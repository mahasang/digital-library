import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { searchManagementResearchRows } from "@/lib/data/queries";
import { mapRowToSubmissionItem } from "@/lib/data/mappers";
import type { AccessLevel, DocumentStatus, SubmissionItem } from "@/types/research";

export interface AdminResearchSearchParams {
  query?: string;
  status?: DocumentStatus;
  accessLevel?: AccessLevel;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminResearchSearchResult {
  items: SubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;

/** ค้นหา/กรองงานวิจัยทุกสถานะแบบแบ่งหน้า — สำหรับ /dashboard/research (librarian/admin) */
export async function searchAdminResearch(
  params: AdminResearchSearchParams
): Promise<AdminResearchSearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!isSupabaseConfigured()) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const supabase = await createClient();

  let researchIds: string[] | undefined;
  if (params.categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", params.categoryId)
      .maybeSingle();

    if (!category) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const { data: links } = await supabase
      .from("research_categories")
      .select("research_id")
      .eq("category_id", category.id);

    researchIds = (links ?? []).map((l) => l.research_id);
    if (researchIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  const { rows, total } = await searchManagementResearchRows(supabase, {
    query: params.query,
    status: params.status,
    accessLevel: params.accessLevel,
    researchIds,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    items: rows.map(mapRowToSubmissionItem),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
