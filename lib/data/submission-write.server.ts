import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SubmissionInput } from "@/lib/validation/submission";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";

/**
 * แทนที่ความสัมพันธ์ (ผู้วิจัย/หมวดหมู่/คำสำคัญ) ของงานวิจัยด้วยชุดใหม่ที่ส่งมา —
 * ใช้ทั้งตอนส่งงานวิจัยใหม่และตอนแก้ไข
 *
 * ลำดับขั้น (ออกแบบให้ล้มเหลวกลางทางแล้วงานไม่สูญเสียข้อมูลเดิม):
 *  1) เตรียมข้อมูลที่อ่าน/สร้างแบบ idempotent ก่อน โดยยังไม่แตะลิงก์เดิม —
 *     หา category id และ keyword id (ถ้ายังไม่มีค่อยสร้างด้วย INSERT ... ON
 *     CONFLICT DO NOTHING) ถ้าขั้นนี้ล้ม ลิงก์เดิมยังอยู่ครบ
 *  2) สร้างผู้วิจัยใหม่ (พฤติกรรมเดิม — ยังสร้างแถว authors ใหม่ทุกครั้ง)
 *  3) "เพิ่ม" ลิงก์ใหม่ก่อน แล้วค่อย "ลบ" เฉพาะลิงก์เดิมที่ไม่อยู่ในชุดใหม่ —
 *     ช่วงที่ล้มได้จึงเหลือแค่ลิงก์ซ้ำ/เกิน ไม่ใช่ลิงก์หาย
 *
 * ข้อจำกัด: supabase-js ไม่มี transaction ข้ามหลายคำสั่ง จึงไม่ atomic
 * เต็มที่ (ถ้าล้มหลังเพิ่มลิงก์ใหม่แต่ก่อนลบลิงก์เก่า งานจะมีลิงก์เกินชั่วคราว
 * จนกว่าจะบันทึกซ้ำ) — ทางเลือกที่ atomic จริงคือ RPC ฝั่ง DB (ต้องมี migration)
 *
 * ไม่ใช้ upsert ... onConflict บนตาราง keywords เพราะ Postgres ต้องการสิทธิ์
 * UPDATE เมื่อชนกับแถวเดิม และ keywords ไม่มี UPDATE policy (ตั้งใจ)
 */
export async function replaceResearchRelations(
  supabase: SupabaseClient<Database>,
  researchId: string,
  data: Pick<SubmissionInput, "researchers" | "categoryId" | "keywords">
): Promise<void> {
  // ---- 1) เตรียมข้อมูล (ยังไม่แตะลิงก์เดิม)
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", data.categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    throw new Error("ไม่พบหมวดหมู่ที่เลือก");
  }

  const keywordIds = await resolveKeywordIds(supabase, data.keywords);

  const [oldAuthorLinks, oldCategoryLinks, oldKeywordLinks] = await Promise.all([
    supabase.from("research_authors").select("id").eq("research_id", researchId),
    supabase.from("research_categories").select("category_id").eq("research_id", researchId),
    supabase.from("research_keywords").select("keyword_id").eq("research_id", researchId),
  ]);
  if (oldAuthorLinks.error || oldCategoryLinks.error || oldKeywordLinks.error) {
    throw new Error(
      toSafeErrorMessage(
        oldAuthorLinks.error ?? oldCategoryLinks.error ?? oldKeywordLinks.error,
        "ไม่สามารถอ่านข้อมูลที่เกี่ยวข้องเดิมได้",
        "replaceResearchRelations: read existing links failed"
      )
    );
  }
  const oldAuthorLinkIds = (oldAuthorLinks.data ?? []).map((row) => row.id);
  const oldCategoryIds = (oldCategoryLinks.data ?? []).map((row) => row.category_id);
  const oldKeywordIds = (oldKeywordLinks.data ?? []).map((row) => row.keyword_id);

  // ---- 2) ผู้วิจัยชุดใหม่ + ลิงก์ (ลิงก์เดิมยังอยู่จนกว่าจะถึงขั้นที่ 3)
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

  // ---- 3) เพิ่มลิงก์หมวดหมู่/คำสำคัญที่ยังไม่มี ก่อนลบอันที่ไม่ใช้แล้ว
  if (!oldCategoryIds.includes(category.id)) {
    const { error: catLinkError } = await supabase.from("research_categories").insert({
      research_id: researchId,
      category_id: category.id,
    });
    if (catLinkError) {
      throw new Error(
        toSafeErrorMessage(catLinkError, "ไม่สามารถเชื่อมโยงหมวดหมู่ได้", "replaceResearchRelations: category link failed")
      );
    }
  }

  const keywordIdsToAdd = keywordIds.filter((id) => !oldKeywordIds.includes(id));
  if (keywordIdsToAdd.length > 0) {
    const { error: kwLinkError } = await supabase
      .from("research_keywords")
      .insert(keywordIdsToAdd.map((keyword_id) => ({ research_id: researchId, keyword_id })));
    if (kwLinkError) {
      throw new Error(
        toSafeErrorMessage(kwLinkError, "ไม่สามารถเชื่อมโยงคำสำคัญได้", "replaceResearchRelations: keyword link failed")
      );
    }
  }

  // ---- ลบลิงก์เดิมที่ไม่อยู่ในชุดใหม่ (ทำท้ายสุดเสมอ)
  if (oldAuthorLinkIds.length > 0) {
    const { error } = await supabase.from("research_authors").delete().in("id", oldAuthorLinkIds);
    if (error) {
      throw new Error(
        toSafeErrorMessage(error, "ไม่สามารถลบผู้วิจัยเดิมได้", "replaceResearchRelations: old author links delete failed")
      );
    }
  }

  const categoryIdsToRemove = oldCategoryIds.filter((id) => id !== category.id);
  if (categoryIdsToRemove.length > 0) {
    const { error } = await supabase
      .from("research_categories")
      .delete()
      .eq("research_id", researchId)
      .in("category_id", categoryIdsToRemove);
    if (error) {
      throw new Error(
        toSafeErrorMessage(error, "ไม่สามารถลบหมวดหมู่เดิมได้", "replaceResearchRelations: old category links delete failed")
      );
    }
  }

  const keywordIdsToRemove = oldKeywordIds.filter((id) => !keywordIds.includes(id));
  if (keywordIdsToRemove.length > 0) {
    const { error } = await supabase
      .from("research_keywords")
      .delete()
      .eq("research_id", researchId)
      .in("keyword_id", keywordIdsToRemove);
    if (error) {
      throw new Error(
        toSafeErrorMessage(error, "ไม่สามารถลบคำสำคัญเดิมได้", "replaceResearchRelations: old keyword links delete failed")
      );
    }
  }
}

/**
 * คืน id ของ keyword ทุกคำที่ส่งมา (ตัดคำซ้ำแบบตรงตัวเหมือนเดิม): อ่านคำที่มีอยู่แล้ว
 * ก่อน แล้วสร้างเฉพาะที่ยังไม่มีด้วย INSERT ... ON CONFLICT DO NOTHING (ไม่ต้องใช้
 * สิทธิ์ UPDATE) แล้วอ่านกลับอีกครั้ง — ครอบคลุมกรณีมีคนสร้างคำเดียวกันพร้อมกัน
 * ค้นทีละคำด้วย .eq() (ไม่ใช้ .in()) เพื่อไม่ต้องกังวลเรื่อง escape ของ , ( ) "
 */
async function resolveKeywordIds(
  supabase: SupabaseClient<Database>,
  keywords: string[]
): Promise<string[]> {
  const unique = [...new Set(keywords)];
  if (unique.length === 0) return [];

  const idByKeyword = new Map<string, string>();

  async function loadExisting(wanted: string[]) {
    const results = await Promise.all(
      wanted.map((keyword) => supabase.from("keywords").select("id").eq("keyword", keyword).maybeSingle())
    );
    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          toSafeErrorMessage(result.error, "ไม่สามารถบันทึกคำสำคัญได้", "replaceResearchRelations: keyword lookup failed")
        );
      }
      if (result.data) idByKeyword.set(wanted[index], result.data.id);
    });
  }

  await loadExisting(unique);

  const missing = unique.filter((keyword) => !idByKeyword.has(keyword));
  if (missing.length > 0) {
    const { error: insertError } = await supabase
      .from("keywords")
      .upsert(
        missing.map((keyword) => ({ keyword })),
        { onConflict: "keyword", ignoreDuplicates: true }
      );
    if (insertError) {
      throw new Error(
        toSafeErrorMessage(insertError, "ไม่สามารถบันทึกคำสำคัญได้", "replaceResearchRelations: keyword insert failed")
      );
    }
    await loadExisting(missing);
  }

  return unique.map((keyword) => {
    const id = idByKeyword.get(keyword);
    if (!id) {
      throw new Error("ไม่สามารถบันทึกคำสำคัญได้ (ไม่พบ id หลังบันทึก)");
    }
    return id;
  });
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
