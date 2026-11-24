/**
 * ตรรกะล้วนของหน้าอนุมัติเฟส 5: ปุ่ม "อนุมัติและเผยแพร่" และ "อนุมัติหลายรายการ"
 *
 * ไม่แตะ Supabase/Next ใดๆ เพื่อทดสอบได้ตรงๆ — server action ใน
 * app/[locale]/dashboard/approvals/[id]/actions.ts เรียกใช้ตัดสินซ้ำฝั่งเซิร์ฟเวอร์ทุกครั้ง
 * ห้ามเชื่อว่าปุ่มบนหน้าจอโชว์ถูกต้อง
 */
import type { DocumentStatus } from "@/types/research";

/** อนุมัติหลายรายการได้ครั้งละไม่เกินเท่านี้ (UI จำกัดเท่ากัน แต่ฝั่งเซิร์ฟเวอร์ตัดสินซ้ำ) */
export const BULK_APPROVE_MAX = 25;

/**
 * งบเวลาต่อครั้งของการอนุมัติหลายรายการ — แต่ละรายการส่งอีเมลแจ้งผู้ส่งด้วย ถ้าใช้
 * Vercel แผนฟรีฟังก์ชันอาจถูกตัดที่ราว 10 วินาที เลยหยุดเริ่มรายการใหม่เมื่อเกินงบนี้
 * แล้วรายงานว่าที่เหลือ "ยังไม่ได้ทำ" ให้กดอีกครั้ง (ไม่ทำค้างครึ่งๆ กลางรายการ)
 */
export const BULK_APPROVE_TIME_BUDGET_MS = 7000;

/** สถานะที่ปุ่ม "อนุมัติ" เดิมใช้ได้ และปุ่ม "อนุมัติและเผยแพร่" ใช้ได้เช่นกัน */
export const APPROVE_AND_PUBLISH_FROM_STATUSES = [
  "pending_review",
  "revision_requested",
] as const satisfies readonly DocumentStatus[];

/** อนุมัติหลายรายการรับเฉพาะ "รอตรวจสอบ" — งาน "ขอให้แก้ไข" รอผู้ส่งแก้ ห้ามอนุมัติข้าม */
export const BULK_APPROVE_FROM_STATUS = "pending_review" as const satisfies DocumentStatus;

/** ผลสแกนที่ trigger prevent_publish_unscanned_file ยอมให้เผยแพร่ */
const PUBLISHABLE_SCAN_STATUSES: readonly string[] = ["clean", "skipped"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApproveAndPublishDecision =
  | { allowed: true }
  | { allowed: false; reason: "not_reviewable" | "scan_not_ready" };

/**
 * ปุ่ม "อนุมัติและเผยแพร่" ขึ้น/ทำงานได้เมื่อ: งานรออนุมัติหรือขอแก้ไข **และ** ผลสแกนไฟล์
 * เป็น clean/skipped (ไม่งั้นขั้นเผยแพร่จะถูก trigger บล็อก และงานจะค้างครึ่งทาง)
 * ไม่มีทางเลี่ยงด่านสแกน — งานที่สแกนยังไม่ผ่านต้องอนุมัติก่อนแล้วใช้เส้นทางเดิม
 */
export function canApproveAndPublish(input: {
  status: string | null | undefined;
  scanStatus: string | null | undefined;
}): ApproveAndPublishDecision {
  const reviewable = (APPROVE_AND_PUBLISH_FROM_STATUSES as readonly string[]).includes(
    input.status ?? ""
  );
  if (!reviewable) return { allowed: false, reason: "not_reviewable" };
  if (!PUBLISHABLE_SCAN_STATUSES.includes(input.scanStatus ?? "")) {
    return { allowed: false, reason: "scan_not_ready" };
  }
  return { allowed: true };
}

export type BulkIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; code: "empty" | "too_many" | "invalid" };

/**
 * ตรวจ id ที่ client ส่งมา (server action เป็น endpoint สาธารณะ ไม่เชื่อ input):
 * ต้องเป็น UUID ทุกตัว ตัดซ้ำ ไม่ว่าง และไม่เกิน BULK_APPROVE_MAX — เกินแล้ว "ปฏิเสธ"
 * ทั้งคำขอ ไม่ตัดเงียบๆ เพราะผู้ใช้จะเข้าใจว่าอนุมัติครบ
 */
export function parseBulkApproveIds(raw: readonly unknown[]): BulkIdsResult {
  const unique = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
      return { ok: false, code: "invalid" };
    }
    unique.add(value.toLowerCase());
  }
  if (unique.size === 0) return { ok: false, code: "empty" };
  if (unique.size > BULK_APPROVE_MAX) return { ok: false, code: "too_many" };
  return { ok: true, ids: [...unique] };
}

export type BulkApproveItemCode =
  | "approved"
  | "not_found"
  | "not_pending"
  | "failed"
  | "time_budget";

export interface BulkApproveItemResult {
  id: string;
  code: BulkApproveItemCode;
}

export type BulkApproveState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message: string; results: BulkApproveItemResult[] };

export const idleBulkApproveState: BulkApproveState = { status: "idle" };

/**
 * แยกรายการที่อนุมัติได้ออกจากที่ไม่ได้ (ไม่พบ / ไม่ได้อยู่ในรอตรวจสอบแล้ว) ก่อนลงมือ
 * rows คือผลอ่านจากฐานข้อมูลด้วยสิทธิ์ผู้ใช้ (ผ่าน RLS) — id ที่ไม่อยู่ใน rows ถือว่าไม่พบ
 */
export function classifyBulkItems(
  ids: readonly string[],
  rows: readonly { id: string; status: string }[]
): { eligible: string[]; immediate: BulkApproveItemResult[] } {
  const statusById = new Map(rows.map((row) => [row.id.toLowerCase(), row.status]));
  const eligible: string[] = [];
  const immediate: BulkApproveItemResult[] = [];
  for (const id of ids) {
    const status = statusById.get(id.toLowerCase());
    if (status === undefined) immediate.push({ id, code: "not_found" });
    else if (status !== BULK_APPROVE_FROM_STATUS) immediate.push({ id, code: "not_pending" });
    else eligible.push(id);
  }
  return { eligible, immediate };
}

/**
 * ทำทีละรายการตามลำดับ และหยุด "เริ่ม" รายการใหม่เมื่อเกินงบเวลา (รายการแรกทำเสมอ
 * รายการที่กำลังทำอยู่ทำให้จบ) คืนผลรายรายการ + id ที่ยังไม่ได้เริ่ม
 */
export async function runWithinBudget<T>(
  ids: readonly string[],
  processOne: (id: string) => Promise<T>,
  options: { budgetMs: number; now?: () => number }
): Promise<{ processed: { id: string; outcome: T }[]; skippedIds: string[] }> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const processed: { id: string; outcome: T }[] = [];
  const skippedIds: string[] = [];
  for (const id of ids) {
    if (processed.length > 0 && now() - startedAt >= options.budgetMs) {
      skippedIds.push(id);
      continue;
    }
    processed.push({ id, outcome: await processOne(id) });
  }
  return { processed, skippedIds };
}

/** รวมผลทุกกลุ่มกลับเป็นลำดับเดียวกับที่ผู้ใช้เลือก */
export function assembleBulkResults(
  ids: readonly string[],
  immediate: readonly BulkApproveItemResult[],
  processed: readonly { id: string; code: BulkApproveItemCode }[],
  skippedIds: readonly string[]
): BulkApproveItemResult[] {
  const byId = new Map<string, BulkApproveItemCode>();
  for (const item of immediate) byId.set(item.id, item.code);
  for (const item of processed) byId.set(item.id, item.code);
  for (const id of skippedIds) byId.set(id, "time_budget");
  // id ที่หลุดทุกกลุ่ม (ไม่ควรเกิด) ถือว่าล้มเหลว ดีกว่าตกหล่นเงียบๆ
  return ids.map((id) => ({ id, code: byId.get(id) ?? "failed" }));
}

export function summarizeBulkResults(results: readonly BulkApproveItemResult[]): {
  approved: number;
  total: number;
} {
  return {
    approved: results.filter((result) => result.code === "approved").length,
    total: results.length,
  };
}
