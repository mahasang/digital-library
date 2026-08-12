import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRole } from "@/types/research";

/** ต้องตรงกับค่า rank ที่ seed ไว้ใน supabase/migrations (member=10 ... super_admin=50) */
export const RANK_TO_ROLE: Record<number, UserRole> = {
  10: "member",
  20: "staff",
  30: "librarian",
  40: "admin",
  50: "super_admin",
};

/** rank ขั้นต่ำของบทบาท super_admin — ใช้เป็นเกณฑ์การ์ดสำหรับ /superadmin */
export const SUPER_ADMIN_RANK = 50;

/**
 * Hallmark — audit ลดการเรียกซ้ำของการยืนยันตัวตน/สิทธิ์ผ่าน Supabase
 * ห่อด้วย React cache() (memoize เฉพาะภายใน request/การ render เดียวกันเท่านั้น
 * — ไม่ใช่ unstable_cache ข้าม request/ผู้ใช้แบบข้อมูลสาธารณะ) ฟังก์ชันนี้ถูก
 * เรียกจากทั้ง getSessionUser() (lib/supabase/session.ts) และโดยตรงจากเกือบทุก
 * หน้า/Server Action ใน /dashboard และ /superadmin (เดิมแต่ละจุดยิง
 * rpc("user_max_role_rank") เองซ้ำ แม้จะอยู่ใน request/การ render เดียวกันกับที่
 * เพิ่งตรวจไปแล้วใน layout ที่ครอบอยู่) cache() ทำให้ทุกจุดที่เรียกภายใน request
 * เดียวกันได้ค่าจาก network round-trip ครั้งเดียว โดยพฤติกรรม/ผลลัพธ์เหมือนเดิม
 * ทุกประการ (ยังคง query จริงจาก Supabase เสมอ อย่างน้อยครั้งแรกของทุก request
 * ไม่มีการข้ามการตรวจสอบ หรือ cache ข้าม request/ผู้ใช้แต่อย่างใด) — ดู
 * docs/auth-verification-audit.md สำหรับรายละเอียดการวัดผลก่อน/หลัง
 */
export const getCurrentUserRoleRank = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("user_max_role_rank", {});
  if (error || data == null) return 0;
  return data;
});

export async function getCurrentUserRole(): Promise<UserRole> {
  const rank = await getCurrentUserRoleRank();
  return RANK_TO_ROLE[rank] ?? "guest";
}
