import { z } from "zod";

export const accessRequestTypeValues = ["read", "download"] as const;

export const accessRequestSchema = z.object({
  researchSlug: z.string().min(1, "ไม่พบงานวิจัยนี้"),
  requestType: z.enum(accessRequestTypeValues, {
    message: "กรุณาเลือกประเภทคำขอ",
  }),
  purpose: z
    .string()
    .min(10, "กรุณาระบุวัตถุประสงค์การใช้งานอย่างน้อย 10 ตัวอักษร")
    .max(1000, "วัตถุประสงค์ยาวเกินไป"),
  requesterNote: z.string().max(2000, "รายละเอียดเพิ่มเติมยาวเกินไป").optional(),
  termsAccepted: z.boolean().refine((v) => v === true, {
    message: "กรุณายอมรับเงื่อนไขการใช้งานเอกสารก่อนส่งคำขอ",
  }),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
