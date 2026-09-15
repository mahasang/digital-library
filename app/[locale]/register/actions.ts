"use server";

import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapAuthErrorMessage } from "@/lib/supabase/error-messages";
import { registerSchema } from "@/lib/validation/auth";
import { getSettings } from "@/lib/data/settings.server";
import { checkRateLimit, rateLimitKeyForIp } from "@/lib/rate-limit.server";
import { verifyCaptchaIfEnabled } from "@/lib/captcha.server";
import type { ActionResult } from "@/lib/actions/types";

export async function registerAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations("actionMessages.common");
  const tAuth = await getTranslations("actionMessages.auth");
  if (!isSupabaseConfigured()) {
    return { status: "error", message: t("supabaseNotConfiguredDetailed") };
  }

  const settings = await getSettings();
  if (!settings.registrationEnabled) {
    return { status: "error", message: tAuth("registrationDisabled") };
  }

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { allowed } = await checkRateLimit(
    rateLimitKeyForIp("register", clientIp),
    settings.rateLimitRegisterMax,
    settings.rateLimitRegisterWindowSec
  );
  if (!allowed) {
    return { status: "error", message: tAuth("rateLimitedRegister") };
  }

  const captchaResult = await verifyCaptchaIfEnabled(
    settings.captchaEnabled,
    formData.get("turnstileToken")
  );
  if (!captchaResult.ok) {
    return { status: "error", message: captchaResult.message };
  }

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    organization: formData.get("organization") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("invalidFormDataComplete"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const origin = headersList.get("origin") ?? "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organization: parsed.data.organization ?? null,
        phone: parsed.data.phone || null,
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
        "/login?confirmed=1"
      )}`,
    },
  });

  if (error) {
    return { status: "error", message: await mapAuthErrorMessage(error.message) };
  }

  if (data.session) {
    // โปรเจกต์ปิดการยืนยันอีเมล (Confirm email = off) จึงเข้าสู่ระบบได้ทันที
    const locale = await getLocale();
    return redirect({ href: "/", locale });
  }

  return { status: "success", message: tAuth("registerSuccessPendingConfirm") };
}
