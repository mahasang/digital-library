import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { logAudit } from "@/lib/data/audit.server";
import { enqueueCategoryNotificationJob } from "@/lib/jobs/enqueue-research-jobs.server";

export interface ResearchPublishedEvent {
  researchItemId: string;
  titleTh: string;
  submittedBy: string | null;
  actorId: string;
  /** เส้นทางที่ทำให้เกิดการเผยแพร่ — ใช้แค่ metadata ของ audit log เพื่อสืบค้นภายหลัง */
  source: "create" | "update" | "approval";
}

/**
 * จุดเดียวที่ต้องเรียกทุกครั้งที่งานวิจัยเปลี่ยนสถานะเป็น "published" จริง ไม่ว่า
 * จะผ่านเส้นทางไหน (สร้างใหม่พร้อมเผยแพร่ทันที, แก้ไขแล้วเปลี่ยนเป็นเผยแพร่,
 * อนุมัติผ่าน workflow, หรือเผยแพร่ซ้ำหลังปิดเผยแพร่) — ผู้เรียกต้อง UPDATE/
 * INSERT แถว research_items ให้ status = 'published' **สำเร็จแล้ว** เท่านั้น
 * ถึงจะเรียกฟังก์ชันนี้ (ไม่ตรวจ/เขียนสถานะเอง เพื่อไม่ต้องรื้อโครงสร้างการ
 * บันทึกฟอร์มที่ต่างกันของแต่ละเส้นทาง — ดู docs/document-access-requests.md)
 *
 * จัดการให้ครบ:
 * 1. Audit log กลาง (action: "research_published") — เสริมจาก audit log
 *    เฉพาะเส้นทางเดิม (research_create/research_status_change จาก DB trigger)
 *    ให้มี audit trail เดียวที่ query เหตุการณ์ "เผยแพร่" ได้ตรงๆ
 * 2. In-app แจ้งผู้ติดตามหมวดหมู่ — เรียก RPC `notify_category_subscribers_published`
 *    (SQL function, migration 20260811100000) แทนการพึ่ง DB trigger เพราะ
 *    research_categories ยังไม่ถูกเขียนจนกว่า replaceResearchRelations() จะ
 *    เสร็จ — ฟังก์ชันนี้ต้องถูกเรียก **หลังจาก** เขียนความสัมพันธ์หมวดหมู่
 *    เสร็จแล้วเท่านั้น (ทุกจุดเรียกที่มีอยู่เรียกถูกลำดับอยู่แล้ว)
 * 3. Email แจ้งผู้ติดตามหมวดหมู่ — enqueue background job (async, best-effort)
 * 4. ป้องกันแจ้งซ้ำ — RPC ข้างต้น atomic-guard ด้วยคอลัมน์ category_notified_at
 *    ของ research_items เอง (ถูกล้างอัตโนมัติเมื่อสถานะออกจาก published ทำให้
 *    "เผยแพร่ซ้ำหลังปิดเผยแพร่" แจ้งใหม่ได้ถูกต้อง) — audit log และ email ใน
 *    ฟังก์ชันนี้ผูกกับผลของ RPC เดียวกัน ถ้าเป็นการเรียกซ้ำ (เช่น retry โดยไม่
 *    ตั้งใจ) จะไม่ทำอะไรเพิ่มเลยทั้งสามอย่าง
 */
export async function notifyResearchPublished(
  supabase: SupabaseClient<Database>,
  event: ResearchPublishedEvent
): Promise<void> {
  const { data: isFreshPublish, error } = await supabase.rpc(
    "notify_category_subscribers_published",
    { p_research_item_id: event.researchItemId }
  );

  if (error) {
    console.error("notifyResearchPublished: notify_category_subscribers_published failed:", error.message);
    return;
  }

  if (!isFreshPublish) {
    // เรียกซ้ำสำหรับเหตุการณ์เผยแพร่เดียวกัน — ไม่ทำอะไรเพิ่ม (กันแจ้ง/log ซ้ำ)
    return;
  }

  await logAudit(supabase, {
    actorId: event.actorId,
    action: "research_published",
    entityType: "research_items",
    entityId: event.researchItemId,
    metadata: { title_th: event.titleTh, source: event.source },
  });

  await enqueueCategoryNotificationJob(event.researchItemId, event.titleTh, event.submittedBy);
}
