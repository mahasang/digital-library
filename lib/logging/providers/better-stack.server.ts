import "server-only";
import type { LogProvider } from "@/lib/logging/types";

const DEFAULT_INGEST_URL = "https://in.logs.betterstack.com";

/**
 * ส่ง log ไปยัง Better Stack (Logtail) ผ่าน HTTP ingestion API ตรงๆ ไม่ต้องติดตั้ง SDK
 * เอกสาร: https://betterstack.com/docs/logs/http-rest-api/
 */
export function createBetterStackProvider(sourceToken: string, ingestUrl?: string): LogProvider {
  const endpoint = ingestUrl || DEFAULT_INGEST_URL;

  return {
    name: "betterstack",
    async send(event) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sourceToken}`,
          },
          body: JSON.stringify({
            dt: event.timestamp,
            level: event.severity,
            message: event.message,
            route_path: event.routePath ?? null,
            route_type: event.routeType ?? null,
            method: event.method ?? null,
            ...event.extra,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          console.error("BetterStackProvider: ingestion request failed with status", res.status);
        }
      } catch (err) {
        console.error(
          "BetterStackProvider: failed to send log:",
          err instanceof Error ? err.message : "unknown error"
        );
      }
    },
  };
}
