import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSettings } from "@/lib/data/settings.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";
import { sendInBatches, EMAIL_BATCH_CONCURRENCY } from "@/lib/notifications/send-in-batches.server";
import type { AccessRequestType } from "@/types/research";

/**
 * ป้ายกำกับประเภทคำขอสำหรับอีเมลแจ้งเตือนเท่านั้น — คงเป็นภาษาไทยแบบ static
 * เจตนา (ไม่ผูกกับ next-intl) เนื่องจากฟังก์ชันนี้ถูกเรียกทั้งจาก Server Action
 * (มี locale ของผู้ดูแลที่กด approve/reject) และจาก background job handler
 * (lib/jobs/handlers/access-expiration.server.ts) ซึ่งไม่มี request locale
 * ให้ใช้เลย และผู้รับอีเมลคือผู้ขอสิทธิ์ ไม่ใช่ผู้ดูแลที่ทำรายการ จึงไม่มี
 * locale ของผู้รับที่ถูกต้องให้อ้างอิงในทั้งสองกรณีอยู่ดี
 */
const ACCESS_REQUEST_TYPE_LABEL: Record<AccessRequestType, string> = {
  read: "อ่านออนไลน์",
  download: "ดาวน์โหลด",
};

/**
 * ส่งอีเมลแจ้งผู้ขอเมื่อคำขอเข้าถึงเอกสารถูกอนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม —
 * การแจ้งเตือนในระบบ (in-app) ถูกสร้างอัตโนมัติแล้วผ่าน trigger
 * (notify_access_request_status_change) ไม่ว่าจะเรียกจาก Server Action ไหนก็
 * ตาม ฟังก์ชันนี้จึงรับผิดชอบเฉพาะอีเมลเท่านั้น — best-effort เสมอ (ไม่ทำให้
 * การอนุมัติ/ปฏิเสธล้มเหลวหากส่งอีเมลไม่สำเร็จ) ตรวจสอบทั้งการตั้งค่าระบบ
 * (settings.notificationsEmailEnabled) และการตั้งค่าส่วนตัวของผู้ใช้
 * (notification_preferences.access_request_email_enabled) ก่อนส่งเสมอ
 */
export async function notifyAccessRequestByEmail(
  supabase: SupabaseClient<Database>,
  params: {
    requesterId: string;
    researchTitleTh: string;
    requestType: AccessRequestType;
    newStatus: "approved" | "rejected" | "more_information_required";
    reviewerNote?: string | null;
  }
): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEmailEnabled) return;

    const [{ data: profile }, { data: pref }] = await Promise.all([
      supabase.from("profiles").select("email").eq("id", params.requesterId).maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("access_request_email_enabled")
        .eq("user_id", params.requesterId)
        .maybeSingle(),
    ]);

    if (pref && pref.access_request_email_enabled === false) return;
    if (!profile?.email) return;

    const typeLabel = ACCESS_REQUEST_TYPE_LABEL[params.requestType];
    const subjectByStatus: Record<typeof params.newStatus, string> = {
      approved: `คำขอสิทธิ์${typeLabel}เอกสารได้รับการอนุมัติ: ${params.researchTitleTh}`,
      rejected: `คำขอสิทธิ์${typeLabel}เอกสารถูกปฏิเสธ: ${params.researchTitleTh}`,
      more_information_required: `เจ้าหน้าที่ขอข้อมูลเพิ่มเติม: ${params.researchTitleTh}`,
    };
    const bodyByStatus: Record<typeof params.newStatus, string> = {
      approved: `คำขอสิทธิ์${typeLabel}เอกสาร "${params.researchTitleTh}" ของคุณได้รับการอนุมัติแล้ว`,
      rejected: `คำขอสิทธิ์${typeLabel}เอกสาร "${params.researchTitleTh}" ของคุณถูกปฏิเสธ`,
      more_information_required: `เจ้าหน้าที่ขอข้อมูลเพิ่มเติมสำหรับคำขอสิทธิ์${typeLabel}เอกสาร "${params.researchTitleTh}" ของคุณ`,
    };

    const text = params.reviewerNote
      ? `${bodyByStatus[params.newStatus]}\n\nหมายเหตุจากเจ้าหน้าที่: ${params.reviewerNote}`
      : bodyByStatus[params.newStatus];

    await sendNotificationEmail({
      to: profile.email,
      subject: subjectByStatus[params.newStatus],
      text,
    });
  } catch (error) {
    console.error("notifyAccessRequestByEmail failed:", error);
  }
}

/**
 * ส่งอีเมลแจ้งเตือนใกล้หมดอายุสิทธิ์เข้าถึงเอกสาร — เรียกจาก
 * handleAccessExpirationJob (lib/jobs/handlers/access-expiration.server.ts)
 * ด้วยผลลัพธ์ที่ได้จาก RPC warn_expiring_access_grants() ในรอบเดียวกันเท่านั้น
 * (ไม่ query ซ้ำเอง) จึงกันแจ้งซ้ำร่วมกับ in-app notification โดยอัตโนมัติ —
 * grant หนึ่งอยู่ในผลลัพธ์นี้ได้แค่ครั้งเดียวตลอดอายุของมัน (การ์ด
 * expiry_warned_at ใน RPC เป็น atomic) เช็คทั้งการตั้งค่าระบบ
 * (settings.notificationsEmailEnabled + settings.accessExpirationWarningEmailEnabled)
 * และการตั้งค่าส่วนตัวของผู้ใช้ (notification_preferences.access_request_email_enabled
 * — ใช้ preference เดิมร่วมกับคำขอเข้าถึงเอกสาร ไม่เพิ่มคอลัมน์ preference ใหม่)
 * ก่อนส่งเสมอ — best-effort เสมอ ไม่ throw ออกไปให้ handler ล้มเหลวตาม
 */
export async function notifyExpiringAccessGrantsByEmail(
  supabase: SupabaseClient<Database>,
  grants: Array<{
    grant_id: string;
    user_id: string;
    research_item_id: string;
    access_type: string;
    expires_at: string;
  }>
): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEmailEnabled || !settings.accessExpirationWarningEmailEnabled) return;

    const userIds = Array.from(new Set(grants.map((g) => g.user_id)));
    const researchIds = Array.from(new Set(grants.map((g) => g.research_item_id)));

    const [{ data: profiles }, { data: prefs }, { data: items }] = await Promise.all([
      supabase.from("profiles").select("id, email").in("id", userIds),
      supabase
        .from("notification_preferences")
        .select("user_id, access_request_email_enabled")
        .in("user_id", userIds),
      supabase.from("research_items").select("id, title_th").in("id", researchIds),
    ]);

    const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));
    const prefByUser = new Map((prefs ?? []).map((p) => [p.user_id, p.access_request_email_enabled]));
    const titleByItem = new Map((items ?? []).map((i) => [i.id, i.title_th]));

    await sendInBatches(grants, EMAIL_BATCH_CONCURRENCY, (grant) => {
      if (prefByUser.get(grant.user_id) === false) return Promise.resolve();
      const email = emailByUser.get(grant.user_id);
      if (!email) return Promise.resolve();

      const typeLabel = ACCESS_REQUEST_TYPE_LABEL[grant.access_type as AccessRequestType] ?? grant.access_type;
      const title = titleByItem.get(grant.research_item_id) ?? "เอกสาร";
      const expiresLabel = new Date(grant.expires_at).toLocaleDateString("th-TH");

      return sendNotificationEmail({
        to: email,
        subject: `สิทธิ์เข้าถึงเอกสารใกล้หมดอายุ: ${title}`,
        text: `สิทธิ์${typeLabel}เอกสาร "${title}" ของคุณจะหมดอายุในวันที่ ${expiresLabel} กรุณาขอสิทธิ์ใหม่ล่วงหน้าหากยังต้องการเข้าถึงต่อ`,
      }).catch((error) =>
        console.error(`notifyExpiringAccessGrantsByEmail: send to ${email} failed:`, error)
      );
    });
  } catch (error) {
    console.error("notifyExpiringAccessGrantsByEmail failed:", error);
  }
}
