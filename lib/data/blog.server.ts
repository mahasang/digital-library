import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface BlogPost {
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
  contentLo: string;
  contentTh: string;
  contentEn: string;
  contentVi: string;
  coverImage: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  authorId: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
}

function mapRow(row: {
  id: string;
  slug: string;
  title_lo: string;
  title_th: string;
  title_en: string;
  title_vi: string;
  excerpt_lo: string;
  excerpt_th: string;
  excerpt_en: string;
  excerpt_vi: string;
  content_lo: string;
  content_th: string;
  content_en: string;
  content_vi: string;
  cover_image: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  author_id: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
}): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    titleLo: row.title_lo,
    titleTh: row.title_th,
    titleEn: row.title_en,
    titleVi: row.title_vi,
    excerptLo: row.excerpt_lo,
    excerptTh: row.excerpt_th,
    excerptEn: row.excerpt_en,
    excerptVi: row.excerpt_vi,
    contentLo: row.content_lo,
    contentTh: row.content_th,
    contentEn: row.content_en,
    contentVi: row.content_vi,
    coverImage: row.cover_image,
    status: row.status,
    authorId: row.author_id,
    publishedAt: row.published_at,
    scheduledAt: row.scheduled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    ogImage: row.og_image ?? null,
  };
}

const BLOG_SELECT = `
  id, slug, title_lo, title_th, title_en, title_vi,
  excerpt_lo, excerpt_th, excerpt_en, excerpt_vi,
  content_lo, content_th, content_en, content_vi,
  cover_image, status, author_id, published_at, scheduled_at,
  created_at, updated_at, tags,
  seo_title, seo_description, og_image
`;

/** ดึง published posts สำหรับหน้าสาธารณะ */
export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[blog] getPublishedBlogPosts error:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/** ดึง post เดียวตาม slug (published เท่านั้น) */
export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("[blog] getPublishedBlogPostBySlug error:", error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

/** ดึง posts ทั้งหมด (draft + published) สำหรับ dashboard */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[blog] getAllBlogPosts error:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/** ดึง post เดียวตาม id สำหรับ dashboard edit */
export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[blog] getBlogPostById error:", error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

const PAGE_SIZE = 9;

/** ดึง published posts พร้อม filter + search + pagination */
export async function getPublishedBlogPostsPaginated({
  page = 1,
  tag,
  search,
}: {
  page?: number;
  tag?: string;
  search?: string;
}): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
  if (!isSupabaseConfigured()) return { posts: [], total: 0, totalPages: 0 };
  const supabase = createPublicClient();

  let query = supabase
    .from("blog_posts")
    .select(BLOG_SELECT, { count: "exact" })
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (tag) query = query.contains("tags", [tag]);
  if (search) query = query.or(
    `title_lo.ilike.%${search}%,title_th.ilike.%${search}%,title_en.ilike.%${search}%`
  );

  const { data, error, count } = await query;
  if (error) {
    console.error("[blog] getPublishedBlogPostsPaginated error:", error.message);
    return { posts: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  return {
    posts: (data ?? []).map(mapRow),
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

/** ดึง related posts ตาม tags */
export async function getRelatedBlogPosts(slug: string, tags: string[], limit = 3): Promise<BlogPost[]> {
  if (!isSupabaseConfigured() || !tags.length) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .neq("slug", slug)
    .overlaps("tags", tags)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[blog] getRelatedBlogPosts error:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/** ดึง tags ทั้งหมดที่มีใน published posts */
export async function getAllBlogTags(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("tags")
    .eq("status", "published");
  if (error) return [];
  const allTags = (data ?? []).flatMap((p) => p.tags ?? []);
  return [...new Set(allTags)].sort();
}