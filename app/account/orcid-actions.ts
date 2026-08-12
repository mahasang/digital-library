"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isOrcidOAuthConfigured, buildOrcidAuthorizeUrl } from "@/lib/orcid/orcid-oauth.server";
import { createOrcidOAuthState } from "@/lib/orcid/orcid-state.server";
import { logAudit } from "@/lib/data/audit.server";
import type { ActionResult } from "@/lib/actions/types";

/** URL ปลายทางที่ ORCID ต้อง redirect กลับมาเสมอ — ต้องตรงกับที่ลงทะเบียนไว้ใน
 * ORCID Developer Tools ทุกตัวอักษร คำนวณจาก request headers เพื่อให้ใช้ได้ทั้ง
 * local dev และ production โดยไม่ต้องเพิ่ม environment variable ใหม่ */
async function getOrcidCallbackUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/orcid/callback`;
}

/**
 * เริ่มขั้นตอน ORCID OAuth — เรียกจากปุ่ม "เชื่อม ORCID" ที่ /account เท่านั้น
 * ผู้ใช้ต้องมีบัญชีที่เชื่อมกับข้อมูลผู้วิจัย (`authors.profile_id`) ไว้แล้ว
 * (เจ้าหน้าที่เป็นผู้เชื่อมให้ที่ /dashboard/authors/[id] — ดู
 * app/dashboard/authors/actions.ts) มิเช่นนั้นไม่มี author ให้ผูก ORCID เข้าไป
 */
export async function startOrcidConnectAction(): Promise<ActionResult> {
  if (!isOrcidOAuthConfigured()) {
    return { status: "error", message: "ผู้ดูแลระบบยังไม่ได้ตั้งค่า ORCID OAuth กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };

  const { data: author } = await supabase
    .from("authors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!author) {
    return {
      status: "error",
      message: "บัญชีของคุณยังไม่ได้เชื่อมกับข้อมูลผู้วิจัยในระบบ กรุณาติดต่อเจ้าหน้าที่ห้องสมุดให้เชื่อมบัญชีให้ก่อน",
    };
  }

  const state = await createOrcidOAuthState(user.id, author.id);
  if (!state) {
    return { status: "error", message: "ไม่สามารถเริ่มการเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง" };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "orcid_oauth_start",
    entityType: "authors",
    entityId: author.id,
  });

  const redirectUri = await getOrcidCallbackUrl();
  redirect(buildOrcidAuthorizeUrl(state, redirectUri));
}

export { getOrcidCallbackUrl };
