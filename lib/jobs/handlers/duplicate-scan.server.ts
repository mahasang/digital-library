import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { detectDuplicatesForResearchItem } from "@/lib/data/duplicate-research.server";
import { completeBackgroundJob, failBackgroundJob, toSafeJobErrorMessage } from "@/lib/jobs/queue.server";
import type { BackgroundJobRow } from "@/lib/jobs/queue.server";

/**
 * Handler ของ job `duplicate_scan` — เรียก detectDuplicatesForResearchItem()
 * เดิมของช่วงที่ 19 ตรงๆ ผ่าน Service Role (ไม่ต้องแก้ไข logic ภายในเลย —
 * ฟังก์ชันนั้นรับ SupabaseClient<Database> ทั่วไปอยู่แล้ว ใช้ได้ทั้ง client ของ
 * ผู้ใช้และ Service Role) ใช้สำหรับ "ตรวจสอบงานวิจัยซ้ำย้อนหลังทั้งระบบ" ที่
 * /superadmin/data-quality — หนึ่ง job ต่อหนึ่งงานวิจัย (รูปแบบเดียวกับ
 * pdf_text_extraction/file_security_rescan ของช่วงที่ 20) **ไม่มีการรวมข้อมูล
 * (merge) อัตโนมัติเกิดขึ้นเลย** เป็นแค่การตรวจสอบ+บันทึกคู่ที่น่าสงสัยเหมือน
 * การตรวจสอบตอนส่ง/แก้ไขงานวิจัยทุกประการ
 */
export async function handleDuplicateScanJob(job: BackgroundJobRow): Promise<boolean> {
  const researchItemId = String(job.payload.research_item_id ?? "");

  if (!researchItemId) {
    await failBackgroundJob(job.id, "ข้อมูล job ไม่ครบถ้วน (research_item_id)");
    return false;
  }

  try {
    const service = createServiceRoleClient();
    await detectDuplicatesForResearchItem(service, researchItemId);
    await completeBackgroundJob(job.id);
    return true;
  } catch (error) {
    await failBackgroundJob(job.id, toSafeJobErrorMessage(error, "handleDuplicateScanJob"));
    return false;
  }
}
