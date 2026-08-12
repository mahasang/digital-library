import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import { processJobQueue } from "@/lib/jobs/dispatch.server";

export const dynamic = "force-dynamic";

/**
 * Worker endpoint สำหรับประมวลผลคิว background job — เรียกโดย Cron เท่านั้น
 * (Vercel Cron ส่ง GET พร้อม header `Authorization: Bearer $CRON_SECRET`
 * อัตโนมัติเมื่อตั้งค่า env var CRON_SECRET ไว้ ดู docs/background-jobs.md
 * หัวข้อการตั้งค่า Cron สำหรับ Production) **ห้ามเปิดให้เรียกแบบไม่ยืนยันตัวตน
 * เด็ดขาด** — ไม่มี CRON_SECRET ตั้งค่าไว้ ระบบจะปฏิเสธคำขอทุกครั้ง (fail closed
 * ไม่ใช่เปิดให้เรียกได้อย่างอิสระ)
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
      { error: "ระบบยังไม่ได้เชื่อมต่อ Supabase/Service Role จึงประมวลผลคิวไม่ได้" },
      { status: 503 }
    );
  }

  const batchSizeParam = request.nextUrl.searchParams.get("batchSize");
  const batchSize = Math.min(20, Math.max(1, Number(batchSizeParam) || 5));

  const summary = await processJobQueue(batchSize);
  return NextResponse.json(summary, { status: 200 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
