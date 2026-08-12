import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * รายการไฟล์ทดสอบสำหรับ Controlled OCR Test (ช่วงที่ 32) — ไฟล์ทั้งหมดอยู่ใต้
 * public/ocr-test-fixtures/ **ไม่เป็นความลับ ไม่ใช่เอกสารงานวิจัยจริง** ห้าม
 * เพิ่มไฟล์ที่มีข้อมูลอ่อนไหวลงในโฟลเดอร์นี้เด็ดขาด (เสิร์ฟเป็น static asset
 * สาธารณะ)
 *
 * `available: false` = ยังไม่มีไฟล์จริงอยู่ในระบบ (ต้องให้ผู้ดูแลนำไฟล์มาวางเอง
 * ก่อนถึงจะเลือกทดสอบได้ — ดู docs/ocr-provider-validation.md) **ไม่มีการ
 * fallback ไปใช้ fixture อื่นแทนเงียบๆ เด็ดขาด** เพื่อไม่ให้ผลทดสอบดูเหมือนผ่าน
 * ทั้งที่ยังไม่ได้ทดสอบภาษาที่ต้องการจริง
 */
export interface OcrTestFixture {
  name: string;
  label: string;
  description: string;
  relativePath: string;
  available: boolean;
}

const FIXTURES_DIR = path.join(process.cwd(), "public", "ocr-test-fixtures");

const FIXTURE_DEFS: Omit<OcrTestFixture, "available">[] = [
  {
    name: "english-sample",
    label: "PDF ภาษาอังกฤษ",
    description: "เอกสารตัวอย่างภาษาอังกฤษหน้าเดียว มีข้อความจริงในไฟล์อยู่แล้ว",
    relativePath: "english-sample.pdf",
  },
  {
    name: "multipage-sample",
    label: "PDF หลายหน้า",
    description: "เอกสารตัวอย่าง 3 หน้า ทดสอบ progress ระดับหน้าและการรวมข้อความหลายหน้า",
    relativePath: "multipage-sample.pdf",
  },
  {
    name: "no-text-scanned-sample",
    label: "PDF ไม่มีข้อความ (จำลองไฟล์สแกน)",
    description:
      "หน้าเปล่าไม่มี text layer เลย — ทดสอบเส้นทาง \"ไม่พบข้อความ\" ที่นำไปสู่ OCR (ไม่ใช่ภาพสแกนจริง แค่ไม่มีข้อความให้ดึงเหมือนไฟล์สแกนจริง)",
    relativePath: "no-text-scanned-sample.pdf",
  },
  {
    name: "thai-sample",
    label: "PDF ภาษาไทย",
    description:
      "ยังไม่มีไฟล์ในระบบ — ต้องให้ผู้ดูแลนำไฟล์ PDF ภาษาไทยที่ไม่เป็นความลับมาวางที่ public/ocr-test-fixtures/thai-sample.pdf เอง (ดู docs/ocr-provider-validation.md)",
    relativePath: "thai-sample.pdf",
  },
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listOcrTestFixtures(): Promise<OcrTestFixture[]> {
  return Promise.all(
    FIXTURE_DEFS.map(async (def) => ({
      ...def,
      available: await fileExists(path.join(FIXTURES_DIR, def.relativePath)),
    }))
  );
}

export async function getOcrTestFixture(name: string): Promise<OcrTestFixture | null> {
  const def = FIXTURE_DEFS.find((f) => f.name === name);
  if (!def) return null;
  const available = await fileExists(path.join(FIXTURES_DIR, def.relativePath));
  return { ...def, available };
}

/** อ่านไฟล์ fixture จริงเป็น Buffer — throw ถ้าไม่พบไฟล์ (ผู้เรียกต้องตรวจ
 * available ก่อนเรียกฟังก์ชันนี้เสมอ) */
export async function readOcrTestFixtureBuffer(name: string): Promise<Buffer> {
  const fixture = await getOcrTestFixture(name);
  if (!fixture || !fixture.available) {
    throw new Error(`OCR test fixture "${name}" ไม่พร้อมใช้งาน`);
  }
  return readFile(path.join(FIXTURES_DIR, fixture.relativePath));
}
