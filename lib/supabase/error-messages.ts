import { getLocale, getTranslations } from "next-intl/server";

/**
 * แปลข้อความ error ที่พบบ่อยจาก Supabase Auth ให้ตรงกับภาษาปัจจุบันของผู้ใช้
 * (เดิม hardcode ภาษาไทยเสมอไม่ว่า locale ไหน) เพื่อไม่ให้ผู้ใช้เห็นข้อความ
 * error ดิบจากระบบ (ตามหลัก security ที่ดี ไม่ควรเปิดเผยรายละเอียดภายในของ
 * ระบบ auth มากเกินไปด้วย)
 *
 * เรียก getLocale() เองภายในฟังก์ชันนี้แทนการรับ locale เป็น parameter จาก
 * caller — Server Action ที่เรียกใช้ (login/register/forgot-password/
 * reset-password actions.ts) ทำงานภายใต้ request เดียวกับหน้า /[locale]/...
 * ที่เรียกมันอยู่แล้ว จึง resolve locale ถูกต้องเองโดยอัตโนมัติ (pattern
 * เดียวกับที่ใช้ใน app/[locale]/dashboard/approvals/[id]/actions.ts) ผู้เรียก
 * จึงแค่ต้องเติม await หน้าการเรียกเท่านั้น ไม่ต้องแก้ signature อื่นใด
 */
export async function mapAuthErrorMessage(rawMessage: string): Promise<string> {
  const locale = await getLocale();
  const tErrors = await getTranslations({ locale, namespace: "errors" });
  const tAuth = await getTranslations({ locale, namespace: "auth" });
  const message = rawMessage.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return tErrors("invalidCredentials");
  }
  if (message.includes("email not confirmed")) {
    return tErrors("emailNotConfirmed");
  }
  if (message.includes("user already registered") || message.includes("already registered")) {
    return tErrors("alreadyRegistered");
  }
  if (message.includes("password should be at least")) {
    return tErrors("passwordTooShort");
  }
  if (message.includes("rate limit")) {
    return tErrors("rateLimitExceeded");
  }
  if (message.includes("network")) {
    return tErrors("networkError");
  }

  return tAuth("authErrorGeneric");
}
