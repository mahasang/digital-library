/**
 * ตรวจสอบว่าตั้งค่า Supabase environment variables ไว้แล้วหรือไม่
 * ใช้เป็นสวิตช์ fallback: หากยังไม่ตั้งค่า ระบบจะใช้ข้อมูลตัวอย่าง (Mock Data)
 * จาก data/research.ts และ data/categories.ts แทน เพื่อให้เว็บไซต์ยังใช้งานได้
 * แม้ยังไม่ได้เชื่อมต่อฐานข้อมูลจริง
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Service Role Key ใช้สร้าง Signed URL สำหรับไฟล์ PDF ใน private bucket
 * (ข้าม RLS ทั้งหมด — ใช้ได้เฉพาะโค้ดฝั่งเซิร์ฟเวอร์เท่านั้น)
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "ไม่พบการตั้งค่า NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY กรุณาตรวจสอบไฟล์ .env.local"
    );
  }

  return { url, anonKey };
}
