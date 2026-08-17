import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchPublishedResearchRowsByIds } from "@/lib/data/queries";
import { mapRowToResearchItem } from "@/lib/data/mappers";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import type { ResearchItem } from "@/types/research";

export async function getFavoriteResearch(userId: string): Promise<ResearchItem[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: favorites, error } = await supabase
    .from("favorites")
    .select("research_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(toSafeErrorMessage(error, "ไม่สามารถดึงรายการโปรดได้", "getFavoriteResearch failed"));
  }

  const ids = (favorites ?? []).map((f) => f.research_id);
  const rows = await fetchPublishedResearchRowsByIds(supabase, ids);
  const items = rows.map(mapRowToResearchItem);

  // เรียงตามลำดับที่บันทึกเป็นรายการโปรด (ล่าสุดก่อน)
  const order = new Map(ids.map((id, index) => [id, index]));
  const rowIdBySlug = new Map(rows.map((row) => [row.slug, row.id]));
  return items.sort(
    (a, b) =>
      (order.get(rowIdBySlug.get(a.id) ?? "") ?? 0) -
      (order.get(rowIdBySlug.get(b.id) ?? "") ?? 0)
  );
}

export async function isResearchFavorited(
  userId: string,
  researchSlug: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data: research } = await supabase
    .from("research_items")
    .select("id")
    .eq("slug", researchSlug)
    .maybeSingle();

  if (!research) return false;

  const { data: favorite } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("research_id", research.id)
    .maybeSingle();

  return Boolean(favorite);
}

export async function getReadingHistory(userId: string): Promise<
  { item: ResearchItem; readAt: string }[]
> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: history, error } = await supabase
    .from("reading_history")
    .select("research_id, read_at")
    .eq("user_id", userId)
    .order("read_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(toSafeErrorMessage(error, "ไม่สามารถดึงประวัติการอ่านได้", "getReadingHistory failed"));
  }

  const ids = [...new Set((history ?? []).map((h) => h.research_id))];
  const rows = await fetchPublishedResearchRowsByIds(supabase, ids);
  const itemByRowId = new Map(
    rows.map((row) => [row.id, mapRowToResearchItem(row)])
  );

  return (history ?? [])
    .map((h) => {
      const item = itemByRowId.get(h.research_id);
      return item ? { item, readAt: h.read_at } : null;
    })
    .filter((entry): entry is { item: ResearchItem; readAt: string } => entry !== null);
}
