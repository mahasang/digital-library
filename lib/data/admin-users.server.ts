import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRole } from "@/types/research";

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

/** รายชื่อผู้ใช้ทั้งหมดพร้อมบทบาทปัจจุบัน — สำหรับ /dashboard/users (admin เท่านั้น) */
export async function getAdminUserList(): Promise<AdminUserRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const [profilesRes, userRolesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, organization_name, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role_id"),
    supabase.from("roles").select("id, name, rank"),
  ]);

  const profiles = profilesRes.data ?? [];
  const userRoles = userRolesRes.data ?? [];
  const roles = rolesRes.data ?? [];

  const roleById = new Map(roles.map((r) => [r.id, r]));
  const maxRankByUser = new Map<string, { name: UserRole; rank: number }>();

  for (const ur of userRoles) {
    const role = roleById.get(ur.role_id);
    if (!role) continue;
    const current = maxRankByUser.get(ur.user_id);
    if (!current || role.rank > current.rank) {
      maxRankByUser.set(ur.user_id, { name: role.name as UserRole, rank: role.rank });
    }
  }

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name || "ไม่ระบุชื่อ",
    email: p.email || "",
    organizationName: p.organization_name || "",
    role: maxRankByUser.get(p.id)?.name ?? "member",
    isActive: p.is_active,
    createdAt: p.created_at,
  }));
}
