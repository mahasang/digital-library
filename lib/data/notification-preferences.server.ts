import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface NotificationPreferences {
  newResearchInAppEnabled: boolean;
  newResearchEmailEnabled: boolean;
  accessRequestInAppEnabled: boolean;
  accessRequestEmailEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newResearchInAppEnabled: true,
  newResearchEmailEnabled: false,
  accessRequestInAppEnabled: true,
  accessRequestEmailEnabled: false,
};

/** ไม่มีแถวหมายถึงยังไม่เคยตั้งค่า — ใช้ค่าเริ่มต้นเสมอ (ตรงกับ default ของ
 * คอลัมน์ในฐานข้อมูล) ไม่ต้องสร้างแถวล่วงหน้าให้ทุกผู้ใช้ */
export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  if (!isSupabaseConfigured()) return DEFAULT_NOTIFICATION_PREFERENCES;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_NOTIFICATION_PREFERENCES;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "new_research_in_app_enabled, new_research_email_enabled, access_request_in_app_enabled, access_request_email_enabled"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getMyNotificationPreferences failed:", error.message);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    newResearchInAppEnabled: data.new_research_in_app_enabled,
    newResearchEmailEnabled: data.new_research_email_enabled,
    accessRequestInAppEnabled: data.access_request_in_app_enabled,
    accessRequestEmailEnabled: data.access_request_email_enabled,
  };
}
