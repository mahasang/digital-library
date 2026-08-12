import "server-only";
import { consoleProvider } from "@/lib/logging/providers/console.server";
import { createBetterStackProvider } from "@/lib/logging/providers/better-stack.server";
import { createSentryProvider } from "@/lib/logging/providers/sentry.server";
import { redactSecrets } from "@/lib/logging/sanitize.server";
import type { LogProvider, SanitizedLogEvent } from "@/lib/logging/types";

/**
 * เลือก logging provider จาก environment variables — `LOG_PROVIDER` กำหนดว่า
 * จะใช้ตัวไหน ('sentry' | 'betterstack') ถ้าไม่ได้ตั้งค่าหรือขาด key ที่จำเป็น
 * จะคืนค่า null (fallback เป็น console เท่านั้น ไม่ทำให้ระบบพัง)
 */
function resolveExternalProvider(): LogProvider | null {
  const providerName = (process.env.LOG_PROVIDER || "").trim().toLowerCase();

  if (providerName === "sentry") {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return null;
    return createSentryProvider(dsn, process.env.VERCEL_ENV || process.env.NODE_ENV || "production");
  }

  if (providerName === "betterstack") {
    const token = process.env.LOGGING_BETTERSTACK_SOURCE_TOKEN;
    if (!token) return null;
    return createBetterStackProvider(token, process.env.LOGGING_BETTERSTACK_INGEST_URL);
  }

  return null;
}

let cachedProvider: LogProvider | null | undefined;
function getExternalProvider(): LogProvider | null {
  if (cachedProvider === undefined) cachedProvider = resolveExternalProvider();
  return cachedProvider;
}

/** ใช้ที่หน้า /superadmin/system-logs เพื่อแสดงสถานะการเชื่อมต่อจริง (ไม่ใช่ข้อมูลสมมติ) */
export function getLoggingProviderStatus(): { configured: boolean; providerName: string | null } {
  const provider = getExternalProvider();
  return { configured: provider !== null, providerName: provider?.name ?? null };
}

/**
 * บันทึกข้อผิดพลาดของแอปพลิเคชัน — log ผ่าน console เสมอ (พฤติกรรมเดิม อ่านได้
 * จาก terminal ตอน dev หรือ Vercel Runtime Logs ตอน production) และส่งต่อไปยัง
 * external provider เพิ่มเติมเฉพาะตอน production ที่ตั้งค่า provider ไว้แล้ว
 * เท่านั้น (กันไม่ให้ log จาก local dev ไปปนกับ production monitoring โดยไม่ตั้งใจ)
 * ข้อความผ่าน `redactSecrets()` ตัด token/secret/connection string ออกก่อนส่ง
 * ออกนอกระบบเสมอ — เป็น best-effort ทั้งหมด (ส่งไม่สำเร็จก็ไม่ทำให้ request
 * ที่กำลัง error อยู่แล้วพังหนักขึ้นอีก)
 */
export async function logServerError(
  error: unknown,
  context: {
    routePath?: string;
    routeType?: string;
    method?: string;
    extra?: Record<string, string | number | boolean | null>;
  } = {}
): Promise<void> {
  const rawMessage = error instanceof Error ? error.message : String(error);

  await consoleProvider.send({
    message: rawMessage,
    severity: "error",
    timestamp: new Date().toISOString(),
    routePath: context.routePath,
    routeType: context.routeType,
    method: context.method,
    extra: context.extra,
  });

  if (process.env.NODE_ENV !== "production") return;

  const provider = getExternalProvider();
  if (!provider) return;

  const sanitizedEvent: SanitizedLogEvent = {
    message: redactSecrets(rawMessage).slice(0, 2000),
    severity: "error",
    timestamp: new Date().toISOString(),
    routePath: context.routePath,
    routeType: context.routeType,
    method: context.method,
    extra: context.extra,
  };

  try {
    await provider.send(sanitizedEvent);
  } catch {
    // best-effort เท่านั้น — ไม่ throw ต่อ
  }
}
