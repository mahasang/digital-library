"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapAuthErrorMessage } from "@/lib/supabase/error-messages";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { checkRateLimit, rateLimitKeyForIp } from "@/lib/rate-limit.server";
import type { ActionResult } from "@/lib/actions/types";

const FORGOT_PASSWORD_RATE_LIMIT_MAX = 5;
const FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SEC = 15 * 60;

const GENERIC_SUCCESS_MESSAGE =
  "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ";

export async function forgotPasswordAction(
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

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณากรอกอีเมลให้ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { allowed } = await checkRateLimit(
    rateLimitKeyForIp("forgot-password", clientIp),
    FORGOT_PASSWORD_RATE_LIMIT_MAX,
    FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SEC
  );

  // ถูกจำกัดอัตราจาก IP นี้ — ข้ามการเรียก Supabase จริง แต่คืนข้อความสำเร็จ
  // แบบเดียวกับกรณีปกติทุกประการ เพื่อไม่ให้เกิดสัญญาณที่สังเกตได้ต่างจากเดิม
  // (คงพฤติกรรม anti-enumeration ที่มีอยู่แล้วไว้ไม่ให้เปลี่ยน)
  if (!allowed) {
    return { status: "success", message: GENERIC_SUCCESS_MESSAGE };
  }

  const origin = headersList.get("origin") ?? "";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
        "/auth/reset-password"
      )}`,
    }
  );

  // ไม่เปิดเผยว่ามีอีเมลนี้อยู่ในระบบหรือไม่ (ป้องกัน user enumeration)
  // ยกเว้นกรณีถูกจำกัดอัตราการร้องขอ ซึ่งควรแจ้งผู้ใช้ตามจริง
  if (error && error.message.toLowerCase().includes("rate limit")) {
    return { status: "error", message: await mapAuthErrorMessage(error.message) };
  }

  return {
    status: "success",
    message: GENERIC_SUCCESS_MESSAGE,
  };
}
