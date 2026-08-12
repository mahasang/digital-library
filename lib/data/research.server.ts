import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchPublishedResearchRows,
  fetchResearchRowBySlug,
  fetchHomepageResearchRows,
  fetchPublishedResearchCategoryLinkRows,
} from "@/lib/data/queries";
import { mapRowToResearchItem, mapHomepageRowToResearchItem } from "@/lib/data/mappers";
import * as mockData from "@/data/research";
import {
  PUBLIC_RESEARCH_TAG,
  PUBLIC_HOME_TAG,
  PUBLIC_HOME_REVALIDATE_SECONDS,
} from "@/lib/cache/public-home";
import type { ResearchItem } from "@/types/research";

/**
 * ชั้นเข้าถึงข้อมูลงานวิจัยฝั่งเซิร์ฟเวอร์ (Server Component/Action)
 *
 * หากยังไม่ได้ตั้งค่า Supabase (.env.local) ระบบจะใช้ข้อมูลตัวอย่างจาก
 * data/research.ts แทนโดยอัตโนมัติ เพื่อให้เว็บไซต์ยังใช้งานได้ระหว่างพัฒนา
 * ฟังก์ชันในไฟล์นี้มี signature และพฤติกรรมตรงกับ data/research.ts (Phase 1)
 * ทุกประการ เพื่อไม่ให้ต้องแก้ไข UI/Component ที่เรียกใช้งาน
 */

/** หาก slug นี้เป็นงานวิจัยที่ถูกรวม (merge) เข้ากับรายการอื่นไปแล้ว คืนค่า
 * slug ของรายการหลักที่ควร redirect ไปแทน — คืน null ถ้าไม่ใช่กรณีนี้ (ไม่พบ
 * เลย หรือพบแต่ไม่ใช่สถานะ merged) เรียกเฉพาะตอน getResearchById คืนค่าว่าง
 * เท่านั้น (fetchResearchRowBySlug กรอง status='published' ไว้แล้วเป็นค่า
 * เริ่มต้นสำหรับทุกหน้าเว็บสาธารณะ ไม่แตะพฤติกรรมเดิมของฟังก์ชันนั้นเลย) */
export async function getMergedRedirectSlug(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("research_items")
    .select("merged_into_research_item_id")
    .eq("slug", slug)
    .eq("status", "merged")
    .maybeSingle();

  if (!source?.merged_into_research_item_id) return null;

  const { data: target } = await supabase
    .from("research_items")
    .select("slug")
    .eq("id", source.merged_into_research_item_id)
    .maybeSingle();

  return target?.slug ?? null;
}

export async function getPublishedResearch(): Promise<ResearchItem[]> {
  if (!isSupabaseConfigured()) {
    return mockData.getPublishedResearch();
  }

  const supabase = await createClient();
  const rows = await fetchPublishedResearchRows(supabase);
  return rows.map(mapRowToResearchItem);
}

/** ดึงข้อมูลงานวิจัย (published เท่านั้น) โดยไม่นับยอดเข้าชม — ใช้ในบริบทที่ไม่ใช่
 * การเปิดดูหน้าเว็บจริงของผู้ใช้ เช่น server action ที่สร้างลิงก์ดาวน์โหลด */
export async function getResearchByIdNoTracking(
  id: string
): Promise<ResearchItem | undefined> {
  if (!isSupabaseConfigured()) {
    return mockData.getResearchById(id);
  }

  const supabase = await createClient();
  const row = await fetchResearchRowBySlug(supabase, id);
  return row ? mapRowToResearchItem(row) : undefined;
}

export async function getResearchById(id: string): Promise<ResearchItem | undefined> {
  if (!isSupabaseConfigured()) {
    return mockData.getResearchById(id);
  }

  const supabase = await createClient();
  const row = await fetchResearchRowBySlug(supabase, id);
  if (!row) return undefined;

  // เพิ่มยอดเข้าชมผ่าน SECURITY DEFINER function — await ให้เสร็จก่อนตอบกลับ
  // request (สภาพแวดล้อม serverless อาจตัด promise ที่ค้างอยู่หลัง response
  // ถูกส่งแล้ว) แต่ไม่ให้ข้อผิดพลาดของการนับสถิตินี้ทำให้หน้าเว็บพังไปด้วย
  const { error: viewError } = await supabase.rpc("increment_research_views", {
    p_research_id: row.id,
  });
  if (viewError) {
    console.error("increment_research_views failed:", viewError.message);
  }

  return mapRowToResearchItem(row);
}

/**
 * ⚠️ Hallmark — public homepage caching: getLatestResearch/getPopularResearch/
 * getPublishedResearchStats (ทั้งสามฟังก์ชันด้านล่าง) เปลี่ยนจาก createClient()
 * (ผูกกับ cookies ของผู้ใช้ปัจจุบัน) มาเป็น createPublicClient() (ไม่ผูก
 * cookies ใดๆ, มองเห็นเฉพาะแถวที่ role "anon" เห็นได้ตาม RLS เสมอ) โดยตั้งใจ
 * — เป็นเงื่อนไขบังคับของการ cache ข้ามผู้ใช้อย่างปลอดภัย (ดู
 * lib/supabase/public.ts) **ผลที่ตามมาที่มองเห็นได้จริง**: ตาม RLS policy
 * "research_items_select" งานวิจัยเผยแพร่แล้วระดับ member_only ต้องมี rank
 * >= 10 และระดับ staff_only ต้องมี rank >= 20 จึงจะเห็นแถวนั้นได้ (guest เห็น
 * เฉพาะ public/read_only/metadata_only) — **ก่อนหน้านี้ ผู้ใช้ที่ login เป็น
 * member/staff/librarian/admin จะเห็นงานวิจัย member_only/staff_only ปนอยู่ใน
 * "ล่าสุด"/"ยอดนิยม"/สถิติของหน้าแรกด้วย ตอนนี้ทุกคนเห็นชุดเดียวกันเสมอ (เฉพาะ
 * ที่ guest เห็นได้) ไม่ว่าจะ login อยู่หรือมีสิทธิ์สูงแค่ไหนก็ตาม**
 *
 * นี่คือพฤติกรรมที่ตั้งใจตามข้อกำหนดของงานนี้โดยตรง ("Never cache ... member-
 * only data, or staff-only data") ไม่ใช่ผลข้างเคียงที่ไม่ได้ตั้งใจ — การ cache
 * ผลลัพธ์ที่ขึ้นกับ role ของผู้เรียกแล้วนำไปใช้ซ้ำข้ามผู้ใช้ทุกคนจะเป็นช่องโหว่
 * ข้อมูลรั่วไหลจริง (แสดง/ซ่อนงานวิจัยผิดคนได้) จึงต้อง "ตัดลงมาให้เท่ากับสิ่งที่
 * ผู้เยี่ยมชมทั่วไปเห็น" เสมอสำหรับส่วนที่ cache ได้ — getPublishedResearch()/
 * getRelatedResearch() (ใช้ในหน้ารายละเอียดงานวิจัย ไม่ใช่หน้าแรก) ยังคงใช้
 * createClient() แบบเดิมทุกประการ ไม่ถูกแตะต้อง จึงยังคง role-aware เหมือนเดิม
 */

/**
 * งานวิจัยล่าสุดสำหรับหน้าแรก — เรียง (ORDER BY published_at DESC) และจำกัด
 * จำนวน (LIMIT) ที่ฐานข้อมูลโดยตรง พร้อมดึงเฉพาะคอลัมน์/ความสัมพันธ์ที่การ์ด
 * หน้าแรก render จริง (ดู HOMEPAGE_RESEARCH_SELECT ใน queries.ts) — ไม่มี
 * secondary tie-break เพิ่มใหม่ เพราะโค้ดเดิมก็ไม่มีตัวตัดสินลำดับรองสำหรับ
 * published_at ที่เท่ากันเป๊ะอยู่แล้ว (กรณีนี้แทบไม่เกิดขึ้นจริงเพราะ timestamp
 * มีความละเอียดระดับไมโครวินาที) — cache ข้าม request/ผู้ใช้ผ่าน
 * unstable_cache (tag: public-research, public-home) ดูหมายเหตุเรื่อง RLS
 * ด้านบน
 */
async function fetchLatestResearchFromDb(limit: number): Promise<ResearchItem[]> {
  const supabase = createPublicClient();
  const rows = await fetchHomepageResearchRows(supabase, "published_at", limit);
  return rows.map(mapHomepageRowToResearchItem);
}

const getCachedLatestResearch = unstable_cache(
  fetchLatestResearchFromDb,
  ["public-latest-research"],
  { tags: [PUBLIC_RESEARCH_TAG, PUBLIC_HOME_TAG], revalidate: PUBLIC_HOME_REVALIDATE_SECONDS }
);

export async function getLatestResearch(limit = 4): Promise<ResearchItem[]> {
  if (!isSupabaseConfigured()) {
    return mockData.getLatestResearch(limit);
  }
  return getCachedLatestResearch(limit);
}

/**
 * งานวิจัยยอดนิยมสำหรับหน้าแรก — เรียง (ORDER BY views DESC) และจำกัดจำนวนที่
 * ฐานข้อมูลโดยตรงเช่นเดียวกับ getLatestResearch() ข้างบน
 *
 * ต่างจาก getLatestResearch() ตรงที่ต้องระบุ published_at DESC เป็นตัวตัดสิน
 * ลำดับรองอย่างชัดเจน (secondaryOrder) — โค้ดเดิมดึงแถวที่เรียง published_at
 * ใหม่สุดก่อนมาแล้ว (จาก fetchPublishedResearchRows) แล้วค่อย sort ด้วย views
 * ซึ่ง Array.prototype.sort() ของ JavaScript การันตีว่า stable (ES2019+)
 * รายการที่ views เท่ากันจึงคงลำดับ published_at เดิมไว้เสมอ ต้องระบุที่
 * ฐานข้อมูลตรงๆ เพื่อให้ได้ผลลัพธ์เดียวกันเป๊ะ เพราะ Postgres ไม่การันตีลำดับ
 * ของแถวที่เท่ากันโดยไม่มี ORDER BY ระบุไว้ — cache ข้าม request/ผู้ใช้ผ่าน
 * unstable_cache (tag: public-research, public-home) ดูหมายเหตุเรื่อง RLS
 * ด้านบนสุดของกลุ่มฟังก์ชันนี้
 */
async function fetchPopularResearchFromDb(limit: number): Promise<ResearchItem[]> {
  const supabase = createPublicClient();
  const rows = await fetchHomepageResearchRows(supabase, "views", limit, "published_at");
  return rows.map(mapHomepageRowToResearchItem);
}

const getCachedPopularResearch = unstable_cache(
  fetchPopularResearchFromDb,
  ["public-popular-research"],
  { tags: [PUBLIC_RESEARCH_TAG, PUBLIC_HOME_TAG], revalidate: PUBLIC_HOME_REVALIDATE_SECONDS }
);

export async function getPopularResearch(limit = 4): Promise<ResearchItem[]> {
  if (!isSupabaseConfigured()) {
    return mockData.getPopularResearch(limit);
  }
  return getCachedPopularResearch(limit);
}

/**
 * จัดกลุ่มจำนวนงานวิจัยที่เผยแพร่แล้วต่อหมวดหมู่ (สถิติหน้าแรก) — แยกออกมา
 * เป็นฟังก์ชัน pure ล้วน (ไม่ต้องต่อ Supabase) เพื่อให้ทดสอบ logic การนับได้
 * โดยตรง แถวที่ไม่ได้ผูกหมวดหมู่ใดเลย (categorySlug เป็น "" หรือ null) จะไม่
 * ถูกนับเข้าหมวดใด แต่ยังนับรวมใน totalCount เสมอ (ตรงกับพฤติกรรมเดิมของ
 * CategorySection ที่แสดง "0 รายการ" สำหรับหมวดหมู่ที่ไม่มีงานวิจัยเลย)
 */
export function buildResearchCategoryStats(
  categorySlugs: (string | null)[]
): { totalCount: number; countByCategoryId: Record<string, number> } {
  const countByCategoryId: Record<string, number> = {};
  for (const slug of categorySlugs) {
    if (!slug) continue;
    countByCategoryId[slug] = (countByCategoryId[slug] ?? 0) + 1;
  }
  return { totalCount: categorySlugs.length, countByCategoryId };
}

/**
 * สถิติงานวิจัยสำหรับหน้าแรก (จำนวนรวม + จำนวนต่อหมวดหมู่) — ใช้แทนที่การเรียก
 * getPublishedResearch() แบบเต็มรูปแบบสองจุดแยกกัน (เดิมอยู่ใน Hero.tsx เพื่อ
 * นับ .length และใน CategorySection.tsx เพื่อ filter+.length ต่อหมวดหมู่)
 * ด้วย query เดียวที่ดึงเฉพาะ id + หมวดหมู่ที่ผูกไว้ (ดู
 * fetchPublishedResearchCategoryLinkRows ใน queries.ts) ให้ผลลัพธ์การนับ
 * เหมือนเดิมทุกประการ เพียงคำนวณครั้งเดียวแทนที่จะแยกกันสองที่ — cache ข้าม
 * request/ผู้ใช้ผ่าน unstable_cache (tag: public-research, public-home) ดู
 * หมายเหตุเรื่อง RLS ที่คอมเมนต์เหนือ getLatestResearch() ด้านบน (จำนวนรวม/
 * ต่อหมวดหมู่ที่นับได้จะเป็นมุมมองของผู้เยี่ยมชมทั่วไปเสมอ ไม่รวมงานวิจัยระดับ
 * member_only/staff_only แม้ผู้ดูจะ login อยู่ก็ตาม)
 */
async function fetchPublishedResearchStatsFromDb(): Promise<{
  totalCount: number;
  countByCategoryId: Record<string, number>;
}> {
  const supabase = createPublicClient();
  const rows = await fetchPublishedResearchCategoryLinkRows(supabase);
  return buildResearchCategoryStats(
    rows.map((row) => row.research_categories[0]?.categories?.slug ?? null)
  );
}

const getCachedPublishedResearchStats = unstable_cache(
  fetchPublishedResearchStatsFromDb,
  ["public-research-stats"],
  { tags: [PUBLIC_RESEARCH_TAG, PUBLIC_HOME_TAG], revalidate: PUBLIC_HOME_REVALIDATE_SECONDS }
);

export async function getPublishedResearchStats(): Promise<{
  totalCount: number;
  countByCategoryId: Record<string, number>;
}> {
  if (!isSupabaseConfigured()) {
    const items = mockData.getPublishedResearch();
    return buildResearchCategoryStats(items.map((item) => item.categoryId));
  }
  return getCachedPublishedResearchStats();
}

export async function getRelatedResearch(
  item: ResearchItem,
  limit = 3
): Promise<ResearchItem[]> {
  const items = await getPublishedResearch();
  return items
    .filter((r) => r.id !== item.id && r.categoryId === item.categoryId)
    .slice(0, limit);
}
