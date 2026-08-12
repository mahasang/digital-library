import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

export interface SuperAdminRecipient {
  userId: string;
  email: string | null;
}

/**
 * รายชื่อ Super Admin ทั้งหมด (rank >= 50) พร้อมอีเมล — ใช้ร่วมกันทุกจุดที่
 * ต้องแจ้งเตือน Super Admin แบบ system-generated (DLQ ต่อ job เดิมช่วงที่ 25,
 * cron alert รวมช่วงที่ 31) สกัดออกมาจาก lib/jobs/dlq-notify.server.ts เดิม
 * (รูปแบบสองขั้นตอนเดียวกับ notifyIfPublishedAndUnsafe ของ
 * lib/jobs/handlers/file-security-rescan.server.ts) กันโค้ดซ้ำ
 */
export async function getSuperAdminRecipients(): Promise<SuperAdminRecipient[]> {
  const service = createServiceRoleClient();

  const { data: superRoles } = await service.from("roles").select("id").gte("rank", 50);
  const roleIds = (superRoles ?? []).map((r) => r.id);
  if (roleIds.length === 0) return [];

  const { data: superUserRoles } = await service.from("user_roles").select("user_id").in("role_id", roleIds);
  const superUserIds = Array.from(new Set((superUserRoles ?? []).map((r) => r.user_id)));
  if (superUserIds.length === 0) return [];

  const { data: profiles } = await service.from("profiles").select("id, email").in("id", superUserIds);
  return (profiles ?? []).map((p) => ({ userId: p.id, email: p.email }));
}
