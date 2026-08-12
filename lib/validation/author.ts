import { z } from "zod";
import { validateOrcid } from "@/lib/validation/orcid";

export const authorSchema = z.object({
  name: z.string().min(2, "กรุณากรอกชื่อภาษาไทยอย่างน้อย 2 ตัวอักษร").max(200, "ชื่อยาวเกินไป"),
  displayNameEn: z.string().max(200, "ชื่อยาวเกินไป").optional(),
  titlePrefixTh: z.string().max(50, "คำนำหน้ายาวเกินไป").optional(),
  titlePrefixEn: z.string().max(50, "คำนำหน้ายาวเกินไป").optional(),
  organizationId: z.string().uuid().optional().or(z.literal("")),
  orcid: z
    .string()
    .optional()
    .refine((v) => !v || validateOrcid(v).valid, {
      message: "ORCID ไม่ถูกต้อง (ตรวจสอบรูปแบบหรือ checksum ไม่ผ่าน)",
    }),
  biography: z.string().max(4000, "ประวัติยาวเกินไป").optional(),
  isActive: z.boolean().optional(),
});

export type AuthorInput = z.infer<typeof authorSchema>;
