"use server";

import { revalidatePath } from "next/cache";
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
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

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
        "ไม่สามารถบันทึกการตั้งค่าการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง",
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
        "ไม่สามารถบันทึกการติดตามหมวดหมู่ได้ กรุณาลองใหม่อีกครั้ง",
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
          "ไม่สามารถบันทึกการติดตามหมวดหมู่ได้ กรุณาลองใหม่อีกครั้ง",
          "updateNotificationSettingsAction insert subscriptions failed"
        ),
      };
    }
  }

  revalidatePath("/profile/notification-settings");
  return { status: "success", message: "บันทึกการตั้งค่าเรียบร้อยแล้ว" };
}
