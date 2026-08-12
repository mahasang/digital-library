import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { exchangeOrcidCode } from "@/lib/orcid/orcid-oauth.server";
import { consumeOrcidOAuthState } from "@/lib/orcid/orcid-state.server";
import { storeOrcidOAuthTokens } from "@/lib/orcid/orcid-tokens.server";
import { validateOrcid } from "@/lib/validation/orcid";
import { logAudit } from "@/lib/data/audit.server";

/**
 * ปลายทาง callback ของ ORCID OAuth — ORCID redirect ผู้ใช้กลับมาที่นี่พร้อม
 * `?code=&state=` (สำเร็จ) หรือ `?error=access_denied&state=` (ผู้ใช้กดยกเลิก
 * ที่หน้ายืนยันของ ORCID) เสมอ ทำงานฝั่งเซิร์ฟเวอร์ทั้งหมด (แลก code เป็น token
 * ต้องใช้ client_secret ห้ามทำที่ Client Component เด็ดขาด)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = (status: string, reason?: string) =>
    NextResponse.redirect(`${origin}/account?orcid=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`);

  if (!isSupabaseConfigured()) return redirectTo("error", "ระบบยังไม่ได้เชื่อมต่อ Supabase");

  const state = searchParams.get("state") ?? "";
  const errorParam = searchParams.get("error");
  const code = searchParams.get("code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectTo("error", "กรุณาเข้าสู่ระบบก่อนดำเนินการ");

  // ผู้ใช้กดยกเลิกที่หน้ายืนยันของ ORCID — ยัง "ใช้" state ทิ้งเสมอ (กัน state
  // ค้างในระบบแม้ flow จะไม่จบแบบสำเร็จ)
  if (errorParam) {
    await consumeOrcidOAuthState(state, user.id);
    return redirectTo("cancelled");
  }

  if (!code) return redirectTo("error", "ไม่พบรหัสยืนยันจาก ORCID");

  const consumed = await consumeOrcidOAuthState(state, user.id);
  if (!consumed) {
    return redirectTo("error", "เซสชันเชื่อมต่อ ORCID หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
  }

  const proto = request.headers.get("x-forwarded-proto") ?? (origin.startsWith("http://") ? "http" : "https");
  const host = request.headers.get("host") ?? new URL(origin).host;
  const redirectUri = `${proto}://${host}/api/orcid/callback`;

  const token = await exchangeOrcidCode(code, redirectUri);
  if (!token) {
    return redirectTo("error", "ไม่สามารถยืนยันตัวตนกับ ORCID ได้ กรุณาลองใหม่อีกครั้ง");
  }

  const validated = validateOrcid(token.orcid);
  if (!validated.valid || !validated.formatted) {
    return redirectTo("error", "ORCID ที่ได้รับไม่ถูกต้อง");
  }

  const service = createServiceRoleClient();

  const { data: existing } = await service
    .from("authors")
    .select("orcid")
    .eq("id", consumed.authorId)
    .maybeSingle();

  const { error: updateError } = await service
    .from("authors")
    .update({
      orcid: validated.formatted,
      orcid_oauth_verified_at: new Date().toISOString(),
      // ORCID เปลี่ยนไปจากที่เคยบันทึกไว้ — ล้างสถานะยืนยันด้วยตาของเจ้าหน้าที่เดิม
      // (ต้องยืนยันใหม่เสมอเมื่อค่าเปลี่ยน เหมือน updateAuthorAction เดิม)
      ...(existing?.orcid !== validated.formatted ? { orcid_verified_at: null } : {}),
    })
    .eq("id", consumed.authorId);

  if (updateError) {
    if (updateError.code === "23505") {
      await logAudit(service, {
        actorId: user.id,
        action: "orcid_oauth_conflict",
        entityType: "authors",
        entityId: consumed.authorId,
        metadata: { orcid: validated.formatted },
      });
      return redirectTo(
        "error",
        "ORCID นี้ถูกใช้กับผู้วิจัยคนอื่นในระบบแล้ว กรุณาติดต่อเจ้าหน้าที่ห้องสมุดเพื่อตรวจสอบ"
      );
    }
    console.error("ORCID callback: update authors failed:", updateError.message);
    return redirectTo("error", "ไม่สามารถบันทึกการเชื่อมต่อ ORCID ได้ กรุณาลองใหม่อีกครั้ง");
  }

  await storeOrcidOAuthTokens(consumed.authorId, token);

  await logAudit(service, {
    actorId: user.id,
    action: "orcid_oauth_connect",
    entityType: "authors",
    entityId: consumed.authorId,
    metadata: { orcid: validated.formatted },
  });

  return redirectTo("connected");
}
