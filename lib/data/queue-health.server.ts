import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import type { BackgroundJobStatusRow, BackgroundJobTypeRow } from "@/lib/supabase/database.types";

/**
 * ข้อมูล queue health สำหรับหน้า /superadmin/jobs (ช่วงที่ 30) — เรียก 2 SQL
 * function ใหม่ (migration 20260819110000_queue_health.sql) ที่รวมตัวนับต่างๆ
 * ไว้ในคำสั่งเดียวแทนการดึงแถวทั้งหมดมานับใน JS (เข้ากับหลักการเดิมของโปรเจกต์
 * — ดู get_job_batch_progress/count_* ของช่วงที่ 28) แสดงแค่ตัวเลขรวม ไม่มี
 * payload/worker id ดิบ/รายละเอียด infrastructure ใดๆ หลุดออกไปที่ UI
 */

export interface JobTypeQueueHealth {
  jobType: BackgroundJobTypeRow;
  concurrencyLimit: number;
  /** จำนวนงานที่กำลัง processing จริง (lease ยังไม่หมดอายุ) รวมทุก worker/instance */
  processingCount: number;
  /** จำนวน worker ที่แตกต่างกันที่กำลังถืองานประเภทนี้อยู่จริงตอนนี้ */
  activeWorkerCount: number;
  /** งานที่ lease หมดอายุแล้วแต่ยังค้างสถานะ processing — self-heal เองรอบ claim ถัดไป แต่ถ้าไม่เป็นศูนย์บ่อยๆ บ่งชี้ worker ที่ตายกลางคัน */
  expiredLeaseCount: number;
  pendingCount: number;
  /** pending ที่รอเกิน 15 นาที (เกณฑ์คงที่ ไม่ใช่ Setting) */
  stuckPendingCount: number;
}

export interface QueueHealth {
  byJobType: JobTypeQueueHealth[];
  statusCounts: Partial<Record<BackgroundJobStatusRow, number>>;
}

const EMPTY_QUEUE_HEALTH: QueueHealth = { byJobType: [], statusCounts: {} };

export async function getQueueHealth(): Promise<QueueHealth> {
  if (!isServiceRoleConfigured()) return EMPTY_QUEUE_HEALTH;
  const service = createServiceRoleClient();

  const [{ data: healthRows, error: healthError }, { data: statusRows, error: statusError }] = await Promise.all([
    service.rpc("get_queue_health"),
    service.rpc("get_background_job_status_counts"),
  ]);

  if (healthError) {
    console.error("getQueueHealth: get_queue_health failed:", healthError.message);
  }
  if (statusError) {
    console.error("getQueueHealth: get_background_job_status_counts failed:", statusError.message);
  }

  const byJobType: JobTypeQueueHealth[] = (healthRows ?? []).map((row) => ({
    jobType: row.job_type as BackgroundJobTypeRow,
    concurrencyLimit: row.concurrency_limit,
    processingCount: row.processing_count,
    activeWorkerCount: row.active_worker_count,
    expiredLeaseCount: row.expired_lease_count,
    pendingCount: row.pending_count,
    stuckPendingCount: row.stuck_pending_count,
  }));

  const statusCounts: Partial<Record<BackgroundJobStatusRow, number>> = {};
  for (const row of statusRows ?? []) {
    statusCounts[row.status as BackgroundJobStatusRow] = row.job_count;
  }

  return { byJobType, statusCounts };
}
