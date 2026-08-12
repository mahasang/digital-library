import "server-only";

/**
 * แปลง error จาก Postgres/Supabase ให้เป็นข้อความปลอดภัยสำหรับแสดงต่อผู้ใช้
 * ห้ามให้ raw Postgres error, SQL, stack trace หลุดออกไปที่ UI เด็ดขาด
 *
 * ข้อยกเว้นเดียว: error ที่มี code === 'P0001' คือข้อความภาษาไทยที่แอปนี้
 * ตั้งใจ `raise exception ... using errcode = 'P0001'` ขึ้นเองในฝั่งฐานข้อมูล
 * (เช่น กันถอดถอน Super Admin คนสุดท้าย) จึงปลอดภัยที่จะแสดงตรงๆ — error code
 * อื่นทั้งหมด (constraint violation, connection error ฯลฯ) จะถูกแทนที่ด้วย
 * ข้อความทั่วไปเสมอ ส่วนรายละเอียดจริงถูก log ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น
 */

const INTENTIONAL_APP_ERROR_CODE = "P0001";

interface ErrorLike {
  message?: unknown;
  code?: unknown;
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && typeof (error as ErrorLike).message === "string") {
    return (error as ErrorLike).message as string;
  }
  return null;
}

function extractCode(error: unknown): string | null {
  if (error && typeof error === "object" && typeof (error as ErrorLike).code === "string") {
    return (error as ErrorLike).code as string;
  }
  return null;
}

/**
 * @param error error ดิบจาก Supabase (`{ error }` จาก query) หรือ catch block
 * @param fallbackMessage ข้อความทั่วไปที่จะแสดงแทนเมื่อ error ไม่ใช่ข้อความที่ตั้งใจให้ผู้ใช้เห็น
 * @param logContext ป้ายกำกับสั้นๆ สำหรับ console.error ฝั่งเซิร์ฟเวอร์ (ชื่อฟังก์ชัน/Action)
 */
export function toSafeErrorMessage(
  error: unknown,
  fallbackMessage: string,
  logContext: string
): string {
  const rawMessage = extractMessage(error);
  const code = extractCode(error);

  console.error(`${logContext}:`, rawMessage ?? error, code ? `(code: ${code})` : "");

  if (code === INTENTIONAL_APP_ERROR_CODE && rawMessage) {
    return rawMessage;
  }

  return fallbackMessage;
}
