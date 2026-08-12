import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRole } from "@/types/research";
import type { DataResult } from "@/lib/data/superadmin-stats.server";

export interface SuperAdminUserRow {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  roles: UserRole[];
  isActive: boolean;
  createdAt: string;
}

export interface SuperAdminUserFilters {
  search?: string;
  status?: "active" | "suspended";
  role?: UserRole;
}

const ALL_ROLE_NAMES: UserRole[] = ["member", "staff", "librarian", "admin", "super_admin"];

/** รายชื่อผู้ใช้ทั้งหมดพร้อมทุกบทบาทที่มี (ผู้ใช้หนึ่งคนมีได้หลายบทบาท) — สำหรับ /superadmin/users */
export async function getSuperAdminUserList(
  filters: SuperAdminUserFilters
): Promise<DataResult<SuperAdminUserRow[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();

    let query = supabase
      .from("profiles")
      .select("id, full_name, email, organization_name, is_active, created_at")
      .order("created_at", { ascending: false });

    if (filters.search) {
      const term = filters.search.trim();
      if (term) {
        query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
      }
    }
    if (filters.status === "active") query = query.eq("is_active", true);
    if (filters.status === "suspended") query = query.eq("is_active", false);

    const [profilesRes, userRolesRes, rolesRes] = await Promise.all([
      query,
      supabase.from("user_roles").select("user_id, role_id"),
      supabase.from("roles").select("id, name"),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (userRolesRes.error) throw userRolesRes.error;
    if (rolesRes.error) throw rolesRes.error;

    const roleNameById = new Map((rolesRes.data ?? []).map((r) => [r.id, r.name as UserRole]));
    const rolesByUser = new Map<string, UserRole[]>();
    for (const ur of userRolesRes.data ?? []) {
      const roleName = roleNameById.get(ur.role_id);
      if (!roleName) continue;
      const list = rolesByUser.get(ur.user_id) ?? [];
      list.push(roleName);
      rolesByUser.set(ur.user_id, list);
    }

    let rows: SuperAdminUserRow[] = (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name || "ไม่ระบุชื่อ",
      email: p.email || "",
      organizationName: p.organization_name || "",
      roles: rolesByUser.get(p.id) ?? [],
      isActive: p.is_active,
      createdAt: p.created_at,
    }));

    if (filters.role) {
      rows = rows.filter((r) => r.roles.includes(filters.role as UserRole));
    }

    return { available: true, data: rows };
  } catch (error) {
    console.error("getSuperAdminUserList failed:", error);
    return { available: false };
  }
}

export interface SuperAdminUserDetail extends SuperAdminUserRow {
  updatedAt: string;
}

export async function getSuperAdminUserDetail(
  userId: string
): Promise<DataResult<SuperAdminUserDetail>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const [profileRes, userRolesRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, organization_name, is_active, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role_id").eq("user_id", userId),
      supabase.from("roles").select("id, name"),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (!profileRes.data) return { available: false };
    if (userRolesRes.error) throw userRolesRes.error;
    if (rolesRes.error) throw rolesRes.error;

    const roleNameById = new Map((rolesRes.data ?? []).map((r) => [r.id, r.name as UserRole]));
    const roles = (userRolesRes.data ?? [])
      .map((ur) => roleNameById.get(ur.role_id))
      .filter((r): r is UserRole => Boolean(r));

    const p = profileRes.data;
    return {
      available: true,
      data: {
        id: p.id,
        fullName: p.full_name || "ไม่ระบุชื่อ",
        email: p.email || "",
        organizationName: p.organization_name || "",
        roles,
        isActive: p.is_active,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
    };
  } catch (error) {
    console.error("getSuperAdminUserDetail failed:", error);
    return { available: false };
  }
}

export interface UserActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** ประวัติการทำงานของผู้ใช้ (การกระทำที่ผู้ใช้คนนี้เป็นผู้กระทำ ตาม audit_logs) */
export async function getUserActivityHistory(
  userId: string,
  limit = 20
): Promise<DataResult<UserActivityEntry[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at")
      .eq("actor_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      available: true,
      data: (data ?? []).map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
    };
  } catch (error) {
    console.error("getUserActivityHistory failed:", error);
    return { available: false };
  }
}

export { ALL_ROLE_NAMES };
