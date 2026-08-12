import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * บันทึก audit_logs สำหรับการแก้ไขสำคัญที่ทำผ่านหน้าจัดการภายใน (Dashboard)
 * งานวิจัยที่เปลี่ยนสถานะมี trigger บันทึกให้อัตโนมัติอยู่แล้ว (ดู
 * supabase/migrations/20260801100000_submissions_and_approvals.sql) —
 * ฟังก์ชันนี้ใช้สำหรับการกระทำอื่นที่ trigger ไม่ครอบคลุม เช่น จัดการ
 * หมวดหมู่/หน่วยงาน/ผู้ใช้/ตั้งค่า และการแก้ไขงานวิจัยที่ไม่ได้เปลี่ยนสถานะ
 */
export async function logAudit(
  supabase: SupabaseClient<Database>,
  params: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("logAudit failed:", error.message);
  }
}
