"use server";

import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapAuthErrorMessage } from "@/lib/supabase/error-messages";
import { createLoginSchema } from "@/lib/validation/auth";
import { getSettings } from "@/lib/data/settings.server";
import { checkRateLimit, rateLimitKeyForIp } from "@/lib/rate-limit.server";
import { verifyCaptchaIfEnabled } from "@/lib/captcha.server";
import type { ActionResult } from "@/lib/actions/types";

const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_SEC = 15 * 60;

export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfiguredDetailed") };
  }

  const settings = await getSettings();

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { allowed } = await checkRateLimit(
    rateLimitKeyForIp("login", clientIp),
    LOGIN_RATE_LIMIT_MAX,
    LOGIN_RATE_LIMIT_WINDOW_SEC
  );
  if (!allowed) {
    const tAuth = await getTranslations("actionMessages.auth");
    return { status: "error", message: tAuth("rateLimitedLogin") };
  }

  const captchaResult = await verifyCaptchaIfEnabled(
    settings.captchaEnabled,
    formData.get("turnstileToken")
  );
  if (!captchaResult.ok) {
    return { status: "error", message: captchaResult.message };
  }

  const tValidation = await getTranslations("validation");
  const parsed = createLoginSchema(tValidation).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: await mapAuthErrorMessage(error.message) };
  }

  const redirectTarget = formData.get("redirectTo");
  const safeRedirect =
    typeof redirectTarget === "string" && redirectTarget.startsWith("/")
      ? redirectTarget
      : "/";

  const locale = await getLocale();
  return redirect({ href: safeRedirect, locale });
}
