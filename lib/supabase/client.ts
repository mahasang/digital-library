import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/config";

/**
 * สร้าง Supabase client สำหรับใช้งานฝั่ง Browser (Client Component)
 * ใช้ Anon key เท่านั้น ปลอดภัยเนื่องจากสิทธิ์การเข้าถึงข้อมูลถูกจำกัดด้วย RLS Policies
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
