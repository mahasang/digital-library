/**
 * ตรรกะล้วนของชั้นหนังสือ ไม่แตะ DOM หรือ WebGL เพื่อให้เทสต์ได้ใน node
 * หน่วยความยาวทั้งหมดเป็นหน่วยของ scene (ความสูงหนังสือราว 2 หน่วย)
 */

const ELLIPSIS = "…";
const CLICK_TOLERANCE_PX = 6;
const FRICTION_PER_FRAME = 0.92;
const FRAME_MS = 16;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** FNV-1a 32 บิต ให้ค่าเดิมทุกครั้งต่อ slug เดิม หนังสือจึงหน้าตาคงที่ทุกการโหลด */
export function seedFromSlug(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** ค่า 0–1 จาก seed แยกอิสระตาม salt */
function unitFromSeed(seed: number, salt: number): number {
  let value = Math.imul(seed ^ salt, 0x9e3779b1);
  value ^= value >>> 15;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) / 0xffffffff;
}

function inRange(min: number, max: number, unit: number): number {
  return min + (max - min) * unit;
}

export function bookDimensions(seed: number): { height: number; width: number; thickness: number } {
  return {
    height: inRange(1.9, 2.4, unitFromSeed(seed, 1)),
    width: inRange(1.35, 1.7, unitFromSeed(seed, 2)),
    thickness: inRange(0.16, 0.34, unitFromSeed(seed, 3)),
  };
}

export function clothIndex(seed: number, paletteSize: number): number {
  return seed % paletteSize;
}

export function layoutBooks(
  thicknesses: number[],
  gap = 0.02,
): { centers: number[]; totalWidth: number } {
  const centers: number[] = [];
  let cursor = 0;
  thicknesses.forEach((thickness, index) => {
    if (index > 0) cursor += gap;
    centers.push(cursor + thickness / 2);
    cursor += thickness;
  });
  return { centers, totalWidth: cursor };
}

export function clampOffset(offset: number, centers: number[]): number {
  if (centers.length === 0) return 0;
  return Math.min(Math.max(offset, centers[0]), centers[centers.length - 1]);
}

export function nearestIndex(offset: number, centers: number[]): number {
  let nearest = 0;
  centers.forEach((center, index) => {
    if (Math.abs(center - offset) < Math.abs(centers[nearest] - offset)) nearest = index;
  });
  return nearest;
}

export function stepIndex(index: number, delta: number, count: number): number {
  return Math.min(Math.max(index + delta, 0), Math.max(count - 1, 0));
}

/** คิดตามเวลาจริง ไม่ใช่จำนวนเฟรม ความเฉื่อยจึงเท่ากันทุกจอ */
export function decayVelocity(velocity: number, dtMs: number): number {
  return velocity * Math.pow(FRICTION_PER_FRAME, dtMs / FRAME_MS);
}

/** ล้อแนวตั้งต้องเลื่อนหน้าเว็บเสมอ ชั้นรับเฉพาะการเลื่อนแนวนอนเป็นหลัก */
export function shouldHandleWheel(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY);
}

export function isClick(dragPx: number): boolean {
  return dragPx <= CLICK_TOLERANCE_PX;
}

export function coverWindow(index: number, count: number, radius = 3): number[] {
  const first = Math.max(index - radius, 0);
  const last = Math.min(index + radius, count - 1);
  const indexes: number[] = [];
  for (let i = first; i <= last; i += 1) indexes.push(i);
  return indexes;
}

/** ตัดตามกลุ่มอักษร เพื่อไม่ให้สระหรือวรรณยุกต์ไทย/ลาวหลุดจากพยัญชนะ */
export function fitText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string {
  if (measure(text) <= maxWidth) return text;

  let fitted = "";
  for (const { segment } of graphemes.segment(text)) {
    if (measure(fitted + segment + ELLIPSIS) > maxWidth) break;
    fitted += segment;
  }
  return fitted.trimEnd() + ELLIPSIS;
}
