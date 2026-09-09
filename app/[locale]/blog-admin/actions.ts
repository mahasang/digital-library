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
  if (rank < 30) return { status: "error", message: "ບໍ່ມີສິດໃຊ້ງານ" };

  const user = await getSessionUser();
  if (!user) return { status: "error", message: "ກະລຸນາເຂົ້າສູ່ລະບົບ" };

  const slug       = (formData.get("slug")        as string).trim().toLowerCase();
  const titleLo    = (formData.get("title_lo")    as string).trim();
  const titleTh    = (formData.get("title_th")    as string).trim();
  const titleEn    = (formData.get("title_en")    as string).trim();
  const titleVi    = (formData.get("title_vi")    as string).trim();
  const excerptLo  = (formData.get("excerpt_lo")  as string).trim();
  const excerptTh  = (formData.get("excerpt_th")  as string).trim();
  const excerptEn  = (formData.get("excerpt_en")  as string).trim();
  const excerptVi  = (formData.get("excerpt_vi")  as string).trim();
  const contentLo  = (formData.get("content_lo")  as string).trim();
  const contentTh  = (formData.get("content_th")  as string).trim();
  const contentEn  = (formData.get("content_en")  as string).trim();
  const contentVi  = (formData.get("content_vi")  as string).trim();
  const coverImage = (formData.get("cover_image") as string).trim() || null;
  const publish    = formData.get("publish") === "true";
  const scheduledAt = (formData.get("scheduled_at") as string).trim() || null;
  const tagsRaw = (formData.get("tags") as string).trim();
  const tags = tagsRaw ? JSON.parse(tagsRaw) : [];
  const seoTitle       = (formData.get("seo_title") as string)?.trim() || null;
  const seoDescription = (formData.get("seo_description") as string)?.trim() || null;
  const ogImage        = (formData.get("og_image") as string)?.trim() || null;

  if (!slug) return { status: "error", message: "ກະລຸນາໃສ່ Slug" };
  if (!titleLo && !titleTh && !titleEn)
    return { status: "error", message: "ກະລຸນາໃສ່ຫົວຂໍ້ຢ່າງໜ້ອຍ 1 ພາສາ" };
  if (!/^[a-z0-9-]+$/.test(slug))
    return { status: "error", message: "Slug ໃຊ້ໄດ້ສະເພາະ a-z, 0-9, -" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing && existing.id !== id)
    return { status: "error", message: "Slug ນີ້ຖືກໃຊ້ງານແລ້ວ" };

  const statusFields: {
    status: "draft" | "scheduled" | "published";
    published_at: string | null;
    scheduled_at: string | null;
  } = (() => {
    if (!publish) {
      return { status: "draft", published_at: null, scheduled_at: null };
    }
    const now = new Date();
    const isScheduled = scheduledAt && new Date(scheduledAt) > now;
    if (isScheduled) {
      return {
        status: "scheduled",
        published_at: scheduledAt,
        scheduled_at: scheduledAt,
      };
    }
    return {
      status: "published",
      published_at: scheduledAt || now.toISOString(),
      scheduled_at: null,
    };
  })();

  const payload = {
    slug,
    title_lo: titleLo, title_th: titleTh, title_en: titleEn, title_vi: titleVi,
    excerpt_lo: excerptLo, excerpt_th: excerptTh, excerpt_en: excerptEn, excerpt_vi: excerptVi,
    content_lo: contentLo, content_th: contentTh, content_en: contentEn, content_vi: contentVi,
    cover_image: coverImage,
    author_id: user.id,
    tags: tags as string[],
    seo_title: seoTitle,
    seo_description: seoDescription,
    og_image: ogImage,
    ...statusFields,
  };

  let resultId: string;
  if (id) {
    const { error } = await supabase.from("blog_posts").update(payload).eq("id", id);
    if (error) return { status: "error", message: error.message };
    resultId = id;
  } else {
    const { data, error } = await supabase.from("blog_posts").insert(payload).select("id").single();
    if (error) return { status: "error", message: error.message };
    resultId = data.id;
  }

  revalidatePath("/blog-admin");
  revalidatePath("/blog");
  return { status: "success", id: resultId };
}

export async function deleteBlogPostAction(id: string): Promise<void> {
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return;
  const supabase = await createClient();
  await supabase.from("blog_posts").delete().eq("id", id);
  revalidatePath("/blog-admin");
  revalidatePath("/blog");
}

export async function uploadCoverImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const rank = await getCurrentUserRoleRank();
  if (rank < 30) return { error: "ບໍ່ມີສິດໃຊ້ງານ" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "ບໍ່ພົບໄຟລ໌" };

  const ext = file.name.split(".").pop();
  const path = `blog-covers/${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("site-assets")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
  return { url: data.publicUrl };
}