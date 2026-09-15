"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { resetUserMfaFactors } from "@/lib/security/mfa-admin.server";
import { getSettings } from "@/lib/data/settings.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";
import type { ActionResult } from "@/lib/actions/types";
import type { Database, RoleName } from "@/lib/supabase/database.types";

/**
 * บทบาทที่ปรับผ่านฟอร์ม checkbox ทันที (ไม่ต้องยืนยันซ้ำ) — ตั้งใจไม่รวม
 * 'super_admin' ในรายการนี้ การมอบ/ถอดถอน super_admin ต้องผ่าน
 * `grantSuperAdminAction`/`revokeSuperAdminAction` เท่านั้น ซึ่งบังคับให้
 * พิมพ์ยืนยันก่อนเสมอ (กันแม้ super_admin ด้วยกันเองเรียก action นี้ตรงๆ
 * เพื่อข้ามหน้ายืนยัน)
 */
const GENERIC_ASSIGNABLE_ROLES: RoleName[] = ["member", "staff", "librarian", "admin"];

/** เพิ่มบทบาทให้ผู้ใช้ (ไม่แทนที่บทบาทเดิม — ผู้ใช้หนึ่งคนมีได้หลายบทบาท) — ไม่รองรับ super_admin */
export async function addUserRoleAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.superadmin.users");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const roleNameRaw = String(formData.get("role") || "");
  if (!userId || !GENERIC_ASSIGNABLE_ROLES.includes(roleNameRaw as RoleName)) {
    return { status: "error", message: t("invalidData") };
  }
  const roleName = roleNameRaw as RoleName;

  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();
  if (!role) return { status: "error", message: tUsers("roleNotFound") };

  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: role.id });

  if (error && !error.message.includes("duplicate")) {
    console.error("addUserRoleAction failed:", error.message);
    return { status: "error", message: tUsers("addRoleFailed") };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "user_role_add",
    entityType: "profiles",
    entityId: userId,
    metadata: { role: roleName },
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
  return { status: "success", message: tUsers("addRoleSuccess") };
}

/** ถอดถอนบทบาทของผู้ใช้ — ไม่รองรับ super_admin (ดูหมายเหตุที่ GENERIC_ASSIGNABLE_ROLES) */
export async function removeUserRoleAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.superadmin.users");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const roleNameRaw = String(formData.get("role") || "");
  if (!userId || !GENERIC_ASSIGNABLE_ROLES.includes(roleNameRaw as RoleName)) {
    return { status: "error", message: t("invalidData") };
  }
  const roleName = roleNameRaw as RoleName;

  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();
  if (!role) return { status: "error", message: tUsers("roleNotFound") };

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", role.id);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tUsers("removeRoleFailed"),
        "removeUserRoleAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "user_role_remove",
    entityType: "profiles",
    entityId: userId,
    metadata: { role: roleName },
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
  return { status: "success", message: tUsers("removeRoleSuccess") };
}

/**
 * เปิด/ระงับ (ถาวรหรือชั่วคราว) บัญชีผู้ใช้ — ใช้ Supabase Auth Admin API
 * สั่งระงับจริง (ban_duration) เช่นเดียวกับ /dashboard/users
 * durationDays ว่างหรือ 0 = ระงับถาวร, ระบุจำนวนวัน = ระงับชั่วคราว
 */
export async function setUserStatusAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.superadmin.users");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const nextActive = formData.get("nextActive") === "true";
  const durationDaysRaw = formData.get("durationDays");
  const durationDays = durationDaysRaw ? Number(durationDaysRaw) : 0;

  if (!userId) return { status: "error", message: t("invalidData") };
  if (userId === auth.userId && !nextActive) {
    return { status: "error", message: tUsers("cannotSuspendSelf") };
  }
  if (!isServiceRoleConfigured()) {
    return { status: "error", message: tUsers("serviceRoleNotConfigured") };
  }

  const banDuration = nextActive
    ? "none"
    : durationDays > 0
      ? `${durationDays * 24}h`
      : "876000h";

  const supabase = await createClient();
  const service = createServiceRoleClient();

  const { error: banError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  });
  if (banError) {
    console.error("setUserStatusAction ban failed:", banError.message);
    return { status: "error", message: tUsers("statusChangeFailed") };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_active: nextActive })
    .eq("id", userId);
  if (profileError) {
    console.error("setUserStatusAction profile update failed:", profileError.message);
    return { status: "error", message: tUsers("statusChangeFailed") };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: nextActive ? "user_enable" : durationDays > 0 ? "user_suspend_temporary" : "user_suspend",
    entityType: "profiles",
    entityId: userId,
    metadata: nextActive ? {} : { duration_days: durationDays || null },
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
  return {
    status: "success",
    message: nextActive
      ? tUsers("enabledSuccess")
      : durationDays > 0
        ? tUsers("suspendedTemporarySuccess", { days: durationDays })
        : tUsers("suspendedSuccess"),
  };
}

// ============================================================================
// มอบ/ถอดถอนบทบาท Super Admin — ต้องพิมพ์ยืนยัน (CONFIRM หรืออีเมลผู้ใช้เป้าหมาย)
// เสมอ ก่อนดำเนินการจริง (บังคับซ้ำที่นี่ฝั่งเซิร์ฟเวอร์ ไม่พึ่ง client เพียง
// อย่างเดียว) การจำกัดสิทธิ์จริงมาจาก requireMinRank(50) + RLS Policy บนตาราง
// user_roles (supabase/migrations/20260802100100_super_admin_role.sql ข้อ 3)
// ส่วนการกันถอดถอน Super Admin คนสุดท้ายบังคับด้วย database trigger
// (ข้อ 4 ในไฟล์เดียวกัน — ทำงานไม่ว่าจะเรียกผ่านทางไหนก็ตาม)
// ============================================================================

async function getTargetProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  unknownUserFallback: string
): Promise<{ email: string; fullName: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { email: data.email ?? "", fullName: data.full_name || data.email || unknownUserFallback };
}

async function getUserRoleNames(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<RoleName[]> {
  const [{ data: userRoles }, { data: roles }] = await Promise.all([
    supabase.from("user_roles").select("role_id").eq("user_id", userId),
    supabase.from("roles").select("id, name"),
  ]);
  const nameById = new Map((roles ?? []).map((r) => [r.id, r.name as RoleName]));
  return (userRoles ?? [])
    .map((ur) => nameById.get(ur.role_id))
    .filter((name): name is RoleName => Boolean(name));
}

/** ตรวจว่าข้อความยืนยันตรงกับ "CONFIRM" หรืออีเมลผู้ใช้เป้าหมาย (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
function isConfirmationValid(confirmText: string, targetEmail: string): boolean {
  const normalized = confirmText.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "confirm") return true;
  return Boolean(targetEmail) && normalized === targetEmail.trim().toLowerCase();
}

/** มอบสิทธิ์ Super Admin ให้ผู้ใช้ — ต้องยืนยันด้วยข้อความก่อนเสมอ */
export async function grantSuperAdminAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.superadmin.users");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const confirmText = String(formData.get("confirmText") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!userId) return { status: "error", message: t("invalidData") };

  const supabase = await createClient();
  const target = await getTargetProfile(supabase, userId, t("unknownUser"));
  if (!target) return { status: "error", message: tUsers("notFound") };

  if (!isConfirmationValid(confirmText, target.email)) {
    return { status: "error", message: tUsers("confirmMismatch") };
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "super_admin")
    .maybeSingle();
  if (!role) return { status: "error", message: tUsers("superAdminRoleNotFound") };

  const previousRoles = await getUserRoleNames(supabase, userId);

  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: role.id });

  if (error && !error.message.includes("duplicate")) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tUsers("grantFailed"),
        "grantSuperAdminAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "super_admin_grant",
    entityType: "profiles",
    entityId: userId,
    metadata: {
      target_email: target.email,
      target_name: target.fullName,
      previous_roles: previousRoles,
      new_roles: previousRoles.includes("super_admin")
        ? previousRoles
        : [...previousRoles, "super_admin"],
      reason: reason || null,
    },
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
  return {
    status: "success",
    message: tUsers("grantSuccess", { name: target.fullName }),
  };
}

/** ถอดถอนสิทธิ์ Super Admin ของผู้ใช้ — ต้องยืนยันด้วยข้อความก่อนเสมอ (trigger กันคนสุดท้ายอยู่แล้ว) */
export async function revokeSuperAdminAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.superadmin.users");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const confirmText = String(formData.get("confirmText") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!userId) return { status: "error", message: t("invalidData") };

  const supabase = await createClient();
  const target = await getTargetProfile(supabase, userId, t("unknownUser"));
  if (!target) return { status: "error", message: tUsers("notFound") };

  if (!isConfirmationValid(confirmText, target.email)) {
    return { status: "error", message: tUsers("confirmMismatch") };
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "super_admin")
    .maybeSingle();
  if (!role) return { status: "error", message: tUsers("superAdminRoleNotFound") };

  const previousRoles = await getUserRoleNames(supabase, userId);

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", role.id);

  if (error) {
    return {
      status: "error",
      message: toSafeErrorMessage(
        error,
        tUsers("revokeFailed"),
        "revokeSuperAdminAction failed"
      ),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "super_admin_revoke",
    entityType: "profiles",
    entityId: userId,
    metadata: {
      target_email: target.email,
      target_name: target.fullName,
      previous_roles: previousRoles,
      new_roles: previousRoles.filter((r) => r !== "super_admin"),
      reason: reason || null,
    },
  });

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
  return {
    status: "success",
    message: tUsers("revokeSuccess", { name: target.fullName }),
  };
}

// ============================================================================
// รีเซ็ต MFA ของผู้ใช้อื่น (กรณีทำอุปกรณ์หาย) — Super Admin เท่านั้น ห้ามรีเซ็ต
// ของตัวเอง ต้องพิมพ์ "RESET MFA" และระบุเหตุผลก่อนเสมอ (บังคับซ้ำฝั่งเซิร์ฟเวอร์
// ที่นี่ ไม่พึ่ง client เพียงอย่างเดียว — เทียบเท่าการยืนยันของ grant/revoke
// super_admin ด้านบน) ใช้ Supabase Auth Admin API ลบ MFA factor จริง
// (lib/security/mfa-admin.server.ts) แทนการรัน SQL ตรงตามที่เอกสารเดิมแนะนำ
// ============================================================================

/** รีเซ็ต MFA (ลบอุปกรณ์ยืนยันตัวตนทั้งหมด) ของผู้ใช้ — ต้องพิมพ์ "RESET MFA" และระบุเหตุผลเสมอ */
export async function resetUserMfaAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tUsers = await getTranslations("actionMessages.superadmin.users");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const userId = String(formData.get("userId") || "");
  const confirmText = String(formData.get("confirmText") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!userId) return { status: "error", message: t("invalidData") };

  if (userId === auth.userId) {
    return { status: "error", message: tUsers("cannotResetOwnMfa") };
  }

  if (confirmText.trim().toUpperCase() !== "RESET MFA") {
    return { status: "error", message: tUsers("mfaConfirmMismatch") };
  }

  if (!reason) {
    return { status: "error", message: tUsers("mfaReasonRequired") };
  }

  const supabase = await createClient();
  const target = await getTargetProfile(supabase, userId, t("unknownUser"));
  if (!target) return { status: "error", message: tUsers("notFound") };

  const outcome = await resetUserMfaFactors(userId);

  if (!outcome.ok) {
    const message =
      outcome.reason === "not_configured"
        ? tUsers("mfaResetNotConfigured")
        : outcome.reason === "no_factors"
          ? tUsers("mfaResetNoFactors")
          : tUsers("mfaResetFailed");

    await logAudit(supabase, {
      actorId: auth.userId,
      action: "mfa_reset",
      entityType: "profiles",
      entityId: userId,
      metadata: {
        target_email: target.email,
        target_name: target.fullName,
        reason,
        outcome: outcome.reason,
      },
    });

    return { status: "error", message };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "mfa_reset",
    entityType: "profiles",
    entityId: userId,
    metadata: {
      target_email: target.email,
      target_name: target.fullName,
      reason,
      factors_removed: outcome.removedCount,
      outcome: "success",
    },
  });

  const settings = await getSettings();

  if (settings.notificationsInAppEnabled) {
    const service = createServiceRoleClient();
    const { error: notifyError } = await service.from("notifications").insert({
      user_id: userId,
      title: tUsers("mfaResetNotifyTitle"),
      message: tUsers("mfaResetNotifyBody"),
      type: "warning",
    });
    if (notifyError) {
      console.error("resetUserMfaAction: สร้างการแจ้งเตือนในระบบไม่สำเร็จ:", notifyError.message);
    }
  }

  if (settings.notificationsEmailEnabled && target.email) {
    await sendNotificationEmail({
      to: target.email,
      subject: tUsers("mfaResetEmailSubject"),
      text: tUsers("mfaResetEmailBody", { email: target.email }),
    });
  }

  revalidatePath("/superadmin/users");
  revalidatePath(`/superadmin/users/${userId}`);
  return {
    status: "success",
    message: tUsers("mfaResetSuccess", { name: target.fullName }),
  };
}
