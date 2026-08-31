import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * ปลายทางกลางสำหรับแลก authorization code เป็น session cookie
 * ใช้ร่วมกันทั้ง flow ยืนยันอีเมลหลังสมัครสมาชิก และ flow ลืมรหัสผ่าน
 * (Supabase ส่งผู้ใช้มาที่นี่พร้อม ?code=... หลังคลิกลิงก์ในอีเมล)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/lo/login?error=auth_callback_failed`);
}