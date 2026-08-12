import "server-only";

/**
 * ORCID OAuth (Public API, free tier — scope `/authenticate` เท่านั้น ไม่ใช่
 * Member API ที่เสียค่าใช้จ่าย) — ใช้ยืนยันตัวตนผู้วิจัยด้วยตนเองผ่านการล็อกอิน
 * ORCID จริง แยกออกจากการยืนยันด้วยตาของเจ้าหน้าที่เดิม (`orcid_verified_at`)
 * โดยสิ้นเชิง — ดู docs/orcid-integration.md
 *
 * รองรับทั้ง ORCID Sandbox (สำหรับทดสอบ ไม่กระทบข้อมูล ORCID จริง) และ
 * Production ผ่าน `ORCID_OAUTH_ENV` — ค่าเริ่มต้นเป็น sandbox เสมอเพื่อความ
 * ปลอดภัย (ต้องตั้งค่า `ORCID_OAUTH_ENV=production` อย่างชัดเจนเท่านั้นถึงจะ
 * เชื่อมกับ ORCID จริง)
 */

export function isOrcidOAuthConfigured(): boolean {
  return Boolean(process.env.ORCID_CLIENT_ID && process.env.ORCID_CLIENT_SECRET);
}

function isProductionOrcidEnv(): boolean {
  return process.env.ORCID_OAUTH_ENV === "production";
}

function getOrcidOAuthBaseUrl(): string {
  return isProductionOrcidEnv() ? "https://orcid.org" : "https://sandbox.orcid.org";
}

export function getOrcidEnvLabel(): "production" | "sandbox" {
  return isProductionOrcidEnv() ? "production" : "sandbox";
}

/** สร้าง URL หน้ายืนยันตัวตนของ ORCID ให้ผู้วิจัย redirect ไป — เรียกจากฝั่ง
 * เซิร์ฟเวอร์เท่านั้น (Server Action) ไม่เคยสร้างที่ Client Component */
export function buildOrcidAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.ORCID_CLIENT_ID ?? "",
    response_type: "code",
    scope: "/authenticate",
    redirect_uri: redirectUri,
    state,
  });
  return `${getOrcidOAuthBaseUrl()}/oauth/authorize?${params.toString()}`;
}

export interface OrcidTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  orcid: string;
  name?: string;
}

/** แลก authorization code เป็น access token — เรียกฝั่งเซิร์ฟเวอร์เท่านั้น
 * (ต้องใช้ client_secret) คืน null เสมอเมื่อล้มเหลว (ไม่ throw ออกไปให้ผู้เรียก
 * ต้องจัดการเอง — ผู้เรียกแสดงข้อความปลอดภัยแทน) ORCID คืนค่า `orcid` ในตัว
 * token response โดยตรงสำหรับ scope `/authenticate` ไม่ต้องเรียก API แยกอีก
 * ครั้งเพื่อดึง ORCID iD ของผู้ยืนยัน */
export async function exchangeOrcidCode(
  code: string,
  redirectUri: string
): Promise<OrcidTokenResponse | null> {
  try {
    const res = await fetch(`${getOrcidOAuthBaseUrl()}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.ORCID_CLIENT_ID ?? "",
        client_secret: process.env.ORCID_CLIENT_SECRET ?? "",
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("exchangeOrcidCode: ORCID token endpoint ตอบกลับผิดพลาด:", res.status, body);
      return null;
    }

    return (await res.json()) as OrcidTokenResponse;
  } catch (error) {
    console.error(
      "exchangeOrcidCode: เรียก ORCID token endpoint ไม่สำเร็จ:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
