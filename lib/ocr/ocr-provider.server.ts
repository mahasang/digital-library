import "server-only";
import { getSettings } from "@/lib/data/settings.server";

/**
 * OCR สำหรับ PDF ที่เป็นเอกสารสแกน (ไม่มี text layer ให้ดึงตรงๆ) — abstraction
 * แบบเดียวกับ lib/security/malware-scanner.server.ts (เลือก provider ผ่าน
 * Environment Variable, ไม่ตัดสินใจเอง แค่คืนผลลัพธ์ดิบให้ผู้เรียกจัดการ)
 *
 * **ไม่มี "โหมดจำลอง" (mock mode) ให้ข้อความ/progress ปลอมเมื่อไม่ได้ตั้งค่า
 * provider หรือ provider รายงานหน้าปัจจุบันไม่ได้** — ตามข้อกำหนดเดิมทุกประการ
 * (ช่วงที่ 23) ขยายเพิ่มในช่วงที่ 29, เปลี่ยนชื่อ/รวม environment variable
 * ในช่วงที่ 32 (ดูหัวข้อ 1 ของ docs/ocr-operations.md)
 *
 * รองรับ 2 รูปแบบ provider ผ่าน `OCR_PROVIDER`:
 *   - `"self_hosted"` (เดิมชื่อ `"http"` ก่อนช่วงที่ 32) — synchronous เดียว
 *     POST แล้วรอผลลัพธ์สุดท้ายกลับมาในคำตอบเดียวกันเลย ไม่รองรับ progress
 *     ระดับหน้าโดยธรรมชาติ (เป็น blocking call เดียว ไม่มีจังหวะให้รายงาน
 *     สถานะระหว่างทาง)
 *   - `"external_api"` (ช่วงที่ 29) — async submit แล้ว poll สถานะแยกต่างหาก
 *     จำลองรูปแบบที่ OCR API เชิงพาณิชย์ส่วนใหญ่ใช้จริง (ส่งงาน → ได้ job id
 *     กลับมา → poll สถานะจนกว่าจะเสร็จ) รองรับ progress ระดับหน้าได้ **ถ้า
 *     provider จริงรายงานมาให้** (current_page/total_pages ใน response) —
 *     ถ้า provider จริงไม่ส่งมา ระบบจะไม่เดา/สร้างตัวเลขปลอมเด็ดขาด แสดงแค่
 *     ข้อความสถานะทั่วไปแทน
 *   - `"none"` (ค่าเริ่มต้นถ้าไม่ตั้งค่า) — ไม่มี provider ใดๆ
 *
 * ดู docs/ocr-operations.md สำหรับสัญญา (contract) แบบเต็มของทั้งสอง provider
 * และตัวอย่างการตั้งค่า self-hosted แบบไม่เสียค่าใช้จ่าย
 */

export type OcrProviderKind = "self_hosted" | "external_api";

function getProviderKind(): OcrProviderKind | null {
  const raw = process.env.OCR_PROVIDER;
  if (raw === "self_hosted" || raw === "external_api") return raw;
  return null; // ครอบคลุมทั้ง "none", ค่าว่าง, และค่าอื่นที่ไม่รู้จัก
}

/** เปิดเผย kind ที่ตั้งค่าไว้ให้โค้ดอื่นใช้ได้ (เช่น การตรวจนโยบายเอกสาร private
 * ใน lib/ocr/ocr-limits.server.ts และหน้า Readiness Check) — คืน `null` เมื่อ
 * ไม่ได้ตั้งค่าหรือค่าไม่ถูกต้อง เหมือน getProviderKind() ภายในไฟล์นี้ */
export function getConfiguredProviderKind(): OcrProviderKind | null {
  return getProviderKind();
}

export function isOcrConfigured(): boolean {
  const kind = getProviderKind();
  if (!kind) return false;
  return Boolean(process.env.OCR_PROVIDER_BASE_URL);
}

/** สวิตช์หลักระดับ environment (ช่วงที่ 32 — เดิมชื่อ
 * `isExternalOcrTransferAllowed()`/`OCR_ALLOW_EXTERNAL_TRANSFER` ก่อนหน้านี้)
 * ต้องตั้งค่าเป็น "true" อย่างชัดเจนเท่านั้นถึงจะยอมให้ระบบเรียก OCR provider
 * จริง ไม่ว่า provider จะเป็น self-hosted ในเครือข่ายเดียวกันหรือภายนอกก็ตาม
 * — เป็นการตัดสินใจเชิงนโยบายระดับองค์กร (เปิดใช้งาน OCR จริงหรือยัง) แยกจาก
 * "ตั้งค่า provider ไว้แล้วหรือยัง" (isOcrConfigured) โดยเจตนา */
export function isOcrEnabled(): boolean {
  return process.env.OCR_ENABLED === "true";
}

/** ใช้เฉพาะ provider แบบ external_api เท่านั้น (ช่วงที่ 32) — เอกสารที่ระดับ
 * การเข้าถึงไม่ใช่ "public" (ผ่าน settings.ocrAllowedAccessLevels ของ DB มา
 * แล้วชั้นหนึ่ง) ต้องได้รับอนุมัติเพิ่มอีกชั้นก่อนจะส่งไปยังผู้ให้บริการภายนอก
 * โดยเฉพาะ — self_hosted ไม่ตรวจเงื่อนไขนี้ (ถือว่าอยู่ในโครงสร้างพื้นฐานของ
 * องค์กรเอง) ดู lib/ocr/ocr-limits.server.ts สำหรับจุดที่ใช้ค่านี้จริง
 * (ตรวจตอน pre-flight เท่านั้น เหมือน ocrAllowedAccessLevels เดิม) */
export function isPrivateDocumentTransferAllowed(): boolean {
  return process.env.OCR_ALLOW_PRIVATE_DOCUMENTS === "true";
}

/** เปิดใช้ Controlled OCR Test (ช่วงที่ 32, ดูหัวข้อ 3 ของ docs/ocr-operations.md)
 * — ตั้งใจให้เป็นอิสระจาก isOcrEnabled() เพื่อให้ตรวจสอบ provider ได้ก่อนเปิด
 * ใช้งานจริงกับผู้ใช้ทั่วไป */
export function isOcrTestModeEnabled(): boolean {
  return process.env.OCR_TEST_MODE === "true";
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;

/** timeout ต่อคำขอ HTTP หนึ่งครั้งไปยัง provider (ไม่ว่าจะเป็นคำขอ OCR เดียว
 * ของ self_hosted หรือคำขอ submit/poll แต่ละครั้งของ external_api) — ปรับได้
 * ผ่าน OCR_PROVIDER_TIMEOUT_MS (ช่วงที่ 32, เดิมเป็นค่าคงที่ในโค้ด 120000/30000
 * แยกตาม provider) จำกัดช่วง 5-300 วินาทีกันตั้งค่าที่สร้างปัญหาโดยไม่ตั้งใจ */
function getProviderTimeoutMs(): number {
  const raw = Number(process.env.OCR_PROVIDER_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(raw)));
}

export interface OcrEnvLimits {
  maxFileSizeMb: number | null;
  maxPages: number | null;
  maxJobsPerDay: number | null;
}

/** เพดานสูงสุดจาก environment variable (ช่วงที่ 32) — `null` ต่อฟิลด์เมื่อไม่ได้
 * ตั้งค่า (ไม่มีเพดานจาก env ในกรณีนั้น ใช้แค่ค่าจาก Settings ของ DB อย่างเดียว
 * เหมือนช่วงที่ 27) ค่าจริงที่ใช้บังคับคือ min(เพดาน env, ค่าที่ Super Admin ตั้ง
 * ไว้ใน DB) เสมอ ดู lib/ocr/ocr-limits.server.ts */
export function getOcrEnvLimits(): OcrEnvLimits {
  const parse = (raw: string | undefined): number | null => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    maxFileSizeMb: parse(process.env.OCR_MAX_FILE_SIZE_MB),
    maxPages: parse(process.env.OCR_MAX_PAGES),
    maxJobsPerDay: parse(process.env.OCR_MAX_JOBS_PER_DAY),
  };
}

const DEFAULT_LANGUAGES = "tha+eng";

/** จำนวนครั้งสูงสุดที่งาน OCR requeue ตัวเองเพื่อ poll สถานะได้ (เฉพาะ
 * provider แบบ async) — การ requeue นับเป็น attempt ผ่าน claim_background_jobs
 * เดิมเหมือน bulk_enqueue (ดู docs/background-jobs.md หัวข้อ 11.4) ตั้งสูงไว้
 * มาก (ไม่ใช่ค่าประมาณที่แม่นยำ แค่กันไม่ให้เอกสารที่ใช้เวลานานถูกตัดเข้า DLQ
 * ก่อนเวลาอันควรทั้งที่ยังทำงานปกติอยู่ — ที่ poll ทุก 10 วินาที ค่านี้เผื่อเวลา
 * ได้ประมาณ 20 นาที) provider แบบ self_hosted (synchronous) ไม่เคย requeue
 * เลยจึงไม่ได้ใช้ค่านี้จริง แต่ใช้ค่าเดียวกันกับทุกงาน ocr_processing/
 * ocr_test_run เพื่อความเรียบง่าย */
export const OCR_JOB_MAX_ATTEMPTS = 120;

/** ระยะเวลาระหว่างรอบ poll สถานะจาก external_api provider */
export const OCR_POLL_DELAY_MS = 10_000;

export type OcrSubmitResult =
  | { status: "completed"; provider: string; text: string; confidence?: number | null; language?: string }
  | { status: "processing"; provider: string; externalJobId: string; totalPages?: number | null }
  | { status: "blocked"; provider: string; error: string }
  | { status: "failed"; provider: string; error: string };

export type OcrPollResult =
  | { status: "processing"; currentPage?: number | null; totalPages?: number | null }
  | { status: "completed"; text: string; confidence?: number | null; language?: string }
  | { status: "failed"; error: string };

/**
 * สัญญา (contract) ของ provider แบบ `"self_hosted"` (ไม่เปลี่ยนจากช่วงที่ 23 —
 * เปลี่ยนแค่ชื่อ environment variable ในช่วงที่ 32):
 *   POST {OCR_PROVIDER_BASE_URL}
 *   Header: Authorization: Bearer {OCR_PROVIDER_API_KEY} (ถ้าตั้งค่าไว้)
 *   Body: multipart/form-data ฟิลด์ "file" (ไฟล์ PDF ต้นฉบับ) + "languages"
 *   Response (JSON): { "text": string, "confidence"?: number, "language"?: string }
 */
async function submitSelfHosted(buffer: Buffer, filename: string): Promise<OcrSubmitResult> {
  const apiUrl = process.env.OCR_PROVIDER_BASE_URL ?? "";
  const apiKey = process.env.OCR_PROVIDER_API_KEY;
  const languages = process.env.OCR_LANGUAGES || DEFAULT_LANGUAGES;
  const provider = `self_hosted:${new URL(apiUrl).host}`;

  try {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(buffer)]), filename);
    form.set("languages", languages);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getProviderTimeoutMs());
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.error(`submitSelfHosted: ${provider} ตอบกลับ HTTP ${response.status}`);
      return { status: "failed", provider, error: `บริการ OCR ตอบกลับ HTTP ${response.status}` };
    }

    const data = (await response.json()) as { text?: string; confidence?: number; language?: string };
    if (typeof data.text !== "string") {
      console.error(`submitSelfHosted: ${provider} ตอบกลับรูปแบบไม่คาดคิด`);
      return { status: "failed", provider, error: "รูปแบบผลลัพธ์จากบริการ OCR ไม่ถูกต้อง" };
    }

    return {
      status: "completed",
      provider,
      text: data.text,
      confidence: typeof data.confidence === "number" ? data.confidence : null,
      language: data.language || languages,
    };
  } catch (error) {
    console.error(`submitSelfHosted: เรียก ${provider} ไม่สำเร็จ:`, error instanceof Error ? error.message : error);
    return { status: "failed", provider, error: "เรียกบริการ OCR ไม่สำเร็จ" };
  }
}

/**
 * สัญญา (contract) ของ provider แบบ `"external_api"` (ช่วงที่ 29) — แบบ async
 * submit + poll ทั่วไป จำลองรูปแบบที่ผู้ให้บริการ OCR เชิงพาณิชย์ส่วนใหญ่ใช้
 * จริง (แนบไว้เพื่อให้ทดสอบ/นำไปปรับใช้กับ provider จริงได้ ไม่ใช่ SDK ของผู้
 * ให้บริการรายใดรายหนึ่งโดยเฉพาะ) — เปลี่ยนแค่ชื่อ environment variable ใน
 * ช่วงที่ 32:
 *
 *   POST {OCR_PROVIDER_BASE_URL}/jobs
 *   Header: Authorization: Bearer {OCR_PROVIDER_API_KEY} (ถ้าตั้งค่าไว้)
 *   Body: multipart/form-data ฟิลด์ "file" + "languages"
 *   Response 202 (JSON): { "job_id": string, "total_pages"?: number }
 *
 *   GET {OCR_PROVIDER_BASE_URL}/jobs/{job_id}
 *   Header: Authorization: Bearer {OCR_PROVIDER_API_KEY}
 *   Response (JSON): {
 *     "status": "processing" | "completed" | "failed",
 *     "current_page"?: number, "total_pages"?: number,
 *     "text"?: string, "confidence"?: number, "language"?: string,
 *     "error"?: string
 *   }
 */
async function submitExternalApi(buffer: Buffer, filename: string): Promise<OcrSubmitResult> {
  const apiUrl = process.env.OCR_PROVIDER_BASE_URL ?? "";
  const apiKey = process.env.OCR_PROVIDER_API_KEY;
  const languages = process.env.OCR_LANGUAGES || DEFAULT_LANGUAGES;
  const provider = `external_api:${new URL(apiUrl).host}`;

  try {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(buffer)]), filename);
    form.set("languages", languages);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getProviderTimeoutMs());
    const response = await fetch(`${apiUrl}/jobs`, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.error(`submitExternalApi: ${provider} ตอบกลับ HTTP ${response.status}`);
      return { status: "failed", provider, error: `บริการ OCR ตอบกลับ HTTP ${response.status}` };
    }

    const data = (await response.json()) as { job_id?: string; total_pages?: number };
    if (typeof data.job_id !== "string" || !data.job_id) {
      console.error(`submitExternalApi: ${provider} ไม่คืน job_id`);
      return { status: "failed", provider, error: "รูปแบบผลลัพธ์จากบริการ OCR ไม่ถูกต้อง" };
    }

    return {
      status: "processing",
      provider,
      externalJobId: data.job_id,
      totalPages: typeof data.total_pages === "number" ? data.total_pages : null,
    };
  } catch (error) {
    console.error(
      `submitExternalApi: เรียก ${provider} ไม่สำเร็จ:`,
      error instanceof Error ? error.message : error
    );
    return { status: "failed", provider, error: "เรียกบริการ OCR ไม่สำเร็จ" };
  }
}

async function pollExternalApi(externalJobId: string): Promise<OcrPollResult> {
  const apiUrl = process.env.OCR_PROVIDER_BASE_URL ?? "";
  const apiKey = process.env.OCR_PROVIDER_API_KEY;
  const languages = process.env.OCR_LANGUAGES || DEFAULT_LANGUAGES;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getProviderTimeoutMs());
    const response = await fetch(`${apiUrl}/jobs/${encodeURIComponent(externalJobId)}`, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.error(`pollExternalApi: ตอบกลับ HTTP ${response.status}`);
      return { status: "failed", error: `บริการ OCR ตอบกลับ HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      status?: string;
      current_page?: number;
      total_pages?: number;
      text?: string;
      confidence?: number;
      language?: string;
      error?: string;
    };

    if (data.status === "processing") {
      return {
        status: "processing",
        currentPage: typeof data.current_page === "number" ? data.current_page : null,
        totalPages: typeof data.total_pages === "number" ? data.total_pages : null,
      };
    }

    if (data.status === "completed") {
      if (typeof data.text !== "string") {
        console.error("pollExternalApi: ตอบกลับ completed แต่ไม่มี text");
        return { status: "failed", error: "รูปแบบผลลัพธ์จากบริการ OCR ไม่ถูกต้อง" };
      }
      return {
        status: "completed",
        text: data.text,
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        language: data.language || languages,
      };
    }

    return { status: "failed", error: data.error || "OCR ไม่สำเร็จ" };
  } catch (error) {
    console.error("pollExternalApi: เรียกไม่สำเร็จ:", error instanceof Error ? error.message : error);
    return { status: "failed", error: "ตรวจสอบสถานะบริการ OCR ไม่สำเร็จ" };
  }
}

async function dispatchToProvider(kind: OcrProviderKind, buffer: Buffer, filename: string): Promise<OcrSubmitResult> {
  return kind === "self_hosted" ? submitSelfHosted(buffer, filename) : submitExternalApi(buffer, filename);
}

/**
 * จุดเรียกใช้งานหลักสำหรับ OCR จริง (ไม่ใช่ Controlled Test — ดู submitOcrTest()
 * ด้านล่าง) — ตรวจสอบการตั้งค่า/การเปิดใช้งานระดับ environment/สวิตช์ระดับ
 * ฐานข้อมูลก่อนเสมอ **ไม่มีโหมดจำลองที่คืนข้อความปลอม** — ไม่พร้อมด้วยเหตุผลใด
 * ก็ตามจะคืนสถานะ `blocked` (ไม่ใช่ `failed`) พร้อมเหตุผลที่ปลอดภัยเสมอ ไม่มี
 * การเชื่อมต่อเครือข่ายเกิดขึ้นเลยในกรณีนี้ (เงื่อนไขเกี่ยวกับระดับการเข้าถึง
 * เอกสาร/เอกสาร private ตรวจล่วงหน้าที่ checkOcrEligibility() เท่านั้น ไม่ซ้ำ
 * ที่นี่ เพราะฟังก์ชันนี้ไม่รู้ระดับการเข้าถึงของเอกสาร — เหมือน
 * ocrAllowedAccessLevels เดิมตั้งแต่ช่วงที่ 27)
 */
export async function submitOcr(buffer: Buffer, filename: string): Promise<OcrSubmitResult> {
  const kind = getProviderKind();

  if (!kind || !isOcrConfigured()) {
    return {
      status: "blocked",
      provider: "none",
      error: "ยังไม่ได้ตั้งค่า OCR provider (OCR_PROVIDER/OCR_PROVIDER_BASE_URL) กรุณาติดต่อผู้ดูแลระบบ",
    };
  }

  if (!isOcrEnabled()) {
    return {
      status: "blocked",
      provider: kind,
      error: "องค์กรยังไม่ได้เปิดใช้งาน OCR (ตั้งค่า OCR_ENABLED=true เมื่อได้รับอนุมัติแล้ว)",
    };
  }

  const settings = await getSettings();
  if (!settings.ocrProviderEnabled) {
    return { status: "blocked", provider: kind, error: "ผู้ดูแลระบบปิดการใช้งาน OCR ไว้ชั่วคราว" };
  }

  return dispatchToProvider(kind, buffer, filename);
}

/**
 * จุดเรียกใช้งานสำหรับ Controlled OCR Test เท่านั้น (ช่วงที่ 32, ดูหัวข้อ 3 ของ
 * docs/ocr-operations.md) — ตรวจแค่ provider ตั้งค่าครบ + OCR_TEST_MODE=true
 * **ไม่ตรวจ OCR_ENABLED/settings.ocrProviderEnabled/นโยบายเอกสาร private**
 * เพราะไฟล์ทดสอบเป็นไฟล์ fixture ที่ไม่เป็นความลับโดยธรรมชาติเสมอ และ
 * จุดประสงค์ของโหมดนี้คือให้ตรวจสอบว่า provider ใช้งานได้จริงก่อนเปิดใช้งาน
 * จริงกับผู้ใช้ทั่วไป (OCR_ENABLED=false ก็ยังทดสอบได้)
 */
export async function submitOcrTest(buffer: Buffer, filename: string): Promise<OcrSubmitResult> {
  const kind = getProviderKind();

  if (!kind || !isOcrConfigured()) {
    return {
      status: "blocked",
      provider: "none",
      error: "ยังไม่ได้ตั้งค่า OCR provider (OCR_PROVIDER/OCR_PROVIDER_BASE_URL) กรุณาตั้งค่าก่อนทดสอบ",
    };
  }

  if (!isOcrTestModeEnabled()) {
    return {
      status: "blocked",
      provider: kind,
      error: "โหมดทดสอบ OCR ยังไม่ได้เปิดใช้งาน (ตั้งค่า OCR_TEST_MODE=true)",
    };
  }

  return dispatchToProvider(kind, buffer, filename);
}

/** ตรวจสอบสถานะงานที่ submit ไปแล้วแบบ async — ใช้ได้เฉพาะกับ provider ที่
 * submitOcr()/submitOcrTest() คืน externalJobId มาให้เท่านั้น (ปัจจุบันมีแค่
 * external_api) ใช้ร่วมกันทั้งเส้นทาง OCR จริงและ Controlled Test เพราะเป็นแค่
 * การตรวจสอบสถานะงานที่ provider รับไปแล้ว ไม่มีเงื่อนไขนโยบายเพิ่มเติม */
export async function pollOcrStatus(externalJobId: string): Promise<OcrPollResult> {
  const kind = getProviderKind();
  if (kind !== "external_api") {
    console.error("pollOcrStatus: เรียกกับ provider ที่ไม่รองรับการ poll:", kind);
    return { status: "failed", error: "ไม่รองรับการตรวจสอบสถานะสำหรับ provider นี้" };
  }
  return pollExternalApi(externalJobId);
}

export interface OcrConnectivityCheckResult {
  reachable: boolean;
  /** ข้อความสั้นๆ ที่ sanitize แล้วเท่านั้น — ไม่มี URL/error ดิบของ provider */
  detail: string;
  checkedAt: string;
}

/**
 * ตรวจสอบว่าเข้าถึง endpoint ที่ตั้งค่าไว้ได้หรือไม่ (ช่วงที่ 32, ปุ่ม
 * "ตรวจสอบการเชื่อมต่อ" ที่ /superadmin/ocr) — **ไม่ส่งไฟล์ ไม่สร้าง OCR job
 * ไม่เรียก endpoint OCR จริง (POST /jobs เป็นต้น)** แค่ยิง GET ไปที่ base URL
 * เฉยๆ ด้วย timeout สั้น (5 วินาที) แล้วดูว่าได้ response กลับมาหรือไม่ —
 * **response ใดก็ตาม (2xx-5xx) ถือว่า "เชื่อมต่อได้"** (เซิร์ฟเวอร์ตอบกลับจริง
 * พอร์ต/TLS ใช้งานได้) ไม่ได้ยืนยันว่า endpoint ถูกต้องหรือ provider ทำงานถูก
 * — เฉพาะ network error/timeout เท่านั้นที่ถือว่า "เชื่อมต่อไม่ได้" (เหตุผล:
 * ไม่มีสัญญา health-check endpoint มาตรฐานที่ provider ทุกเจ้าต้องมี จึงไม่
 * บังคับ path เฉพาะ)
 */
export async function checkOcrProviderConnectivity(): Promise<OcrConnectivityCheckResult> {
  const checkedAt = new Date().toISOString();
  const kind = getProviderKind();

  if (!kind || !isOcrConfigured()) {
    return { reachable: false, detail: "ยังไม่ได้ตั้งค่า OCR provider", checkedAt };
  }

  const apiUrl = process.env.OCR_PROVIDER_BASE_URL ?? "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(apiUrl, { method: "GET", signal: controller.signal }).finally(() =>
      clearTimeout(timeout)
    );
    return { reachable: true, detail: `เชื่อมต่อ endpoint ได้ (HTTP ${response.status})`, checkedAt };
  } catch (error) {
    console.error(
      "checkOcrProviderConnectivity: เชื่อมต่อไม่สำเร็จ:",
      error instanceof Error ? error.message : error
    );
    return { reachable: false, detail: "เชื่อมต่อ endpoint ที่ตั้งค่าไว้ไม่ได้ (timeout หรือ network error)", checkedAt };
  }
}

export interface OcrConfigSummary {
  enabled: boolean;
  testModeEnabled: boolean;
  providerKind: OcrProviderKind | null;
  configured: boolean;
  /** มีค่าใน OCR_PROVIDER_BASE_URL หรือไม่ (ไม่ใช่ตัวค่าเอง) */
  baseUrlSet: boolean;
  /** มีค่าใน OCR_PROVIDER_API_KEY หรือไม่ (ไม่ใช่ตัวค่าเอง — ห้ามส่งค่าจริงไปที่ UI เด็ดขาด) */
  apiKeySet: boolean;
  timeoutMs: number;
  privateDocumentsAllowed: boolean;
  envLimits: OcrEnvLimits;
}

/** สรุปการตั้งค่า OCR ทั้งหมดสำหรับหน้า OCR Readiness Check (ช่วงที่ 32) —
 * เป็นค่า boolean/ตัวเลขที่ปลอดภัยเท่านั้น **ไม่มีค่า OCR_PROVIDER_BASE_URL/
 * OCR_PROVIDER_API_KEY จริงหลุดออกไปเลย** (แค่บอกว่า "ตั้งค่าไว้หรือไม่")
 * รวม process.env access ของหน้านี้ไว้จุดเดียวแทนกระจายอยู่ใน page.tsx ตรงๆ */
export function getOcrConfigSummary(): OcrConfigSummary {
  return {
    enabled: isOcrEnabled(),
    testModeEnabled: isOcrTestModeEnabled(),
    providerKind: getProviderKind(),
    configured: isOcrConfigured(),
    baseUrlSet: Boolean(process.env.OCR_PROVIDER_BASE_URL),
    apiKeySet: Boolean(process.env.OCR_PROVIDER_API_KEY),
    timeoutMs: getProviderTimeoutMs(),
    privateDocumentsAllowed: isPrivateDocumentTransferAllowed(),
    envLimits: getOcrEnvLimits(),
  };
}
