import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

/**
 * ป้ายภาษาไทยของแต่ละประเภทงาน — ใช้แสดงผลที่หน้า /superadmin/jobs และในอีเมล
 * แจ้งเตือน (ดู lib/jobs/dlq-notify.server.ts) ซ้ำความหมายเดียวกับ CASE
 * expression ใน fail_background_job() ฝั่ง SQL โดยตั้งใจ (คนละระบบ คนละจุดที่
 * render ข้อความ ไม่คุ้มที่จะพยายามใช้แหล่งเดียวกันข้าม SQL/TS)
 */
export const JOB_TYPE_LABELS: Record<BackgroundJobTypeRow, string> = {
  pdf_text_extraction: "ดึงข้อความ PDF",
  file_security_rescan: "ตรวจสอบความปลอดภัยไฟล์",
  access_expiration: "ตรวจสอบสิทธิ์หมดอายุ",
  category_notification: "แจ้งเตือนผู้ติดตามหมวดหมู่",
  duplicate_scan: "ตรวจสอบงานวิจัยซ้ำ",
  ocr_processing: "OCR เอกสารสแกน",
  bulk_enqueue: "สร้างงานเป็นชุด",
  maintenance_cleanup: "บำรุงรักษา/ล้างข้อมูลเก่า",
  ocr_test_run: "ทดสอบ OCR (Controlled Test)",
};

export interface JobDisplayInfo {
  label: string;
  entityTitle: string | null;
  safeSummary: string;
}

interface JobLike {
  jobType: string;
  entityType: string | null;
  entityId: string | null;
}

/**
 * แปลง background_jobs row เป็นข้อมูลที่ปลอดภัยสำหรับแสดงผลที่ UI/อีเมลเสมอ —
 * **ห้ามส่ง job.payload ดิบไปแสดงที่ไหนเลย** (อาจมี path ไฟล์ภายใน/พารามิเตอร์ที่
 * ไม่ควรเปิดเผยแม้จะไม่ใช่ secret ก็ตาม) จุดนี้เป็น allowlist เดียวที่อนุญาตให้
 * ดึงชื่องานวิจัย (entity_type='research_items' เท่านั้น — ประเภทเดียวที่ทุก
 * job type ที่ผูก entity ใช้จริงในปัจจุบัน) แบบ batch เดียวกันคำขอเดียว ไม่ query
 * ทีละแถว (กัน N+1 ที่หน้ารายการ DLQ ซึ่งอาจมีหลายสิบ/ร้อยแถว)
 */
export async function describeJobsForDisplay(jobs: JobLike[]): Promise<JobDisplayInfo[]> {
  const researchIds = Array.from(
    new Set(
      jobs
        .filter((j) => j.entityType === "research_items" && j.entityId)
        .map((j) => j.entityId as string)
    )
  );

  let titleById = new Map<string, string>();
  if (researchIds.length > 0) {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("research_items")
      .select("id, title_th")
      .in("id", researchIds);
    if (error) {
      console.error("describeJobsForDisplay: query research_items failed:", error.message);
    } else {
      titleById = new Map((data ?? []).map((r) => [r.id, r.title_th]));
    }
  }

  return jobs.map((job) => {
    const label = JOB_TYPE_LABELS[job.jobType as BackgroundJobTypeRow] ?? job.jobType;
    const entityTitle =
      job.entityType === "research_items" && job.entityId ? (titleById.get(job.entityId) ?? null) : null;
    return {
      label,
      entityTitle,
      safeSummary: entityTitle ? `${label} — ${entityTitle}` : label,
    };
  });
}

export async function describeJobForDisplay(job: JobLike): Promise<JobDisplayInfo> {
  const [info] = await describeJobsForDisplay([job]);
  return info;
}
