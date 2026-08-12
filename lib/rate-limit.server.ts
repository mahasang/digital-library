import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Rate limiting แบบอิงฐานข้อมูล (ไม่ต้องพึ่งบริการภายนอกที่มีค่าใช้จ่าย เช่น
 * Redis) ผ่านฟังก์ชัน `check_rate_limit()` ใน Postgres — เหมาะกับสเกลของ
 * ระบบห้องสมุดนี้ (ฟอร์มสมัครสมาชิก/ส่งงานวิจัย ไม่ใช่ endpoint ที่มี traffic สูง)
 *
 * ออกแบบให้ "fail-open" เมื่อตรวจสอบไม่ได้ (เช่น ยังไม่ได้ตั้งค่า Supabase หรือ
 * DB error) เพื่อไม่ให้ตัว rate limiter เองกลายเป็นจุดที่ทำให้ฟีเจอร์หลักใช้
 * งานไม่ได้ — ความเสี่ยงที่ยอมรับได้เพราะมี validation/RLS ชั้นอื่นอยู่แล้ว
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean }> {
  if (!isSupabaseConfigured()) return { allowed: true };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return { allowed: data !== false };
  } catch (error) {
    console.error(`checkRateLimit failed for key "${key}":`, error);
    return { allowed: true };
  }
}

/** รวม IP กับ action เป็น key เดียว — ใช้จำกัดอัตราต่อ IP ต่อฟอร์ม */
export function rateLimitKeyForIp(action: string, ip: string | null): string {
  return `${action}:${ip ?? "unknown"}`;
}

/** รวม user id กับ action เป็น key เดียว — ใช้จำกัดอัตราต่อผู้ใช้ที่ล็อกอินแล้ว
 * (ต่างจาก rateLimitKeyForIp ที่ใช้กับฟอร์มสาธารณะแบบไม่ล็อกอิน) */
export function rateLimitKeyForUser(action: string, userId: string): string {
  return `${action}:${userId}`;
}
