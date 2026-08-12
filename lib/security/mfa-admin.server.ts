import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import type { DataResult } from "@/lib/data/superadmin-stats.server";
import { getSuperAdminUserList } from "@/lib/data/superadmin-users.server";
import type { MfaFactorSummary } from "@/types/research";

/**
 * อ่าน/ลบอุปกรณ์ MFA (TOTP factor) ของผู้ใช้อื่นผ่าน Supabase Auth Admin API
 * (`supabase.auth.admin.mfa.*`) — เป็นความสามารถที่ Supabase Auth รองรับอยู่แล้ว
 * ไม่ใช่ตาราง/backend ที่แอปนี้สร้างเอง (`@experimental` ใน supabase-js แต่เป็น
 * REST endpoint จริงของ GoTrue: /admin/users/{id}/factors) ใช้ Service Role
 * เท่านั้น (ข้าม RLS) — การจำกัดสิทธิ์ว่าใครเรียกฟังก์ชันเหล่านี้ได้ต้องทำที่
 * ผู้เรียก (Server Action ที่ตรวจ requireMinRank(50) ก่อนเสมอ) เนื่องจาก
 * auth.mfa_factors อยู่นอก schema public จึงเพิ่ม RLS Policy ของแอปเองไม่ได้
 *
 * Factor object ที่ API นี้คืนมามีแค่ id/friendly_name/factor_type/status/
 * created_at/updated_at/last_challenged_at เท่านั้น — ไม่มี secret/QR/recovery
 * code หลุดออกมาแม้แต่ตอนดึงสถานะ (ไม่ต้องกรองข้อมูลเพิ่มเติมฝั่งแอป)
 */

export async function getUserMfaFactors(userId: string): Promise<DataResult<MfaFactorSummary[]>> {
  if (!isServiceRoleConfigured()) return { available: false };

  try {
    const service = createServiceRoleClient();
    const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
    if (error) throw error;

    return {
      available: true,
      data: (data?.factors ?? []).map((f) => ({
        id: f.id,
        friendlyName: f.friendly_name ?? null,
        factorType: f.factor_type,
        status: f.status,
        createdAt: f.created_at,
        lastChallengedAt: f.last_challenged_at ?? null,
      })),
    };
  } catch (error) {
    console.error("getUserMfaFactors failed:", error);
    return { available: false };
  }
}

export type ResetMfaOutcome =
  | { ok: true; removedCount: number }
  | { ok: false; reason: "not_configured" | "list_failed" | "no_factors" | "partial_failure" };

/** ลบอุปกรณ์ MFA ทั้งหมดของผู้ใช้ (รีเซ็ตกลับไปเป็นสถานะ "ยังไม่ได้ตั้งค่า MFA") */
export async function resetUserMfaFactors(userId: string): Promise<ResetMfaOutcome> {
  if (!isServiceRoleConfigured()) return { ok: false, reason: "not_configured" };

  const service = createServiceRoleClient();
  const { data, error: listError } = await service.auth.admin.mfa.listFactors({ userId });
  if (listError) {
    console.error("resetUserMfaFactors: listFactors failed:", listError.message);
    return { ok: false, reason: "list_failed" };
  }

  const factors = data?.factors ?? [];
  if (factors.length === 0) return { ok: false, reason: "no_factors" };

  const results = await Promise.all(
    factors.map((f) => service.auth.admin.mfa.deleteFactor({ id: f.id, userId }))
  );
  const failedCount = results.filter((r) => r.error).length;
  if (failedCount > 0) {
    console.error(
      `resetUserMfaFactors: ลบไม่สำเร็จ ${failedCount}/${factors.length} factor(s) ของผู้ใช้ ${userId}`
    );
    return { ok: false, reason: "partial_failure" };
  }

  return { ok: true, removedCount: factors.length };
}

export type SuperAdminMfaStatus = "enabled" | "not_configured" | "reset_required";

export interface SuperAdminMfaOverviewRow {
  userId: string;
  fullName: string;
  email: string;
  mfaStatus: SuperAdminMfaStatus;
  lastVerifiedAt: string | null;
  isActive: boolean;
}

/**
 * ภาพรวมสถานะ MFA ของ Super Admin ทุกคน — สำหรับ /superadmin/mfa-status
 * ไม่มีการอ่าน recovery code/secret/QR หรือรายละเอียด factor เชิงลึกใดๆ เลย
 * (ใช้แค่ status/last_challenged_at ที่ getUserMfaFactors กรองมาให้แล้ว)
 *
 * แยก `not_configured` (ไม่เคยตั้งค่า MFA เลย) จาก `reset_required` (เคยตั้งค่า
 * แล้วถูก Super Admin คนอื่นรีเซ็ตไป ยังไม่ได้ตั้งค่าใหม่) โดยตรวจ audit_logs
 * ว่ามีเหตุการณ์ `mfa_reset` ที่สำเร็จของผู้ใช้คนนี้หรือไม่ — ทั้งสองสถานะแสดง
 * เป็น "ยังเข้า /superadmin ไม่ได้" เหมือนกันในทางปฏิบัติ (ดู middleware บังคับ
 * MFA เดิม) ต่างกันแค่ข้อความอธิบายให้ผู้ดูแลเข้าใจสาเหตุที่แท้จริง
 */
export async function getSuperAdminMfaOverview(): Promise<DataResult<SuperAdminMfaOverviewRow[]>> {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) return { available: false };

  try {
    const usersResult = await getSuperAdminUserList({ role: "super_admin" });
    if (!usersResult.available) return { available: false };

    const supabase = await createClient();
    const userIds = usersResult.data.map((u) => u.id);

    const { data: resetLogs, error: resetLogsError } = await supabase
      .from("audit_logs")
      .select("entity_id, metadata")
      .eq("action", "mfa_reset")
      .eq("entity_type", "profiles")
      .in("entity_id", userIds.length > 0 ? userIds : [""]);
    if (resetLogsError) throw resetLogsError;

    const resetUserIds = new Set(
      (resetLogs ?? [])
        .filter((row) => (row.metadata as { outcome?: string } | null)?.outcome === "success")
        .map((row) => row.entity_id)
        .filter((id): id is string => Boolean(id))
    );

    const rows = await Promise.all(
      usersResult.data.map(async (user): Promise<SuperAdminMfaOverviewRow> => {
        const factorsResult = await getUserMfaFactors(user.id);
        const factors = factorsResult.available ? factorsResult.data : [];
        const verifiedFactors = factors.filter((f) => f.status === "verified");

        const mfaStatus: SuperAdminMfaStatus =
          verifiedFactors.length > 0
            ? "enabled"
            : resetUserIds.has(user.id)
              ? "reset_required"
              : "not_configured";

        const lastVerifiedAt =
          verifiedFactors
            .map((f) => f.lastChallengedAt ?? f.createdAt)
            .sort()
            .at(-1) ?? null;

        return {
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          mfaStatus,
          lastVerifiedAt,
          isActive: user.isActive,
        };
      })
    );

    return { available: true, data: rows };
  } catch (error) {
    console.error("getSuperAdminMfaOverview failed:", error);
    return { available: false };
  }
}
