"use server";

import { createClient } from "@/lib/supabase/server";
import { SUPER_ADMIN_RANK } from "@/lib/supabase/roles";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { processJobQueue } from "@/lib/jobs/dispatch.server";
import { logAudit } from "@/lib/data/audit.server";
import type { ActionResult } from "@/lib/actions/types";

/**
 * ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ของ Super Admin — เรียก dispatcher ตัวเดียวกับที่
 * /api/jobs/process (Cron) เรียก แต่ผ่านเซสชันที่ยืนยันตัวตนแล้วแทน secret
 * header ใช้สำหรับ local dev หรือช่วงที่ยังไม่ได้ตั้งค่า Cron จริงบน Production
 */
export async function processQueueNowAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const auth = await requireMinRank(SUPER_ADMIN_RANK);
  if (!auth.ok) return auth.result;
  const supabase = await createClient();

  const summary = await processJobQueue(10);

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "background_jobs_process_now",
    entityType: "background_jobs",
    metadata: { claimed: summary.claimed, results: summary.results },
  });

  const okCount = summary.results.filter((r) => r.ok).length;
  return {
    status: "success",
    message: `ประมวลผล ${summary.claimed} งาน (สำเร็จ ${okCount}, ล้มเหลว ${summary.claimed - okCount})`,
  };
}
