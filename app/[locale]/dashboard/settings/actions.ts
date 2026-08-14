"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { SETTINGS_ROW_ID } from "@/lib/data/settings.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";

export async function updateSettingsAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(40);
  if (!auth.ok) return auth.result;

  const siteName = String(formData.get("siteName") || "").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "").trim();
  const contactPhone = String(formData.get("contactPhone") || "").trim();
  const contactAddress = String(formData.get("contactAddress") || "").trim();
  const copyrightText = String(formData.get("copyrightText") || "").trim();
  const homepageLatestCount = Number(formData.get("homepageLatestCount")) || 8;
  const homepagePopularCount = Number(formData.get("homepagePopularCount")) || 8;

  if (!siteName) {
    return { status: "error", message: "กรุณากรอกชื่อองค์กร" };
  }
  if (homepageLatestCount < 1 || homepageLatestCount > 24) {
    return { status: "error", message: "จำนวนงานวิจัยล่าสุดต้องอยู่ระหว่าง 1-24" };
  }
  if (homepagePopularCount < 1 || homepagePopularCount > 24) {
    return { status: "error", message: "จำนวนงานวิจัยยอดนิยมต้องอยู่ระหว่าง 1-24" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      site_name: siteName,
      logo_url: logoUrl || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      contact_address: contactAddress || null,
      copyright_text: copyrightText || null,
      homepage_latest_count: homepageLatestCount,
      homepage_popular_count: homepagePopularCount,
      updated_by: auth.userId,
    })
    .eq("id", SETTINGS_ROW_ID);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง",
        "updateSettingsAction update failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "settings_update",
    entityType: "settings",
    entityId: SETTINGS_ROW_ID,
    metadata: { site_name: siteName },
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "บันทึกการตั้งค่าเรียบร้อยแล้ว" };
}
