import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface MyOrcidStatus {
  authorId: string;
  authorName: string;
  orcid: string | null;
  orcidVerifiedAt: string | null;
  orcidOauthVerifiedAt: string | null;
}

/** ข้อมูล ORCID ของผู้วิจัยที่บัญชีผู้ใช้ปัจจุบันถูกเชื่อมไว้ (authors.profile_id)
 * — คืน null ถ้าบัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลผู้วิจัยใดเลย (เจ้าหน้าที่ยังไม่
 * ได้เชื่อมให้ที่ /dashboard/authors/[id]) ใช้ที่หน้า /account เท่านั้น */
export async function getMyOrcidStatus(): Promise<MyOrcidStatus | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("authors")
    .select("id, name, orcid, orcid_verified_at, orcid_oauth_verified_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getMyOrcidStatus failed:", error.message);
    return null;
  }

  return {
    authorId: data.id,
    authorName: data.name,
    orcid: data.orcid,
    orcidVerifiedAt: data.orcid_verified_at,
    orcidOauthVerifiedAt: data.orcid_oauth_verified_at,
  };
}
