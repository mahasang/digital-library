import "server-only";
import { validateOrcid } from "@/lib/validation/orcid";

/**
 * ORCID Public API แบบอ่านอย่างเดียว (read-only) — ใช้ Client Credentials
 * token (grant_type=client_credentials, scope=/read-public) จาก
 * ORCID_CLIENT_ID/ORCID_CLIENT_SECRET เดิม (ตัวเดียวกับ ORCID OAuth ในไฟล์
 * lib/orcid/orcid-oauth.server.ts — คนละ grant_type/scope เท่านั้น ไม่ใช่
 * credential ใหม่ ไม่มีค่าใช้จ่ายเพิ่ม) แล้วเรียก GET /v3.0/{orcid}/person
 * ของ pub.orcid.org (หรือ pub.sandbox.orcid.org ตาม ORCID_OAUTH_ENV เดิม)
 *
 * **สำคัญ**: ฟังก์ชันในไฟล์นี้อ่านข้อมูลจาก ORCID เท่านั้น ไม่เคยเขียนกลับไปยัง
 * ORCID และไม่เคยเขียนทับ authors.name/display_name_en/organization_id/
 * orcid_verified_at/orcid_oauth_verified_at ในฐานข้อมูลของเรา — ผู้เรียก
 * (checkOrcidPublicApiAction) เขียนได้แค่คอลัมน์ cache
 * orcid_api_checked_at/orcid_api_public_name เท่านั้น ดู
 * docs/orcid-integration.md §6
 */

export function isOrcidPublicApiConfigured(): boolean {
  return Boolean(process.env.ORCID_CLIENT_ID && process.env.ORCID_CLIENT_SECRET);
}

function isProductionOrcidEnv(): boolean {
  return process.env.ORCID_OAUTH_ENV === "production";
}

function getOrcidOAuthBaseUrl(): string {
  return isProductionOrcidEnv() ? "https://orcid.org" : "https://sandbox.orcid.org";
}

function getPubOrcidBaseUrl(): string {
  return isProductionOrcidEnv() ? "https://pub.orcid.org" : "https://pub.sandbox.orcid.org";
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

/** cache token ไว้ในหน่วยความจำของ server instance นี้ (ไม่ใช่ persistent
 * cache ข้าม instance — เพียงพอเพราะ token client_credentials ของ ORCID มีอายุ
 * ยาว (~20 ปี) ไม่จำเป็นต้องเก็บถาวรในฐานข้อมูล) รีเซ็ตเองเมื่อ process restart */
let cachedToken: CachedToken | null = null;

async function getOrcidPublicApiToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

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
        grant_type: "client_credentials",
        scope: "/read-public",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("getOrcidPublicApiToken: ORCID token endpoint ตอบกลับผิดพลาด:", res.status, body);
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.accessToken;
  } catch (error) {
    console.error(
      "getOrcidPublicApiToken: เรียก ORCID token endpoint ไม่สำเร็จ:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export type OrcidPublicLookupResult =
  | { status: "not_configured" }
  | { status: "invalid_format"; error: string }
  | { status: "not_found" }
  | { status: "no_public_data" }
  | { status: "rate_limited" }
  | { status: "error" }
  | { status: "found"; givenNames: string | null; familyName: string | null; creditName: string | null };

interface OrcidPersonResponse {
  name?: {
    visibility?: string;
    "given-names"?: { value?: string } | null;
    "family-name"?: { value?: string } | null;
    "credit-name"?: { value?: string } | null;
  } | null;
}

/** ตรวจสอบ ORCID iD กับ ORCID Public API — คืนค่าแบบ discriminated union
 * เสมอ ไม่ throw ออกไปให้ผู้เรียกต้องจัดการเอง (ผู้เรียกแสดงข้อความปลอดภัยแทน
 * ไม่เคยแสดง error ดิบจาก ORCID ให้ผู้ใช้เห็น) */
export async function lookupOrcidPublicRecord(orcid: string): Promise<OrcidPublicLookupResult> {
  if (!isOrcidPublicApiConfigured()) {
    return { status: "not_configured" };
  }

  const validation = validateOrcid(orcid);
  if (!validation.valid || !validation.formatted) {
    return { status: "invalid_format", error: validation.error ?? "รูปแบบ ORCID ไม่ถูกต้อง" };
  }

  const token = await getOrcidPublicApiToken();
  if (!token) {
    return { status: "error" };
  }

  try {
    const res = await fetch(`${getPubOrcidBaseUrl()}/v3.0/${validation.formatted}/person`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) {
      return { status: "not_found" };
    }
    if (res.status === 429) {
      return { status: "rate_limited" };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("lookupOrcidPublicRecord: ORCID person endpoint ตอบกลับผิดพลาด:", res.status, body);
      return { status: "error" };
    }

    const data = (await res.json()) as OrcidPersonResponse;
    const name = data.name;
    if (!name || name.visibility !== "public") {
      return { status: "no_public_data" };
    }

    return {
      status: "found",
      givenNames: name["given-names"]?.value ?? null,
      familyName: name["family-name"]?.value ?? null,
      creditName: name["credit-name"]?.value ?? null,
    };
  } catch (error) {
    console.error(
      "lookupOrcidPublicRecord: เรียก ORCID person endpoint ไม่สำเร็จ:",
      error instanceof Error ? error.message : error
    );
    return { status: "error" };
  }
}
