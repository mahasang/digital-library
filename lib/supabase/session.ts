import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserRoleRank, RANK_TO_ROLE } from "@/lib/supabase/roles";
import type { UserRole } from "@/types/research";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  /** มี MFA factor ที่ verified แล้วอย่างน้อยหนึ่งตัวหรือไม่ (ไม่ได้แปลว่าเซสชันนี้ยืนยันขั้นที่สองแล้ว — ดู aal ใน middleware สำหรับการบังคับจริง) */
  hasVerifiedMfa: boolean;
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบันฝั่งเซิร์ฟเวอร์ (สำหรับ layout/Header และหน้าที่ต้อง
 * ตรวจสอบสิทธิ์) ใช้ supabase.auth.getUser() ซึ่งยืนยันตัวตนกับ Supabase Auth
 * server จริง (ปลอดภัยกว่าการอ่าน session จาก cookie ตรงๆ)
 *
 * Hallmark — audit ลดการเรียกซ้ำของการยืนยันตัวตน/สิทธิ์ผ่าน Supabase ห่อด้วย
 * React cache() (memoize เฉพาะภายใน request/การ render เดียวกัน ไม่ใช่ข้าม
 * request/ผู้ใช้) — วัดผลจริงพบว่าหน้าที่ล็อกอินแล้วหนึ่งครั้ง (เช่น /dashboard)
 * เดิมเรียกฟังก์ชันนี้ 3-4 ครั้งใน request เดียว (Header desktop/mobile,
 * IdleLogoutGate, และ layout ที่ครอบหน้านั้นๆ) แต่ละครั้งยิง
 * supabase.auth.getUser() จริงไปที่ Supabase Auth server ทุกครั้ง — cache()
 * ทำให้เหลือ network round-trip จริงครั้งเดียวต่อ request โดยยังคงยืนยันตัวตน
 * จริงกับ Supabase เสมอ (อย่างน้อยหนึ่งครั้งทุก request ไม่มีการข้าม หรือนำ
 * ผลจาก request ก่อนหน้า/ผู้ใช้อื่นมาใช้แต่อย่างใด) ปลอดภัยเหมือนของเดิมทุก
 * ประการ เรียก getCurrentUserRoleRank() (cache() เช่นกัน) แทนการยิง
 * rpc("user_max_role_rank") เองซ้ำอีกชุด — ยุบการคำนวณ rank ที่ซ้ำกันระหว่าง
 * สองฟังก์ชันนี้ลงเหลือ query เดียวต่อ request ด้วย ดู
 * docs/auth-verification-audit.md สำหรับตัวเลขวัดผลก่อน/หลังแบบเต็ม
 *
 * middleware.ts (ทำงานคนละช่วงจากการ render RSC โดยสิ้นเชิง — ก่อนหน้าเสมอ ไม่มี
 * request-scoped cache ร่วมกับ React cache() ของ RSC เลย) ยังคงเรียก
 * supabase.auth.getUser() ของตัวเองแยกต่างหากเหมือนเดิมทุกประการ — ไม่ยุบรวม
 * กับที่นี่ เพราะวิธีเดียวที่จะทำได้คือส่งต่อผลยืนยันตัวตนจาก middleware ผ่าน
 * request header แล้วให้ RSC เชื่อ header นั้นแทนการตรวจสอบเอง ซึ่งเป็นรูปแบบที่
 * งานนี้ห้ามไว้ชัดเจน (ห้ามเชื่อ header ที่มาจาก middleware แทนการตรวจสอบฝั่ง
 * เซิร์ฟเวอร์จริง)
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, rank] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    getCurrentUserRoleRank(),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: RANK_TO_ROLE[rank ?? 0] ?? "guest",
    hasVerifiedMfa: Boolean(user.factors?.some((f) => f.status === "verified")),
  };
});
