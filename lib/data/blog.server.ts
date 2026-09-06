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
  status: "draft" | "published";
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  status: "draft" | "published";
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BLOG_SELECT = `
  id, slug, title_lo, title_th, title_en, title_vi,
  excerpt_lo, excerpt_th, excerpt_en, excerpt_vi,
  content_lo, content_th, content_en, content_vi,
  cover_image, status, author_id, published_at,
  created_at, updated_at
`;

/** ดึง published posts สำหรับหน้าสาธารณะ */
export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(BLOG_SELECT)
    .eq("status", "published")
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