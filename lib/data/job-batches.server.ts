import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import type { BackgroundJobStatusRow, BackgroundJobTypeRow, JobBatchStatusRow } from "@/lib/supabase/database.types";

export interface JobBatchSummary {
  batchId: string;
  status: JobBatchStatusRow;
  createdAt: string;
  /** จำนวนรายการที่ตรงตัวกรองทั้งหมด (ประมาณการตอนสร้าง — null ถ้านับไม่ได้ตอนนั้น) */
  totalItems: number | null;
  /** จำนวน job ลูกที่สร้างแล้วจริงจนถึงตอนนี้ (อาจน้อยกว่า totalItems ถ้ายังสร้างไม่ครบ) */
  enqueuedItems: number;
  batchSize: number;
  completed: number;
  failed: number;
  cancelled: number;
  skipped: number;
  /** enqueuedItems - (completed+failed+cancelled+skipped) — ยังไม่แยก pending/processing
   * (ต้องเปิดดูรายละเอียดผ่าน getJobBatchDetail() ถึงจะเห็นแยก) เพื่อไม่ต้อง
   * ทำ GROUP BY ทุกครั้งที่ poll รายการทั้งหมด */
  inProgress: number;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  /** เวลาประมาณที่เหลือ (วินาที) จนกว่าจะเสร็จทั้งชุด คำนวณจาก (now - startedAt) /
   * completed * inProgress — null เมื่อยังไม่มี job ไหน completed อย่างน้อย 5
   * รายการ (ฐานประมาณยังไม่น่าเชื่อถือ) หรือไม่มีรายการเหลือแล้ว */
  etaSeconds: number | null;
  filterSnapshot: Record<string, unknown>;
  createdBy: string | null;
}

const MIN_COMPLETED_FOR_ETA = 5;

function toJobBatchSummary(row: {
  id: string;
  status: JobBatchStatusRow;
  created_at: string;
  total_items: number | null;
  enqueued_items: number;
  batch_size: number;
  completed_items: number;
  failed_items: number;
  cancelled_items: number;
  skipped_items: number;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  filter_snapshot: Record<string, unknown> | null;
  created_by: string | null;
}): JobBatchSummary {
  const inProgress = Math.max(
    0,
    row.enqueued_items - row.completed_items - row.failed_items - row.cancelled_items - row.skipped_items
  );
  let etaSeconds: number | null = null;
  if (row.started_at && row.completed_items >= MIN_COMPLETED_FOR_ETA && inProgress > 0) {
    const elapsedSeconds = (Date.now() - new Date(row.started_at).getTime()) / 1000;
    if (elapsedSeconds > 0) {
      etaSeconds = Math.round((elapsedSeconds / row.completed_items) * inProgress);
    }
  }

  return {
    batchId: row.id,
    status: row.status,
    createdAt: row.created_at,
    totalItems: row.total_items,
    enqueuedItems: row.enqueued_items,
    batchSize: row.batch_size,
    completed: row.completed_items,
    failed: row.failed_items,
    cancelled: row.cancelled_items,
    skipped: row.skipped_items,
    inProgress,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    pausedAt: row.paused_at,
    cancelledAt: row.cancelled_at,
    etaSeconds,
    filterSnapshot: row.filter_snapshot ?? {},
    createdBy: row.created_by,
  };
}

const JOB_BATCH_COLUMNS =
  "id, status, created_at, total_items, enqueued_items, batch_size, completed_items, failed_items, cancelled_items, skipped_items, started_at, updated_at, completed_at, paused_at, cancelled_at, filter_snapshot, created_by";

export interface JobRow {
  id: string;
  entityId: string | null;
  status: BackgroundJobStatusRow;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface RecentJobRow extends JobRow {
  completedAt: string | null;
  /** เริ่มประมวลผลจริงเมื่อไหร่ (ต่างจาก createdAt ที่เป็นเวลาสร้าง job) */
  startedAt: string | null;
  /** อัปเดตล่าสุดเมื่อไหร่ — เปลี่ยนทุกครั้งที่มีการ requeue/poll (ช่วงที่ 29) */
  updatedAt: string;
  /** หน้าปัจจุบัน/จำนวนหน้าทั้งหมดที่ provider รายงานจริง (ช่วงที่ 29) — null
   * เมื่อไม่ทราบ (provider ไม่รองรับ หรือยังไม่เริ่มนับ) ไม่เคยเป็นค่าประมาณ */
  currentPage: number | null;
  totalPages: number | null;
  progressPercent: number | null;
  /** ข้อความสถานะทั่วไปเมื่อไม่มีตัวเลขหน้าให้แสดง (เช่น "กำลังประมวลผลโดย
   * OCR provider") — ไม่เคยมีทั้ง currentPage/totalPages และข้อความนี้พร้อมกัน */
  progressMessage: string | null;
}

const RECENT_JOB_COLUMNS =
  "id, entity_id, status, attempts, max_attempts, error_message, created_at, completed_at, started_at, updated_at, current_page, total_pages, progress, progress_message";

/**
 * รายการ job ล่าสุดของ job_type หนึ่งแบบไม่จัดกลุ่ม (ต่างจาก
 * getRecentJobBatches ที่ group ด้วย batch_id) — ใช้กับ job ที่ไม่ได้สร้างจาก
 * bulk action ของ Super Admin (ไม่มี batch_id) เช่น `access_expiration` ที่
 * self-seed ทีละ job, `category_notification` ที่สร้างทีละรายการต่องานวิจัย
 * หนึ่งชิ้น, หรือ `ocr_processing` ที่สั่งทีละรายการจากหน้าจัดการงานวิจัย
 * (ช่วงที่ 29 — เพิ่มฟิลด์ progress ระดับหน้าเข้ามาในชุดนี้ด้วย)
 */
export async function getRecentJobs(
  jobType: BackgroundJobTypeRow,
  limit = 10
): Promise<RecentJobRow[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from("background_jobs")
    .select(RECENT_JOB_COLUMNS)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getRecentJobs failed:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    progressPercent: row.current_page !== null && row.total_pages ? row.progress : null,
    progressMessage: row.progress_message,
  }));
}

/**
 * รายการ master job (job_batches) ล่าสุดของ job_type หนึ่ง — ใช้แสดง progress
 * ที่หน้า /superadmin/pdf-processing, /superadmin/data-quality,
 * /superadmin/file-security เท่านั้น
 *
 * **เปลี่ยนจากเดิมทั้งหมด (ช่วงที่ 28)**: เดิมดึง background_jobs สูงสุด 2000
 * แถวมา group ใน JS ทุกครั้งที่เรียก — ไม่แม่นยำเมื่อ batch มีมากกว่า 2000
 * แถวรวมกัน และขัดกับข้อกำหนด "ห้ามโหลดรายการทั้งหมดเข้าหน่วยความจำเพื่อคำนวณ
 * จำนวนรวม" ตอนนี้ query จาก job_batches ตรงๆ (แถวเดียวต่อ batch อยู่แล้ว) ใช้
 * ตัวนับ completed_items/failed_items/cancelled_items/skipped_items ที่อัปเดต
 * แบบ O(1) จาก complete_background_job()/fail_background_job()/
 * set_job_batch_status() ทุกครั้งที่ job ลูกเปลี่ยนสถานะ (ดู migration
 * 20260817120000) — ไม่มีการ query background_jobs เลยในฟังก์ชันนี้อีกต่อไป
 */
export async function getRecentJobBatches(
  jobType: BackgroundJobTypeRow,
  limit = 10
): Promise<JobBatchSummary[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from("job_batches")
    .select(JOB_BATCH_COLUMNS)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getRecentJobBatches failed:", error?.message);
    return [];
  }

  return data.map(toJobBatchSummary);
}

export interface JobBatchDetail extends JobBatchSummary {
  pending: number;
  processing: number;
}

/**
 * รายละเอียด batch เดียวแบบละเอียด (แยก pending/processing ที่ list ไม่มี) —
 * ใช้เฉพาะตอนเปิด JobBatchDetailDrawer เท่านั้น เรียก get_job_batch_progress()
 * ซึ่งเป็น GROUP BY จริงใน Postgres (ไม่โหลดแถวดิบเข้า JS) แต่มีต้นทุนสูงกว่า
 * ตัวนับสำเร็จรูปของ getRecentJobBatches เล็กน้อย จึงไม่เรียกตอน poll รายการ
 * ทั้งหมดทุก 5 วินาที
 */
export async function getJobBatchDetail(batchId: string): Promise<JobBatchDetail | null> {
  if (!isServiceRoleConfigured()) return null;
  const service = createServiceRoleClient();

  const [{ data: batch, error: batchError }, { data: progress, error: progressError }] = await Promise.all([
    service.from("job_batches").select(JOB_BATCH_COLUMNS).eq("id", batchId).maybeSingle(),
    service.rpc("get_job_batch_progress", { p_batch_id: batchId }),
  ]);

  if (batchError || !batch) {
    console.error("getJobBatchDetail failed:", batchError?.message);
    return null;
  }
  if (progressError) {
    console.error("getJobBatchDetail: get_job_batch_progress failed:", progressError.message);
  }

  const byStatus = new Map((progress ?? []).map((r) => [r.status as BackgroundJobStatusRow, Number(r.item_count)]));

  return {
    ...toJobBatchSummary(batch),
    pending: byStatus.get("pending") ?? 0,
    processing: byStatus.get("processing") ?? 0,
  };
}

/** รายการ job ที่ล้มเหลวถาวรของ job_type หนึ่ง — ใช้แสดงปุ่ม "ลองใหม่" ทีละรายการ
 * ที่หน้า pdf-processing/file-security/data-quality เดิม — ไม่รวมรายการที่
 * เจ้าหน้าที่ทำเครื่องหมาย "แก้ไขแล้ว" ที่หน้า /superadmin/jobs ไปแล้ว (ดู
 * resolveDeadLetterJob) เพื่อไม่ให้ค้างอยู่ในรายการที่ต้องจัดการซ้ำสองที่ */
export async function getFailedJobs(jobType: BackgroundJobTypeRow, limit = 50): Promise<JobRow[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from("background_jobs")
    .select("id, entity_id, status, attempts, max_attempts, error_message, created_at")
    .eq("job_type", jobType)
    .eq("status", "failed")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getFailedJobs failed:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export interface DeadLetterJobRow extends JobRow {
  jobType: BackgroundJobTypeRow;
  entityType: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

const DEAD_LETTER_COLUMNS =
  "id, job_type, entity_type, entity_id, status, attempts, max_attempts, error_message, created_at, resolved_at, resolved_by, resolution_note";

function mapDeadLetterRow(row: {
  id: string;
  job_type: BackgroundJobTypeRow;
  entity_type: string | null;
  entity_id: string | null;
  status: BackgroundJobStatusRow;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}): DeadLetterJobRow {
  return {
    id: row.id,
    jobType: row.job_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
  };
}

/** Dead-letter queue ที่ยัง active (ยังไม่ถูกทำเครื่องหมายแก้ไข/ยกเลิก) รวมทุก
 * ประเภทงาน — ใช้ที่หน้า /superadmin/jobs (ต่างจาก getFailedJobs ที่กรองเฉพาะ
 * job_type เดียวสำหรับหน้าย่อยแต่ละหน้า) */
export async function getDeadLetterJobs(limit = 100): Promise<DeadLetterJobRow[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from("background_jobs")
    .select(DEAD_LETTER_COLUMNS)
    .eq("status", "failed")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getDeadLetterJobs failed:", error?.message);
    return [];
  }
  return data.map(mapDeadLetterRow);
}

/** ประวัติ DLQ ที่ถูกจัดการแล้ว (ลองใหม่จนสำเร็จไม่นับ — เฉพาะที่ resolve/cancel
 * ผ่านหน้า /superadmin/jobs) เรียงล่าสุดก่อน */
export async function getResolvedDeadLetterJobs(limit = 50): Promise<DeadLetterJobRow[]> {
  if (!isServiceRoleConfigured()) return [];
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from("background_jobs")
    .select(DEAD_LETTER_COLUMNS)
    .not("resolved_at", "is", null)
    .order("resolved_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("getResolvedDeadLetterJobs failed:", error?.message);
    return [];
  }
  return data.map(mapDeadLetterRow);
}

export interface DuplicateScanBatchRow extends JobBatchSummary {
  ruleVersion: number | null;
}

/**
 * ชุดการสแกนงานวิจัยซ้ำล่าสุด (ช่วงที่ 26) — ใช้แสดง "การสแกนซ้ำล่าสุด" ที่หน้า
 * /superadmin/data-quality/settings โดยเฉพาะ (รวมทั้งที่มาจากปุ่ม "บันทึกและ
 * สแกนใหม่ทั้งระบบ" และจากปุ่ม "ประมวลผลทั้งหมดตามตัวกรอง" ที่หน้า
 * /superadmin/data-quality เดิม) — ตอนนี้ getRecentJobBatches() เองก็คืน
 * filterSnapshot/createdBy มาให้แล้ว (ช่วงที่ 28) จึงแค่ดึงเวอร์ชันเกณฑ์จาก
 * filterSnapshot ต่อโดยไม่ต้อง query/merge สองรอบเหมือนเดิมอีกต่อไป
 */
export async function getRecentDuplicateScanBatches(limit = 10): Promise<DuplicateScanBatchRow[]> {
  const summaries = await getRecentJobBatches("duplicate_scan", limit);
  return summaries.map((s): DuplicateScanBatchRow => ({
    ...s,
    ruleVersion: typeof s.filterSnapshot.ruleVersion === "number" ? s.filterSnapshot.ruleVersion : null,
  }));
}
