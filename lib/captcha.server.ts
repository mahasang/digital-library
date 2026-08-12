import "server-only";

/**
 * รองรับ Cloudflare Turnstile (มี free tier ไม่มีค่าใช้จ่าย) — เลือกเพราะ
 * REST verify API เรียบง่าย ไม่ต้องติดตั้ง SDK
 *
 * ฝัง widget จริงในฟอร์มสมัครสมาชิก (`RegisterForm`) และฟอร์มส่งงานวิจัยใหม่
 * (`SubmitResearchForm` ที่ `/submit-research` เท่านั้น ไม่รวมหน้าแก้ไข/เพิ่ม
 * งานวิจัยของ Librarian/Admin) — ใช้ `verifyCaptchaIfEnabled()` ที่ Server
 * Action เพื่อบังคับตรวจสอบ token กับ Cloudflare จริงก่อนสร้างบัญชี/บันทึกข้อมูล
 * ดูวิธีตั้งค่าใน docs/superadmin-guide.md
 */

export function isCaptchaConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY
  );
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey || !token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (error) {
    console.error("verifyTurnstileToken failed:", error);
    return false;
  }
}

export type CaptchaVerifyResult = { ok: true } | { ok: false; message: string };

/**
 * ตรวจสอบ CAPTCHA เฉพาะเมื่อ `settings.captchaEnabled` เป็นจริงเท่านั้น เรียกใช้
 * ต้น Server Action ก่อนสร้างบัญชี/บันทึกการส่งงานวิจัยเสมอ — ต้องได้ `{ ok: true }`
 * จึงจะดำเนินการต่อได้
 *
 * กรณีเปิดสวิตช์ไว้แต่ยังตั้งค่า `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/
 * `TURNSTILE_SECRET_KEY` ไม่ครบ (`isCaptchaConfigured()` เป็นเท็จ) — จงใจ
 * fail-open (ผ่านการตรวจสอบ ไม่บล็อกผู้ใช้) พร้อม log คำเตือนไว้ฝั่งเซิร์ฟเวอร์
 * เท่านั้น เพื่อไม่ให้ผู้ดูแลเปิดสวิตช์โดยยังตั้งค่าไม่ครบแล้วปิดกั้นผู้ใช้ทุกคน
 * โดยไม่ได้ตั้งใจ — สอดคล้องกับรูปแบบ fail-open เดียวกับ `checkRateLimit()`
 */
export async function verifyCaptchaIfEnabled(
  captchaEnabled: boolean,
  token: unknown
): Promise<CaptchaVerifyResult> {
  if (!captchaEnabled) return { ok: true };

  if (!isCaptchaConfigured()) {
    console.warn(
      "verifyCaptchaIfEnabled: CAPTCHA เปิดใช้งานใน /superadmin/security แต่ยังไม่ได้ตั้งค่า " +
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY ครบถ้วน — ข้ามการตรวจสอบชั่วคราว (fail-open)"
    );
    return { ok: true };
  }

  if (typeof token !== "string" || !token) {
    return {
      ok: false,
      message: "กรุณายืนยันตัวตน (CAPTCHA) ก่อนดำเนินการ",
    };
  }

  const verified = await verifyTurnstileToken(token);
  if (!verified) {
    return {
      ok: false,
      message: "ยืนยันตัวตน (CAPTCHA) ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }

  return { ok: true };
}
