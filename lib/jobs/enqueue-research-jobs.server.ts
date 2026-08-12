import "server-only";
import { enqueueBackgroundJob, replaceEntityJob } from "@/lib/jobs/queue.server";

/**
 * ตัวช่วย enqueue job ที่เกี่ยวกับงานวิจัยหนึ่งรายการ — รวม logic ไว้ที่เดียวกัน
 * เพราะถูกเรียกจาก Server Action หลายไฟล์ (submit-research, dashboard/research/
 * new, dashboard/research/[id]/edit, my-submissions/[id], dashboard/approvals)
 * ไม่ throw ออกไปให้ผู้เรียกเลย (enqueueBackgroundJob เองก็ไม่ throw อยู่แล้ว)
 * เพื่อไม่ให้การ enqueue ล้มเหลวไปกระทบการอัปโหลด/แก้ไข/เผยแพร่งานวิจัยหลัก
 */

interface ProcessingJobParams {
  researchItemId: string;
  pdfPath: string;
  userId: string | null;
}

/** ตอนอัปโหลด PDF ครั้งแรก (แถวเพิ่งถูกสร้าง ไม่มี job เก่าที่ต้องยกเลิก) */
export async function enqueueInitialFileProcessingJobs({
  researchItemId,
  pdfPath,
  userId,
}: ProcessingJobParams): Promise<void> {
  await enqueueBackgroundJob({
    jobType: "file_security_rescan",
    payload: { research_item_id: researchItemId, pdf_path: pdfPath },
    idempotencyKey: `file_security_rescan:${researchItemId}`,
    entityType: "research_items",
    entityId: researchItemId,
    createdBy: userId,
  });
  await enqueueBackgroundJob({
    jobType: "pdf_text_extraction",
    payload: { research_item_id: researchItemId, pdf_path: pdfPath },
    idempotencyKey: `pdf_text_extraction:${researchItemId}`,
    entityType: "research_items",
    entityId: researchItemId,
    createdBy: userId,
  });
}

/**
 * ตอนแทนที่ไฟล์ PDF เดิม (แก้ไขงานวิจัยที่มีอยู่แล้ว) — ต้องยกเลิก job เก่าที่ยัง
 * active อยู่ก่อนเสมอ (อ้างไฟล์เก่าที่ไม่มีอยู่แล้ว ประมวลผลไปก็ไม่มีความหมาย
 * และอาจชนกับผลของไฟล์ใหม่ที่กำลังจะสแกน/ดึงข้อความ)
 */
export async function enqueueReplacementFileProcessingJobs({
  researchItemId,
  pdfPath,
  userId,
}: ProcessingJobParams): Promise<void> {
  await replaceEntityJob({
    jobType: "file_security_rescan",
    entityType: "research_items",
    entityId: researchItemId,
    payload: { research_item_id: researchItemId, pdf_path: pdfPath },
    idempotencyKey: `file_security_rescan:${researchItemId}`,
    createdBy: userId,
  });
  await replaceEntityJob({
    jobType: "pdf_text_extraction",
    entityType: "research_items",
    entityId: researchItemId,
    payload: { research_item_id: researchItemId, pdf_path: pdfPath },
    idempotencyKey: `pdf_text_extraction:${researchItemId}`,
    createdBy: userId,
  });
}

/** ตอนเปลี่ยนสถานะเป็น published จริง — ส่งอีเมลแจ้งผู้ติดตามหมวดหมู่แบบ async */
export async function enqueueCategoryNotificationJob(
  researchItemId: string,
  titleTh: string,
  submittedBy: string | null
): Promise<void> {
  await enqueueBackgroundJob({
    jobType: "category_notification",
    payload: { research_item_id: researchItemId, title_th: titleTh, submitted_by: submittedBy },
    idempotencyKey: `category_notification:${researchItemId}`,
    entityType: "research_items",
    entityId: researchItemId,
  });
}
