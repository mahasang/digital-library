import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import type { ScanStatusRow } from "@/lib/supabase/types";
import type { DocumentStatus } from "@/types/research";
import { evaluateScanOverride, type ScanOverrideDecision } from "./scan-override";

/**
 * ตัดสินสิทธิ์ "เผยแพร่โดยยืนยันเอง" ของงานวิจัยหนึ่งรายการ — อ่านเวลาที่ job สแกน
 * ที่ยังรออยู่ถูกสร้างจากตาราง background_jobs (ใช้ service role เพราะตารางนี้
 * จำกัดสิทธิ์) แล้วส่งเข้า evaluateScanOverride
 *
 * ผู้เรียกต้องตรวจ rank (>= SCAN_OVERRIDE_MIN_RANK) มาก่อนแล้ว ฟังก์ชันนี้ไม่ตรวจ
 */
export async function getScanOverrideDecision(item: {
  id: string;
  status: DocumentStatus;
  scanStatus: ScanStatusRow;
}): Promise<ScanOverrideDecision> {
  if (!isServiceRoleConfigured()) {
    return { allowed: false, reason: "unavailable" };
  }

  let pendingSince: Date | null = null;
  if (item.scanStatus === "pending") {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("background_jobs")
      .select("created_at")
      .eq("job_type", "file_security_rescan")
      .eq("entity_type", "research_items")
      .eq("entity_id", item.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // อ่านคิวไม่ได้ — ถือว่าไม่รู้อายุ ให้รอจนกว่าจะอ่านได้ (ปลอดภัยกว่าอนุญาต)
      return { allowed: false, reason: "unavailable" };
    }
    pendingSince = data?.created_at ? new Date(data.created_at) : null;
  }

  return evaluateScanOverride({
    status: item.status,
    scanStatus: item.scanStatus,
    pendingSince,
    now: new Date(),
  });
}
