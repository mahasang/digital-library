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

  const ids = (favorites ?? [])
  .map((f) => f.research_id)
  .filter((id): id is string => id !== null);
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

export interface ReadingHistoryBlogPost {
  id: string;
  slug: string;
  titleLo: string;
  titleTh: string;
  titleEn: string;
  titleVi: string;
  excerptLo: string;
  excerptTh: string;
  excerptEn: string;
  excerptVi: string;
  coverImage: string | null;
  publishedAt: string | null;
}

export type ReadingHistoryItem =
  | { type: "research"; item: ResearchItem; readAt: string }
  | { type: "blog"; item: ReadingHistoryBlogPost; readAt: string };

const READING_HISTORY_LIMIT = 50;

/** ประวัติการอ่านแบบรวม research + blog เรียงตาม read_at ล่าสุดก่อน — ดึง
 * แยก 2 query ตามประเภท (reading_history.research_id / .blog_post_id เป็น
 * XOR กันเสมอตาม constraint) แล้ว merge + sort + ตัดเหลือ 50 รายการล่าสุดรวมกัน */
export async function getReadingHistory(userId: string): Promise<ReadingHistoryItem[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const { data: researchHistory, error: researchError } = await supabase
    .from("reading_history")
    .select("research_id, read_at")
    .eq("user_id", userId)
    .not("research_id", "is", null)
    .order("read_at", { ascending: false })
    .limit(READING_HISTORY_LIMIT);

  if (researchError) {
    throw new Error(
      toSafeErrorMessage(researchError, "ไม่สามารถดึงประวัติการอ่านได้", "getReadingHistory research query failed")
    );
  }

  const { data: blogHistory, error: blogError } = await supabase
    .from("reading_history")
    .select("blog_post_id, read_at")
    .eq("user_id", userId)
    .not("blog_post_id", "is", null)
    .order("read_at", { ascending: false })
    .limit(READING_HISTORY_LIMIT);

  if (blogError) {
    throw new Error(
      toSafeErrorMessage(blogError, "ไม่สามารถดึงประวัติการอ่านได้", "getReadingHistory blog query failed")
    );
  }

  const researchIds = [
    ...new Set(
      (researchHistory ?? []).map((h) => h.research_id).filter((id): id is string => id !== null)
    ),
  ];
  const researchRows = await fetchPublishedResearchRowsByIds(supabase, researchIds);
  const researchItemByRowId = new Map(researchRows.map((row) => [row.id, mapRowToResearchItem(row)]));

  const blogPostIds = [
    ...new Set(
      (blogHistory ?? []).map((h) => h.blog_post_id).filter((id): id is string => id !== null)
    ),
  ];
  let blogPostById = new Map<string, ReadingHistoryBlogPost>();
  if (blogPostIds.length > 0) {
    const { data: blogPosts } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, title_lo, title_th, title_en, title_vi, excerpt_lo, excerpt_th, excerpt_en, excerpt_vi, cover_image, published_at"
      )
      .in("id", blogPostIds)
      .eq("status", "published");
    blogPostById = new Map(
      (blogPosts ?? []).map((p) => [
        p.id,
        {
          id: p.id,
          slug: p.slug,
          titleLo: p.title_lo,
          titleTh: p.title_th,
          titleEn: p.title_en,
          titleVi: p.title_vi,
          excerptLo: p.excerpt_lo,
          excerptTh: p.excerpt_th,
          excerptEn: p.excerpt_en,
          excerptVi: p.excerpt_vi,
          coverImage: p.cover_image,
          publishedAt: p.published_at,
        },
      ])
    );
  }

  const researchEntries: ReadingHistoryItem[] = (researchHistory ?? [])
    .map((h): ReadingHistoryItem | null => {
      const item = h.research_id ? researchItemByRowId.get(h.research_id) : undefined;
      return item ? { type: "research", item, readAt: h.read_at } : null;
    })
    .filter((entry): entry is ReadingHistoryItem => entry !== null);

  const blogEntries: ReadingHistoryItem[] = (blogHistory ?? [])
    .map((h): ReadingHistoryItem | null => {
      const item = h.blog_post_id ? blogPostById.get(h.blog_post_id) : undefined;
      return item ? { type: "blog", item, readAt: h.read_at } : null;
    })
    .filter((entry): entry is ReadingHistoryItem => entry !== null);

  return [...researchEntries, ...blogEntries]
    .sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime())
    .slice(0, READING_HISTORY_LIMIT);
}

export async function isBlogFavorited(
  userId: string,
  blogPostId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data: favorite } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("blog_post_id", blogPostId)
    .maybeSingle();

  return Boolean(favorite);
}

export interface FavoriteBlogPost {
  id: string;
  slug: string;
  titleLo: string;
  titleTh: string;
  titleEn: string;
  titleVi: string;
  coverImage: string | null;
  publishedAt: string | null;
  favoritedAt: string;
}

export async function getFavoriteBlogPosts(
  userId: string
): Promise<FavoriteBlogPost[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: favs, error } = await supabase
    .from("favorites")
    .select("blog_post_id, created_at")
    .eq("user_id", userId)
    .not("blog_post_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[favorites] getFavoriteBlogPosts error:", error.message);
    return [];
  }

  const blogPostIds = (favs ?? [])
    .map((f) => f.blog_post_id)
    .filter((id): id is string => id !== null);

  if (blogPostIds.length === 0) return [];

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, slug, title_lo, title_th, title_en, title_vi, cover_image, published_at")
    .in("id", blogPostIds);

  const favOrder = new Map(
    (favs ?? []).map((f) => [f.blog_post_id, f.created_at])
  );

  return (posts ?? [])
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      titleLo: p.title_lo,
      titleTh: p.title_th,
      titleEn: p.title_en,
      titleVi: p.title_vi,
      coverImage: p.cover_image,
      publishedAt: p.published_at,
      favoritedAt: favOrder.get(p.id) ?? "",
    }))
    .sort(
      (a, b) =>
        new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime()
    );
}
