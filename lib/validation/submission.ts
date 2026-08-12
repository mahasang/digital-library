import { z } from "zod";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  COVER_ALLOWED_EXTENSIONS,
  PDF_ALLOWED_EXTENSIONS,
  isExtensionAllowed,
} from "@/lib/storage/limits";

export const accessLevelValues = [
  "public",
  "member_only",
  "staff_only",
  "read_only",
  "metadata_only",
] as const;

export const researcherSchema = z.object({
  name: z.string().min(2, "กรุณากรอกชื่อผู้วิจัย"),
  organization: z.string().max(200, "ชื่อหน่วยงานยาวเกินไป").optional(),
});

export type ResearcherInput = z.infer<typeof researcherSchema>;

export const submissionSchema = z.object({
  titleTh: z
    .string()
    .min(5, "กรุณากรอกชื่อเรื่องภาษาไทยอย่างน้อย 5 ตัวอักษร")
    .max(500, "ชื่อเรื่องยาวเกินไป"),
  titleEn: z.string().max(500, "ชื่อเรื่องยาวเกินไป").optional(),
  abstract: z
    .string()
    .min(50, "บทคัดย่อควรมีความยาวอย่างน้อย 50 ตัวอักษร")
    .max(5000, "บทคัดย่อยาวเกินไป"),
  organizationId: z.string().min(1, "กรุณาเลือกหน่วยงาน"),
  year: z.coerce
    .number()
    .int("ปีต้องเป็นตัวเลข")
    .min(2400, "ปีไม่ถูกต้อง")
    .max(2700, "ปีไม่ถูกต้อง"),
  categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  keywords: z
    .array(z.string().min(1))
    .min(1, "กรุณาระบุคำสำคัญอย่างน้อย 1 คำ")
    .max(20, "ระบุคำสำคัญได้ไม่เกิน 20 คำ"),
  researchers: z
    .array(researcherSchema)
    .min(1, "กรุณาระบุผู้วิจัยอย่างน้อย 1 คน")
    .max(20, "ระบุผู้วิจัยได้ไม่เกิน 20 คน"),
  accessLevel: z.enum(accessLevelValues),
  copyrightNote: z
    .string()
    .min(10, "กรุณากรอกข้อมูลลิขสิทธิ์อย่างน้อย 10 ตัวอักษร")
    .max(2000, "ข้อมูลลิขสิทธิ์ยาวเกินไป"),
  copyrightConfirmed: z.boolean().refine((v) => v === true, {
    message: "กรุณายืนยันว่าเป็นเจ้าของลิขสิทธิ์และยินยอมให้เผยแพร่",
  }),
  pdfPath: z
    .string()
    .min(1, "กรุณาอัปโหลดไฟล์ PDF")
    .refine((path) => isExtensionAllowed(path, PDF_ALLOWED_EXTENSIONS), {
      message: "ไฟล์ PDF ที่อัปโหลดไม่ถูกต้อง (นามสกุลไฟล์ไม่ตรงกับที่อนุญาต)",
    }),
  coverPath: z
    .string()
    .optional()
    .refine((path) => !path || isExtensionAllowed(path, COVER_ALLOWED_EXTENSIONS), {
      message: "ไฟล์ภาพปกที่อัปโหลดไม่ถูกต้อง (นามสกุลไฟล์ไม่ตรงกับที่อนุญาต)",
    }),
  attachmentPath: z
    .string()
    .optional()
    .refine((path) => !path || isExtensionAllowed(path, ATTACHMENT_ALLOWED_EXTENSIONS), {
      message: "ไฟล์แนบที่อัปโหลดไม่ถูกต้อง (นามสกุลไฟล์ไม่ตรงกับที่อนุญาต)",
    }),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
