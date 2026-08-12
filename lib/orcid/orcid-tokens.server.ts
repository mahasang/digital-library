import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { OrcidTokenResponse } from "@/lib/orcid/orcid-oauth.server";

/**
 * เก็บ access/refresh token ของ ORCID ในตารางแยก `orcid_oauth_tokens`
 * (ไม่ grant ให้ authenticated เลย — Service Role เท่านั้น) ไม่เคยเก็บใน
 * `authors` ที่ RLS เปิดให้ทุกคนอ่านได้ ตามข้อกำหนดของ docs/orcid-integration.md
 */
export async function storeOrcidOAuthTokens(
  authorId: string,
  token: OrcidTokenResponse
): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.from("orcid_oauth_tokens").upsert({
    author_id: authorId,
    orcid: token.orcid,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    token_type: token.token_type,
    scope: token.scope,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  });

  if (error) {
    console.error("storeOrcidOAuthTokens failed:", error.message);
  }
}
