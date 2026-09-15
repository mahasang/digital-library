"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";

/** บันทึกการตั้งค่าการแจ้งเตือน (in-app/email สำหรับงานวิจัยใหม่และคำขอเข้าถึง
 * เอกสาร) และรายการหมวดหมู่ที่ติดตามพร้อมกันในคำขอเดียว — upsert
 * notification_preferences (แถวเดียวต่อผู้ใช้) แล้ว sync category_subscriptions
 * แบบ "ลบทั้งหมดแล้วเพิ่มใหม่ตามที่เลือก" (เรียบง่ายกว่าการ diff และปริมาณ
 * หมวดหมู่ในระบบนี้น้อยพอที่จะไม่มีปัญหาประสิทธิภาพ) */
export async function updateNotificationSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "actionMessages" });

  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("common.supabaseNotConfigured") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: t("common.mustLogIn") };

  const preferences = {
    user_id: user.id,
    new_research_in_app_enabled: formData.get("newResearchInAppEnabled") === "true",
    new_research_email_enabled: formData.get("newResearchEmailEnabled") === "true",
    access_request_in_app_enabled: formData.get("accessRequestInAppEnabled") === "true",
    access_request_email_enabled: formData.get("accessRequestEmailEnabled") === "true",
  };

  const { error: prefError } = await supabase
    .from("notification_preferences")
    .upsert(preferences, { onConflict: "user_id" });

  if (prefError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        prefError,
        t("notificationSettings.preferencesSaveFailed"),
        "updateNotificationSettingsAction preferences failed"
      ),
    };
  }

  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  const { error: deleteError } = await supabase
    .from("category_subscriptions")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        deleteError,
        t("notificationSettings.subscriptionsSaveFailed"),
        "updateNotificationSettingsAction delete subscriptions failed"
      ),
    };
  }

  if (categoryIds.length > 0) {
    const { error: insertError } = await supabase
      .from("category_subscriptions")
      .insert(categoryIds.map((categoryId) => ({ user_id: user.id, category_id: categoryId })));
    if (insertError) {
      return {
        status: "error",
        message: toSafeErrorMessage(
          insertError,
          t("notificationSettings.subscriptionsSaveFailed"),
          "updateNotificationSettingsAction insert subscriptions failed"
        ),
      };
    }
  }

  revalidatePath("/profile/notification-settings");
  return { status: "success", message: t("common.settingsSavedSuccess") };
}
