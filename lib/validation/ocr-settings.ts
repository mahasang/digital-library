import { z } from "zod";

const ACCESS_LEVELS = ["public", "member_only", "staff_only", "read_only", "metadata_only"] as const;

export const ocrSettingsSchema = z.object({
  ocrMaxFileSizeMb: z.coerce.number().int().min(1).max(500),
  ocrMaxPages: z.coerce.number().int().min(1).max(2000),
  ocrDailyQuotaEnabled: z.boolean(),
  ocrMaxJobsPerUserPerDay: z.coerce.number().int().min(1).max(1000),
  ocrProviderEnabled: z.boolean(),
  ocrAllowedAccessLevels: z.array(z.enum(ACCESS_LEVELS)),
});

export type OcrSettingsInput = z.infer<typeof ocrSettingsSchema>;
