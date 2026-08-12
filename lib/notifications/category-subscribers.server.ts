import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSettings } from "@/lib/data/settings.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";
import { sendInBatches, EMAIL_BATCH_CONCURRENCY } from "@/lib/notifications/send-in-batches.server";

/**
 * ส่งอีเมลแจ้งผู้ติดตามหมวดหมู่ทุกคนเมื่อมีงานวิจัยใหม่เผยแพร่ — การแจ้งเตือน
 * ในระบบ (in-app) ถูกสร้างอัตโนมัติแล้วผ่าน trigger ที่ขยายจาก
 * log_research_status_change() (ทำงานทุกครั้งที่ status เปลี่ยนเป็น published
 * ไม่ว่าจะเปลี่ยนจาก Server Action ไหน) — trigger เรียก HTTP ไม่ได้ ฟังก์ชันนี้
 * จึงรับผิดชอบเฉพาะอีเมลเท่านั้น ต้องเรียกจาก Server Action ที่ทำให้สถานะ
 * เปลี่ยนเป็น published โดยตรง (ดู app/dashboard/approvals/[id]/actions.ts,
 * app/dashboard/research/[id]/edit/actions.ts) — best-effort เสมอ ไม่ทำให้การ
 * เผยแพร่ล้มเหลวหากส่งอีเมลไม่สำเร็จ หลีกเลี่ยงแจ้งซ้ำด้วย Set ของ user_id
 * (เอกสารหนึ่งอาจอยู่หลายหมวดหมู่ที่คนเดียวติดตามพร้อมกัน) และไม่แจ้งเจ้าของ
 * งานวิจัยเอง (เข้ากับพฤติกรรมของ trigger ฝั่ง in-app)
 *
 * คืนค่า {attempted, sent} (ช่วงที่ 31) — ให้ handleCategoryNotificationJob()
 * บันทึกเป็น processed_count ของ cron_runs ได้ (เดิมคืน void)
 */
export async function notifyCategorySubscribersByEmail(
  supabase: SupabaseClient<Database>,
  researchItemId: string,
  researchTitleTh: string,
  submittedBy: string | null
): Promise<{ attempted: number; sent: number }> {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEmailEnabled) return { attempted: 0, sent: 0 };

    const { data: categoryLinks } = await supabase
      .from("research_categories")
      .select("category_id")
      .eq("research_id", researchItemId);
    const categoryIds = (categoryLinks ?? []).map((row) => row.category_id);
    if (categoryIds.length === 0) return { attempted: 0, sent: 0 };

    const { data: subscriptions } = await supabase
      .from("category_subscriptions")
      .select("user_id")
      .in("category_id", categoryIds);
    const subscriberIds = Array.from(
      new Set((subscriptions ?? []).map((row) => row.user_id).filter((id) => id !== submittedBy))
    );
    if (subscriberIds.length === 0) return { attempted: 0, sent: 0 };

    const [{ data: preferences }, { data: profiles }] = await Promise.all([
      supabase
        .from("notification_preferences")
        .select("user_id, new_research_email_enabled")
        .in("user_id", subscriberIds),
      supabase.from("profiles").select("id, email").in("id", subscriberIds),
    ]);

    const emailEnabledByUser = new Map(
      (preferences ?? []).map((p) => [p.user_id, p.new_research_email_enabled])
    );
    const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    const recipients = subscriberIds
      .filter((id) => emailEnabledByUser.get(id) === true)
      .map((id) => emailByUser.get(id))
      .filter((email): email is string => Boolean(email));

    let sent = 0;
    await sendInBatches(recipients, EMAIL_BATCH_CONCURRENCY, async (email) => {
      const result = await sendNotificationEmail({
        to: email,
        subject: `มีงานวิจัยใหม่ในหมวดหมู่ที่คุณติดตาม: ${researchTitleTh}`,
        text: `งานวิจัยใหม่ "${researchTitleTh}" เผยแพร่แล้วในหมวดหมู่ที่คุณติดตาม สามารถเข้าชมได้ที่เว็บไซต์ห้องสมุดดิจิทัล`,
      }).catch((error) => {
        console.error(`notifyCategorySubscribersByEmail: send to ${email} failed:`, error);
        return { sent: false };
      });
      if (result.sent) sent++;
    });

    return { attempted: recipients.length, sent };
  } catch (error) {
    console.error("notifyCategorySubscribersByEmail failed:", error);
    return { attempted: 0, sent: 0 };
  }
}
