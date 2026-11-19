/**
 * ตัดสินว่าเบราว์เซอร์ควร "ลงทะเบียน" Service Worker, "ข้าม" หรือ "ถอด" ของเดิมออก
 *
 * - นอก production (npm run dev): ไม่ลงทะเบียน และถอด SW + แคชเดิมที่ค้างอยู่ — ไฟล์ใต้
 *   /_next/static ตอน dev ไม่มี hash ในชื่อ ถ้า SW แคชแบบ cache-first ไว้จะได้ JS เก่าค้าง
 *   แม้แก้โค้ดแล้ว (เคยทำให้ฟอร์มส่งงานยังขึ้นข้อความบังคับเก่า)
 * - production: ลงทะเบียนเฉพาะ https หรือ localhost เหมือนเดิม (localhost ใช้ตอนรัน
 *   production build ในเครื่อง เช่น npm run test:a11y)
 *
 * เป็นฟังก์ชันล้วน ไม่แตะ window/navigator เพื่อทดสอบได้ตรงๆ
 */

export type ServiceWorkerAction = "register" | "unregister" | "skip";

/** ชื่อแคชทั้งหมดของ SW นี้ขึ้นต้นด้วยคำนี้ (ดู CACHE_NAME ใน public/sw.js) */
export const SERVICE_WORKER_CACHE_PREFIX = "ebooks-";

export function decideServiceWorkerAction(input: {
  nodeEnv: string | undefined;
  protocol: string;
  hostname: string;
}): ServiceWorkerAction {
  if (input.nodeEnv !== "production") return "unregister";
  if (input.protocol !== "https:" && input.hostname !== "localhost") return "skip";
  return "register";
}
