import "server-only";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";
import type { DataResult } from "@/lib/data/superadmin-stats.server";

export interface AuthPolicyStatus {
  emailConfirmationRequired: boolean;
  signupDisabled: boolean;
}

/**
 * อ่านนโยบายการยืนยันอีเมล/การเปิดรับสมัครสมาชิกจริงจาก GoTrue โดยตรงผ่าน
 * endpoint สาธารณะ `/auth/v1/settings` (ไม่ต้องยืนยันตัวตน) — ค่านี้ตั้งได้
 * เฉพาะผ่าน Supabase Dashboard (cloud) หรือ supabase/config.toml (local)
 * เท่านั้น แอปนี้ไม่มีสิทธิ์เปลี่ยนค่านี้เอง จึงแสดงผลแบบอ่านอย่างเดียว
 */
export async function getAuthPolicyStatus(): Promise<DataResult<AuthPolicyStatus>> {
  if (!isSupabaseConfigured()) return { available: false };

  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as {
      mailer_autoconfirm?: boolean;
      disable_signup?: boolean;
    };

    return {
      available: true,
      data: {
        emailConfirmationRequired: data.mailer_autoconfirm !== true,
        signupDisabled: data.disable_signup === true,
      },
    };
  } catch (error) {
    console.error("getAuthPolicyStatus failed:", error);
    return { available: false };
  }
}
