import { routing } from "@/i18n/routing";

/**
 * ทำความสะอาดปลายทาง `redirect` หลังล็อกอิน/ยืนยัน MFA ให้เป็น path ภายในเว็บที่
 * "ไม่มี" locale prefix
 *
 * ทำไมต้องตัด locale: middleware.ts เติม locale prefix ให้ `?redirect=` ที่ได้จาก
 * updateSession() เสมอ (เช่น `/login?redirect=/lo/submit-research`) แต่ปลายทางที่ใช้
 * ต่อ (`redirect({ href, locale })` ของ @/i18n/navigation และ `router.push` ของ
 * useRouter จาก @/i18n/navigation) เติม locale ให้เองอยู่แล้ว ถ้าส่ง `/lo/submit-research`
 * เข้าไปตรงๆ จะได้ `/lo/lo/submit-research` (หน้า 404)
 *
 * ความปลอดภัย: รับเฉพาะ path ภายในเว็บ — ปฏิเสธ `//host` (protocol-relative), `/\host`,
 * ค่าที่มีอักขระควบคุม และค่าที่ไม่ใช่ string แล้วใช้ `fallback` (ค่าเริ่มต้น "/") แทน
 */

const LOCALE_SEGMENT = new RegExp(`^/(?:${routing.locales.join("|")})(?=/|\\?|#|$)`);
// ปลายทางที่ถูกเติม prefix ซ้ำมาแล้ว (/lo/lo/...) ก็ตัดได้ แต่จำกัดรอบกันวนไม่รู้จบ
const MAX_STRIPPED_PREFIXES = 3;

export function sanitizeRedirectTarget(raw: unknown, fallback: string = "/"): string {
  if (typeof raw !== "string") return fallback;

  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // ห้ามมีอักขระควบคุมใน URL ปลายทาง (กัน header injection ผ่าน \r\n)
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  let path = value;
  for (let i = 0; i < MAX_STRIPPED_PREFIXES && LOCALE_SEGMENT.test(path); i++) {
    path = path.replace(LOCALE_SEGMENT, "");
  }

  // เหลือแค่ locale เฉยๆ (/lo) = หน้าแรก
  if (path === "") return "/";
  if (path.startsWith("?") || path.startsWith("#")) return `/${path}`;
  // หลังตัด prefix แล้วต้องยังเป็น path ภายใน (ไม่ใช่ //host ที่เกิดจากการตัด เช่น /lo//evil.com)
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
