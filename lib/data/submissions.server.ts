import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchManagementResearchRowById,
  fetchOwnSubmissionRows,
  fetchResearchRowsByStatus,
} from "@/lib/data/queries";
import { mapRowToApprovalLogEntry, mapRowToSubmissionItem } from "@/lib/data/mappers";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ApprovalLogEntry, DocumentStatus, SubmissionItem } from "@/types/research";

/**
 * ชั้นเข้าถึงข้อมูลสำหรับหน้าจัดการภายใน (ส่งงานวิจัย/อนุมัติ)
 * ฟีเจอร์เหล่านี้ต้องใช้ Supabase จริงเสมอ (ไม่มี Mock Data fallback
 * เนื่องจากเป็น workflow เขียนข้อมูล/ตรวจสอบสิทธิ์ที่ข้อมูลตัวอย่างไม่รองรับ)
 * — หน้าเว็บจะแสดง SupabaseNotConfiguredNotice แทนเมื่อยังไม่ได้ตั้งค่า
 */

export async function getSubmissionById(id: string): Promise<SubmissionItem | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  const supabase = await createClient();
  const row = await fetchManagementResearchRowById(supabase, id);
  return row ? mapRowToSubmissionItem(row) : undefined;
}

export async function getOwnSubmissions(userId: string): Promise<SubmissionItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const rows = await fetchOwnSubmissionRows(supabase, userId);
  return rows.map(mapRowToSubmissionItem);
}

export async function getSubmissionsByStatus(
  statuses: DocumentStatus[]
): Promise<SubmissionItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const rows = await fetchResearchRowsByStatus(supabase, statuses);
  return rows.map(mapRowToSubmissionItem);
}

export async function getApprovalLogs(researchId: string): Promise<ApprovalLogEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_logs")
    .select("id, from_status, to_status, note, created_at")
    .eq("research_id", researchId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(toSafeErrorMessage(error, "ไม่สามารถดึงประวัติการอนุมัติได้", "getApprovalLogs failed"));
  }

  return (data ?? []).map(mapRowToApprovalLogEntry);
}
