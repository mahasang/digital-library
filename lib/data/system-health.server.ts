import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

export type HealthStatus = "ok" | "error" | "unknown";

export interface ServiceHealth {
  service: "database" | "auth" | "storage";
  status: HealthStatus;
  checkedAt: string;
  detail: string;
}

/**
 * ตรวจสอบสถานะ Database/Auth/Storage แบบสด (real-time) ทุกครั้งที่โหลดหน้า
 * — ไม่มีการแคช/บันทึกประวัติสถานะไว้ ตัวเลข "เวลาที่ตรวจสอบล่าสุด" คือเวลา
 * ที่ request นี้เกิดขึ้นจริงเสมอ แต่ละบริการตรวจสอบอิสระต่อกัน หนึ่งบริการ
 * ตรวจสอบไม่ได้จะไม่กระทบผลของบริการอื่น และไม่มีรายละเอียด error ดิบของ
 * Postgres/GoTrue หลุดออกไปในข้อความ (มีแต่สถานะ ok/error และคำอธิบายทั่วไป)
 */
export async function checkSystemHealth(): Promise<ServiceHealth[]> {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return (["database", "auth", "storage"] as const).map((service) => ({
      service,
      status: "unknown",
      checkedAt,
      detail: "ยังไม่ได้ตั้งค่า Supabase",
    }));
  }

  const [database, auth, storage] = await Promise.all([
    checkDatabase(checkedAt),
    checkAuth(checkedAt),
    checkStorage(checkedAt),
  ]);

  return [database, auth, storage];
}

async function checkDatabase(checkedAt: string): Promise<ServiceHealth> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("settings").select("id").limit(1);
    if (error) throw error;
    return { service: "database", status: "ok", checkedAt, detail: "เชื่อมต่อฐานข้อมูลได้ปกติ" };
  } catch (error) {
    console.error("checkSystemHealth: database check failed:", error);
    return {
      service: "database",
      status: "error",
      checkedAt,
      detail: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ในขณะนี้",
    };
  }
}

async function checkAuth(checkedAt: string): Promise<ServiceHealth> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { service: "auth", status: "ok", checkedAt, detail: "เชื่อมต่อ Supabase Auth ได้ปกติ" };
  } catch (error) {
    console.error("checkSystemHealth: auth check failed:", error);
    return {
      service: "auth",
      status: "error",
      checkedAt,
      detail: "ไม่สามารถเชื่อมต่อ Supabase Auth ได้ในขณะนี้",
    };
  }
}

async function checkStorage(checkedAt: string): Promise<ServiceHealth> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("superadmin_storage_usage");
    if (error) throw error;
    return { service: "storage", status: "ok", checkedAt, detail: "เชื่อมต่อ Supabase Storage ได้ปกติ" };
  } catch (error) {
    console.error("checkSystemHealth: storage check failed:", error);
    return {
      service: "storage",
      status: "error",
      checkedAt,
      detail: "ไม่สามารถเชื่อมต่อ Supabase Storage ได้ในขณะนี้",
    };
  }
}
