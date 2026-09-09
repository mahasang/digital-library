"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addBlogCommentAction(
  blogPostId: string,
  content: string,
  locale: string
) {
  if (!content.trim()) return { error: "กรุณากรอกข้อความ" };
  if (content.trim().length > 1000) return { error: "ความคิดเห็นยาวเกินไป (สูงสุด 1000 ตัวอักษร)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase.from("comments").insert({
    blog_post_id: blogPostId,
    user_id: user.id,
    content: content.trim(),
  });

  if (error) return { error: "ไม่สามารถเพิ่มความคิดเห็นได้" };

  revalidatePath(`/${locale}/blog`);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function deleteBlogCommentAction(
  commentId: string,
  locale: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) return { error: "ไม่สามารถลบความคิดเห็นได้" };

  revalidatePath(`/${locale}/blog`);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateBlogCommentAction(
  commentId: string,
  content: string,
  locale: string
) {
  if (!content.trim()) return { error: "กรุณากรอกข้อความ" };
  if (content.trim().length > 1000) return { error: "ความคิดเห็นยาวเกินไป (สูงสุด 1000 ตัวอักษร)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("comments")
    .update({ content: content.trim() })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: "ไม่สามารถแก้ไขความคิดเห็นได้" };

  revalidatePath(`/${locale}/blog`);
  revalidatePath("/", "layout");
  return { error: null };
}

export interface ToggleBlogFavoriteResult {
  favorited: boolean | null;
  error: string | null;
}

export async function toggleBlogFavoriteAction(
  blogPostId: string,
  locale: string
): Promise<ToggleBlogFavoriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { favorited: null, error: "กรุณาเข้าสู่ระบบก่อนบันทึกรายการโปรด" };
  }

  // ตรวจว่า favorited อยู่แล้วหรือไม่
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("blog_post_id", blogPostId)
    .maybeSingle();

  if (existing) {
    // ลบออก
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return { favorited: null, error: "ไม่สามารถลบรายการโปรดได้" };
    }
    revalidatePath(`/${locale}/blog`);
    revalidatePath("/", "layout");
    return { favorited: false, error: null };
  }

  // เพิ่ม
  const { error: insertError } = await supabase.from("favorites").insert({
    user_id: user.id,
    blog_post_id: blogPostId,
  });

  if (insertError) {
    return { favorited: null, error: "ไม่สามารถบันทึกรายการโปรดได้" };
  }

  revalidatePath(`/${locale}/blog`);
  revalidatePath("/", "layout");
  return { favorited: true, error: null };
}
