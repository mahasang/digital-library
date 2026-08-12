import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  from?: string;
  to?: string;
  entityType?: string;
  /** กรองตาม entity_id ตรงๆ (เช่น ดูประวัติที่ถูกดำเนินการกับผู้ใช้คนใดคนหนึ่ง) */
  entityId?: string;
  action?: string;
  /** ค้นหาผู้กระทำจากชื่อหรืออีเมล (แปลงเป็น actor_id ก่อน query จริง) */
  actorSearch?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogResult {
  available: boolean;
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 30;

function emptyResult(page: number, pageSize: number, available: boolean): AuditLogResult {
  return { available, rows: [], total: 0, page, pageSize, totalPages: 0 };
}

/**
 * ประวัติการเปลี่ยนแปลงทั้งหมด — ใช้ร่วมกันทั้ง /dashboard/audit-logs
 * (admin, rank >= 40) และ /superadmin/audit-logs (super_admin, rank >= 50 —
 * ตัวหน้าเว็บเป็นผู้บังคับสิทธิ์ ฟังก์ชันนี้เองไม่ได้ตรวจสอบ rank)
 * ไม่ throw raw error ออกไปนอกฟังก์ชัน — คืนค่า available:false แทนเสมอ
 * เพื่อไม่ให้ error ดิบของ Postgres หลุดไปแสดงในหน้าเว็บ
 */
export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!isSupabaseConfigured()) {
    return emptyResult(page, pageSize, false);
  }

  try {
    const supabase = await createClient();

    let actorIdFilter: string[] | undefined;
    if (filters.actorSearch?.trim()) {
      const term = filters.actorSearch.trim();
      const { data: matches, error: searchError } = await supabase
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
      if (searchError) throw searchError;
      actorIdFilter = (matches ?? []).map((m) => m.id);
      if (actorIdFilter.length === 0) {
        return { available: true, rows: [], total: 0, page, pageSize, totalPages: 0 };
      }
    }

    let query = supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, metadata, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lt("created_at", filters.to);
    if (filters.entityType) query = query.eq("entity_type", filters.entityType);
    if (filters.entityId) query = query.eq("entity_id", filters.entityId);
    if (filters.action) query = query.eq("action", filters.action);
    if (actorIdFilter) query = query.in("actor_id", actorIdFilter);

    const { data, error, count } = await query;
    if (error) throw error;

    const actorIds = [
      ...new Set((data ?? []).map((r) => r.actor_id).filter((id): id is string => Boolean(id))),
    ];

    const nameById = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      for (const p of profiles ?? []) {
        nameById.set(p.id, p.full_name || p.email || p.id);
      }
    }

    const rows: AuditLogRow[] = (data ?? []).map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_id ? (nameById.get(r.actor_id) ?? "ไม่ทราบผู้ใช้") : "ระบบ",
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata,
      createdAt: r.created_at,
    }));

    return {
      available: true,
      rows,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    };
  } catch (error) {
    console.error("getAuditLogs failed:", error);
    return emptyResult(page, pageSize, false);
  }
}
