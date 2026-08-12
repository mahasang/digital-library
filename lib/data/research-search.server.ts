import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchPublishedResearchRows } from "@/lib/data/queries";
import { mapRowToResearchItem } from "@/lib/data/mappers";
import { getPublishedResearch as getMockPublishedResearch } from "@/data/research";
import { searchResearch, sortOptions as bibliographicSortOptions } from "@/lib/search";
import {
  normalizeRank,
  chainComparators,
  compareByPublishedAtAsc,
  compareByPublishedAtDesc,
  compareByIdAsc,
} from "@/lib/search/rank";
import type { AccessLevel, ResearchItem } from "@/types/research";
import type { SortOption } from "@/lib/search";

/**
 * ค้นหางานวิจัยฝั่งเซิร์ฟเวอร์ทั้งหมด — รวมค้นหาข้อมูลบรรณานุกรม (ชื่อเรื่อง/
 * ผู้วิจัย/คำสำคัญ/บทคัดย่อ) และเนื้อหาภายในไฟล์ PDF ที่ดึงข้อความไว้แล้ว
 * (research_document_texts) เข้าด้วยกัน — แทนที่ lib/search.ts เดิมที่กรอง
 * ฝั่ง Client ล้วนๆ (ไม่ปลอดภัยพอสำหรับเนื้อหา PDF ที่ต้องตรวจสิทธิ์ก่อนเสมอ)
 *
 * ทุก query ที่นี่ผ่าน Supabase query builder เท่านั้น (parameterized โดย
 * PostgREST เอง ไม่มีการต่อ SQL string ดิบที่ไหนเลย) และใช้ user-scoped client
 * (createClient() จาก cookies) เสมอ — RLS ของ research_items/
 * research_document_texts จึงบังคับสิทธิ์การเข้าถึงจริงที่ระดับฐานข้อมูล ไม่ใช่
 * แค่กรองในโค้ดแอป (ดู supabase/migrations/20260807100000_pdf_fulltext_search.sql)
 */

export type SearchMode = "bibliographic" | "pdf" | "all";
export type MatchSource = "title" | "researcher" | "keyword" | "abstract" | "pdf" | null;

export interface ResearchSearchParams {
  query?: string;
  mode?: SearchMode;
  categoryId?: string; // จริงๆ คือ category slug (ตั้งชื่อให้ตรงกับ ResearchFilters เดิม)
  year?: number;
  accessLevel?: AccessLevel;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface ResearchSearchResultItem extends ResearchItem {
  matchSource: MatchSource;
  snippet: string | null;
  snippetMatchStart: number | null;
  snippetMatchEnd: number | null;
  /** true เมื่อ snippet มาจากข้อความที่ได้จาก OCR (อาจคลาดเคลื่อนกว่าข้อความที่คัดลอกได้จริง) */
  isOcrMatch: boolean;
}

export interface ResearchSearchResult {
  items: ResearchSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  years: number[];
}

const DEFAULT_PAGE_SIZE = 20;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const SNIPPET_RADIUS = 120;

/** ตัดอักขระที่มีความหมายพิเศษใน PostgREST filter DSL ออก (comma/parens/percent)
 * — ป้องกัน filter injection ในระดับ syntax ของ PostgREST เอง (การ escape ค่า
 * จริงลง SQL ยังคงทำโดย PostgREST/parameterized query เสมออยู่แล้ว) ใช้รูปแบบ
 * เดียวกับ lib/data/queries.ts (searchManagementResearchRows) */
function sanitizeForFilter(raw: string): string {
  return raw.replace(/[,()%]/g, " ").trim();
}

function isValidQueryLength(q: string): boolean {
  return q.length >= MIN_QUERY_LENGTH && q.length <= MAX_QUERY_LENGTH;
}

const MATCH_SOURCE_RELEVANCE: Record<Exclude<MatchSource, null>, number> = {
  title: 4,
  researcher: 3,
  keyword: 3,
  abstract: 2,
  pdf: 1,
};

/** คะแนนความเกี่ยวข้อง (relevance rank) ของผลลัพธ์หนึ่งรายการ — ผ่าน
 * normalizeRank() เสมอ กัน finding M-1: ถ้า matchSource เป็นค่าที่ไม่มีอยู่ใน
 * MATCH_SOURCE_RELEVANCE (เช่น เพิ่ม MatchSource ใหม่ในอนาคตแล้วลืมอัปเดต
 * ตารางนี้) การ index ตรงๆ จะได้ `undefined` ซึ่งทำให้ `relB - relA` กลายเป็น
 * NaN และ Array.prototype.sort() มีพฤติกรรมไม่แน่นอนตามสเปก — ฟังก์ชันนี้คืน
 * ค่า 0 (คะแนนต่ำสุดเท่าที่เป็นไปได้ในระบบนี้ ไม่มี matchSource ใดคะแนนต่ำกว่า
 * 0) แทนเสมอในกรณีนั้น — exported เฉพาะเพื่อให้ unit test ยืนยันพฤติกรรมนี้
 * ได้ตรงๆ (ดู lib/data/research-search.pagination.test.ts) */
export function relevanceOf(item: { matchSource: MatchSource }): number {
  if (!item.matchSource) return 0;
  return normalizeRank(MATCH_SOURCE_RELEVANCE[item.matchSource], 0);
}

interface CandidateMatch {
  matchSource: MatchSource;
  snippet: string | null;
  snippetMatchStart: number | null;
  snippetMatchEnd: number | null;
  isOcrMatch?: boolean;
}

/** หาตำแหน่ง query ใน text (case-insensitive) แล้วตัดช่วงรอบๆ ออกมาเป็น snippet
 * สั้นๆ พร้อมตำแหน่งเริ่ม/จบของคำที่ตรงกัน (สำหรับไฮไลต์ฝั่ง UI) — ใช้ text ตัว
 * เต็ม (ไม่ใช่ normalized ที่ยุบช่องว่างแล้ว) เพื่อคง index ให้ตรงกับต้นฉบับ
 * ไม่ใช้ regex กับ query ดิบเพื่อกัน ReDoS/อักขระพิเศษ ใช้ indexOf ธรรมดา */
function buildSnippet(fullText: string, rawQuery: string): {
  snippet: string;
  matchStart: number;
  matchEnd: number;
} | null {
  const lowerText = fullText.toLowerCase();
  const lowerQuery = rawQuery.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return null;

  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(fullText.length, idx + lowerQuery.length + SNIPPET_RADIUS);

  const prefix = start > 0 ? "…" : "";
  const suffix = end < fullText.length ? "…" : "";
  const snippet = prefix + fullText.slice(start, end).trim() + suffix;

  const matchStart = idx - start + prefix.length;
  const matchEnd = matchStart + rawQuery.length;

  return { snippet, matchStart, matchEnd };
}

export async function searchResearchServer(
  params: ResearchSearchParams
): Promise<ResearchSearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const mode = params.mode ?? "all";
  const rawQuery = (params.query ?? "").trim();
  const hasValidQuery = rawQuery.length > 0 && isValidQueryLength(rawQuery);

  if (!isSupabaseConfigured()) {
    // โหมดไม่มี Supabase (Mock Data) — ค้นหาเนื้อหา PDF ทำไม่ได้เพราะไม่มี
    // ฐานข้อมูลจริง คงพฤติกรรมเดิมของ lib/search.ts ไว้ (บรรณานุกรมเท่านั้น)
    const mockItems = getMockPublishedResearch();
    const filtered = searchResearch(mockItems, {
      query: rawQuery,
      categoryId: params.categoryId,
      year: params.year,
      sort: params.sort,
    }).filter((item) => !params.accessLevel || item.accessLevel === params.accessLevel);
    const years = Array.from(new Set(mockItems.map((i) => i.year))).sort((a, b) => b - a);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize).map((item) => ({
      ...item,
      matchSource: null,
      snippet: null,
      snippetMatchStart: null,
      snippetMatchEnd: null,
      isOcrMatch: false,
    }));
    return {
      items: pageItems,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      years,
    };
  }

  const supabase = await createClient();

  // งานวิจัย published ทั้งหมดที่ผู้ใช้ปัจจุบันมองเห็นได้ (RLS บังคับสิทธิ์แล้ว)
  // หมายเหตุสำคัญ: ResearchItem.id ที่ mapRowToResearchItem คืนมาคือ "slug"
  // (ใช้ทำ URL สาธารณะ /research/[slug] ไม่ใช่ uuid จริง) แต่
  // research_document_texts.research_item_id คือ uuid จริงของ research_items
  // เสมอ — itemById จึงต้อง key ด้วย row.id (uuid จริงจาก RawResearchRow) ไม่ใช่
  // item.id (slug) มิเช่นนั้นผลค้นหาเนื้อหา PDF จะจับคู่กับ ResearchItem ไม่ได้
  // เลยสักรายการ (เทียบ key คนละชนิดกัน)
  const rows = await fetchPublishedResearchRows(supabase);
  const allItems = rows.map(mapRowToResearchItem);
  const itemById = new Map(rows.map((row, index) => [row.id, allItems[index]]));
  const years = Array.from(new Set(allItems.map((i) => i.year))).sort((a, b) => b - a);

  if (!rawQuery) {
    // ไม่มีคำค้นหา — เดิมทีคือแค่เรียกดู/กรองตามหมวดหมู่-ปี-เรียงลำดับ (พฤติกรรม
    // เดิมก่อนมีฟีเจอร์นี้ คงไว้ทุกประการ) — matchSource เป็น null เสมอในเคสนี้
    // จึงไม่ต้องสนใจว่า candidates ใช้ key ชนิดไหน (ผูก uuid ให้ถูกต้องไว้เผื่ออนาคต)
    const candidates = new Map<string, CandidateMatch>();
    const pairs = rows.map((row, index) => ({ item: allItems[index], uuid: row.id }));
    for (const { uuid } of pairs) {
      candidates.set(uuid, { matchSource: null, snippet: null, snippetMatchStart: null, snippetMatchEnd: null });
    }
    return finalizeResults(pairs, candidates, params, page, pageSize, years);
  }

  if (!hasValidQuery) {
    // คำค้นหาสั้น/ยาวผิดปกติเกินไป — ไม่รันคำค้นหาจริง (กันของหนักฐานข้อมูล
    // โดยไม่จำเป็น) ถือว่าไม่พบผลลัพธ์แทนการ error ให้ผู้ใช้สับสน
    return { items: [], total: 0, page, pageSize, totalPages: 0, years };
  }

  const candidates = new Map<string, CandidateMatch>();
  const safe = sanitizeForFilter(rawQuery);

  if (safe && (mode === "bibliographic" || mode === "all")) {
    await collectBibliographicMatches(supabase, safe, candidates);
  }

  if (mode === "pdf" || mode === "all") {
    await collectPdfMatches(supabase, rawQuery, candidates);
  }

  // เก็บคู่ (item, uuid) ไว้เสมอ — candidates ถูก key ด้วย uuid จริงเท่านั้น
  // (ทั้งจาก research_items.id ตรงๆ และจาก research_document_texts.research_item_id)
  // ถ้าใช้ item.id (slug) มาค้นใน candidates ใน finalizeResults จะไม่เจอ match
  // เลยสักรายการเหมือนบั๊กเดิมที่เพิ่งแก้ที่ itemById
  const matchedPairs = Array.from(candidates.keys())
    .map((uuid) => {
      const item = itemById.get(uuid);
      return item ? { item, uuid } : null;
    })
    .filter((pair): pair is { item: ResearchItem; uuid: string } => Boolean(pair));

  return finalizeResults(matchedPairs, candidates, params, page, pageSize, years);
}

async function collectBibliographicMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  safeQuery: string,
  candidates: Map<string, CandidateMatch>
): Promise<void> {
  const { data: directRows } = await supabase
    .from("research_items")
    .select("id, title_th, title_en, abstract")
    .eq("status", "published")
    .or(`title_th.ilike.%${safeQuery}%,title_en.ilike.%${safeQuery}%,abstract.ilike.%${safeQuery}%`);

  const lowerQuery = safeQuery.toLowerCase();
  for (const row of directRows ?? []) {
    const inTitle =
      (row.title_th && row.title_th.toLowerCase().includes(lowerQuery)) ||
      (row.title_en && row.title_en.toLowerCase().includes(lowerQuery));
    candidates.set(row.id, {
      matchSource: inTitle ? "title" : "abstract",
      snippet: null,
      snippetMatchStart: null,
      snippetMatchEnd: null,
    });
  }

  const { data: keywordRowsRaw } = await supabase
    .from("keywords")
    .select("id, research_keywords ( research_id )")
    .ilike("keyword", `%${safeQuery}%`);
  const keywordRows = (keywordRowsRaw ?? []) as unknown as {
    id: string;
    research_keywords: { research_id: string }[];
  }[];

  for (const kw of keywordRows) {
    for (const rk of kw.research_keywords ?? []) {
      if (!candidates.has(rk.research_id)) {
        candidates.set(rk.research_id, {
          matchSource: "keyword",
          snippet: null,
          snippetMatchStart: null,
          snippetMatchEnd: null,
        });
      }
    }
  }

  const { data: authorRowsRaw } = await supabase
    .from("authors")
    .select("id, research_authors ( research_id )")
    .ilike("name", `%${safeQuery}%`);
  const authorRows = (authorRowsRaw ?? []) as unknown as {
    id: string;
    research_authors: { research_id: string }[];
  }[];

  for (const author of authorRows) {
    for (const ra of author.research_authors ?? []) {
      if (!candidates.has(ra.research_id)) {
        candidates.set(ra.research_id, {
          matchSource: "researcher",
          snippet: null,
          snippetMatchStart: null,
          snippetMatchEnd: null,
        });
      }
    }
  }
}

async function collectPdfMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  candidates: Map<string, CandidateMatch>
): Promise<void> {
  const normalizedQuery = sanitizeForFilter(rawQuery.toLowerCase());
  if (!normalizedQuery) return;

  // เรียกผ่าน RPC (security definer) แทนการ select ตรงจาก
  // research_document_texts เสมอ — คืนค่าเฉพาะ "ช่วงข้อความรอบจุดที่ตรงคำค้นหา"
  // (ไม่เกิน ~2000 ตัวอักษร) ไม่ใช่เนื้อหาทั้งไฟล์ ฟังก์ชันทวนสอบเงื่อนไขการ
  // มองเห็นแถวเดียวกับ RLS policy ของตารางนี้ด้วยตนเองทุกประการ (แก้ finding
  // C-1 ใน docs/production-readiness-report.md — ดูรายละเอียดใน migration
  // 20260822100000_restrict_document_text_exposure.sql) buildSnippet() ด้านล่าง
  // ทำงานกับ excerpt ที่ได้เหมือนเดิมทุกประการ ไม่ต้องแก้ไข เพราะรัศมี excerpt
  // (1000 ตัวอักษร) มากกว่ารัศมี snippet จริง (120 ตัวอักษร) เสมอ
  const { data, error } = await supabase.rpc("search_research_document_excerpts", {
    p_raw_query: rawQuery,
    p_normalized_query: normalizedQuery,
  });

  if (error) {
    console.error("collectPdfMatches: ค้นหาเนื้อหา PDF ไม่สำเร็จ:", error.message);
    return;
  }

  const rows = data ?? [];

  // ให้สิทธิ์ข้อความปกติมาก่อนเสมอถ้าเจอทั้งสองทาง (แม่นยำกว่า OCR) — คงลำดับ
  // ประมวลผลเดิม (extracted ก่อน ocr) ไว้ทุกประการ แม้ตอนนี้ทั้งสองทางมาจาก
  // RPC เดียวกันแล้วก็ตาม
  for (const row of rows) {
    if (row.is_ocr) continue;
    // ข้ามถ้าเจอทางบรรณานุกรมไปแล้ว (ให้ผลลัพธ์บรรณานุกรมมีความสำคัญกว่าเสมอ
    // ตามที่โจทย์กำหนด "เรียงตามความเกี่ยวข้องก่อน") ไม่ต้องมี match ซ้ำสองทาง
    if (candidates.has(row.research_item_id)) continue;
    if (!row.excerpt) continue;

    const built = buildSnippet(row.excerpt, rawQuery);
    candidates.set(row.research_item_id, {
      matchSource: "pdf",
      snippet: built?.snippet ?? null,
      snippetMatchStart: built?.matchStart ?? null,
      snippetMatchEnd: built?.matchEnd ?? null,
      isOcrMatch: false,
    });
  }

  for (const row of rows) {
    if (!row.is_ocr) continue;
    if (candidates.has(row.research_item_id)) continue;
    if (!row.excerpt) continue;

    const built = buildSnippet(row.excerpt, rawQuery);
    candidates.set(row.research_item_id, {
      matchSource: "pdf",
      snippet: built?.snippet ?? null,
      snippetMatchStart: built?.matchStart ?? null,
      snippetMatchEnd: built?.matchEnd ?? null,
      isOcrMatch: true,
    });
  }
}

/** exported เฉพาะเพื่อให้ unit test เรียกทดสอบ pagination/sorting ได้ตรงๆ โดย
 * ไม่ต้องพึ่ง Supabase/Next.js request context (ดู
 * lib/data/research-search.pagination.test.ts) — พฤติกรรมเดิมไม่เปลี่ยนแปลง */
export function finalizeResults(
  pairs: { item: ResearchItem; uuid: string }[],
  candidates: Map<string, CandidateMatch>,
  params: ResearchSearchParams,
  page: number,
  pageSize: number,
  years: number[]
): ResearchSearchResult {
  let filtered = pairs;

  if (params.categoryId && params.categoryId !== "all") {
    filtered = filtered.filter(({ item }) => item.categoryId === params.categoryId);
  }
  if (params.year) {
    filtered = filtered.filter(({ item }) => item.year === params.year);
  }
  if (params.accessLevel) {
    filtered = filtered.filter(({ item }) => item.accessLevel === params.accessLevel);
  }

  const enriched: ResearchSearchResultItem[] = filtered.map(({ item, uuid }) => {
    const match = candidates.get(uuid);
    return {
      ...item,
      matchSource: match?.matchSource ?? null,
      snippet: match?.snippet ?? null,
      snippetMatchStart: match?.snippetMatchStart ?? null,
      snippetMatchEnd: match?.snippetMatchEnd ?? null,
      isOcrMatch: match?.isOcrMatch ?? false,
    };
  });

  const hasQuery = enriched.some((item) => item.matchSource !== null);
  const sort = params.sort ?? "newest";

  // ทุกสาย comparator ปิดท้ายด้วย compareByIdAsc เสมอ (ตัวตัดสินสุดท้ายที่ไม่
  // ซ้ำกัน) — กัน finding M-1: เดิมไม่มีตัวตัดสินลำดับที่ไม่ซ้ำกันเลย ทำให้
  // รายการที่ relevance/วันที่เผยแพร่เท่ากันเรียงลำดับไม่คงที่ข้ามคำขอ (Postgres
  // ไม่การันตีลำดับแถวที่คืนมาโดยไม่มี ORDER BY) กระทบทั้งความคาดเดาได้ของผล
  // ค้นหาและความคงที่ของ pagination — ดู docs/production-readiness-report.md
  const comparator = hasQuery
    ? chainComparators<ResearchSearchResultItem>(
        (a, b) => relevanceOf(b) - relevanceOf(a),
        compareByPublishedAtDesc,
        compareByIdAsc
      )
    : chainComparators<ResearchSearchResultItem>(
        (a, b) => applySortComparator(a, b, sort),
        compareByPublishedAtDesc,
        compareByIdAsc
      );

  enriched.sort(comparator);

  const total = enriched.length;
  const start = (page - 1) * pageSize;
  const pageItems = enriched.slice(start, start + pageSize);

  return {
    items: pageItems,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    years,
  };
}

/** ตัวเปรียบเทียบหลัก (primary) ต่อ sort option หนึ่งค่า — ยังไม่มีตัวตัดสิน
 * รอง/สุดท้ายในตัวเอง เรียกผ่าน chainComparators() เสมอที่ finalizeResults()
 * เพื่อต่อ compareByPublishedAtDesc + compareByIdAsc เป็นตัวตัดสินเมื่อเสมอกัน
 * — `views`/`downloads` ผ่าน normalizeRank() เสมอ (กัน finding M-1 กรณีค่าจาก
 * ฐานข้อมูลผิดปกติ แม้คอลัมน์จะเป็น `bigint not null default 0` อยู่แล้วก็ตาม
 * เป็นการป้องกันสองชั้น ไม่ใช่การ cast ปิดบังปัญหา — ค่าที่ไม่ใช่ตัวเลขจำกัด
 * จริงจะถูกมองเป็น 0 อย่างชัดเจนแทนที่จะปล่อยให้คำนวณต่อจนได้ NaN) */
function applySortComparator(a: ResearchItem, b: ResearchItem, sort: SortOption): number {
  switch (sort) {
    case "oldest":
      return compareByPublishedAtAsc(a, b);
    case "popular":
      return normalizeRank(b.views, 0) - normalizeRank(a.views, 0);
    case "downloads":
      return normalizeRank(b.downloads, 0) - normalizeRank(a.downloads, 0);
    case "title":
      return a.titleTh.localeCompare(b.titleTh, "th");
    case "newest":
    default:
      return compareByPublishedAtDesc(a, b);
  }
}

export { bibliographicSortOptions as sortOptions };
