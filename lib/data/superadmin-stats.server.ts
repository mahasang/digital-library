import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import type { UserRole, DocumentStatus } from "@/types/research";

/**
 * ชั้นเข้าถึงข้อมูลสำหรับหน้า /superadmin/overview
 *
 * ทุกฟังก์ชันในไฟล์นี้ดัก error ภายในตัวเองและคืนค่า `{ available: false }`
 * แทนการ throw — เพื่อให้แต่ละ widget บนหน้า overview แสดงสถานะ "ไม่พร้อมใช้งาน"
 * ได้อย่างอิสระต่อกัน (ส่วนหนึ่งดึงข้อมูลไม่ได้ ไม่ทำให้ทั้งหน้าพัง) และไม่มี
 * ข้อความ error ดิบของ Postgres/Supabase หลุดไปแสดงในหน้าเว็บ — รายละเอียด
 * จริงถูก log ไว้ฝั่งเซิร์ฟเวอร์ผ่าน console.error เท่านั้น
 */

export type DataResult<T> = { available: true; data: T } | { available: false };

const ALL_ROLES: UserRole[] = ["member", "staff", "librarian", "admin", "super_admin"];
const ALL_STATUSES: DocumentStatus[] = [
  "draft",
  "pending_review",
  "revision_requested",
  "approved",
  "published",
  "rejected",
  "archived",
];

export interface UsersByRole {
  total: number;
  byRole: Record<UserRole, number>;
  unassigned: number;
}

/** จำนวนผู้ใช้ทั้งหมด แยกตามบทบาท (รวมผู้ใช้ที่ยังไม่มีบทบาทใดเลย) */
export async function getUsersByRole(): Promise<DataResult<UsersByRole>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const [profilesRes, userRolesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("user_roles").select("user_id, role_id"),
      supabase.from("roles").select("id, name"),
    ]);

    if (profilesRes.error || userRolesRes.error || rolesRes.error) {
      throw profilesRes.error ?? userRolesRes.error ?? rolesRes.error;
    }

    const roleNameById = new Map((rolesRes.data ?? []).map((r) => [r.id, r.name as UserRole]));
    const byRole = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<UserRole, number>;
    const usersWithRole = new Set<string>();

    for (const ur of userRolesRes.data ?? []) {
      const roleName = roleNameById.get(ur.role_id);
      if (!roleName) continue;
      byRole[roleName] += 1;
      usersWithRole.add(ur.user_id);
    }

    const total = profilesRes.count ?? 0;
    const unassigned = Math.max(0, total - usersWithRole.size);

    return { available: true, data: { total, byRole, unassigned } };
  } catch (error) {
    console.error("getUsersByRole failed:", error);
    return { available: false };
  }
}

/** จำนวนงานวิจัยทั้งหมด แยกตามสถานะ */
export async function getResearchByStatus(): Promise<
  DataResult<{ total: number; byStatus: Record<DocumentStatus, number> }>
> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    // เดิม select("status") ดึงทุกแถวของ research_items มาทั้งตารางเพื่อนับด้วย
    // JS ฝั่งแอป (ยิ่งงานวิจัยเยอะยิ่งโอนข้อมูลเยอะโดยไม่จำเป็น) เปลี่ยนเป็น
    // count(exact, head: true) แยกตามสถานะแทน (เหมือน pattern ที่ใช้อยู่แล้วใน
    // lib/data/admin-stats.server.ts) — head:true ไม่โอนข้อมูลแถวจริงเลย ได้แค่
    // ตัวเลขนับจาก response header เท่านั้น ยิงพร้อมกันทั้งหมดด้วย Promise.all
    // จึงไม่ช้ากว่าเดิมทั้งที่โอนข้อมูลน้อยกว่ามาก — total ยังคงนับทุกแถวไม่ว่า
    // สถานะใด (รวมสถานะที่ไม่อยู่ใน ALL_STATUSES เช่น "merged") เหมือนโค้ดเดิม
    // ทุกประการ ส่วน byStatus นับเฉพาะ 7 สถานะใน ALL_STATUSES เหมือนเดิม
    const [totalRes, ...statusResults] = await Promise.all([
      supabase.from("research_items").select("id", { count: "exact", head: true }),
      ...ALL_STATUSES.map((status) =>
        supabase.from("research_items").select("id", { count: "exact", head: true }).eq("status", status)
      ),
    ]);
    if (totalRes.error) throw totalRes.error;

    const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
      DocumentStatus,
      number
    >;
    for (let i = 0; i < ALL_STATUSES.length; i++) {
      const { count, error } = statusResults[i];
      if (error) throw error;
      byStatus[ALL_STATUSES[i]] = count ?? 0;
    }

    return { available: true, data: { total: totalRes.count ?? 0, byStatus } };
  } catch (error) {
    console.error("getResearchByStatus failed:", error);
    return { available: false };
  }
}

export interface StorageBucketUsage {
  bucketId: string;
  totalBytes: number;
  objectCount: number;
}

/** พื้นที่ Storage ที่ใช้งานจริง แยกตาม bucket (ผลรวมจาก storage.objects.metadata) */
export async function getStorageUsage(): Promise<DataResult<StorageBucketUsage[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("superadmin_storage_usage");
    if (error) throw error;

    return {
      available: true,
      data: (data ?? []).map((row) => ({
        bucketId: row.bucket_id,
        totalBytes: row.total_bytes,
        objectCount: row.object_count,
      })),
    };
  } catch (error) {
    console.error("getStorageUsage failed:", error);
    return { available: false };
  }
}

export interface OrphanedFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export type CleanableBucket = "research-documents" | "research-covers" | "submission-attachments";

/**
 * ไฟล์ที่ไม่มีการอ้างอิงในฐานข้อมูลอีกต่อไป (ไฟล์เก่าที่ถูกแทนที่ตอนแก้ไข
 * หรืออัปโหลดค้างไว้ไม่เคยบันทึกสำเร็จ) — เป็นการประมาณการแบบ best-effort
 */
export async function getOrphanedFiles(
  bucketId: CleanableBucket
): Promise<DataResult<OrphanedFile[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("superadmin_orphaned_storage_objects", {
      p_bucket_id: bucketId,
    });
    if (error) throw error;

    return {
      available: true,
      data: (data ?? []).map((row) => ({
        name: row.name,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    console.error(`getOrphanedFiles failed for bucket ${bucketId}:`, error);
    return { available: false };
  }
}

export interface SystemAlert {
  severity: "warning" | "info";
  message: string;
}

/**
 * การแจ้งเตือน/ปัญหาสำคัญของระบบ — คำนวณจากสัญญาณจริงเท่านั้น (ไม่ใช่ข้อมูลสมมติ)
 * เช่น การตั้งค่าที่ขาดหาย หรือรายการที่ค้างนานผิดปกติ
 */
export async function getSystemAlerts(): Promise<DataResult<SystemAlert[]>> {
  if (!isSupabaseConfigured()) return { available: false };

  const alerts: SystemAlert[] = [];

  if (!isServiceRoleConfigured()) {
    alerts.push({
      severity: "warning",
      message:
        "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY — ฟีเจอร์อ่าน/ดาวน์โหลดไฟล์ PDF และระงับบัญชีผู้ใช้จะใช้งานไม่ได้",
    });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("research_items")
      .select("title_th, created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      const ageDays = Math.floor(
        (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (ageDays >= 7) {
        alerts.push({
          severity: "warning",
          message: `มีงานวิจัยรอตรวจสอบค้างมานาน ${ageDays} วัน ("${data.title_th}") กรุณาตรวจสอบที่หน้าอนุมัติงานวิจัย`,
        });
      }
    }
  } catch (error) {
    console.error("getSystemAlerts (pending review check) failed:", error);
    return { available: false };
  }

  return { available: true, data: alerts };
}

export interface BackupStatus {
  available: false;
  reasonKey: string;
  guidanceKey: string;
}

/**
 * สถานะ Backup ล่าสุด — แอปนี้ไม่มีทางเข้าถึงสถานะ Backup ของ Supabase ได้จริง
 * (Automatic Backups เป็นฟีเจอร์ระดับแผนราคาที่จัดการนอกฐานข้อมูล ไม่มี API
 * ให้ query จากฝั่งแอป) จึงแสดงสถานะ "ไม่พร้อมใช้งาน" อย่างตรงไปตรงมาเสมอ
 * แทนการสร้างข้อมูลปลอม พร้อมชี้ทางไปยังที่ที่ตรวจสอบได้จริง
 *
 * Returns translation keys (not translated text) since this is a plain
 * data function without access to next-intl — the caller translates via
 * getTranslations("superadmin.backups").
 */
export function getBackupStatus(): BackupStatus {
  return {
    available: false,
    reasonKey: "reason",
    guidanceKey: "guidance",
  };
}
