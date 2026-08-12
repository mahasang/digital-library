import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/config";

/**
 * Supabase client สำหรับอ่านข้อมูลสาธารณะของหน้าแรกที่ปลอดภัยต่อการ cache
 * ข้าม request/ข้ามผู้ใช้ (Hallmark — public homepage caching)
 *
 * ต่างจาก lib/supabase/server.ts (createClient ที่ผูกกับ cookies ของ request
 * ปัจจุบันเสมอ — ใช้สิทธิ์ของผู้ใช้จริงถ้า login อยู่) client นี้ใช้ Anon key
 * ล้วนๆ และ**ไม่อ่าน cookies ใดๆ เลย** จึงมีพฤติกรรมเหมือนกันทุกครั้งไม่ว่าใคร
 * จะเป็นผู้เรียก (มองเห็นเฉพาะแถวที่ RLS policy อนุญาตให้ role "anon" เห็น
 * เท่านั้นเสมอ ไม่ว่าผู้เข้าชมจริงจะ login อยู่หรือมีสิทธิ์สูงแค่ไหนก็ตาม)
 *
 * เหตุผลที่ต้องแยก client ต่างหาก: unstable_cache() (ดู lib/cache/public-home.ts)
 * เก็บผลลัพธ์ไว้ใช้ซ้ำข้าม request และข้ามผู้ใช้ทุกคน — ถ้าใช้ client ที่ผูกกับ
 * cookies ของผู้ใช้คนใดคนหนึ่งไปห่อด้วย unstable_cache ผลลัพธ์ที่คำนวณจากสิทธิ์
 * ของผู้ใช้คนแรกที่เรียก (เช่น เห็นงานวิจัย member_only/staff_only เพิ่มเติม)
 * อาจถูกนำไปแสดงผลซ้ำให้ผู้เข้าชมคนอื่นที่ไม่มีสิทธิ์เห็นข้อมูลนั้นจริงๆ ได้ —
 * เป็นช่องโหว่ข้อมูลรั่วไหลข้ามผู้ใช้ที่ร้ายแรง client นี้ป้องกันปัญหานี้ตั้งแต่ต้น
 * ทาง เพราะไม่มีทางพาสิทธิ์ของผู้ใช้คนใดติดไปกับผลลัพธ์ที่ cache ไว้ได้เลย
 *
 * **กติกาการใช้งาน**: ใช้เฉพาะกับ query ที่ตั้งใจให้ผู้เยี่ยมชมที่ไม่ login เห็น
 * ได้อยู่แล้วภายใต้ RLS เดิม (เช่น การตั้งค่าระบบสาธารณะ, หมวดหมู่ที่เปิดใช้งาน,
 * งานวิจัยที่เผยแพร่แล้วระดับ public/read_only/metadata_only) **ห้ามใช้กับ
 * ข้อมูลที่ผูกกับตัวผู้ใช้เด็ดขาด** (session, บทบาท/สิทธิ์, การแจ้งเตือน, คำขอ
 * เข้าถึงเอกสาร, Signed URL, งานวิจัยระดับ member_only/staff_only) — ไม่ใช่แค่
 * เพราะ client นี้จะมองไม่เห็นข้อมูลเหล่านั้นอยู่แล้ว (RLS ปฏิเสธ role "anon")
 * แต่เพราะการนำ query ประเภทนั้นมาห่อด้วย unstable_cache ด้วยกลไกเดียวกันนี้จะ
 * ผิดหลักการตั้งแต่ต้น ไม่ว่า client จะเป็นตัวไหนก็ตาม
 *
 * ไม่ใช้ service_role — client นี้ยังคงอยู่ภายใต้ RLS ปกติทุกประการ เพียงแค่
 * เป็นมุมมองของ role "anon" เสมอ ไม่ใช่การข้าม RLS แบบ
 * lib/supabase/service.ts
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
