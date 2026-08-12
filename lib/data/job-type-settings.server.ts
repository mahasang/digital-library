import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

export interface JobTypeConcurrency {
  jobType: BackgroundJobTypeRow;
  concurrency: number;
  defaultBatchSize: number;
}

/** ค่าสำรองเมื่อยังไม่มีแถวตั้งค่าไว้ (ปกติไม่เกิดขึ้นเพราะ migration seed
 * ค่าเริ่มต้นให้ครบทุกประเภทงานแล้ว — กันไว้เผื่อมี job_type ใหม่ในอนาคตที่ยัง
 * ไม่ได้ insert แถวตั้งค่า) */
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_BATCH_SIZE = 100;

/** อ่านค่า concurrency ของทุกประเภทงานเป็น Map ครั้งเดียว — ใช้ใน
 * processJobQueue() ทุกรอบ worker tick */
export async function getJobConcurrencySettings(): Promise<Map<BackgroundJobTypeRow, number>> {
  if (!isServiceRoleConfigured()) return new Map();
  const service = createServiceRoleClient();
  const { data, error } = await service.from("job_type_settings").select("job_type, concurrency");
  if (error || !data) {
    console.error("getJobConcurrencySettings failed:", error?.message);
    return new Map();
  }
  return new Map(data.map((row) => [row.job_type, row.concurrency]));
}

export function resolveConcurrency(
  settings: Map<BackgroundJobTypeRow, number>,
  jobType: BackgroundJobTypeRow
): number {
  return settings.get(jobType) ?? DEFAULT_CONCURRENCY;
}

/** ค่า default_batch_size ของ job_type หนึ่งตัว — ใช้ตอนสร้าง master job ใหม่
 * (createBulkJobBatch) เป็นค่าเริ่มต้นให้ผู้ใช้ปรับต่อในกล่องยืนยันได้ก่อนสั่งงาน
 * จริง (คนละมิติกับ concurrency — ดู comment บนคอลัมน์ในฐานข้อมูล) */
export async function getDefaultBatchSize(jobType: BackgroundJobTypeRow): Promise<number> {
  if (!isServiceRoleConfigured()) return DEFAULT_BATCH_SIZE;
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("job_type_settings")
    .select("default_batch_size")
    .eq("job_type", jobType)
    .maybeSingle();
  if (error || !data) return DEFAULT_BATCH_SIZE;
  return data.default_batch_size;
}

/** รายการสำหรับหน้า /superadmin/jobs (ฟอร์มปรับค่า) — เรียงตามชื่อ job_type
 * ให้แสดงผลคงที่ ไม่ขึ้นกับลำดับที่ Postgres คืนมา */
export async function getJobConcurrencySettingsList(): Promise<JobTypeConcurrency[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();
  const { data, error } = await service.from("job_type_settings").select("job_type, concurrency, default_batch_size");
  if (error || !data) {
    console.error("getJobConcurrencySettingsList failed:", error?.message);
    return [];
  }
  return data
    .map((row) => ({ jobType: row.job_type, concurrency: row.concurrency, defaultBatchSize: row.default_batch_size }))
    .sort((a, b) => a.jobType.localeCompare(b.jobType));
}
