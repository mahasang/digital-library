import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { canReadOnline } from "@/lib/labels";
import { getResearchReadUrl } from "@/lib/storage/signed-url.server";
import type { AccessLevel } from "@/types/research";
import type { ScanStatusRow } from "@/lib/supabase/types";

/**
 * ตัวช่วยของ endpoint `GET /api/mobile/research/[slug]/read-url` — ให้แอปมือถือ
 * (Expo) ขอ Signed URL สำหรับ "อ่านออนไลน์" ของสมาชิกทั่วไปได้อย่างปลอดภัย
 *
 * ทำไมต้องมี endpoint นี้: Storage RLS ของ bucket `research-documents` อนุญาต
 * ให้อ่านเฉพาะเจ้าของไฟล์หรือ role ตั้งแต่ librarian ขึ้นไปเท่านั้น (ตั้งใจ
 * ไม่ผ่อนปรน) แอปมือถือจึงสร้าง Signed URL เองฝั่ง client ให้สมาชิกทั่วไปไม่ได้
 * เว็บแก้ปัญหานี้ด้วยการให้เซิร์ฟเวอร์ (Service Role) สร้างลิงก์หลังตรวจสิทธิ์เอง
 * — endpoint นี้ทำแบบเดียวกันให้แอป โดย **ไม่แก้ RLS/นโยบาย Storage ใดๆ**
 *
 * หลักความปลอดภัย:
 * - ยืนยันตัวตนด้วย Bearer access token ของ Supabase (ตรวจกับ Supabase Auth
 *   ฝั่งเซิร์ฟเวอร์ ไม่เชื่อ payload ของ JWT เอง)
 * - อ่านข้อมูลงานวิจัย/สิทธิ์ ผ่าน client ที่ถือสิทธิ์ของผู้ใช้คนนั้น (RLS เดิม
 *   ยังเป็นผู้ตัดสินว่าเห็นรายการได้หรือไม่) ไม่ใช้ Service Role อ่านตาราง
 * - Service Role ใช้เฉพาะในขั้นสร้าง Signed URL ผ่าน `getResearchReadUrl` เดิม
 *   (ซึ่งตรวจ access_level / grant / สถานะสแกนอีกชั้น) — ไม่ได้แก้ฟังก์ชันนั้น
 */

export type MobileReadUrlErrorCode =
  | "read_not_allowed"
  | "not_found"
  | "scan_pending"
  | "unavailable";

export type MobileReadUrlResult =
  | { ok: true; url: string }
  | { ok: false; status: 403 | 404 | 409 | 502; code: MobileReadUrlErrorCode };

const BEARER_PATTERN = /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/i;
const MAX_SLUG_LENGTH = 200;

// ใช้เลือก error code เท่านั้น — การบล็อกจริงทำใน getResearchReadUrl (แหล่งตัดสิน
// หลัก) ถ้ารายการนี้คลาดเคลื่อน ผลคือได้ code "unavailable" แทน "scan_pending"
// ไม่ได้ทำให้ไฟล์ที่ยังไม่ผ่านสแกนรั่วออกไป
const SCAN_BLOCKED: readonly string[] = ["pending", "infected", "error"];

export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = BEARER_PATTERN.exec(header.trim());
  return match ? match[1] : null;
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH;
}

export interface BearerAuth {
  client: SupabaseClient<Database>;
  userId: string;
}

/**
 * ตรวจ Bearer token กับ Supabase Auth แล้วคืน client ที่ถือสิทธิ์ของผู้ใช้คนนั้น
 * (ไม่อ่าน/เขียน cookies ไม่เก็บ session) — token ไม่ถูกต้อง/หมดอายุ → null
 */
export async function authenticateBearer(token: string): Promise<BearerAuth | null> {
  const { url, anonKey } = getSupabaseEnv();
  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

/**
 * ตรวจสิทธิ์อ่านแบบเดียวกับหน้า /research/[id]/read ของเว็บ แล้วขอ Signed URL
 * `client` ต้องเป็น client ที่ถือสิทธิ์ผู้ใช้ (จาก authenticateBearer) เท่านั้น
 */
export async function getMobileReadUrl(
  client: SupabaseClient<Database>,
  userId: string,
  slug: string
): Promise<MobileReadUrlResult> {
  const { data: item, error: itemError } = await client
    .from("research_items")
    .select("id, access_level, pdf_file, scan_status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (itemError) {
    console.error("getMobileReadUrl: research lookup failed:", itemError.message);
    return { ok: false, status: 502, code: "unavailable" };
  }
  if (!item || !item.pdf_file) {
    return { ok: false, status: 404, code: "not_found" };
  }

  const accessLevel = item.access_level as AccessLevel;
  const scanStatus = item.scan_status as ScanStatusRow;

  // grant "อ่าน" ที่ยัง active — เป็นชั้นเสริมแบบ OR กับ access_level เหมือนเว็บ
  // (lib/data/access-grants.server.ts) RLS ให้ผู้ใช้เห็นเฉพาะ grant ของตัวเอง
  const nowIso = new Date().toISOString();
  const { data: grant, error: grantError } = await client
    .from("document_access_grants")
    .select("id")
    .eq("research_item_id", item.id)
    .eq("user_id", userId)
    .eq("access_type", "read")
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1)
    .maybeSingle();
  if (grantError) {
    console.error("getMobileReadUrl: grant lookup failed:", grantError.message);
  }
  const hasReadGrant = Boolean(grant);

  if (!canReadOnline(accessLevel) && !hasReadGrant) {
    return { ok: false, status: 403, code: "read_not_allowed" };
  }

  const signed = await getResearchReadUrl(item.pdf_file, accessLevel, hasReadGrant, scanStatus);
  if (signed.error || !signed.url) {
    if (SCAN_BLOCKED.includes(scanStatus)) {
      return { ok: false, status: 409, code: "scan_pending" };
    }
    return { ok: false, status: 502, code: "unavailable" };
  }

  return { ok: true, url: signed.url };
}
