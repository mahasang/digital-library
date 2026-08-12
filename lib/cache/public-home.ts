import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Cache tags + นโยบายเวลา สำหรับข้อมูลสาธารณะของหน้าแรกเท่านั้น (Hallmark —
 * public homepage caching) — ใช้คู่กับ unstable_cache() ใน
 * lib/data/settings.server.ts, lib/data/categories.server.ts, และ
 * lib/data/research.server.ts (เฉพาะ getLatestResearch/getPopularResearch/
 * getPublishedResearchStats) เท่านั้น **ห้ามนำ tag เหล่านี้ไปใช้กับข้อมูลที่
 * ผูกกับตัวผู้ใช้** (session, บทบาท, การแจ้งเตือน, คำขอเข้าถึงเอกสาร, Signed
 * URL, งานวิจัยระดับ member_only/staff_only) — ดูเหตุผลเต็มที่
 * lib/supabase/public.ts
 *
 * PUBLIC_HOME_TAG เป็น tag "ร่ม" ที่ผูกกับ cache ทุกตัวข้างต้น ใช้เมื่อต้องการ
 * ล้าง cache สาธารณะของหน้าแรกทั้งหมดพร้อมกัน (เช่น จากการ seed ข้อมูลใหม่
 * หรือ maintenance action) — เส้นทางเขียนข้อมูลปกติ (Server Action ต่างๆ)
 * ควรเรียกฟังก์ชัน revalidatePublic*() ด้านล่างที่ตรงกับข้อมูลที่แก้ไขจริง
 * แทน เพื่อล้างเฉพาะจุดที่จำเป็น ไม่กระทบ cache ของข้อมูลส่วนอื่นที่ไม่ได้แก้ไข
 */
export const PUBLIC_HOME_TAG = "public-home";
export const PUBLIC_SETTINGS_TAG = "public-settings";
export const PUBLIC_CATEGORIES_TAG = "public-categories";
export const PUBLIC_RESEARCH_TAG = "public-research";

/**
 * เวลาหมดอายุสำรอง (วินาที) สำหรับทุก cache สาธารณะของหน้าแรก — เป็นเพียง
 * "ตาข่ายนิรภัย" เผื่อเส้นทางเขียนข้อมูลจุดใดจุดหนึ่งลืมเรียก revalidateTag()
 * (หรือมีการแก้ไขข้อมูลนอกแอปนี้โดยตรง เช่นผ่าน SQL Editor) ไม่ใช่กลไกหลักที่
 * ทำให้เห็นข้อมูลใหม่ — กลไกหลักคือการเรียก revalidatePublicSettings()/
 * revalidatePublicCategories()/revalidatePublicResearch() จาก Server Action
 * ทุกจุดที่แก้ไขข้อมูลจริง (ดูฟังก์ชันด้านล่าง) ซึ่งทำให้เห็นผลภายในไม่กี่วินาที
 * (วัดจริงระหว่างพัฒนา ~2-3 วินาที — ไม่ใช่ synchronous ทันทีเป๊ะ เพราะเป็นการ
 * ทำงานของ Next.js เอง ไม่ใช่สิ่งที่แอปนี้ควบคุมเวลาได้ตรงๆ) เร็วกว่าเวลาหมด
 * อายุสำรองนี้มาก ใช้ค่าเดียวกันทั้งหมด (ไม่แยกตามตาราง) เพื่อให้เข้าใจ/ตรวจสอบ
 * นโยบาย cache ได้ง่าย — ดูรายละเอียดเต็มใน docs/caching.md
 */
export const PUBLIC_HOME_REVALIDATE_SECONDS = 60;

/** เรียกหลังแก้ไขการตั้งค่าระบบ (settings table) เสร็จสำเร็จ — ดู
 * app/superadmin/system-settings/actions.ts */
export function revalidatePublicSettings() {
  revalidateTag(PUBLIC_SETTINGS_TAG);
  revalidateTag(PUBLIC_HOME_TAG);
}

/** เรียกหลังเพิ่ม/แก้ไข/เปิดปิด/ลบ หมวดหมู่เสร็จสำเร็จ — ดู
 * app/dashboard/categories/actions.ts */
export function revalidatePublicCategories() {
  revalidateTag(PUBLIC_CATEGORIES_TAG);
  revalidateTag(PUBLIC_HOME_TAG);
}

/** เรียกหลังเปลี่ยนสถานะ (เผยแพร่/เก็บถาวร/อนุมัติ/ปฏิเสธ/ขอแก้ไข)/แก้ไข/รวม
 * งานวิจัยเสร็จสำเร็จ — ดู app/dashboard/approvals/[id]/actions.ts,
 * app/dashboard/research/[id]/edit/actions.ts,
 * app/dashboard/duplicate-reviews/actions.ts
 *
 * เรียกแบบไม่มีเงื่อนไข (ไม่ต้องแยกว่าการเปลี่ยนสถานะครั้งนี้กระทบชุดข้อมูล
 * สาธารณะจริงหรือไม่ เช่น draft -> pending_review ไม่กระทบ) เพราะการล้าง
 * cache ที่ไม่จำเป็นเป็นแค่ต้นทุนของการ query ใหม่ครั้งเดียว ไม่ใช่บั๊ก —
 * ตรงข้ามกับการลืมล้างซึ่งทำให้ผู้ใช้เห็นข้อมูลเก่าค้างอยู่ */
export function revalidatePublicResearch() {
  revalidateTag(PUBLIC_RESEARCH_TAG);
  revalidateTag(PUBLIC_HOME_TAG);
}
