import "server-only";

/**
 * ส่งอีเมลแจ้งเตือนผ่าน Resend (https://resend.com) — เลือกเพราะมี free tier
 * และ REST API ตรงไปตรงมา ไม่ต้องติดตั้ง SDK เพิ่ม
 *
 * หากยังไม่ได้ตั้งค่า RESEND_API_KEY จะไม่ส่งจริง (log แจ้งไว้ฝั่งเซิร์ฟเวอร์
 * เท่านั้น) — ออกแบบให้ "fail silently" ต่อผู้ใช้เสมอ เพราะการแจ้งเตือนอีเมล
 * ไม่ควรทำให้ workflow หลัก (เช่น การอนุมัติงานวิจัย) ล้มเหลวไปด้วย
 *
 * วิธีตั้งค่าจริง: ดู docs/superadmin-guide.md หัวข้อ "ตั้งค่าอีเมลแจ้งเตือน"
 */

export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "notifications@example.org";

  if (!apiKey) {
    console.error(
      `sendNotificationEmail: RESEND_API_KEY ยังไม่ได้ตั้งค่า — ข้ามการส่งอีเมลถึง ${params.to}`
    );
    return { sent: false, error: "ยังไม่ได้ตั้งค่าผู้ให้บริการอีเมล" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: params.to,
        subject: params.subject,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`sendNotificationEmail failed (${res.status}):`, body);
      return { sent: false, error: "ส่งอีเมลไม่สำเร็จ" };
    }

    return { sent: true };
  } catch (error) {
    console.error("sendNotificationEmail threw:", error);
    return { sent: false, error: "ส่งอีเมลไม่สำเร็จ" };
  }
}
