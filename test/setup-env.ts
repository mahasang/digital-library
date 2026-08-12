import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * โหลด .env.local แบบง่าย (ไม่มี dependency เพิ่ม) สำหรับ integration test ที่
 * ต้องต่อ local Supabase จริง (เช่น lib/data/research-search-rls.integration.test.ts)
 * — unit test ทั่วไปที่เป็น pure logic ไม่ต้องพึ่งไฟล์นี้เลย ถ้าไม่มี .env.local
 * (เช่นบนเครื่อง CI ที่ไม่ได้รัน local Supabase) จะไม่ error แค่ข้ามไปเฉยๆ —
 * integration test เองมีหน้าที่ตรวจสอบว่าต่อ Supabase ได้จริงก่อนแล้วค่อย skip
 * ตัวเองถ้าต่อไม่ได้ (ดู lib/data/research-search-rls.integration.test.ts)
 */
const envPath = path.resolve(__dirname, "..", ".env.local");

if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
