"use server";

import { getResearchByIdNoTracking } from "@/lib/data/research.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getResearchDownloadUrl } from "@/lib/storage/signed-url.server";
import { hasActiveAccessGrantBySlug } from "@/lib/data/access-grants.server";
import { canDownload } from "@/lib/labels";

export interface DownloadUrlResult {
  url: string | null;
  error: string | null;
}

/**
 * Server Action: ตรวจสอบสิทธิ์ตาม access_level แล้วสร้าง Signed URL สำหรับ
 * ดาวน์โหลดไฟล์ PDF พร้อมบันทึก download_logs — เรียกจาก DownloadButton
 * (Client Component) เมื่อผู้ใช้กดปุ่มดาวน์โหลด
 */
export async function requestDownloadUrlAction(
  slug: string
): Promise<DownloadUrlResult> {
  if (!isSupabaseConfigured()) {
    return { url: null, error: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const item = await getResearchByIdNoTracking(slug);
  if (!item) {
    return { url: null, error: "ไม่พบงานวิจัยนี้" };
  }

  const hasDownloadGrant = canDownload(item.accessLevel)
    ? false
    : await hasActiveAccessGrantBySlug(item.id, "download");
  if (!canDownload(item.accessLevel) && !hasDownloadGrant) {
    return { url: null, error: "งานวิจัยนี้ไม่อนุญาตให้ดาวน์โหลด" };
  }

  const supabase = await createClient();
  const { error: logError } = await supabase.rpc("log_research_download", {
    p_slug: item.id,
  });
  if (logError) {
    console.error("log_research_download failed:", logError.message);
  }

  return getResearchDownloadUrl(
    item.pdfFile,
    item.accessLevel,
    `${item.id}.pdf`,
    hasDownloadGrant,
    item.scanStatus
  );
}

export interface ToggleFavoriteResult {
  favorited: boolean | null;
  error: string | null;
}

/**
 * Server Action: เพิ่ม/ลบงานวิจัยออกจากรายการโปรดของผู้ใช้ปัจจุบัน (ต้องเป็น
 * สมาชิกที่เข้าสู่ระบบแล้ว — RLS จำกัดสิทธิ์นี้ไว้อีกชั้นหนึ่งด้วย)
 */
export async function toggleFavoriteAction(slug: string): Promise<ToggleFavoriteResult> {
  if (!isSupabaseConfigured()) {
    return { favorited: null, error: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { favorited: null, error: "กรุณาเข้าสู่ระบบก่อนบันทึกรายการโปรด" };
  }

  const { data: research, error: researchError } = await supabase
    .from("research_items")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (researchError || !research) {
    return { favorited: null, error: "ไม่พบงานวิจัยนี้" };
  }

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("research_id", research.id)
    .maybeSingle();

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);
    if (deleteError) {
      console.error("toggleFavoriteAction delete failed:", deleteError.message);
      return { favorited: null, error: "ไม่สามารถลบรายการโปรดได้ กรุณาลองใหม่อีกครั้ง" };
    }
    return { favorited: false, error: null };
  }

  const { error: insertError } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, research_id: research.id });

  if (insertError) {
    console.error("toggleFavoriteAction insert failed:", insertError.message);
    return { favorited: null, error: "ไม่สามารถบันทึกรายการโปรดได้ กรุณาลองใหม่อีกครั้ง" };
  }

  return { favorited: true, error: null };
}
