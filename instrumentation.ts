import { logServerError } from "@/lib/logging/logger.server";

/**
 * Hook มาตรฐานของ Next.js (App Router) — เรียกอัตโนมัติทุกครั้งที่เกิด error
 * ที่ไม่ได้ถูกจับใน Server Component/Server Action/Route Handler/Middleware
 * ใช้เป็นจุดเดียวสำหรับส่ง error ของทั้งแอปไปยัง centralized logging provider
 * (ผ่าน lib/logging/logger.server.ts) โดยไม่ต้องแก้โค้ดทุกจุดที่มี try/catch
 * — ไม่ส่ง headers ของ request ออกไปเลย (อาจมี cookie/authorization ปนอยู่)
 * ส่งเฉพาะ path/method/ประเภท route เท่านั้น
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  await logServerError(error, {
    routePath: context.routePath,
    routeType: context.routeType,
    method: request.method,
  });
}
