"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.users");
  const auth = await requireMinRank(40);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const roleNameRaw = String(formData.get("role") || "");

  if (!userId || !ASSIGNABLE_ROLES.includes(roleNameRaw as RoleName)) {
    return { status: "error", message: t("invalidData") };
  }
  const roleName = roleNameRaw as RoleName;

  const supabase = await createClient();

  const { data: targetRank } = await supabase.rpc("user_max_role_rank", { uid: userId });
  if ((targetRank ?? 0) >= 50) {
    return { status: "error", message: tUsers("cannotChangeSuperAdminHere") };
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();

  if (!role) {
    return { status: "error", message: tUsers("roleNotFound") };
  }

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (deleteError) {
    return {
      status: "error",
      message: toSafeErrorMessage(deleteError, tUsers("roleChangeFailed"), "changeUserRoleAction delete failed"),
    };
  }

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: role.id });
  if (insertError) {
    return {
      status: "error",
      message: toSafeErrorMessage(insertError, tUsers("roleChangeFailed"), "changeUserRoleAction insert failed"),
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
  return { status: "success", message: tUsers("roleChangeSuccess") };
}

/**
 * เปิด/ปิดสถานะบัญชี — ใช้ Supabase Auth Admin API สั่งระงับ (ban) บัญชีจริง
 * ไม่ใช่แค่ปรับ flag ในตาราง profiles เพื่อป้องกันการเข้าสู่ระบบจริงโดยไม่ลบข้อมูล
 */
export async function toggleUserActiveAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.users");
  const auth = await requireMinRank(40);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const nextActive = formData.get("nextActive") === "true";

  if (!userId) {
    return { status: "error", message: t("invalidData") };
  }
  if (userId === auth.userId && !nextActive) {
    return { status: "error", message: tUsers("cannotSuspendSelf") };
  }
  if (!isServiceRoleConfigured()) {
    return { status: "error", message: tUsers("serviceRoleNotConfigured") };
  }

  const supabase = await createClient();
  const service = createServiceRoleClient();

  const { error: banError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: nextActive ? "none" : "876000h",
  });
  if (banError) {
    return {
      status: "error",
      message: toSafeErrorMessage(banError, tUsers("statusChangeFailed"), "toggleUserActiveAction ban failed"),
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_active: nextActive })
    .eq("id", userId);
  if (profileError) {
    return {
      status: "error",
      message: toSafeErrorMessage(profileError, tUsers("statusChangeFailed"), "toggleUserActiveAction profile update failed"),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: nextActive ? "user_enable" : "user_disable",
    entityType: "profiles",
    entityId: userId,
  });

  revalidatePath("/dashboard/users");
  return { status: "success", message: nextActive ? tUsers("enabledSuccess") : tUsers("suspendedSuccess") };
}
