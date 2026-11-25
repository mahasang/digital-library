import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isServiceRoleConfigured } from "@/lib/supabase/config";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit.server";
import {
  authenticateBearer,
  extractBearerToken,
  getMobileReadUrl,
  isValidSlug,
} from "@/lib/mobile/read-url.server";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SEC = 60;

function json(body: Record<string, unknown>, status: number, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

/**
 * ให้แอปมือถือขอ Signed URL "อ่านออนไลน์" ของงานวิจัยที่เผยแพร่แล้ว
 * (ดูเหตุผลและหลักความปลอดภัยใน lib/mobile/read-url.server.ts)
 *
 * ต้องส่ง `Authorization: Bearer <Supabase access token>` — ไม่มี/ไม่ถูกต้อง
 * → 401 คืนเฉพาะ `{ url }` ที่หมดอายุเอง (ไม่ส่งไฟล์ผ่านเซิร์ฟเวอร์)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return json({ error: "unavailable" }, 503);
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return json({ error: "unauthorized" }, 401);

  const { slug } = await params;
  if (!isValidSlug(slug)) return json({ error: "not_found" }, 404);

  const auth = await authenticateBearer(token);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const { allowed } = await checkRateLimit(
    rateLimitKeyForUser("mobile-read-url", auth.userId),
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SEC
  );
  if (!allowed) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(RATE_LIMIT_WINDOW_SEC) });
  }

  const result = await getMobileReadUrl(auth.client, auth.userId, slug);
  if (!result.ok) return json({ error: result.code }, result.status);

  // บันทึกประวัติการอ่านเหมือนหน้าอ่านบนเว็บ — ล้มเหลวไม่กระทบการอ่าน
  const { error: historyError } = await auth.client.rpc("log_reading_history", { p_slug: slug });
  if (historyError) {
    console.error("log_reading_history failed:", historyError.message);
  }

  return json({ url: result.url }, 200);
}
