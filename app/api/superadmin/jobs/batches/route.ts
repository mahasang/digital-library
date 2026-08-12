import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserRoleRank } from "@/lib/supabase/roles";
import { getRecentJobBatches, getJobBatchDetail, getRecentJobs } from "@/lib/data/job-batches.server";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/**
 * ปลายทาง JSON เบาๆ สำหรับ JobProgressPoller.tsx/JobBatchDetailDrawer.tsx ดึง
 * สถานะ batch ซ้ำเป็นระยะ — แยกจาก /api/jobs/process (worker endpoint ที่
 * ป้องกันด้วย CRON_SECRET) โดยสิ้นเชิง จุดนี้ตรวจสิทธิ์ผ่าน session ปกติ
 * (rank >= 50) เหมือนหน้า Super Admin ทั่วไป ไม่ใช่ endpoint สำหรับ Cron
 *
 * ใช้ route แยกแทน router.refresh() เพราะ router.refresh() รัน Server
 * Component ทั้งหน้าใหม่ (รวม query รายการผู้สมัคร 500 แถวของหน้า
 * pdf-processing/file-security/data-quality ด้วย) ทั้งที่ต้องการแค่รีเฟรช
 * ตัวเลข progress เท่านั้น
 *
 * ?batchId=... (ช่วงที่ 28): คืนรายละเอียด batch เดียวแบบละเอียด (แยก
 * pending/processing ที่รายการปกติไม่มี) — ใช้เฉพาะตอนเปิด
 * JobBatchDetailDrawer ไม่ใช่ตอน poll รายการทั้งหมด
 *
 * ?jobType=...&mode=recent (ช่วงที่ 29): คืนรายการ job แบบไม่จัดกลุ่ม
 * (getRecentJobs) พร้อม progress ระดับหน้า — ใช้กับ ocr_processing ที่หน้า
 * /superadmin/pdf-processing และ /superadmin/ocr (คนละโหมดกับรายการ batch
 * เดิม เพราะ ocr_processing ที่สั่งทีละรายการไม่มี batch_id)
 */
export async function GET(request: NextRequest) {
  const rank = await getCurrentUserRoleRank();
  if (rank < 50) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const batchId = request.nextUrl.searchParams.get("batchId");
  if (batchId) {
    const detail = await getJobBatchDetail(batchId);
    if (!detail) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ detail }, { status: 200 });
  }

  const jobType = request.nextUrl.searchParams.get("jobType") as BackgroundJobTypeRow | null;
  if (!jobType) {
    return NextResponse.json({ error: "missing jobType" }, { status: 400 });
  }

  if (request.nextUrl.searchParams.get("mode") === "recent") {
    const jobs = await getRecentJobs(jobType, 20);
    return NextResponse.json({ jobs }, { status: 200 });
  }

  const batches = await getRecentJobBatches(jobType);
  return NextResponse.json({ batches }, { status: 200 });
}
