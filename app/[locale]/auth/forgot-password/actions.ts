"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapAuthErrorMessage } from "@/lib/supabase/error-messages";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/actions/types";

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
    return { status: "error", message: mapAuthErrorMessage(error.message) };
  }

  return {
    status: "success",
    message:
      "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ",
  };
}
