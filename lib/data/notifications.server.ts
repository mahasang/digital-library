import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AppNotification } from "@/types/research";

function mapRow(row: {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  research_id: string | null;
  read_at: string | null;
  created_at: string;
}): AppNotification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    researchId: row.research_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** การแจ้งเตือนล่าสุดของผู้ใช้ปัจจุบัน (สำหรับ Header bell) */
export async function getMyNotifications(limit = 10): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, research_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapRow);
  } catch (error) {
    console.error("getMyNotifications failed:", error);
    return [];
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error("getUnreadNotificationCount failed:", error);
    return 0;
  }
}
