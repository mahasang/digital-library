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

/** แปลง slug (ค่าที่ ResearchItem.id ใช้จริงทั้งแอป — ดู mapRowToResearchItem
 * ใน lib/data/mappers.ts: `id: row.slug`) เป็น uuid จริงของแถวใน research_items
 * — ต้องทำก่อนใช้เป็น research_id ของ ratings/comments เสมอ เพราะ column นั้น
 * เป็น uuid FK จริง ไม่ใช่ text (เหมือน pattern เดียวกับ isResearchFavorited/
 * toggleFavoriteAction ในไฟล์นี้/lib/data/favorites.server.ts) */
async function resolveResearchDbId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string
): Promise<string | null> {
  const { data } = await supabase
    .from("research_items")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

export interface RatingStats {
  avgScore: number;
  ratingCount: number;
}

/** สถิติคะแนนของงานวิจัย — สาธารณะ (guest เห็นได้เหมือนเนื้อหาอื่นของ research_items) */
export async function getRatingStatsAction(researchSlug: string): Promise<RatingStats> {
  if (!isSupabaseConfigured()) {
    return { avgScore: 0, ratingCount: 0 };
  }

  const supabase = await createClient();
  const researchId = await resolveResearchDbId(supabase, researchSlug);
  if (!researchId) return { avgScore: 0, ratingCount: 0 };

  const { data, error } = await supabase
    .rpc("get_rating_stats", { p_research_id: researchId })
    .single();

  if (error || !data) {
    if (error) console.error("getRatingStatsAction failed:", error.message);
    return { avgScore: 0, ratingCount: 0 };
  }

  return { avgScore: data.avg_score ?? 0, ratingCount: data.rating_count ?? 0 };
}

/** คะแนนที่ผู้ใช้ปัจจุบันเคยให้ไว้ — null เมื่อยังไม่ login หรือยังไม่เคยให้คะแนน */
export async function getMyRatingAction(researchSlug: string): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const researchId = await resolveResearchDbId(supabase, researchSlug);
  if (!researchId) return null;

  const { data } = await supabase
    .from("ratings")
    .select("score")
    .eq("research_id", researchId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.score ?? null;
}

export interface RateResult {
  error: string | null;
}

/** ให้/แก้ไขคะแนน — upsert เพราะ 1 คนให้คะแนนได้ 1 ครั้งต่อชิ้น (unique
 * (research_id, user_id) ใน ratings ตาม migration 20260901090000) */
export async function upsertRatingAction(
  researchSlug: string,
  score: number
): Promise<RateResult> {
  if (!isSupabaseConfigured()) {
    return { error: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { error: "คะแนนไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนให้คะแนน" };
  }

  const researchId = await resolveResearchDbId(supabase, researchSlug);
  if (!researchId) {
    return { error: "ไม่พบงานวิจัยนี้" };
  }

  const { error } = await supabase
    .from("ratings")
    .upsert(
      { user_id: user.id, research_id: researchId, score },
      { onConflict: "research_id,user_id" }
    );

  if (error) {
    console.error("upsertRatingAction failed:", error.message);
    return { error: "ไม่สามารถบันทึกคะแนนได้ กรุณาลองใหม่อีกครั้ง" };
  }

  return { error: null };
}

export interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
}

/** รายการความคิดเห็นล่าสุด (สูงสุด 20 รายการ) — สาธารณะเหมือนเนื้อหาอื่นของ
 * research_items — ใช้ RPC get_comments (security definer) เพราะต้อง join
 * profiles ของคนอื่นซึ่ง RLS ปกติไม่ยอมให้เห็น (ดู migration 20260901090000) */
export async function getCommentsAction(researchSlug: string): Promise<CommentRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const researchId = await resolveResearchDbId(supabase, researchSlug);
  if (!researchId) return [];

  const { data, error } = await supabase.rpc("get_comments", {
    p_research_id: researchId,
    p_limit: 20,
  });

  if (error || !data) {
    if (error) console.error("getCommentsAction failed:", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    userId: row.user_id,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
  }));
}

export interface AddCommentResult {
  error: string | null;
}

export async function addCommentAction(
  researchSlug: string,
  content: string
): Promise<AddCommentResult> {
  if (!isSupabaseConfigured()) {
    return { error: "ระบบยังไม่ได้เชื่อมต่อ Supabase" };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { error: "กรุณากรอกข้อความ" };
  }
  if (trimmed.length > 500) {
    return { error: "ข้อความยาวเกินไป (สูงสุด 500 ตัวอักษร)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น" };
  }

  const researchId = await resolveResearchDbId(supabase, researchSlug);
  if (!researchId) {
    return { error: "ไม่พบงานวิจัยนี้" };
  }

  const { error } = await supabase.from("comments").insert({
    user_id: user.id,
    research_id: researchId,
    content: trimmed,
  });

  if (error) {
    console.error("addCommentAction failed:", error.message);
    return { error: "ไม่สามารถบันทึกความคิดเห็นได้ กรุณาลองใหม่อีกครั้ง" };
  }

  return { error: null };
}
