import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error" | "unknown";

/**
 * /api/health — endpoint สำหรับ external uptime monitor (UptimeRobot, Better
 * Uptime, Cloudflare Health Checks ฯลฯ) เรียกแบบไม่ต้องยืนยันตัวตน
 *
 * ตรวจเฉพาะสิ่งที่ปลอดภัยให้เปิดเผยแบบสาธารณะ: เชื่อมต่อฐานข้อมูลได้หรือไม่
 * (query ตาราง settings ซึ่งอ่านได้แบบสาธารณะอยู่แล้ว) และ Storage service
 * ตอบสนองหรือไม่ (endpoint status ของ Storage API เอง ไม่ใช่ข้อมูลไฟล์ใดๆ)
 * — ใช้ anon key เท่านั้น (สิทธิ์ต่ำสุด ไม่ใช่ service role) ไม่คืนค่า
 * connection string, secret, token หรือรายละเอียด infrastructure ใดๆ
 * คืนเฉพาะสถานะ ok/error/unknown ต่อองค์ประกอบ และเวลาที่ตรวจสอบเท่านั้น
 */
export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        status: "ok",
        checkedAt,
        checks: { application: "ok", database: "unknown", storage: "unknown" },
      },
      { status: 200 }
    );
  }

  const { url, anonKey } = getSupabaseEnv();
  const [database, storage] = await Promise.all([
    checkDatabase(url, anonKey),
    checkStorage(url),
  ]);

  const overallStatus = database === "error" ? "down" : storage === "error" ? "degraded" : "ok";
  const httpStatus = overallStatus === "down" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      checkedAt,
      checks: { application: "ok", database, storage },
    },
    { status: httpStatus }
  );
}

async function checkDatabase(url: string, anonKey: string): Promise<CheckStatus> {
  try {
    const supabase = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.from("settings").select("id").limit(1);
    return error ? "error" : "ok";
  } catch (error) {
    console.error("/api/health: database check failed:", error instanceof Error ? error.message : error);
    return "error";
  }
}

async function checkStorage(url: string): Promise<CheckStatus> {
  try {
    const res = await fetch(`${url}/storage/v1/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? "ok" : "error";
  } catch (error) {
    console.error("/api/health: storage check failed:", error instanceof Error ? error.message : error);
    return "error";
  }
}
