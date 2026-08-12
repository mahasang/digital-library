import { NextResponse } from "next/server";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getRecentOcrTestRuns } from "@/lib/data/ocr-test-runs.server";

export const dynamic = "force-dynamic";

/**
 * ปลายทาง JSON เบาๆ สำหรับ poll ผลการทดสอบ Controlled OCR Test (ช่วงที่ 32) —
 * รูปแบบเดียวกับ /api/superadmin/jobs/batches (ช่วงที่ 25) ตรวจสิทธิ์ผ่าน
 * session ปกติ (rank >= 50) คนละ endpoint กับ /api/jobs/process ที่ป้องกันด้วย
 * CRON_SECRET โดยสิ้นเชิง
 */
export async function GET() {
  const rank = await getCurrentUserRoleRank();
  if (rank < 50) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const runs = await getRecentOcrTestRuns(20);
  return NextResponse.json({ runs }, { status: 200 });
}
