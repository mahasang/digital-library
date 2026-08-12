import { z } from "zod";
import { SITE_ASSET_ALLOWED_EXTENSIONS, isExtensionAllowed } from "@/lib/storage/limits";

export const systemSettingsSchema = z.object({
  siteName: z.string().min(1, "กรุณากรอกชื่อระบบ").max(200, "ชื่อระบบยาวเกินไป"),
  contactEmail: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  contactPhone: z.string().max(50, "เบอร์โทรศัพท์ยาวเกินไป").optional(),
  contactAddress: z.string().max(500, "ที่อยู่ยาวเกินไป").optional(),
  socialFacebook: z.string().max(300, "ลิงก์ยาวเกินไป").optional(),
  socialTwitter: z.string().max(300, "ลิงก์ยาวเกินไป").optional(),
  socialLine: z.string().max(300, "ลิงก์ยาวเกินไป").optional(),
  copyrightText: z.string().max(300, "ข้อความลิขสิทธิ์ยาวเกินไป").optional(),
  homepageLatestCount: z.coerce.number().int().min(1).max(24),
  homepagePopularCount: z.coerce.number().int().min(1).max(24),
  registrationEnabled: z.boolean(),
  submissionEnabled: z.boolean(),
  defaultResearchStatus: z.enum(["draft", "pending_review"]),
  maxPdfSizeMb: z.coerce.number().int().min(1).max(200),
  maxCoverSizeMb: z.coerce.number().int().min(1).max(20),
  maxAttachmentSizeMb: z.coerce.number().int().min(1).max(100),
  logoPath: z
    .string()
    .optional()
    .refine((path) => !path || isExtensionAllowed(path, SITE_ASSET_ALLOWED_EXTENSIONS), {
      message: "ไฟล์โลโก้ที่อัปโหลดไม่ถูกต้อง (นามสกุลไฟล์ไม่ตรงกับที่อนุญาต)",
    }),
  faviconPath: z
    .string()
    .optional()
    .refine((path) => !path || isExtensionAllowed(path, SITE_ASSET_ALLOWED_EXTENSIONS), {
      message: "ไฟล์ favicon ที่อัปโหลดไม่ถูกต้อง (นามสกุลไฟล์ไม่ตรงกับที่อนุญาต)",
    }),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
