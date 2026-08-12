import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, "กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร")
    .max(120, "ชื่อ-นามสกุลยาวเกินไป"),
  organization: z.string().max(200, "ชื่อหน่วยงานยาวเกินไป").optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
