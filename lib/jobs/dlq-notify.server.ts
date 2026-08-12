import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getSettings } from "@/lib/data/settings.server";
import { isEmailProviderConfigured, sendNotificationEmail } from "@/lib/notifications/email.server";
import { describeJobForDisplay } from "@/lib/jobs/dlq.server";
import { getSuperAdminRecipients } from "@/lib/data/super-admins.server";

/**
 * ส่งอีเมลแจ้ง Super Admin ทุกคนเมื่อ job เข้า dead-letter queue (ล้มเหลวถาวร)
 * — เรียกจาก failBackgroundJob() (lib/jobs/queue.server.ts) เฉพาะตอนที่ RPC
 * fail_background_job คืนค่า true เท่านั้น (แปลว่ารอบนี้เป็นรอบแรกที่ job เข้า
 * DLQ จริงๆ — กันแจ้งซ้ำ, ดู migration 20260814100000) การแจ้งเตือนแบบ in-app
 * ถูกสร้างไปแล้วในธุรกรรมเดียวกันฝั่ง SQL — ฟังก์ชันนี้รับผิดชอบแค่อีเมลเท่านั้น
 * รูปแบบเดียวกับ notifyCategorySubscribersByEmail เดิม (best-effort เสมอ
 * ไม่ throw ออกไปให้ failBackgroundJob ล้มเหลวตาม, gate ด้วย settings +
 * ตรวจตั้งค่า provider ก่อนเสมอ, ส่งแบบ Promise.all ต่อผู้รับกันคนเดียวส่งไม่
 * สำเร็จแล้วบล็อกคนอื่น)
 */
export async function sendDeadLetterEmailAlerts(jobId: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEmailEnabled || !isEmailProviderConfigured()) return;

    const service = createServiceRoleClient();

    const { data: job } = await service
      .from("background_jobs")
      .select("job_type, entity_type, entity_id, attempts, max_attempts")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return;

    // หา Super Admin ทั้งหมด (rank >= 50) — สกัดออกเป็น getSuperAdminRecipients()
    // ใช้ร่วมกับ lib/cron/monitor.server.ts (ช่วงที่ 31) แล้ว
    const superAdmins = await getSuperAdminRecipients();
    const recipients = superAdmins.map((s) => s.email).filter((email): email is string => Boolean(email));
    if (recipients.length === 0) return;

    const { safeSummary } = await describeJobForDisplay({
      jobType: job.job_type,
      entityType: job.entity_type,
      entityId: job.entity_id,
    });

    await Promise.all(
      recipients.map((email) =>
        sendNotificationEmail({
          to: email,
          subject: `งานพื้นหลังล้มเหลวถาวร: ${safeSummary}`,
          text:
            `งาน "${safeSummary}" ล้มเหลวถาวรหลังลองซ้ำครบ ${job.max_attempts} ครั้งแล้ว\n\n` +
            `กรุณาเข้าไปตรวจสอบและลองใหม่ได้ที่หน้า /superadmin/jobs ของระบบห้องสมุดดิจิทัล`,
        }).catch((error) => console.error(`sendDeadLetterEmailAlerts: send to ${email} failed:`, error))
      )
    );
  } catch (error) {
    console.error("sendDeadLetterEmailAlerts failed:", error);
  }
}
