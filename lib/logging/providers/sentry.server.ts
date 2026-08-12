import "server-only";
import type { LogProvider } from "@/lib/logging/types";

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

/** แยกส่วนประกอบของ Sentry DSN (รูปแบบ https://<public_key>@<host>/<project_id>) */
function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId || !url.host) return null;
    return { publicKey, host: url.host, projectId };
  } catch {
    return null;
  }
}

/**
 * ส่ง event ไปยัง Sentry ผ่าน Envelope API ตรงๆ (ไม่ติดตั้ง @sentry/nextjs SDK
 * เพื่อลดความเสี่ยงต่อการเปลี่ยนแปลงโครงสร้างโปรเจกต์ใหญ่) รองรับเฉพาะ error
 * event แบบข้อความ ไม่ส่ง stack trace ดิบหรือ breadcrumb ใดๆ
 * เอกสาร: https://develop.sentry.dev/sdk/data-model/envelopes/
 */
export function createSentryProvider(dsn: string, environment: string): LogProvider | null {
  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error("SentryProvider: SENTRY_DSN รูปแบบไม่ถูกต้อง ปิดการส่ง log ไปยัง Sentry");
    return null;
  }

  const envelopeUrl = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  return {
    name: "sentry",
    async send(event) {
      try {
        const eventId = crypto.randomUUID().replace(/-/g, "");
        const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() });
        const itemHeader = JSON.stringify({ type: "event" });
        const body = JSON.stringify({
          event_id: eventId,
          timestamp: Math.floor(Date.parse(event.timestamp) / 1000),
          platform: "node",
          level: event.severity,
          environment,
          message: { formatted: event.message },
          tags: {
            route_path: event.routePath ?? "unknown",
            route_type: event.routeType ?? "unknown",
            method: event.method ?? "unknown",
          },
          extra: event.extra ?? {},
        });
        const envelope = `${header}\n${itemHeader}\n${body}\n`;

        const res = await fetch(envelopeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-sentry-envelope" },
          body: envelope,
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          console.error("SentryProvider: envelope request failed with status", res.status);
        }
      } catch (err) {
        console.error(
          "SentryProvider: failed to send log:",
          err instanceof Error ? err.message : "unknown error"
        );
      }
    },
  };
}
