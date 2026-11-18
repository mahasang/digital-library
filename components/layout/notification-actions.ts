"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeNotificationIds } from "@/lib/notifications/ids";

/** ทำเครื่องหมายว่าอ่านการแจ้งเตือนของตัวเองแล้ว — RLS จำกัดไว้เฉพาะแถวของตัวเองอยู่แล้ว */
export async function markNotificationReadAction(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("markNotificationReadAction failed:", error.message);
    return;
  }

  revalidatePath("/", "layout");
}

/**
 * ทำเครื่องหมายว่าอ่านแล้วหลายรายการในครั้งเดียว — เรียกตอนผู้ใช้เปิดกระดิ่ง
 * (รายการที่แสดงในแผง ไม่เกิน 10 รายการ) คืน true เมื่อสำเร็จ เพื่อให้ฝั่ง client
 * ย้อนตัวเลขที่ลดไว้ล่วงหน้ากลับได้ถ้าบันทึกไม่สำเร็จ
 *
 * ความปลอดภัย: กรอง id ที่ไม่ใช่ UUID ทิ้ง, .eq("user_id", ผู้ใช้ปัจจุบัน) เสมอ
 * (ไม่เชื่อ user_id จาก client) และ RLS notifications_update_own จำกัดแถวของ
 * ตัวเองซ้ำอีกชั้น — อัปเดตเฉพาะแถวที่ยังไม่อ่าน (read_at is null)
 */
export async function markNotificationsReadAction(notificationIds: string[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const ids = sanitizeNotificationIds(notificationIds);
  if (ids.length === 0) return true;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null)
    .eq("user_id", user.id);

  if (error) {
    console.error("markNotificationsReadAction failed:", error.message);
    return false;
  }

  revalidatePath("/", "layout");
  return true;
}

export async function markAllNotificationsReadAction(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", user.id);

  if (error) {
    console.error("markAllNotificationsReadAction failed:", error.message);
    return;
  }

  revalidatePath("/", "layout");
}
