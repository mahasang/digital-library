import { fitText, wrapText } from "@/components/home/shelf/shelfMath";
import type { Cloth } from "@/components/home/shelf/bookGeometry";
import type { ShelfBook } from "@/components/home/shelf/types";

export interface CoverSize {
  width: number;
  height: number;
  /** ความกว้างที่ขอจาก /_next/image ต้องเป็นค่าที่ Next อนุญาต */
  requestWidth: number;
}

export const SHELF_COVER: CoverSize = { width: 512, height: 720, requestWidth: 640 };
export const INSPECT_COVER: CoverSize = { width: 1024, height: 1440, requestWidth: 1080 };

const SPINE_WIDTH = 128;
const SPINE_HEIGHT = 1024;

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  return { canvas, context };
}

/** next/font ตั้งชื่อฟอนต์แบบ hash ต้องอ่านจาก CSS variable และรอโหลดก่อนวาด */
export async function resolveFontFamilies(): Promise<string> {
  const styles = getComputedStyle(document.body);
  const thai = styles.getPropertyValue("--font-noto-thai").trim();
  const lao = styles.getPropertyValue("--font-noto-lao").trim();
  const family = [thai, lao, "sans-serif"].filter(Boolean).join(", ");

  await Promise.allSettled([
    document.fonts.load(`600 32px ${thai || "sans-serif"}`, "กขAa"),
    document.fonts.load(`400 32px ${thai || "sans-serif"}`, "กขAa"),
    document.fonts.load(`600 32px ${lao || "sans-serif"}`, "ກຂ"),
  ]);
  return family;
}

/**
 * พื้นผิวสันมีขนาดคงที่ แต่สันแต่ละเล่มหนาไม่เท่ากัน จึงบีบแกน X ตอนวาดให้ตัวอักษร
 * กลับมาสัดส่วนปกติเมื่อแปะบนเล่ม ข้อความหมุนทั้งบรรทัดเพื่อให้สระและวรรณยุกต์อยู่ถูกที่
 */
export function drawSpine(
  book: ShelfBook,
  cloth: Cloth,
  fonts: string,
  dimensions: { height: number; thickness: number },
): HTMLCanvasElement {
  const { canvas, context } = createCanvas(SPINE_WIDTH, SPINE_HEIGHT);
  const logicalWidth = SPINE_HEIGHT * (dimensions.thickness / dimensions.height);
  context.scale(SPINE_WIDTH / logicalWidth, 1);

  context.fillStyle = cloth.base;
  context.fillRect(0, 0, logicalWidth, SPINE_HEIGHT);

  context.fillStyle = cloth.foil;
  context.globalAlpha = 0.55;
  [46, 54, SPINE_HEIGHT - 56, SPINE_HEIGHT - 48].forEach((y) =>
    context.fillRect(0, y, logicalWidth, 2),
  );
  context.globalAlpha = 1;

  const margin = 84;
  const yearSpace = 92;
  const available = SPINE_HEIGHT - margin * 2 - yearSpace;
  const fontSize = Math.min(Math.max(logicalWidth * 0.46, 26), 52);

  context.save();
  context.translate(logicalWidth / 2, margin);
  context.rotate(Math.PI / 2);
  context.textBaseline = "middle";
  context.fillStyle = cloth.foil;

  context.font = `600 ${fontSize}px ${fonts}`;
  const title = fitText(book.title, available, (value) => context.measureText(value).width);
  context.fillText(title, 0, 0);

  context.font = `400 ${fontSize * 0.68}px ${fonts}`;
  context.textAlign = "right";
  context.fillText(String(book.year), SPINE_HEIGHT - margin * 2, 0);
  context.restore();

  return canvas;
}

/** ปกเรียงพิมพ์สำหรับเล่มที่ไม่มีปกจริง โครงเดียวกับ CategoryCover */
export function drawCover(
  book: ShelfBook,
  cloth: Cloth,
  fonts: string,
  size: CoverSize,
): HTMLCanvasElement {
  const { width, height } = size;
  const { canvas, context } = createCanvas(width, height);
  const unit = width / 512;

  context.fillStyle = cloth.base;
  context.fillRect(0, 0, width, height);
  context.fillStyle = cloth.deep;
  context.fillRect(0, 0, 30 * unit, height);

  const left = 58 * unit;
  const right = width - 28 * unit;
  context.strokeStyle = cloth.foil;
  context.globalAlpha = 0.4;
  context.lineWidth = 2 * unit;
  context.strokeRect(left, 28 * unit, right - left, height - 56 * unit);
  context.globalAlpha = 1;

  const textLeft = left + 30 * unit;
  const textWidth = right - left - 60 * unit;
  const measure = (value: string) => context.measureText(value).width;

  context.fillStyle = cloth.foil;
  context.textBaseline = "top";

  context.font = `400 ${20 * unit}px ${fonts}`;
  context.fillText(fitText(book.categoryName, textWidth, measure), textLeft, 62 * unit);

  const titleSize = 40 * unit;
  const lineHeight = titleSize * 1.5;
  context.font = `600 ${titleSize}px ${fonts}`;
  wrapText(book.title, textWidth, 6, measure).forEach((line, index) => {
    context.fillText(line, textLeft, 132 * unit + index * lineHeight);
  });

  context.font = `400 ${20 * unit}px ${fonts}`;
  context.textBaseline = "bottom";
  context.fillText(fitText(book.authors, textWidth, measure), textLeft, height - 92 * unit);
  context.fillText(String(book.year), textLeft, height - 58 * unit);

  return canvas;
}

/** โหลดผ่าน image optimizer จึงเป็น same-origin ไม่ขึ้นกับ CORS ของต้นทาง และได้รูปที่ย่อแล้ว */
export async function loadCover(url: string, size: CoverSize): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = `/_next/image?url=${encodeURIComponent(url)}&w=${size.requestWidth}&q=75`;
  await image.decode();

  const { canvas, context } = createCanvas(size.width, size.height);
  const scale = Math.max(size.width / image.naturalWidth, size.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (size.width - drawWidth) / 2,
    (size.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas;
}
