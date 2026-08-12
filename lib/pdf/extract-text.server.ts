import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * ดึงข้อความจากไฟล์ PDF ฝั่งเซิร์ฟเวอร์ด้วย pdfjs-dist (ตัวเดียวกับที่ใช้แสดงผล
 * หน้าอ่านแบบ flipbook อยู่แล้ว — ไม่เพิ่ม dependency ใหม่) ใช้ legacy Node build
 * (`pdfjs-dist/legacy/build/pdf.mjs`) ซึ่งออกแบบมาให้ทำงานนอกเบราว์เซอร์โดยเฉพาะ
 * (ไม่ต้องพึ่ง DOM/Canvas) — รองรับเฉพาะ PDF ที่มีข้อความเลือก/คัดลอกได้จริง
 * (text layer) เอกสารสแกนเป็นรูปภาพล้วนจะได้ข้อความว่างเปล่า (ดู
 * docs/pdf-full-text-search.md หัวข้อ OCR)
 */

const PDFJS_DIST_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist");

/** จำนวนตัวอักษรสูงสุดที่เก็บต่อเอกสาร — กันเอกสารขนาดใหญ่ผิดปกติกิน storage/
 * เวลาค้นหาเกินจำเป็น (เอกสารวิชาการทั่วไปไม่เกินนี้อยู่แล้วแม้จะหลายร้อยหน้า) */
export const MAX_EXTRACTED_TEXT_LENGTH = 2_000_000;

export type ExtractionOutcome =
  | { status: "completed"; text: string }
  | { status: "no_text_found" }
  | { status: "failed"; error: string };

/** ยุบช่องว่าง/บรรทัดซ้ำและแปลงเป็นตัวพิมพ์เล็ก สำหรับคอลัมน์
 * extracted_text_normalized ที่ใช้ค้นหาแบบ substring/trigram ให้สม่ำเสมอ —
 * ไม่ตัดคำภาษาไทยใดๆ (ไม่จำเป็นสำหรับการค้นหาแบบ substring) */
export function normalizeExtractedText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** นับจำนวนหน้า PDF โดยไม่ดึงข้อความ — ใช้ path การโหลด pdfjs เดียวกับ
 * extractPdfText() ทุกประการ (ไม่เพิ่ม dependency ใหม่) คืน null หากเปิดไฟล์
 * ไม่สำเร็จ (ผู้เรียกต้อง fail-closed เมื่อได้ null ไม่ใช่ถือว่าผ่าน) */
export async function getPdfPageCount(buffer: Buffer): Promise<number | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(PDFJS_DIST_DIR, "legacy", "build", "pdf.worker.mjs")
    ).href;

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      standardFontDataUrl: pathToFileURL(path.join(PDFJS_DIST_DIR, "standard_fonts") + path.sep).href,
      cMapUrl: pathToFileURL(path.join(PDFJS_DIST_DIR, "cmaps") + path.sep).href,
      cMapPacked: true,
    });

    const doc = await loadingTask.promise;
    try {
      return doc.numPages;
    } finally {
      await doc.destroy();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("getPdfPageCount: เปิดไฟล์ PDF เพื่อนับจำนวนหน้าไม่สำเร็จ:", message);
    return null;
  }
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractionOutcome> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(PDFJS_DIST_DIR, "legacy", "build", "pdf.worker.mjs")
    ).href;

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      standardFontDataUrl: pathToFileURL(path.join(PDFJS_DIST_DIR, "standard_fonts") + path.sep).href,
      cMapUrl: pathToFileURL(path.join(PDFJS_DIST_DIR, "cmaps") + path.sep).href,
      cMapPacked: true,
    });

    const doc = await loadingTask.promise;
    const pageTexts: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
          pageTexts.push(pageText);
        } finally {
          page.cleanup();
        }

        // หยุดดึงเพิ่มทันทีที่เกินขีดจำกัด กันเอกสารขนาดใหญ่ผิดปกติใช้เวลา/
        // หน่วยความจำเกินจำเป็น — เอกสารจริงที่ใหญ่ขนาดนี้แทบไม่มีในทางปฏิบัติ
        if (pageTexts.join("").length > MAX_EXTRACTED_TEXT_LENGTH) break;
      }
    } finally {
      await doc.destroy();
    }

    const fullText = pageTexts.join("\n").trim();

    if (!fullText) {
      return { status: "no_text_found" };
    }

    return {
      status: "completed",
      text: fullText.length > MAX_EXTRACTED_TEXT_LENGTH
        ? fullText.slice(0, MAX_EXTRACTED_TEXT_LENGTH)
        : fullText,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("extractPdfText: ดึงข้อความจาก PDF ไม่สำเร็จ:", message);
    return {
      status: "failed",
      error: "ไม่สามารถประมวลผลไฟล์ PDF เพื่อดึงข้อความได้",
    };
  }
}
