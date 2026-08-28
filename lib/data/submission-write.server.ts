import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SubmissionInput } from "@/lib/validation/submission";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";

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
      throw new Error(
        toSafeErrorMessage(authorError, "ไม่สามารถบันทึกผู้วิจัยได้", "replaceResearchRelations: author insert failed")
      );
    }

    const { error: linkError } = await supabase.from("research_authors").insert({
      research_id: researchId,
      author_id: author.id,
      author_order: i + 1,
    });

    if (linkError) {
      throw new Error(
        toSafeErrorMessage(linkError, "ไม่สามารถเชื่อมโยงผู้วิจัยได้", "replaceResearchRelations: author link failed")
      );
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
    throw new Error(
      toSafeErrorMessage(catLinkError, "ไม่สามารถเชื่อมโยงหมวดหมู่ได้", "replaceResearchRelations: category link failed")
    );
  }

  if (data.keywords.length > 0) {
    // ตัดคำซ้ำก่อนเสมอ — batch upsert เดียวที่มีแถวซ้ำกันเองบน column ที่มี
    // unique constraint (keyword) จะพัง Postgres error "ON CONFLICT DO UPDATE
    // command cannot affect row a second time" ต่างจาก upsert ทีละคำแบบเดิม
    // ที่แต่ละคำสั่งแยกกันจึงไม่เจอปัญหานี้ — ผลลัพธ์ชุดคำสำคัญที่ผูกกับงานวิจัย
    // เหมือนเดิมทุกประการ (คำซ้ำก็ควรผูกกับ keyword_id เดียวกันอยู่แล้ว)
    const uniqueKeywords = [...new Set(data.keywords)];

    const { data: upsertedKeywords, error: kwError } = await supabase
      .from("keywords")
      .upsert(
        uniqueKeywords.map((keyword) => ({ keyword })),
        { onConflict: "keyword" }
      )
      .select("id, keyword");

    if (kwError || !upsertedKeywords) {
      throw new Error(
        toSafeErrorMessage(kwError, "ไม่สามารถบันทึกคำสำคัญได้", "replaceResearchRelations: keyword insert failed")
      );
    }

    // จับคู่กลับด้วยข้อความ keyword เอง (มี unique constraint) ไม่ใช่ตำแหน่ง
    // แถวที่ upsert คืนมา — ปลอดภัยไม่ว่า batch upsert จะคืนแถวมาลำดับใดก็ตาม
    const idByKeyword = new Map(upsertedKeywords.map((row) => [row.keyword, row.id]));
    const links = uniqueKeywords.map((keyword) => {
      const keywordId = idByKeyword.get(keyword);
      if (!keywordId) {
        throw new Error("ไม่สามารถบันทึกคำสำคัญได้ (ไม่พบ id หลัง upsert)");
      }
      return { research_id: researchId, keyword_id: keywordId };
    });

    const { error: kwLinkError } = await supabase.from("research_keywords").insert(links);
    if (kwLinkError) {
      throw new Error(
        toSafeErrorMessage(kwLinkError, "ไม่สามารถเชื่อมโยงคำสำคัญได้", "replaceResearchRelations: keyword link failed")
      );
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
