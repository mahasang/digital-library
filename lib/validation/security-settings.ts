import { z } from "zod";

export const securitySettingsSchema = z.object({
  captchaEnabled: z.boolean(),
  rateLimitRegisterMax: z.coerce.number().int().min(1).max(100),
  rateLimitRegisterWindowSec: z.coerce.number().int().min(60).max(86400),
  rateLimitSubmitMax: z.coerce.number().int().min(1).max(100),
  rateLimitSubmitWindowSec: z.coerce.number().int().min(60).max(86400),
});

export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;
