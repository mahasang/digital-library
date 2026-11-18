import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import {
  EMPTY_WORKSPACE_COUNTS,
  MIN_RANK_FOR_PENDING_REVIEW_COUNT,
  MIN_RANK_FOR_REVISION_COUNT,
  type WorkspaceCounts,
} from "@/lib/auth/workspace-counts";

type ResearchStatusFilter = "pending_review" | "revision_requested";

/** นับแถว research_items ตามสถานะ (head query — ไม่ดึงข้อมูลแถวมาเลย) */
async function countResearchByStatus(
  supabase: SupabaseClient<Database>,
  status: ResearchStatusFilter,
  submittedBy?: string
): Promise<number> {
  let query = supabase
    .from("research_items")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (submittedBy) query = query.eq("submitted_by", submittedBy);

  const { count, error } = await query;
  if (error) {
    console.error(`getWorkspaceCounts(${status}) failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * ตัวเลขงานค้างสำหรับ badge ในเมนูผู้ใช้ (Header)
 *
 * ใช้ Supabase client ของผู้ใช้เอง (cookie session) ไม่ใช่ service role —
 * ผลลัพธ์ถูกจำกัดด้วย RLS research_items_select เสมอ (บรรณารักษ์ขึ้นไปเห็นทั้งหมด
 * เจ้าของเห็นงานของตัวเอง) และตัวเลข "ขอให้แก้ไข" กรอง submitted_by = ผู้ใช้
 * ปัจจุบันด้วยเอง เพื่อไม่ให้บรรณารักษ์นับงานของคนอื่นเป็นงานของตัวเอง
 *
 * ครอบด้วย React cache() เพราะ HeaderAccountArea ถูก render 2 ครั้งต่อ request
 * (desktop + mobile) — อาร์กิวเมนต์เป็น primitive จึง dedupe ได้ภายใน request เดียว
 * ถ้า query ล้มเหลวจะคืน 0 (ไม่ให้ header ทั้งแถบพังเพราะ badge)
 */
export const getWorkspaceCounts = cache(
  async (userId: string, roleRank: number): Promise<WorkspaceCounts> => {
    if (!isSupabaseConfigured() || roleRank < MIN_RANK_FOR_REVISION_COUNT) {
      return EMPTY_WORKSPACE_COUNTS;
    }

    try {
      const supabase = await createClient();
      const [pendingReview, revisionRequested] = await Promise.all([
        roleRank >= MIN_RANK_FOR_PENDING_REVIEW_COUNT
          ? countResearchByStatus(supabase, "pending_review")
          : Promise.resolve(0),
        countResearchByStatus(supabase, "revision_requested", userId),
      ]);
      return { pendingReview, revisionRequested };
    } catch (error) {
      console.error("getWorkspaceCounts failed:", error);
      return EMPTY_WORKSPACE_COUNTS;
    }
  }
);
