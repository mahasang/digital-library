/**
 * แปลข้อความ error ที่พบบ่อยจาก Supabase Auth ให้เป็นภาษาไทย
 * เพื่อไม่ให้ผู้ใช้เห็นข้อความ error ดิบจากระบบ (ตามหลัก security ที่ดี
 * ไม่ควรเปิดเผยรายละเอียดภายในของระบบ auth มากเกินไปด้วย)
 */
export function mapAuthErrorMessage(rawMessage: string): string {
  const message = rawMessage.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (message.includes("email not confirmed")) {
    return "กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมายของคุณ)";
  }
  if (message.includes("user already registered") || message.includes("already registered")) {
    return "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น";
  }
  if (message.includes("password should be at least")) {
    return "รหัสผ่านสั้นเกินไป กรุณาตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร";
  }
  if (message.includes("rate limit")) {
    return "มีการร้องขอบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง";
  }
  if (message.includes("network")) {
    return "ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
  }

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}
