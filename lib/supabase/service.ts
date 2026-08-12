import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client ที่ใช้ Service Role Key — ข้าม Row Level Security ทั้งหมด
 *
 * ใช้เฉพาะในบริบทที่เชื่อถือได้ฝั่งเซิร์ฟเวอร์เท่านั้น (Server Action / Route
 * Handler) และเฉพาะงานที่จำเป็นต้องข้าม RLS จริงๆ เช่นการสร้าง Signed URL
 * สำหรับไฟล์ใน private bucket ให้ผู้อ่านที่ไม่ใช่เจ้าของไฟล์ (Guest/Member/Staff
 * ที่มีสิทธิ์อ่านตาม access_level ของงานวิจัย แต่ไม่ใช่เจ้าของไฟล์ใน Storage)
 *
 * ห้ามนำไปใช้แทน client ปกติสำหรับ query ทั่วไป — การตรวจสอบสิทธิ์ยังต้องทำ
 * ด้วยตนเองในโค้ดก่อนเรียกใช้ client นี้เสมอ (ดู lib/storage/signed-url.server.ts)
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "ไม่พบการตั้งค่า SUPABASE_SERVICE_ROLE_KEY กรุณาตรวจสอบไฟล์ .env.local"
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
