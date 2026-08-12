import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SubmissionInput } from "@/lib/validation/submission";

/**
 * ลบความสัมพันธ์เดิมทั้งหมด (ผู้วิจัย/หมวดหมู่/คำสำคัญ) แล้วสร้างใหม่ตามข้อมูล
 * ที่ส่งมา — ใช้ทั้งตอนส่งงานวิจัยใหม่และตอนแก้ไข (ง่ายกว่าการ diff รายการ)
 */
export async function replaceResearchRelations(
  supabase: SupabaseClient<Database>,
  researchId: string,
  data: Pick<SubmissionInput, "researchers" | "categoryId" | "keywords">
): Promise<void> {
  await supabase.from("research_authors").delete().eq("research_id", researchId);
  await supabase.from("research_categories").delete().eq("research_id", researchId);
  await supabase.from("research_keywords").delete().eq("research_id", researchId);

  for (let i = 0; i < data.researchers.length; i++) {
    const researcher = data.researchers[i];
    const { data: author, error: authorError } = await supabase
      .from("authors")
      .insert({
        name: researcher.name,
        organization_name: researcher.organization || null,
      })
      .select("id")
      .single();

    if (authorError || !author) {
      throw new Error(`ไม่สามารถบันทึกผู้วิจัยได้: ${authorError?.message ?? ""}`);
    }

    const { error: linkError } = await supabase.from("research_authors").insert({
      research_id: researchId,
      author_id: author.id,
      author_order: i + 1,
    });

    if (linkError) {
      throw new Error(`ไม่สามารถเชื่อมโยงผู้วิจัยได้: ${linkError.message}`);
    }
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", data.categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    throw new Error("ไม่พบหมวดหมู่ที่เลือก");
  }

  const { error: catLinkError } = await supabase.from("research_categories").insert({
    research_id: researchId,
    category_id: category.id,
  });

  if (catLinkError) {
    throw new Error(`ไม่สามารถเชื่อมโยงหมวดหมู่ได้: ${catLinkError.message}`);
  }

  for (const keyword of data.keywords) {
    const { data: kw, error: kwError } = await supabase
      .from("keywords")
      .upsert({ keyword }, { onConflict: "keyword" })
      .select("id")
      .single();

    if (kwError || !kw) {
      throw new Error(`ไม่สามารถบันทึกคำสำคัญได้: ${kwError?.message ?? ""}`);
    }

    const { error: kwLinkError } = await supabase.from("research_keywords").insert({
      research_id: researchId,
      keyword_id: kw.id,
    });

    if (kwLinkError) {
      throw new Error(`ไม่สามารถเชื่อมโยงคำสำคัญได้: ${kwLinkError.message}`);
    }
  }
}

/** สร้าง slug ที่อ่านง่ายจากชื่อเรื่อง พร้อมสุ่มต่อท้ายให้ไม่ซ้ำกันเสมอ */
export function generateResearchSlug(
  titleEn: string | undefined,
  titleTh: string
): string {
  const base = (titleEn || titleTh)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const suffix = crypto.randomUUID().slice(0, 8);
  return base ? `${base}-${suffix}` : suffix;
}
