"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapAuthErrorMessage } from "@/lib/supabase/error-messages";
import { loginSchema } from "@/lib/validation/auth";
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
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "ระบบยังไม่ได้เชื่อมต่อ Supabase กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ .env.local ก่อนใช้งานฟังก์ชันนี้",
    };
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
    return {
      status: "error",
      message: "คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
    };
  }

  const captchaResult = await verifyCaptchaIfEnabled(
    settings.captchaEnabled,
    formData.get("turnstileToken")
  );
  if (!captchaResult.ok) {
    return { status: "error", message: captchaResult.message };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
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

  redirect(safeRedirect);
}
