"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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
    .eq("id", notificationId);

  if (error) {
    console.error("markNotificationReadAction failed:", error.message);
    return;
  }

  revalidatePath("/", "layout");
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
    .is("read_at", null);

  if (error) {
    console.error("markAllNotificationsReadAction failed:", error.message);
    return;
  }

  revalidatePath("/", "layout");
}
