import "server-only";
import type { LogProvider } from "@/lib/logging/types";

/** Provider สำรอง — ใช้เสมอเมื่อยังไม่ได้ตั้งค่า provider ภายนอก หรือใน development */
export const consoleProvider: LogProvider = {
  name: "console",
  async send(event) {
    const prefix = `[${event.severity}] ${event.routeType ?? "server"} ${event.routePath ?? ""}`;
    if (event.severity === "error") {
      console.error(prefix, event.message, event.extra ?? {});
    } else if (event.severity === "warning") {
      console.warn(prefix, event.message, event.extra ?? {});
    } else {
      console.info(prefix, event.message, event.extra ?? {});
    }
  },
};
