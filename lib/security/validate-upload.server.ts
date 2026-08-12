import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { validateFileSignature } from "@/lib/security/file-signature.server";
import {
  scanFileForMalware,
  isMalwareScanRequired,
  type ScanStatus,
} from "@/lib/security/malware-scanner.server";
import {
  PDF_ALLOWED_TYPES,
  COVER_ALLOWED_TYPES,
  ATTACHMENT_ALLOWED_TYPES,
} from "@/lib/storage/limits";

/**
 * ตรวจสอบไฟล์ที่อัปโหลดใหม่ (ก่อน insert/update แถว research_items เสมอ) —
 * ดาวน์โหลดไฟล์ที่เพิ่งอัปโหลดกลับมาตรวจ magic-byte เสมอ (เร็ว ทำในหน่วยความจำ
 * ไม่มีความเสี่ยง timeout) หากไม่ผ่านจะลบไฟล์ออกจาก Storage ทันทีและไม่มีการ
 * สร้าง/แก้ไขแถว research_items เกิดขึ้น (ดู docs/file-security.md หัวข้อ 2)
 *
 * **ตั้งแต่ช่วงที่ 20**: ไฟล์ PDF หลัก (`pdf`) จะ **ไม่สแกนมัลแวร์แบบ synchronous
 * ที่นี่อีกต่อไป** — magic-byte ผ่านก็ถือว่าอัปโหลดผ่าน แล้วคืน scan:
 * { scanStatus: "pending" } ให้ผู้เรียกบันทึกแถวด้วยสถานะ "รอสแกน" และสั่ง
 * enqueue background job (`file_security_rescan`) แยกต่างหาก — ป้องกัน provider
 * สแกนช้า/ไฟล์ใหญ่ทำให้คำขออัปโหลดติด Serverless timeout (ดู
 * docs/background-jobs.md) แถวที่ scan_status = "pending" ถูกบล็อกไม่ให้เผยแพร่/
 * สร้าง Signed URL จนกว่า background job จะสแกนเสร็จ (ดู migration
 * 20260810100000_background_jobs.sql)
 *
 * ไฟล์ภาพปก/เอกสารแนบ (`cover`/`attachment`) ยังคงสแกนมัลแวร์แบบ synchronous
 * เหมือนเดิม (ไฟล์เล็ก สแกนเร็ว ความเสี่ยง timeout ต่ำ ไม่คุ้มความซับซ้อนที่เพิ่ม
 * ขึ้นจากการทำ async ทั้งหมด)
 */

type ValidatedBucket = "research-documents" | "research-covers" | "submission-attachments";
type SubmissionField = "pdf" | "cover" | "attachment";

export interface FileScanRecord {
  scanStatus: ScanStatus | "pending";
  scanProvider: string;
  scanReason: string | null;
  scannedAt: string;
}

interface ValidateFileTarget {
  field: SubmissionField;
  bucket: ValidatedBucket;
  path: string;
  allowedTypes: readonly string[];
  /** true เฉพาะฟิลด์ pdf — ข้ามการสแกนมัลแวร์ตรงนี้ ไปสแกนแบบ async แทน */
  deferMalwareScan?: boolean;
}

type ValidateFileResult =
  | { ok: true; scan: FileScanRecord }
  | { ok: false; reason: string; logReason: string };

async function validateAndScanFile({
  bucket,
  path,
  allowedTypes,
  deferMalwareScan,
}: ValidateFileTarget): Promise<ValidateFileResult> {
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      reason: "ระบบตรวจสอบไฟล์ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
      logReason: "SUPABASE_SERVICE_ROLE_KEY ไม่ได้ตั้งค่า จึงตรวจสอบไฟล์ไม่ได้",
    };
  }

  const service = createServiceRoleClient();
  const { data: blob, error: downloadError } = await service.storage
    .from(bucket)
    .download(path);

  if (downloadError || !blob) {
    console.error(
      `validateAndScanFile: ดาวน์โหลด ${bucket}/${path} ไม่สำเร็จ:`,
      downloadError?.message
    );
    return {
      ok: false,
      reason: "ไม่พบไฟล์ที่อัปโหลด กรุณาอัปโหลดใหม่อีกครั้ง",
      logReason: "ดาวน์โหลดไฟล์ที่เพิ่งอัปโหลดกลับมาตรวจสอบไม่สำเร็จ",
    };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const declaredMimeType = blob.type || "application/octet-stream";

  const signatureResult = validateFileSignature(
    new Uint8Array(buffer),
    declaredMimeType,
    allowedTypes
  );
  if (!signatureResult.ok) {
    return {
      ok: false,
      reason:
        "ไฟล์ที่อัปโหลดไม่ผ่านการตรวจสอบชนิดไฟล์ กรุณาตรวจสอบว่าไฟล์ไม่เสียหายและเป็นชนิดที่ระบบรองรับจริง",
      logReason: signatureResult.reason ?? "signature mismatch",
    };
  }

  if (deferMalwareScan) {
    return {
      ok: true,
      scan: {
        scanStatus: "pending",
        scanProvider: "queued",
        scanReason: null,
        scannedAt: new Date().toISOString(),
      },
    };
  }

  const filename = path.split("/").pop() ?? path;
  const scanOutcome = await scanFileForMalware(buffer, filename);

  if (scanOutcome.status === "infected") {
    return {
      ok: false,
      reason: "ระบบตรวจพบความเสี่ยงด้านความปลอดภัยในไฟล์ที่อัปโหลด ไม่สามารถบันทึกได้",
      logReason: `malware detected (${scanOutcome.provider}): ${scanOutcome.reason ?? ""}`,
    };
  }

  if (scanOutcome.status === "error" && isMalwareScanRequired()) {
    return {
      ok: false,
      reason: "ระบบตรวจสอบไฟล์ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง หรือติดต่อผู้ดูแลระบบ",
      logReason: `scanner unavailable/error (${scanOutcome.provider}): ${scanOutcome.reason ?? ""}`,
    };
  }

  return {
    ok: true,
    scan: {
      scanStatus: scanOutcome.status,
      scanProvider: scanOutcome.provider,
      scanReason: scanOutcome.reason ?? null,
      scannedAt: new Date().toISOString(),
    },
  };
}

async function cleanupUploadedFiles(
  files: Array<{ bucket: ValidatedBucket; path: string }>
): Promise<void> {
  if (!isServiceRoleConfigured() || files.length === 0) return;
  const service = createServiceRoleClient();
  await Promise.all(
    files.map(async ({ bucket, path }) => {
      const { error } = await service.storage.from(bucket).remove([path]);
      if (error) {
        console.error(`cleanupUploadedFiles: ลบ ${bucket}/${path} ไม่สำเร็จ:`, error.message);
      }
    })
  );
}

export interface SubmissionFileScans {
  pdf?: FileScanRecord;
  cover?: FileScanRecord;
  attachment?: FileScanRecord;
}

export type ValidateSubmissionFilesResult =
  | { ok: true; scans: SubmissionFileScans }
  | { ok: false; message: string; logReason: string; field: SubmissionField };

/**
 * ตรวจสอบไฟล์ทั้งหมดที่ "อัปโหลดใหม่จริง" ในการส่ง/แก้ไขงานวิจัยครั้งนี้เท่านั้น
 * — ฟิลด์ที่ path เดิม (ตอนแก้ไขแล้วไม่ได้แทนที่ไฟล์) จะไม่ถูกดาวน์โหลด/สแกนซ้ำ
 * (ผ่านการตรวจสอบไปแล้วตอนอัปโหลดครั้งแรก ผลเดิมยังอยู่ในแถวเดิม) หากไฟล์ใด
 * ไม่ผ่าน จะลบไฟล์ที่เพิ่งอัปโหลดใหม่ *ทั้งหมด* ของการส่งครั้งนี้ออกจาก Storage
 * ทันที (ไม่ใช่แค่ไฟล์ที่ตรวจไม่ผ่าน) เพื่อไม่ให้มีไฟล์ค้างที่ไม่มีแถวอ้างอิง
 */
export async function validateSubmissionFiles(
  newPaths: { pdfPath?: string; coverPath?: string; attachmentPath?: string },
  existingPdfPath?: string | null
): Promise<ValidateSubmissionFilesResult> {
  const targets: ValidateFileTarget[] = [];

  if (newPaths.pdfPath && newPaths.pdfPath !== existingPdfPath) {
    targets.push({
      field: "pdf",
      bucket: "research-documents",
      path: newPaths.pdfPath,
      allowedTypes: PDF_ALLOWED_TYPES,
      deferMalwareScan: true,
    });
  }
  if (newPaths.coverPath) {
    targets.push({
      field: "cover",
      bucket: "research-covers",
      path: newPaths.coverPath,
      allowedTypes: COVER_ALLOWED_TYPES,
    });
  }
  if (newPaths.attachmentPath) {
    targets.push({
      field: "attachment",
      bucket: "submission-attachments",
      path: newPaths.attachmentPath,
      allowedTypes: ATTACHMENT_ALLOWED_TYPES,
    });
  }

  const scans: SubmissionFileScans = {};

  for (const target of targets) {
    const result = await validateAndScanFile(target);
    if (!result.ok) {
      await cleanupUploadedFiles(targets.map((t) => ({ bucket: t.bucket, path: t.path })));
      return { ok: false, message: result.reason, logReason: result.logReason, field: target.field };
    }
    scans[target.field] = result.scan;
  }

  return { ok: true, scans };
}
