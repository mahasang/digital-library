import "server-only";
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
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      result: { status: "error", message: "ระบบยังไม่ได้เชื่อมต่อ Supabase" },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      result: { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" },
    };
  }

  const rank = await getCurrentUserRoleRank();
  if (rank < minRank) {
    return {
      ok: false,
      result: {
        status: "error",
        message:
          minRank >= 40
            ? "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นผู้ดูแลระบบเท่านั้น"
            : "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นบรรณารักษ์ขึ้นไป",
      },
    };
  }

  if (minRank >= SUPER_ADMIN_RANK) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return {
        ok: false,
        result: {
          status: "error",
          message:
            "ต้องยืนยันตัวตนสองขั้นตอน (MFA) ให้เรียบร้อยก่อนดำเนินการนี้ กรุณาเข้าสู่ระบบใหม่",
        },
      };
    }
  }

  return { ok: true, userId: user.id };
}
