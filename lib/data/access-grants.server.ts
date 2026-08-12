import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AccessRequestType } from "@/types/research";

/**
 * ตรวจสอบว่าผู้ใช้ปัจจุบันมีสิทธิ์ที่ได้รับอนุมัติ (document_access_grants) ที่
 * ยัง active อยู่สำหรับเอกสาร+ประเภทสิทธิ์ที่ระบุหรือไม่ — เป็น "ชั้นเสริม" ที่
 * ทำงานคู่ขนานกับ canReadOnline/canDownload(access_level) เดิมเสมอ (OR กัน)
 * ไม่เคยแทนที่การตรวจสอบเดิม ใช้ client ของผู้ใช้เอง (RLS จำกัดให้เห็นเฉพาะ
 * grant ของตัวเอง) ไม่ต้องใช้ Service Role
 *
 * รับ "slug" (ไม่ใช่ uuid จริง) เพราะหน้าเว็บสาธารณะ/หน้าอ่าน PDF มีแต่
 * ResearchItem.id ซึ่งเป็น slug เสมอ (ดู mapRowToResearchItem) join ผ่าน
 * research_items!inner(slug) เพื่อแปลง slug -> uuid จริงในคิวรีเดียว — เหมือน
 * รูปแบบ getExtractionStatusBySlug จากช่วงที่ 17
 */
export async function hasActiveAccessGrantBySlug(
  researchSlug: string,
  accessType: AccessRequestType
): Promise<boolean> {
  if (!isSupabaseConfigured() || !researchSlug) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_access_grants")
    .select("id, research_items!inner(slug)")
    .eq("research_items.slug", researchSlug)
    .eq("user_id", user.id)
    .eq("access_type", accessType)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("hasActiveAccessGrantBySlug failed:", error.message);
    return false;
  }
  return Boolean(data);
}

/**
 * ตรวจสอบสิทธิ์ทั้งสองประเภท (อ่าน/ดาวน์โหลด) พร้อมกันในคำขอเดียว — ใช้ในหน้า
 * รายละเอียดงานวิจัยที่ต้องรู้ทั้งสองค่าพร้อมกันเพื่อตัดสินใจแสดงปุ่ม
 */
export async function getMyActiveGrantsBySlug(
  researchSlug: string
): Promise<{ read: boolean; download: boolean }> {
  if (!isSupabaseConfigured() || !researchSlug) {
    return { read: false, download: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { read: false, download: false };

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_access_grants")
    .select("access_type, research_items!inner(slug)")
    .eq("research_items.slug", researchSlug)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (error) {
    console.error("getMyActiveGrantsBySlug failed:", error.message);
    return { read: false, download: false };
  }

  const types = new Set((data ?? []).map((row) => row.access_type));
  return { read: types.has("read"), download: types.has("download") };
}
