"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "ระบบยังไม่ได้เชื่อมต่อ Supabase กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ .env.local ก่อนใช้งานฟังก์ชันนี้",
    };
  }

  const settings = await getSettings();
  if (!settings.registrationEnabled) {
    return {
      status: "error",
      message: "ระบบปิดรับสมัครสมาชิกใหม่ชั่วคราว กรุณาติดต่อผู้ดูแลระบบ",
    };
  }

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { allowed } = await checkRateLimit(
    rateLimitKeyForIp("register", clientIp),
    settings.rateLimitRegisterMax,
    settings.rateLimitRegisterWindowSec
  );
  if (!allowed) {
    return {
      status: "error",
      message: "มีการสมัครสมาชิกจากที่อยู่นี้บ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง",
    };
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
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกข้อมูลให้ถูกต้องครบถ้วน",
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
    redirect("/");
  }

  return {
    status: "success",
    message:
      "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันการสมัครสมาชิกก่อนเข้าสู่ระบบครั้งแรก",
  };
}
