"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * next=/ คงที่ (ไม่รับ redirectTo แบบ loginAction) — ปุ่ม Google เป็น form
 * แยกต่างหากจาก LoginForm/RegisterForm เดิม ยังไม่ได้เชื่อม redirectTo เข้ามา
 * ตามที่ file_prompt/web-google-signin.md ระบุไว้ตรงๆ (ไม่ได้อยู่ใน scope นี้)
 */
export async function signInWithGoogleAction() {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/")}`,
    },
  });

  if (error || !data.url) return;

  redirect(data.url);
}
