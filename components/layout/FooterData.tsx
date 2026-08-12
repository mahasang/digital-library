import FooterSwitcher from "@/components/layout/FooterSwitcher";
import { getSettings } from "@/lib/data/settings.server";
import { getCategories } from "@/lib/data/categories.server";

/**
 * Hallmark — header rendering refactor. เดิม app/layout.tsx ดึง settings +
 * categories (สำหรับ Footer) เป็นส่วนหนึ่งของ Promise.all ที่บล็อกทั้งหน้าทุก
 * route — ย้ายมาเป็น Server Component ของตัวเอง ให้ห่อด้วย <Suspense> ได้
 * (ดู app/layout.tsx) Footer ไม่ใช่เนื้อหาสำคัญเหนือ fold จึงไม่จำเป็นต้องรอ
 * ให้พร้อมก่อน {children} จะ render ได้
 *
 * getCategories() ผ่าน unstable_cache แล้ว (Hallmark — public homepage
 * caching) จึงเบามาก ส่วน getSettings() ยังไม่ cache (ตั้งใจ — มีฟิลด์ที่ใช้
 * ตัดสินใจเชิงธุรกิจที่ต้องสดเสมอ ดู lib/data/settings.server.ts) แต่เป็นแค่
 * query แถวเดียวเบาๆ ไม่ใช่ปัญหาด้านความเร็ว
 */
/** Loading fallback ระหว่างรอ FooterData — Footer อยู่ใต้ fold เสมอจึงไม่กระทบ
 * การมองเห็นเนื้อหาหลัก แต่ยังคงทำเครื่องหมายให้ screen reader ทราบว่ากำลังโหลด
 * อยู่เช่นเดียวกับ HeaderAccountAreaSkeleton */
export function FooterSkeleton() {
  return (
    <div
      role="status"
      aria-label="กำลังโหลดส่วนท้ายเว็บไซต์"
      className="border-t border-gray-200 bg-gray-50 py-10"
    >
      <div className="mx-auto h-24 w-full max-w-7xl animate-pulse rounded-lg bg-gray-100" aria-hidden="true" />
    </div>
  );
}

export default async function FooterData() {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  return <FooterSwitcher settings={settings} categories={categories} />;
}
