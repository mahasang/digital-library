import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/config";

/**
 * สร้าง Supabase client สำหรับใช้งานฝั่งเซิร์ฟเวอร์ (Server Component,
 * Server Action, Route Handler) โดยอ่าน/เขียน session ผ่าน cookies ของ Next.js
 *
 * หมายเหตุ: การเรียก .set() ใน Server Component ธรรมดา (ที่ไม่ใช่ Server Action
 * หรือ Route Handler) จะไม่มีผล เนื่องจาก Next.js ไม่อนุญาตให้ตั้งค่า cookies
 * ระหว่าง render — ในกรณีนั้น middleware.ts จะเป็นตัวรีเฟรช session แทน
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // เรียกจาก Server Component ระหว่าง render — ปล่อยให้ middleware
          // เป็นผู้รีเฟรช session แทน
        }
      },
    },
  });
}
