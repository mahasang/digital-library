import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron endpoint — เปลี่ยนสถานะบล็อกที่ตั้งเวลาไว้ (scheduled) เป็น
 * published เมื่อถึงเวลาที่กำหนด — ป้องกันด้วย CRON_SECRET เดียวกันกับ
 * /api/jobs/process และ /api/cron/health-check ทุกประการ (fail closed —
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
      { error: "ระบบยังไม่ได้เชื่อมต่อ Supabase/Service Role จึงเผยแพร่บล็อกที่ตั้งเวลาไว้ไม่ได้" },
      { status: 503 }
    );
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("blog_posts")
    .update({ status: "published" })
    .eq("status", "scheduled")
    .lte("published_at", now)
    .select("id, slug");

  if (error) {
    console.error("[cron] publish-scheduled-posts error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  console.log(`[cron] publish-scheduled-posts: published ${count} post(s)`);

  return NextResponse.json({ published: count, posts: data });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
