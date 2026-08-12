import "server-only";
import crypto from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isServiceRoleConfigured } from "@/lib/supabase/config";

/**
 * state แบบใช้ครั้งเดียวสำหรับ ORCID OAuth flow (กัน CSRF ตามมาตรฐาน OAuth
 * Authorization Code flow) — เก็บใน `orcid_oauth_states` (Service Role
 * เท่านั้น ไม่มี grant ให้ authenticated เลย) ผูกกับทั้งผู้ใช้และ author ที่จะ
 * เชื่อมโยง ป้องกันผู้ใช้คนอื่นสวม state ของคนอื่นแม้จะเดา/ขโมย state ได้
 * (ต้องตรงกับ user_id ของ session ปัจจุบันด้วยเสมอ ดู consumeOrcidOAuthState)
 */

export async function createOrcidOAuthState(userId: string, authorId: string): Promise<string | null> {
  if (!isServiceRoleConfigured()) return null;

  const service = createServiceRoleClient();
  // ล้าง state ที่หมดอายุไปแล้วแบบ opportunistic (ไม่มี cron แยกสำหรับตารางเล็กนี้)
  await service.from("orcid_oauth_states").delete().lt("expires_at", new Date().toISOString());

  const state = crypto.randomBytes(32).toString("hex");
  const { error } = await service
    .from("orcid_oauth_states")
    .insert({ state, user_id: userId, author_id: authorId });

  if (error) {
    console.error("createOrcidOAuthState failed:", error.message);
    return null;
  }
  return state;
}

export interface ConsumedOrcidState {
  userId: string;
  authorId: string;
}

/** ตรวจสอบและ "ใช้" state ทันที (ลบทิ้งไม่ว่าผลจะเป็นอย่างไร — ใช้ซ้ำไม่ได้
 * เด็ดขาดแม้ตรวจสอบผ่าน) คืน null หาก state ไม่ถูกต้อง/หมดอายุ/ไม่ตรงกับผู้ใช้
 * ปัจจุบัน (ป้องกัน state ของผู้ใช้ A ถูกนำไปใช้กับ session ของผู้ใช้ B) */
export async function consumeOrcidOAuthState(
  state: string,
  expectedUserId: string
): Promise<ConsumedOrcidState | null> {
  if (!isServiceRoleConfigured() || !state) return null;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("orcid_oauth_states")
    .select("user_id, author_id, expires_at")
    .eq("state", state)
    .maybeSingle();

  await service.from("orcid_oauth_states").delete().eq("state", state);

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  if (data.user_id !== expectedUserId) return null;

  return { userId: data.user_id, authorId: data.author_id };
}
