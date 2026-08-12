import IdleLogout from "@/components/auth/IdleLogout";
import { getSessionUser } from "@/lib/supabase/session";

/**
 * Hallmark — header rendering refactor. เดิม app/layout.tsx ใช้ user จาก
 * getSessionUser() ที่ดึงไว้ที่ระดับบนสุดของ layout (บล็อกทั้งหน้า) มาตัดสินใจ
 * ว่าจะ mount <IdleLogout /> หรือไม่ (`{user && <IdleLogout />}`) — ย้ายมาเป็น
 * Server Component ของตัวเอง เรียก getSessionUser() เอง (ซ้ำกับที่
 * HeaderAccountArea และ middleware เรียก — ตั้งใจ ไม่ลดความซ้ำซ้อนในรอบนี้
 * ตามที่ระบุไว้) ให้ห่อด้วย <Suspense fallback={null}> ได้ใน app/layout.tsx
 * — ไม่มี UI ที่มองเห็นได้เลย (IdleLogout คืน null เสมอ) จึง fallback={null}
 * ก็เพียงพอ ไม่กระทบการแสดงผลใดๆ ระหว่างรอ
 */
export default async function IdleLogoutGate() {
  const user = await getSessionUser();
  return user ? <IdleLogout /> : null;
}
