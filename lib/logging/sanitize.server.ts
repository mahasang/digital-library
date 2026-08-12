import "server-only";

/**
 * รูปแบบข้อมูลอ่อนไหวที่ต้องตัดออกก่อนส่งข้อความ error ออกนอกระบบเสมอ —
 * ครอบคลุม connection string, Bearer token, Supabase key, JWT และรูปแบบ
 * `key=value`/`token=value`/`secret=value`/`password=value` ทั่วไป
 */
const REDACTION_PATTERNS: RegExp[] = [
  /postgres(?:ql)?:\/\/[^\s"']+/gi,
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s"',;]+/gi,
];

/** ตัดข้อมูลอ่อนไหว (connection string/token/secret/JWT) ออกจากข้อความก่อนส่งออกนอกระบบ */
export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, "[redacted]");
  }
  return result;
}
