import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { logAudit } from "@/lib/data/audit.server";

/**
 * ไฟล์ภาพปก/เอกสารแนบที่ "รับโดยยังไม่ได้สแกนมัลแวร์" เพราะยังไม่ได้ตั้งค่าระบบสแกนเลย
 * (ดู lib/security/scan-decision.ts) — บันทึก audit log ทุกไฟล์เพื่อให้ตรวจย้อนหลังได้
 * ว่าไฟล์ไหนเข้าระบบโดยผ่านเฉพาะการตรวจเนื้อไฟล์ ไม่มีเนื้อไฟล์หรือข้อมูลอ่อนไหวใน metadata
 */

export const UNSCANNED_UPLOAD_AUDIT_ACTION = "file_upload_unscanned";

export interface UnscannedUpload {
  field: "pdf" | "cover" | "attachment";
  bucket: string;
  path: string;
}

export async function logUnscannedUploads(
  supabase: SupabaseClient<Database>,
  actorId: string,
  unscanned: UnscannedUpload[],
  entityId?: string
): Promise<void> {
  for (const file of unscanned) {
    await logAudit(supabase, {
      actorId,
      action: UNSCANNED_UPLOAD_AUDIT_ACTION,
      entityType: "storage_object",
      entityId,
      metadata: {
        field: file.field,
        bucket: file.bucket,
        path: file.path,
        reason: "scanner_not_configured",
      },
    });
  }
}
