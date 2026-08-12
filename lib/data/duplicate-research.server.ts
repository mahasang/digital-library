import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DuplicateReviewStatusRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getActiveDuplicateDetectionRule,
  DEFAULT_DUPLICATE_DETECTION_WEIGHTS,
  type DuplicateDetectionRule,
} from "@/lib/data/duplicate-detection-rules.server";

interface SimilarityCandidate {
  candidate_id: string;
  title_similarity_th: number;
  title_similarity_en: number;
  same_year: boolean;
  same_isbn: boolean;
  same_doi: boolean;
  same_pdf_hash: boolean;
  same_principal_author: boolean;
}

/**
 * คำนวณคะแนนความคล้าย (0-1) จากน้ำหนักของเกณฑ์ที่ active อยู่ตอนนี้ (ปรับได้ที่
 * /superadmin/data-quality/settings — ดู lib/data/duplicate-detection-rules.server.ts)
 * แทนค่าคงที่ตายตัวแบบเดิม (ก่อนช่วงที่ 22): ISBN/DOI/PDF hash ตรงกันเคยให้
 * คะแนนเต็ม 100% ทันที ตอนนี้กลายเป็นน้ำหนักของตัวเอง (weightIdentifier รวม
 * ISBN+DOI เป็นหมวดเดียวกัน ตามที่ระบุในขอบเขตงาน "DOI/ISBN/เลขอ้างอิง",
 * weightFileHash แยกต่างหาก) น้ำหนักทั้งห้ารวมกันได้ 100 เสมอ (บังคับด้วย CHECK
 * constraint ของตาราง) คะแนนจึงอยู่ในช่วง 0-1 เสมอโดยไม่ต้อง clamp
 */
function scoreAndReasons(
  row: SimilarityCandidate,
  rule: DuplicateDetectionRule
): { score: number; reasons: string[] } {
  const titleSim = Math.max(row.title_similarity_th, row.title_similarity_en);
  const sameIdentifier = row.same_isbn || row.same_doi;

  let weightedSum = titleSim * rule.weightTitle;
  const reasons: string[] = [];
  if (titleSim > 0) reasons.push(`ชื่อเรื่องคล้ายกัน ${Math.round(titleSim * 100)}%`);

  if (row.same_year) {
    weightedSum += rule.weightYear;
    reasons.push("ปีเผยแพร่เดียวกัน");
  }
  if (row.same_principal_author) {
    weightedSum += rule.weightAuthor;
    reasons.push("ผู้วิจัยหลักคนเดียวกัน");
  }
  if (sameIdentifier) {
    weightedSum += rule.weightIdentifier;
    reasons.push(row.same_isbn && row.same_doi ? "เลข ISBN และ DOI ตรงกัน" : row.same_isbn ? "เลข ISBN ตรงกัน" : "เลข DOI ตรงกัน");
  }
  if (row.same_pdf_hash) {
    weightedSum += rule.weightFileHash;
    reasons.push("ไฟล์ PDF เหมือนกันทุกประการ (hash ตรงกัน)");
  }

  return { score: Math.min(1, weightedSum / 100), reasons };
}

/** เกณฑ์สำรองถ้าอ่าน active rule จากฐานข้อมูลไม่ได้ (ไม่ควรเกิดขึ้นจริงเพราะ
 * migration seed ไว้เสมอ) — กันการตรวจงานวิจัยซ้ำหยุดทำงานไปเฉยๆ */
const FALLBACK_RULE: DuplicateDetectionRule = {
  id: "",
  version: 0,
  ...DEFAULT_DUPLICATE_DETECTION_WEIGHTS,
  isActive: true,
  createdBy: null,
  createdAt: new Date(0).toISOString(),
};

/** ตรวจสอบงานวิจัยซ้ำสำหรับรายการที่ระบุ แล้วบันทึกคู่ที่น่าสงสัยลง
 * duplicate_research_reviews (upsert — ไม่สร้างซ้ำถ้าคู่เดิมมีอยู่แล้วและยัง
 * เป็น pending) ไม่เคยบล็อกการบันทึกงานวิจัยเอง เป็นแค่คำเตือนสำหรับ
 * เจ้าหน้าที่ตรวจสอบภายหลังที่ /dashboard/duplicate-reviews เท่านั้น
 * เรียกจาก Server Action ของผู้ส่ง/แก้ไขงานวิจัย (rank >= 20 อยู่แล้ว ตรงกับ
 * เงื่อนไข rank ภายใน find_similar_research_items) หรือจาก background job
 * `duplicate_scan` ผ่าน Service Role (bulk scan ย้อนหลังทั้งระบบ ช่วงที่ 22) */
export async function detectDuplicatesForResearchItem(
  supabase: SupabaseClient<Database>,
  researchItemId: string
): Promise<void> {
  const [{ data, error }, rule] = await Promise.all([
    supabase.rpc("find_similar_research_items", { p_research_item_id: researchItemId }),
    getActiveDuplicateDetectionRule(supabase),
  ]);

  if (error) {
    console.error("detectDuplicatesForResearchItem: RPC failed:", error.message);
    return;
  }

  const activeRule = rule ?? FALLBACK_RULE;
  const minScore = activeRule.thresholdLow / 100;

  for (const row of data ?? []) {
    const { score, reasons } = scoreAndReasons(row, activeRule);
    if (score < minScore) continue;

    const [a, b] = [researchItemId, row.candidate_id].sort();
    const { error: upsertError } = await supabase
      .from("duplicate_research_reviews")
      .upsert(
        {
          research_item_id: a,
          candidate_research_item_id: b,
          similarity_score: score,
          similarity_reasons: reasons,
          rule_version_id: activeRule.id || null,
        },
        { onConflict: "research_item_id,candidate_research_item_id", ignoreDuplicates: false }
      );

    if (upsertError) {
      console.error("detectDuplicatesForResearchItem: upsert failed:", upsertError.message);
    }
  }
}

export interface DuplicateReviewRow {
  id: string;
  researchItemId: string;
  researchTitleTh: string;
  researchSlug: string;
  candidateResearchItemId: string;
  candidateTitleTh: string;
  candidateSlug: string;
  similarityScore: number;
  similarityReasons: string[];
  status: DuplicateReviewStatusRow;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** เวอร์ชันของเกณฑ์ที่ใช้ตอนตรวจพบคู่นี้ — null สำหรับแถวเก่าก่อนช่วงที่ 22
   * ที่ยังไม่มี rule_version_id (ดู migration 20260812100000) */
  ruleVersion: number | null;
  /** true เมื่อเกณฑ์เวอร์ชันที่ใช้ตรวจคู่นี้ไม่ใช่เวอร์ชันที่ active อยู่ในปัจจุบัน
   * แล้ว — คำนวณตอน query เสมอ (เทียบกับ duplicate_detection_rules.is_active
   * สด) ไม่ใช่คอลัมน์ที่เก็บไว้ล่วงหน้า จึงถูกต้องเสมอโดยไม่ต้องมี job กวาดอัปเดต
   * แยกทุกครั้งที่เปลี่ยนเกณฑ์ (ดู docs/data-quality.md เรื่องผลตรวจเก่าล้าสมัย) */
  staleRuleVersion: boolean;
}

interface RawReviewRow {
  id: string;
  research_item_id: string;
  candidate_research_item_id: string;
  similarity_score: number;
  similarity_reasons: string[];
  status: DuplicateReviewStatusRow;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  research: { title_th: string; slug: string } | null;
  candidate: { title_th: string; slug: string } | null;
  rule: { version: number; is_active: boolean } | null;
}

const REVIEW_SELECT_COLUMNS =
  "id, research_item_id, candidate_research_item_id, similarity_score, similarity_reasons, status, review_note, reviewed_at, created_at, research:research_items!duplicate_research_reviews_research_item_id_fkey ( title_th, slug ), candidate:research_items!duplicate_research_reviews_candidate_research_item_id_fkey ( title_th, slug ), rule:duplicate_detection_rules!duplicate_research_reviews_rule_version_id_fkey ( version, is_active )";

function mapReviewRow(row: RawReviewRow): DuplicateReviewRow {
  return {
    id: row.id,
    researchItemId: row.research_item_id,
    researchTitleTh: row.research?.title_th ?? "",
    researchSlug: row.research?.slug ?? "",
    candidateResearchItemId: row.candidate_research_item_id,
    candidateTitleTh: row.candidate?.title_th ?? "",
    candidateSlug: row.candidate?.slug ?? "",
    similarityScore: row.similarity_score,
    similarityReasons: row.similarity_reasons ?? [],
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    ruleVersion: row.rule?.version ?? null,
    staleRuleVersion: row.rule ? !row.rule.is_active : false,
  };
}

/** รายการคู่งานวิจัยที่อาจซ้ำ (มุมมองเจ้าหน้าที่ rank >= 30) — `ruleVersion` ถ้า
 * ระบุ จะกรองเฉพาะคู่ที่ตรวจพบด้วยเกณฑ์เวอร์ชันนั้น (ใช้ deep-link จากรายงาน
 * "การสแกนซ้ำล่าสุด" ที่หน้า /superadmin/data-quality/settings — ต้องใช้
 * !inner แทน left embed ปกติ เพราะต้อง filter บนตารางที่ join ด้วย) */
export async function getDuplicateReviews(
  status?: DuplicateReviewStatusRow,
  ruleVersion?: number
): Promise<DuplicateReviewRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const selectColumns = ruleVersion
    ? REVIEW_SELECT_COLUMNS.replace(
        "rule:duplicate_detection_rules!duplicate_research_reviews_rule_version_id_fkey ( version, is_active )",
        "rule:duplicate_detection_rules!inner!duplicate_research_reviews_rule_version_id_fkey ( version, is_active )"
      )
    : REVIEW_SELECT_COLUMNS;

  let query = supabase
    .from("duplicate_research_reviews")
    .select(selectColumns)
    .order("similarity_score", { ascending: false });

  if (status) query = query.eq("status", status);
  if (ruleVersion) query = query.eq("rule.version", ruleVersion);

  const { data, error } = await query;
  if (error) {
    console.error("getDuplicateReviews failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as RawReviewRow[]).map(mapReviewRow);
}

export async function getDuplicateReviewDetail(reviewId: string): Promise<DuplicateReviewRow | null> {
  if (!isSupabaseConfigured() || !reviewId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplicate_research_reviews")
    .select(REVIEW_SELECT_COLUMNS)
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getDuplicateReviewDetail failed:", error.message);
    return null;
  }
  return mapReviewRow(data as unknown as RawReviewRow);
}
