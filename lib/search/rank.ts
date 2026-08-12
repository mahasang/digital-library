/**
 * Utility กลางสำหรับ validate/normalize ค่าที่ใช้จัดลำดับผลค้นหา (relevance
 * rank, views, downloads ฯลฯ) และตัดสินลำดับแบบ deterministic เสมอ — ใช้ร่วมกัน
 * ทุกเส้นทางค้นหาในระบบ (lib/data/research-search.server.ts ที่ต่อ Supabase
 * จริง และ lib/search.ts ที่เป็น fallback สำหรับโหมด Mock Data)
 *
 * แก้ finding M-1 (docs/production-readiness-report.md): เดิม comparator ใน
 * finalizeResults() ใช้ MATCH_SOURCE_RELEVANCE[a.matchSource] ตรงๆ โดยไม่มี
 * ด่านตรวจสอบว่าค่าที่ได้เป็นตัวเลขจำกัดจริง (undefined จาก key ที่ไม่รู้จัก
 * จะทำให้ `relB - relA` กลายเป็น NaN — ECMAScript ไม่ได้นิยามพฤติกรรมของ
 * Array.prototype.sort() เมื่อ comparator คืนค่า NaN จึงเรียงลำดับไม่แน่นอน)
 * และไม่มีตัวตัดสินลำดับสุดท้ายที่ไม่ซ้ำกัน (id) ทำให้รายการที่คะแนน/วันที่
 * เผยแพร่เท่ากันเรียงลำดับต่างกันได้ระหว่างคำขอ (Postgres ไม่การันตีลำดับแถว
 * โดยไม่มี ORDER BY) กระทบทั้งความคาดเดาได้ของผลลัพธ์และความคงที่ของ pagination
 */

export type Comparator<T> = (a: T, b: T) => number;

/**
 * ตรวจสอบว่าค่าที่ได้รับมาเป็นตัวเลขจำกัดจริง (ไม่ใช่ null/undefined/NaN/
 * Infinity/-Infinity/string/ชนิดอื่นใด) แล้วคืนค่านั้นตรงๆ ถ้าใช่ มิเช่นนั้นคืน
 * ค่า fallback ที่กำหนด — **ไม่พยายาม parse หรือ cast string เป็นตัวเลข**
 * (เช่น ไม่ใช้ `Number(value)`) เพราะนั่นคือการซ่อนข้อมูลผิดปกติ ไม่ใช่การ
 * ป้องกัน ค่าที่ไม่ใช่ตัวเลขจำกัดถือว่า "ไม่รู้จัก" เสมอและตกไปใช้ fallback
 */
export function normalizeRank(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** ไล่เทียบ comparator ทีละตัวตามลำดับ (primary -> secondary -> tertiary ...)
 * คืนผลลัพธ์ของตัวแรกที่ไม่เท่ากับ 0 — ใช้ประกอบ comparator หลายชั้นให้เรียง
 * ลำดับแบบ deterministic เสมอ ตราบใดที่ comparator ตัวสุดท้ายในสายไม่มีทาง
 * คืนค่า 0 ได้เลย (เช่น compareByIdAsc ด้านล่าง ซึ่งอิงคีย์ที่ไม่ซ้ำกัน) */
export function chainComparators<T>(...comparators: Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

/** เรียงจากวันที่เผยแพร่ใหม่สุดไปเก่าสุด — ใช้ string comparison ตรงๆ (ISO 8601
 * เรียงตามตัวอักษรได้ผลเหมือนเรียงตามเวลาจริงอยู่แล้ว) รายการที่ยังไม่เผยแพร่
 * (publishedAt เป็น "" ตาม lib/data/mappers.ts) จะเรียงไปอยู่ท้ายสุดเสมอ
 * เพราะ "" น้อยกว่าทุก ISO date string ตามหลัก lexicographic — พฤติกรรมนี้
 * เกิดขึ้นเฉพาะกับ librarian/admin/super_admin หรือเจ้าของงานที่เห็นรายการ
 * ที่ยังไม่เผยแพร่ผ่าน RLS เท่านั้น (ผู้อ่านทั่วไปไม่เห็นรายการเหล่านี้อยู่แล้ว) */
export function compareByPublishedAtDesc<T extends { publishedAt: string }>(
  a: T,
  b: T
): number {
  if (a.publishedAt === b.publishedAt) return 0;
  return a.publishedAt < b.publishedAt ? 1 : -1;
}

export function compareByPublishedAtAsc<T extends { publishedAt: string }>(
  a: T,
  b: T
): number {
  return -compareByPublishedAtDesc(a, b);
}

/**
 * ตัวตัดสินลำดับสุดท้ายเสมอในทุกสายการเรียงลำดับของระบบค้นหา — รับประกันว่า
 * ลำดับผลลัพธ์ไม่ขึ้นกับลำดับที่ฐานข้อมูล/RPC คืนแถวมา (Postgres ไม่การันตี
 * ลำดับแถวโดยไม่มี ORDER BY แม้จะยิง query เดิมซ้ำก็ตาม) ทำให้ pagination
 * ข้ามคำขอคงที่จริง — ใช้ `id` (คือ `slug` ของ research_items ซึ่งมี unique
 * constraint ในฐานข้อมูล) เป็นคีย์ตัดสิน ไม่มีทางคืนค่า 0 ระหว่างสองรายการที่
 * ต่างกันได้เลย ตราบใดที่ id ไม่ซ้ำกัน
 */
export function compareByIdAsc<T extends { id: string }>(a: T, b: T): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
