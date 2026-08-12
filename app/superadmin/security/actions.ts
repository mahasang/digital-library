"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { SETTINGS_ROW_ID } from "@/lib/data/settings.server";
import { securitySettingsSchema } from "@/lib/validation/security-settings";
import type { ActionResult } from "@/lib/actions/types";

export async function updateSecuritySettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const parsed = securitySettingsSchema.safeParse({
    captchaEnabled: formData.get("captchaEnabled") === "true",
    rateLimitRegisterMax: formData.get("rateLimitRegisterMax"),
    rateLimitRegisterWindowSec: formData.get("rateLimitRegisterWindowSec"),
    rateLimitSubmitMax: formData.get("rateLimitSubmitMax"),
    rateLimitSubmitWindowSec: formData.get("rateLimitSubmitWindowSec"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      captcha_enabled: parsed.data.captchaEnabled,
      rate_limit_register_max: parsed.data.rateLimitRegisterMax,
      rate_limit_register_window_sec: parsed.data.rateLimitRegisterWindowSec,
      rate_limit_submit_max: parsed.data.rateLimitSubmitMax,
      rate_limit_submit_window_sec: parsed.data.rateLimitSubmitWindowSec,
      updated_by: auth.userId,
    })
    .eq("id", SETTINGS_ROW_ID);

  if (error) {
    console.error("updateSecuritySettingsAction failed:", error.message);
    return { status: "error", message: "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง" };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "security_settings_update",
    entityType: "settings",
    entityId: SETTINGS_ROW_ID,
    metadata: { captcha_enabled: parsed.data.captchaEnabled },
  });

  revalidatePath("/superadmin/security");
  return { status: "success", message: "บันทึกการตั้งค่าความปลอดภัยเรียบร้อยแล้ว" };
}
