import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface BlogPostStats {
  id: string;
  slug: string;
  titleLo: string;
  status: string;
  publishedAt: string | null;
  likeCount: number;
  commentCount: number;
}

export interface BlogAnalytics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  posts: BlogPostStats[];
}

export async function getBlogAnalytics(): Promise<BlogAnalytics> {
  if (!isSupabaseConfigured()) {
    return { totalPosts: 0, totalLikes: 0, totalComments: 0, posts: [] };
  }

  const supabase = await createClient();

  // ดึง published blog posts
  const { data: posts, error: postsError } = await supabase
    .from("blog_posts")
    .select("id, slug, title_lo, status, published_at")
    .in("status", ["published", "scheduled", "draft"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (postsError) {
    console.error("[blog-analytics] posts error:", postsError.message);
    return { totalPosts: 0, totalLikes: 0, totalComments: 0, posts: [] };
  }

  const postList = posts ?? [];
  if (postList.length === 0) {
    return { totalPosts: 0, totalLikes: 0, totalComments: 0, posts: [] };
  }

  const postIds = postList.map((p) => p.id);

  // นับ likes (favorites) แต่ละ post
  const { data: likesData } = await supabase
    .from("favorites")
    .select("blog_post_id")
    .in("blog_post_id", postIds)
    .not("blog_post_id", "is", null);

  // นับ comments แต่ละ post
  const { data: commentsData } = await supabase
    .from("comments")
    .select("blog_post_id")
    .in("blog_post_id", postIds)
    .not("blog_post_id", "is", null);

  // สร้าง map count
  const likesMap = new Map<string, number>();
  const commentsMap = new Map<string, number>();

  for (const row of likesData ?? []) {
    if (!row.blog_post_id) continue;
    likesMap.set(row.blog_post_id, (likesMap.get(row.blog_post_id) ?? 0) + 1);
  }

  for (const row of commentsData ?? []) {
    if (!row.blog_post_id) continue;
    commentsMap.set(row.blog_post_id, (commentsMap.get(row.blog_post_id) ?? 0) + 1);
  }

  const result: BlogPostStats[] = postList.map((p) => ({
    id: p.id,
    slug: p.slug,
    titleLo: p.title_lo,
    status: p.status,
    publishedAt: p.published_at,
    likeCount: likesMap.get(p.id) ?? 0,
    commentCount: commentsMap.get(p.id) ?? 0,
  }));

  const totalLikes = result.reduce((sum, p) => sum + p.likeCount, 0);
  const totalComments = result.reduce((sum, p) => sum + p.commentCount, 0);

  return {
    totalPosts: result.length,
    totalLikes,
    totalComments,
    posts: result,
  };
}
