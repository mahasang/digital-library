export type LogSeverity = "error" | "warning" | "info";

/**
 * รูปแบบ event ที่ผ่านการตัดข้อมูลอ่อนไหวแล้ว (sanitize) ก่อนส่งออกนอกระบบ
 * ห้ามใส่ secret/token/connection string/stack trace ดิบลงในฟิลด์ใดๆ ที่นี่
 */
export interface SanitizedLogEvent {
  message: string;
  severity: LogSeverity;
  timestamp: string;
  routePath?: string;
  routeType?: string;
  method?: string;
  extra?: Record<string, string | number | boolean | null>;
}

/** Abstraction ของผู้ให้บริการ logging รวมศูนย์ — เพิ่มผู้ให้บริการใหม่โดย implement interface นี้ */
export interface LogProvider {
  name: string;
  send(event: SanitizedLogEvent): Promise<void>;
}
