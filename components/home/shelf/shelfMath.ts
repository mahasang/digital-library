/**
 * ตรรกะล้วนของชั้นหนังสือ ไม่แตะ DOM หรือ WebGL เพื่อให้เทสต์ได้ใน node
 * หน่วยความยาวทั้งหมดเป็นหน่วยของ scene (ความสูงหนังสือราว 2 หน่วย)
 */

const ELLIPSIS = "…";
const CLICK_TOLERANCE_PX = 6;
const FRICTION_PER_FRAME = 0.92;
const FRAME_MS = 16;

/** สระหน้าของไทยและลาวอยู่คนละกลุ่มอักษรกับพยัญชนะที่ตามมา จึงต้องตัดทิ้งเมื่อค้างท้ายข้อความ */
const TRAILING_LEADING_VOWEL = /[เ-ไເ-ໄ]$/;

/**
 * สร้างตอนใช้งานเท่านั้น ไฟล์นี้อยู่ในเส้นทางโหลดแรกของหน้าแรก เบราว์เซอร์เก่าที่ไม่มี
 * Intl.Segmenter จึงต้องยังโหลดหน้าได้ แล้วถอยกลับเป็นรายการลิงก์เมื่อวาดปกไม่สำเร็จ
 */
function segment(text: string, granularity: "grapheme" | "word"): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity });
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

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
    thickness: inRange(0.26, 0.5, unitFromSeed(seed, 3)),
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

function trimToFit(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string {
  let fitted = "";
  for (const grapheme of segment(text, "grapheme")) {
    if (measure(fitted + grapheme + ELLIPSIS) > maxWidth) break;
    fitted += grapheme;
  }
  return fitted.replace(TRAILING_LEADING_VOWEL, "").trimEnd() + ELLIPSIS;
}

/** ตัดตามกลุ่มอักษร เพื่อไม่ให้สระหรือวรรณยุกต์ไทย/ลาวหลุดจากพยัญชนะ */
export function fitText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string {
  return measure(text) <= maxWidth ? text : trimToFit(text, maxWidth, measure);
}

/** ตัดบรรทัดตามคำ ภาษาไทยและลาวไม่มีช่องว่างจึงต้องใช้ตัวแบ่งคำของเบราว์เซอร์ */
export function wrapText(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (value: string) => number,
): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of segment(text, "word")) {
    if (measure(current + word) <= maxWidth) {
      current += word;
      continue;
    }
    if (current.trim()) lines.push(current.trimEnd());
    current = "";
    if (!word.trim()) continue;

    for (const grapheme of segment(word, "grapheme")) {
      if (current && measure(current + grapheme) > maxWidth) {
        lines.push(current);
        current = "";
      }
      current += grapheme;
    }
  }
  if (current.trim()) lines.push(current.trimEnd());

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] =
    measure(last + ELLIPSIS) <= maxWidth ? last + ELLIPSIS : trimToFit(last, maxWidth, measure);
  return kept;
}

/**
 * จำว่าแต่ละเล่มมีปกจริงความละเอียดระดับไหนแล้ว รูปโหลดเสร็จไม่เรียงลำดับ รูปเล็กที่มาทีหลัง
 * จึงต้องไม่ทับรูปใหญ่ และเมื่อมีปกจริงแล้วต้องไม่ย้อนกลับไปเป็นปกเรียงพิมพ์
 */
export function createCoverTracker() {
  const best = new Map<number, number>();
  return {
    needsTypeset: (book: number) => !best.has(book),
    accept(book: number, rank: number): boolean {
      if ((best.get(book) ?? 0) >= rank) return false;
      best.set(book, rank);
      return true;
    },
  };
}

const SPRING_STIFFNESS = 170;
const SPRING_DAMPING = 20;
const SPRING_STEP_MS = 8;

/** สปริงหน่วงเกินเป้าเล็กน้อยแบบของจริง แบ่งก้าวย่อยเพื่อให้นิ่งแม้เฟรมช้า */
export function springStep(
  value: number,
  velocity: number,
  target: number,
  dtMs: number,
): { value: number; velocity: number } {
  let nextValue = value;
  let nextVelocity = velocity;
  const steps = Math.max(1, Math.ceil(dtMs / SPRING_STEP_MS));
  const seconds = dtMs / steps / 1000;

  for (let step = 0; step < steps; step += 1) {
    const force = SPRING_STIFFNESS * (target - nextValue) - SPRING_DAMPING * nextVelocity;
    nextVelocity += force * seconds;
    nextValue += nextVelocity * seconds;
  }
  return { value: nextValue, velocity: nextVelocity };
}

function smoothstep(from: number, to: number, value: number): number {
  const progress = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return progress * progress * (3 - 2 * progress);
}

/** ดึงหนังสือเหมือนใช้มือ: เลื่อนออกจากชั้นก่อน แล้วค่อยหมุนปกเข้าหาคนดู */
export function pullPose(pull: number): { slide: number; turn: number; lift: number } {
  const clamped = Math.min(Math.max(pull, 0), 1);
  return {
    slide: smoothstep(0, 0.6, clamped),
    turn: smoothstep(0.2, 1, clamped),
    lift: Math.sin(Math.PI * clamped) * 0.05,
  };
}

const ENTRANCE_STAGGER_MS = 45;
const ENTRANCE_MS = 620;

/** หนังสือทยอยเข้าชั้นตอนเปิดหน้า order คือลำดับคิว เริ่มจาก 0 */
export function entranceProgress(elapsedMs: number, order: number): number {
  const progress = (elapsedMs - order * ENTRANCE_STAGGER_MS) / ENTRANCE_MS;
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

const MAX_LEAN = 0.06;

/** หนังสือเอนสวนทิศที่ชั้นเลื่อน speed มีหน่วยเป็นระยะของ scene ต่อมิลลิวินาที */
export function leanAngle(speed: number): number {
  return Math.min(Math.max(0 - speed * 4, -MAX_LEAN), MAX_LEAN);
}

/** เล่มที่ถูกดึงออกมาหันปกจึงกว้างขึ้น เล่มถัดไปต้องขยับหลบตามสัดส่วนการดึง */
export function spreadPositions(centers: number[], extras: number[], pulls: number[]): number[] {
  let shift = 0;
  return centers.map((center, index) => {
    const opened = extras[index] * pulls[index];
    const position = center + shift + opened / 2;
    shift += opened;
    return position;
  });
}

/** แปลง offset บนชั้นปกติเป็นตำแหน่งบนชั้นที่ถูกกระจายแล้ว */
export function focusPosition(offset: number, centers: number[], positions: number[]): number {
  if (centers.length === 0) return 0;
  const clamped = clampOffset(offset, centers);
  for (let i = 1; i < centers.length; i += 1) {
    if (clamped <= centers[i]) {
      const progress = (clamped - centers[i - 1]) / (centers[i] - centers[i - 1]);
      return positions[i - 1] + (positions[i] - positions[i - 1]) * progress;
    }
  }
  return positions[positions.length - 1];
}
