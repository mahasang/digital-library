import { z } from "zod";

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, "กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร")
    .max(120, "ชื่อ-นามสกุลยาวเกินไป"),
  organization: z.string().max(200, "ชื่อหน่วยงานยาวเกินไป").optional(),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[0-9+\-\s()]{6,20}$/, "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง")
      .optional()
  ),
  dateOfBirth: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine((val) => !Number.isNaN(Date.parse(val)), "วันเกิดไม่ถูกต้อง")
      .refine((val) => new Date(val) <= new Date(), "วันเกิดต้องไม่ใช่วันในอนาคต")
      .optional()
  ),
  address: z.preprocess(emptyToUndefined, z.string().max(500, "ที่อยู่ยาวเกินไป").optional()),
});

export type ProfileInput = z.infer<typeof profileSchema>;
