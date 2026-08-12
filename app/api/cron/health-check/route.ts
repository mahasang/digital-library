import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import { runCronHealthChecks } from "@/lib/cron/monitor.server";

export const dynamic = "force-dynamic";

/**
 * Watchdog endpoint สำหรับตรวจสุขภาพ cron/worker อื่นๆ (ช่วงที่ 31) — ต้องเป็น
 * Cron **แยกต่างหาก** จาก /api/jobs/process โดยเจตนา (ดู
 * docs/background-jobs.md หัวข้อ 14) เพราะถ้าฝังการตรวจสอบไว้ใน worker
 * เดียวกัน ตอน Cron หลักหยุดทำงานทั้งหมดจะไม่มีอะไรตรวจจับได้เลย — ป้องกันด้วย
 * `CRON_SECRET` เดียวกันกับ /api/jobs/process ทุกประการ (fail closed เหมือนกัน
 * ไม่ตั้งค่าไว้ปฏิเสธทุกคำขอเสมอ)
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า CRON_SECRET จึงปฏิเสธการเรียก endpoint นี้ทุกกรณี" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "ระบบยังไม่ได้เชื่อมต่อ Supabase/Service Role จึงตรวจสุขภาพ Cron ไม่ได้" },
      { status: 503 }
    );
  }

  const summary = await runCronHealthChecks();
  return NextResponse.json(summary, { status: 200 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
