import "server-only";

/**
 * จำนวนอีเมล/คำขอที่ยอมให้ยิงพร้อมกันได้สูงสุดต่อ "chunk" เดียว — ค่าคงที่
 * ปลอดภัยที่ตายตัว ไม่ใช่ Setting ที่ Super Admin ปรับได้ (ตัดสินใจตั้งใจ:
 * นี่คือกันชนภายในของโค้ด ไม่ใช่มิติที่ผู้ดูแลระบบควรต้องมาปรับเอง — เหมือน
 * OCR_POLL_DELAY_MS ในช่วงที่ 29) กันไม่ให้ job เดียวที่มีผู้รับจำนวนมาก (เช่น
 * หมวดหมู่ที่มีผู้ติดตามหลักร้อย) ยิง request หา email provider พร้อมกันเกิน
 * rate limit ของ provider เอง
 */
export const EMAIL_BATCH_CONCURRENCY = 5;

/**
 * รัน fn() ให้ทุกรายการใน items แต่จำกัดจำนวนที่ทำงานพร้อมกันไม่เกิน
 * concurrency ต่อ chunk (แทน Promise.all แบบไม่จำกัดจำนวนเดิม) — แต่ละรายการ
 * ที่ fn() reject จะไม่ทำให้รายการอื่นหยุดทำงาน (ผู้เรียกต้อง catch เองใน fn()
 * ถ้าต้องการ best-effort ต่อรายการ เหมือนที่ผู้เรียกทั้งสองจุดทำอยู่แล้ว)
 */
export async function sendInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<unknown>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(fn));
  }
}
