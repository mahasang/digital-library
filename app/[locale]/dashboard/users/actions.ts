"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ActionResult } from "@/lib/actions/types";
import type { RoleName } from "@/lib/supabase/database.types";

const ASSIGNABLE_ROLES: RoleName[] = ["member", "staff", "librarian", "admin"];

/** เปลี่ยนบทบาทผู้ใช้ (แทนที่บทบาทเดิมทั้งหมดด้วยบทบาทใหม่ที่เลือก) — Admin เท่านั้น */
export async function changeUserRoleAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(40);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const roleNameRaw = String(formData.get("role") || "");

  if (!userId || !ASSIGNABLE_ROLES.includes(roleNameRaw as RoleName)) {
    return { status: "error", message: "ข้อมูลไม่ถูกต้อง" };
  }
  const roleName = roleNameRaw as RoleName;

  const supabase = await createClient();

  const { data: targetRank } = await supabase.rpc("user_max_role_rank", { uid: userId });
  if ((targetRank ?? 0) >= 50) {
    return {
      status: "error",
      message: "ไม่สามารถเปลี่ยนบทบาทของ Super Admin ได้ที่หน้านี้ — จัดการได้ที่ /superadmin เท่านั้น",
    };
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();

  if (!role) {
    return { status: "error", message: "ไม่พบบทบาทที่เลือก" };
  }

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (deleteError) {
    return {
      status: "error",
      message: toSafeErrorMessage(deleteError, "ไม่สามารถเปลี่ยนบทบาทได้ กรุณาลองใหม่อีกครั้ง", "changeUserRoleAction delete failed"),
    };
  }

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: role.id });
  if (insertError) {
    return {
      status: "error",
      message: toSafeErrorMessage(insertError, "ไม่สามารถเปลี่ยนบทบาทได้ กรุณาลองใหม่อีกครั้ง", "changeUserRoleAction insert failed"),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "user_role_change",
    entityType: "profiles",
    entityId: userId,
    metadata: { new_role: roleName },
  });

  revalidatePath("/dashboard/users");
  return { status: "success", message: "เปลี่ยนบทบาทเรียบร้อยแล้ว" };
}

/**
 * เปิด/ปิดสถานะบัญชี — ใช้ Supabase Auth Admin API สั่งระงับ (ban) บัญชีจริง
 * ไม่ใช่แค่ปรับ flag ในตาราง profiles เพื่อป้องกันการเข้าสู่ระบบจริงโดยไม่ลบข้อมูล
 */
export async function toggleUserActiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(40);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const nextActive = formData.get("nextActive") === "true";

  if (!userId) {
    return { status: "error", message: "ข้อมูลไม่ถูกต้อง" };
  }
  if (userId === auth.userId && !nextActive) {
    return { status: "error", message: "ไม่สามารถระงับบัญชีของตัวเองได้" };
  }
  if (!isServiceRoleConfigured()) {
    return {
      status: "error",
      message:
        "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงไม่สามารถระงับ/เปิดใช้งานบัญชีได้",
    };
  }

  const supabase = await createClient();
  const service = createServiceRoleClient();

  const { error: banError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: nextActive ? "none" : "876000h",
  });
  if (banError) {
    return {
      status: "error",
      message: toSafeErrorMessage(banError, "ไม่สามารถเปลี่ยนสถานะบัญชีได้ กรุณาลองใหม่อีกครั้ง", "toggleUserActiveAction ban failed"),
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_active: nextActive })
    .eq("id", userId);
  if (profileError) {
    return {
      status: "error",
      message: toSafeErrorMessage(profileError, "ไม่สามารถเปลี่ยนสถานะบัญชีได้ กรุณาลองใหม่อีกครั้ง", "toggleUserActiveAction profile update failed"),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: nextActive ? "user_enable" : "user_disable",
    entityType: "profiles",
    entityId: userId,
  });

  revalidatePath("/dashboard/users");
  return { status: "success", message: nextActive ? "เปิดใช้งานบัญชีแล้ว" : "ระงับบัญชีแล้ว" };
}
