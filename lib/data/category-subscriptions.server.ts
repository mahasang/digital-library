import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** รหัสหมวดหมู่ (uuid จริง) ที่ผู้ใช้ปัจจุบันติดตามอยู่ — สำหรับ checkbox
 * เลือกหมวดหมู่ที่หน้าตั้งค่าการแจ้งเตือน */
export async function getMySubscribedCategoryIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("category_subscriptions").select("category_id");
  if (error) {
    console.error("getMySubscribedCategoryIds failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.category_id);
}
