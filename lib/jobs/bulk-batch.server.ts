import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueBackgroundJob } from "@/lib/jobs/queue.server";
import { getDefaultBatchSize } from "@/lib/data/job-type-settings.server";
import type { BackgroundJobTypeRow, Database } from "@/lib/supabase/database.types";

/** เผื่อ attempts ไว้มากพอสำหรับทุก chunk ที่ bulk_enqueue coordinator ต้อง
 * requeue ตัวเอง (การ requeue นับเป็น attempt ตาม claim_background_jobs เดิม
 * เหมือน retry ทั่วไป) บวก buffer 20 ครั้งสำหรับ retry จริงตอนเจอ error —
 * ถ้าไม่ตั้งสูงพอ งานที่มีหลาย chunk มากจะโดนตัดเข้า DLQ ทั้งที่ยังทำงานถูกต้อง
 * อยู่ ไม่ได้ล้มเหลวจริง */
const MIN_MAX_ATTEMPTS = 50;
const ATTEMPTS_BUFFER = 20;

/**
 * สร้างคำขอ "ประมวลผลทั้งหมดตามตัวกรอง" หนึ่งคำขอ แบบ idempotent — เรียก
 * create_job_batch_if_not_exists() (migration 20260817120000) ผ่าน client
 * ของผู้ใช้ที่ล็อกอินอยู่ (ไม่ใช่ Service Role) เพราะฟังก์ชันนี้ตรวจสิทธิ์ภายใน
 * ด้วย user_max_role_rank() ซึ่งอ่านจาก auth.uid() ของ session ปัจจุบัน — เรียก
 * ผ่าน Service Role จะทำให้ auth.uid() เป็น null และถูกปฏิเสธเสมอ
 *
 * ถ้ามี batch ที่ยัง active (enqueueing/ready/paused) อยู่แล้วสำหรับ
 * job_type+filter เดียวกัน จะได้ batch เดิมกลับมา (isNew=false) แทนการสร้าง
 * ซ้ำ — ผู้เรียกไม่ต้อง enqueue coordinator job ซ้ำในกรณีนี้ (กันกด "ประมวลผล
 * ทั้งหมด" ซ้ำโดยไม่ตั้งใจสร้างสอง batch พร้อมกัน)
 */
export async function createBulkJobBatch(params: {
  supabase: SupabaseClient<Database>;
  jobType: BackgroundJobTypeRow;
  filterSnapshot: Record<string, unknown>;
  totalItems: number | null;
  createdBy: string;
  batchSize?: number;
}): Promise<
  | { ok: true; batchId: string; totalItems: number | null; isNew: boolean }
  | { ok: false; error: string }
> {
  const batchSize = params.batchSize ?? (await getDefaultBatchSize(params.jobType));

  const { data: created, error: createError } = await params.supabase.rpc("create_job_batch_if_not_exists", {
    p_job_type: params.jobType,
    p_filter_snapshot: params.filterSnapshot,
    p_batch_size: batchSize,
    p_total_items: params.totalItems,
    p_created_by: params.createdBy,
  });

  if (createError || !created || created.length === 0) {
    console.error("createBulkJobBatch: create_job_batch_if_not_exists failed:", createError?.message);
    return { ok: false, error: "ไม่สามารถสร้างชุดงานได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const { batch_id: batchId, is_new: isNew } = created[0];

  if (!isNew) {
    // มี batch เดิมทำงานอยู่แล้วสำหรับตัวกรองนี้ — ไม่ต้อง enqueue coordinator ซ้ำ
    return { ok: true, batchId, totalItems: params.totalItems, isNew: false };
  }

  const estimatedChunks = params.totalItems ? Math.ceil(params.totalItems / batchSize) : MIN_MAX_ATTEMPTS;
  const maxAttempts = Math.max(MIN_MAX_ATTEMPTS, estimatedChunks + ATTEMPTS_BUFFER);

  const result = await enqueueBackgroundJob({
    jobType: "bulk_enqueue",
    payload: { job_batches_id: batchId },
    idempotencyKey: `bulk_enqueue:${batchId}`,
    createdBy: params.createdBy,
    maxAttempts,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "สร้างชุดงานสำเร็จ แต่เริ่มประมวลผลไม่สำเร็จ กรุณาลองใหม่ที่หน้า Dead-letter Queue",
    };
  }

  return { ok: true, batchId, totalItems: params.totalItems, isNew: true };
}
