import { z } from "zod";

/**
 * Zod schema สำหรับตัวกรองของ "ประมวลผลทั้งหมดตามตัวกรอง" (แต่ละโดเมน) —
 * ตรวจสอบฝั่งเซิร์ฟเวอร์เสมอก่อนส่งต่อไปยัง RPC นับ/แบ่งหน้า (ดู
 * lib/data/pdf-processing.server.ts ฯลฯ) ทุก schema เป็น .strict() เพื่อปฏิเสธ
 * field ที่ไม่รู้จัก — Client ไม่มีทางส่งชื่อ field หรือค่าที่ไม่อยู่ใน allowlist
 * เข้ามาปนใน filter_snapshot ได้ ไม่มี schema ใดรับ "sort"/"orderBy" เพราะลำดับ
 * การจัดเรียงเป็นค่าคงที่ (updated_at desc, id desc) ควบคุมฝั่งเซิร์ฟเวอร์เสมอ
 * ไม่เคยรับค่าจาก Client
 */

const uuidField = z.string().uuid();
const yearField = z.coerce.number().int().min(1900).max(3000);
const isoDateField = z.string().datetime({ offset: true }).or(z.string().date());

export const documentStatusEnum = z.enum([
  "draft",
  "pending_review",
  "revision_requested",
  "approved",
  "published",
  "rejected",
  "archived",
  "merged",
]);

export const extractionStateEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "no_text_found",
  "failed",
  "never_attempted",
  "replaced",
]);

export const ocrStatusEnum = z.enum(["not_required", "pending", "processing", "completed", "failed"]);

export const scanStatusEnum = z.enum(["pending", "error", "infected", "clean", "skipped"]);

export const pdfProcessingBulkFilterSchema = z
  .object({
    extractionState: extractionStateEnum.optional(),
    year: yearField.optional(),
    categoryId: uuidField.optional(),
    publishStatus: documentStatusEnum.optional(),
  })
  .strict();
export type PdfProcessingBulkFilter = z.infer<typeof pdfProcessingBulkFilterSchema>;

export const ocrBulkFilterSchema = pdfProcessingBulkFilterSchema.extend({
  ocrStatus: ocrStatusEnum.optional(),
});
export type OcrBulkFilter = z.infer<typeof ocrBulkFilterSchema>;

export const duplicateScanBulkFilterSchema = z
  .object({
    year: yearField.optional(),
    categoryId: uuidField.optional(),
    status: documentStatusEnum.optional(),
    editedAfter: isoDateField.optional(),
    neverScannedOnly: z.boolean().optional(),
  })
  .strict();
export type DuplicateScanBulkFilter = z.infer<typeof duplicateScanBulkFilterSchema>;

export const fileSecurityBulkFilterSchema = z
  .object({
    scanStatus: scanStatusEnum.optional(),
    neverScannedOnly: z.boolean().optional(),
    fileKind: z.enum(["pdf", "attachment", "either"]).optional(),
    createdAfter: isoDateField.optional(),
    createdBefore: isoDateField.optional(),
  })
  .strict();
export type FileSecurityBulkFilter = z.infer<typeof fileSecurityBulkFilterSchema>;

export const jobBatchControlSchema = z
  .object({
    batchId: uuidField,
    action: z.enum(["pause", "resume", "cancel", "retryFailed"]),
  })
  .strict();
export type JobBatchControlInput = z.infer<typeof jobBatchControlSchema>;
