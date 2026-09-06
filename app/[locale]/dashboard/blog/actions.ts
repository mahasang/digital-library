"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getSessionUser } from "@/lib/supabase/session";

export type BlogFormState =
  | { status: "idle" }
  | { status: "success"; id: string }
  | { status: "error"; message: string };

export async function upsertBlogPostAction(
  id: string | null,
  _prev: BlogFormState,
  formData: FormData
): Promise<BlogFormState> {
  const rank = await getCurrentUserRoleRank();
  if (rank < 40) return { status: "error", message: "ບໍ່ມີສິດໃຊ້ງານ" };

  const user = await getSessionUser();
  if (!user) return { status: "error", message: "ກະລຸນາເຂົ້າສູ່ລະບົບ" };

  const slug        = (formData.get("slug")        as string).trim().toLowerCase();
  const titleLo     = (formData.get("title_lo")    as string).trim();
  const titleTh     = (formData.get("title_th")    as string).trim();
  const titleEn     = (formData.get("title_en")    as string).trim();
  const titleVi     = (formData.get("title_vi")    as string).trim();
  const excerptLo   = (formData.get("excerpt_lo")  as string).trim();
  const excerptTh   = (formData.get("excerpt_th")  as string).trim();
  const excerptEn   = (formData.get("excerpt_en")  as string).trim();
  const excerptVi   = (formData.get("excerpt_vi")  as string).trim();
  const contentLo   = (formData.get("content_lo")  as string).trim();
  const contentTh   = (formData.get("content_th")  as string).trim();
  const contentEn   = (formData.get("content_en")  as string).trim();
  const contentVi   = (formData.get("content_vi")  as string).trim();
  const coverImage  = (formData.get("cover_image") as string).trim() || null;
  const publish     = formData.get("publish") === "true";

  if (!slug) return { status: "error", message: "ກະລຸນາໃສ່ Slug" };
  if (!titleLo && !titleTh && !titleEn)
    return { status: "error", message: "ກະລຸນາໃສ່ຫົວຂໍ້ຢ່າງໜ້ອຍ 1 ພາສາ" };

  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug))
    return { status: "error", message: "Slug ໃຊ້ໄດ້ສະເພາະ a-z, 0-9, -" };

  const supabase = await createClient();

  // ตรวจ slug ซ้ำ
  const { data: existing } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing && existing.id !== id)
    return { status: "error", message: "Slug ນີ້ຖືກໃຊ້ງານແລ້ວ" };

  const payload = {
    slug,
    title_lo: titleLo,
    title_th: titleTh,
    title_en: titleEn,
    title_vi: titleVi,
    excerpt_lo: excerptLo,
    excerpt_th: excerptTh,
    excerpt_en: excerptEn,
    excerpt_vi: excerptVi,
    content_lo: contentLo,
    content_th: contentTh,
    content_en: contentEn,
    content_vi: contentVi,
    cover_image: coverImage,
    status: publish ? "published" as const : "draft" as const,
    author_id: user.id,
    ...(publish ? { published_at: new Date().toISOString() } : {}),
  };

  let resultId: string;

  if (id) {
    const { error } = await supabase
      .from("blog_posts")
      .update(payload)
      .eq("id", id);
    if (error) return { status: "error", message: error.message };
    resultId = id;
  } else {
    const { data, error } = await supabase
      .from("blog_posts")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { status: "error", message: error.message };
    resultId = data.id;
  }

  revalidatePath("/dashboard/blog");
  revalidatePath("/blog");
  return { status: "success", id: resultId };
}

export async function deleteBlogPostAction(id: string): Promise<{ error?: string }> {
  const rank = await getCurrentUserRoleRank();
  if (rank < 40) return { error: "ບໍ່ມີສິດໃຊ້ງານ" };

  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/blog");
  revalidatePath("/blog");
  return {};
}