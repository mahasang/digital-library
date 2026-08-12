import { z } from "zod";

export const organizationAuthoritySchema = z.object({
  nameTh: z.string().min(2, "กรุณากรอกชื่อภาษาไทยอย่างน้อย 2 ตัวอักษร").max(300, "ชื่อยาวเกินไป"),
  nameEn: z.string().max(300, "ชื่อยาวเกินไป").optional(),
  description: z.string().max(2000, "คำอธิบายยาวเกินไป").optional(),
  parentId: z.string().uuid().optional().or(z.literal("")),
  organizationCode: z.string().max(50, "รหัสหน่วยงานยาวเกินไป").optional(),
  websiteUrl: z
    .string()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), {
      message: "URL เว็บไซต์ต้องขึ้นต้นด้วย http:// หรือ https://",
    }),
});

export type OrganizationAuthorityInput = z.infer<typeof organizationAuthoritySchema>;
