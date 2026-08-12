import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * ทำงานกับทุก path ยกเว้นไฟล์ static, รูปภาพที่ปรับแต่งโดย Next.js และ
     * /api/health (endpoint สาธารณะสำหรับ uptime monitor ไม่ต้องใช้ session
     * — ยกเว้นไว้เพื่อไม่ให้ทุก health check เรียก Supabase Auth โดยไม่จำเป็น)
     */
    "/((?!_next/static|_next/image|favicon.ico|covers/|mock-pdfs/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
