import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank, SUPER_ADMIN_RANK } from "@/lib/supabase/roles";
import type { ActionResult } from "@/lib/actions/types";

type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; result: ActionResult };

/**
 * ตรวจสอบว่าผู้ใช้ปัจจุบันเข้าสู่ระบบและมี rank >= minRank — ใช้ต้น server
 * action ของ Dashboard ทุกตัว
 *
 * เมื่อ minRank >= 50 (super_admin — ทุก call site ที่เรียกด้วยค่านี้อยู่ใน
 * app/superadmin/*​/actions.ts เท่านั้น) จะตรวจสอบ MFA assurance level (aal2)
 * เพิ่มอีกชั้นด้วยเสมอ — เป็นด่านสำรอง (defense-in-depth) ของการบังคับ MFA
 * สำหรับ Super Admin ด่านหลักคือ middleware.ts ซึ่งกันไม่ให้ไปถึงหน้าที่มี
 * ฟอร์มเรียก Server Action เหล่านี้ได้ตั้งแต่แรกอยู่แล้วหากยังไม่ผ่าน MFA —
 * เผื่อกรณีเรียก Server Action ตรงโดยไม่ผ่านการนำทางหน้าปกติ
 */
export async function requireMinRank(minRank: number): Promise<GuardResult> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "actionMessages.common" });

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      result: { status: "error", message: t("supabaseNotConfigured") },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      result: { status: "error", message: t("mustLogIn") },
    };
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < minRank) {
    return {
      ok: false,
      result: {
        status: "error",
        message: minRank >= 40 ? t("requiresAdminRank") : t("requiresLibrarianRank"),
      },
    };
  }

  if (minRank >= SUPER_ADMIN_RANK) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return {
        ok: false,
        result: { status: "error", message: t("mfaRequired") },
      };
    }
  }

  return { ok: true, userId: user.id };
}
