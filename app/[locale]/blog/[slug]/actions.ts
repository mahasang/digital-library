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
