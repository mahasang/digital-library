import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Json } from "@/lib/supabase/database.types";

export type ContentRevisionEntityType = "blog_post" | "research_item";

export interface ContentRevision {
  id: string;
  entityType: ContentRevisionEntityType;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

const REVISIONS_LIMIT = 50;

/**
 * บันทึก snapshot ของ blog post/research item ก่อนถูกแก้ไข — best-effort
 * เท่านั้น (ไม่ throw ถ้า insert ไม่สำเร็จ) เพื่อไม่ให้การบันทึกประวัติที่ล้มเหลว
 * บล็อกการบันทึกหลักของผู้ใช้ ใช้ Service Role client เสมอเพราะ RLS insert
 * policy ของ content_revisions (migration 20260917100000) อนุญาตเฉพาะ
 * service_role เท่านั้น — ผู้ใช้ authenticated ทั่วไป insert เองตรงๆ ไม่ได้
 */
export async function saveRevision(params: {
  entityType: ContentRevisionEntityType;
  entityId: string;
  actorId: string;
  snapshot: Record<string, unknown>;
}): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  const service = createServiceRoleClient();
  const { error } = await service.from("content_revisions").insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    actor_id: params.actorId,
    snapshot: params.snapshot as Json,
  });
  if (error) {
    console.error("saveRevision failed:", error.message);
  }
}

interface RevisionRow {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  snapshot: Json;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

/** ประวัติ revision ของ entity หนึ่งตัว เรียงใหม่สุดก่อน — จำกัด 50 รายการล่าสุด
 * (view-only ไม่มี restore/rollback) การมองเห็นถูกจำกัดด้วย RLS
 * (content_revisions_select_librarian, rank >= 30) อยู่แล้ว ฟังก์ชันนี้ไม่ตรวจ
 * rank ซ้ำเอง */
export async function getRevisions(
  entityType: ContentRevisionEntityType,
  entityId: string
): Promise<ContentRevision[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_revisions")
    .select("id, entity_type, entity_id, actor_id, snapshot, created_at, profiles ( full_name, email )")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(REVISIONS_LIMIT);

  if (error || !data) {
    console.error("getRevisions failed:", error?.message);
    return [];
  }

  return (data as unknown as RevisionRow[]).map((row) => ({
    id: row.id,
    entityType: row.entity_type as ContentRevisionEntityType,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorName: row.profiles?.full_name || row.profiles?.email || null,
    snapshot: row.snapshot as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}
