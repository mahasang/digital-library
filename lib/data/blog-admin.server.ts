import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

/** ดึง profiles ของ staff+ (rank >= 20) สำหรับ author dropdown ใน blog-admin */
export async function getStaffProfiles(): Promise<StaffProfile[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id, full_name, email, avatar_url,
      user_roles!inner (
        roles!inner ( rank )
      )
    `)
    .gte("user_roles.roles.rank", 20)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[blog-admin] getStaffProfiles error:", error.message);
    return [];
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name || p.email || "ไม่ระบุชื่อ",
    email: p.email || "",
    avatarUrl: p.avatar_url,
  }));
}

/** ดึง authors ของ blog post ตาม id */
export async function getBlogPostAuthors(blogPostId: string): Promise<StaffProfile[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_post_authors")
    .select("display_order, profiles ( id, full_name, email, avatar_url )")
    .eq("blog_post_id", blogPostId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[blog-admin] getBlogPostAuthors error:", error.message);
    return [];
  }

  return (data ?? [])
    .filter((a) => a.profiles)
    .map((a) => ({
      id: a.profiles!.id,
      fullName: a.profiles!.full_name || "",
      email: a.profiles!.email || "",
      avatarUrl: a.profiles!.avatar_url,
    }));
}
