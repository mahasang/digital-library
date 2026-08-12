import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export interface DuplicateDetectionRule {
  id: string;
  version: number;
  weightTitle: number;
  weightAuthor: number;
  weightYear: number;
  weightIdentifier: number;
  weightFileHash: number;
  thresholdLow: number;
  thresholdMedium: number;
  thresholdHigh: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

/** ค่าเริ่มต้นที่ปลอดภัย — ใช้ทั้งตอน seed migration และปุ่ม "คืนค่าเริ่มต้น" ที่หน้าตั้งค่า
 * ต้องตรงกับค่าที่ seed ไว้ใน migration 20260812100000 เสมอ */
export const DEFAULT_DUPLICATE_DETECTION_WEIGHTS = {
  weightTitle: 50,
  weightAuthor: 20,
  weightYear: 10,
  weightIdentifier: 15,
  weightFileHash: 5,
  thresholdLow: 35,
  thresholdMedium: 60,
  thresholdHigh: 85,
} as const;

function mapRule(row: Database["public"]["Tables"]["duplicate_detection_rules"]["Row"]): DuplicateDetectionRule {
  return {
    id: row.id,
    version: row.version,
    weightTitle: row.weight_title,
    weightAuthor: row.weight_author,
    weightYear: row.weight_year,
    weightIdentifier: row.weight_identifier,
    weightFileHash: row.weight_file_hash,
    thresholdLow: row.threshold_low,
    thresholdMedium: row.threshold_medium,
    thresholdHigh: row.threshold_high,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** เกณฑ์ที่ active อยู่ตอนนี้ — ใช้คำนวณคะแนนงานวิจัยซ้ำทุกครั้ง (ทั้งตอนส่ง/
 * แก้ไขงานวิจัยเดี่ยวๆ และ bulk scan) รับ client ได้ทั้งของผู้ใช้ (rank >= 20)
 * และ Service Role (job handler) — ทั้งคู่มีสิทธิ์ select ตาม RLS/grant */
export async function getActiveDuplicateDetectionRule(
  supabase: SupabaseClient<Database>
): Promise<DuplicateDetectionRule | null> {
  const { data, error } = await supabase
    .from("duplicate_detection_rules")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getActiveDuplicateDetectionRule failed:", error.message);
    return null;
  }
  return mapRule(data);
}

/** ประวัติเกณฑ์ทั้งหมด (ใหม่สุดก่อน) — ใช้แสดงที่หน้า /superadmin/data-quality/settings */
export async function getDuplicateDetectionRuleHistory(limit = 20): Promise<DuplicateDetectionRule[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplicate_detection_rules")
    .select("*")
    .order("version", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getDuplicateDetectionRuleHistory failed:", error.message);
    return [];
  }
  return data.map(mapRule);
}
