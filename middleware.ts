import { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const LOCALE_PREFIX_PATTERN = /^\/(th|en|lo|vi)(?=\/|$)/;

function addLocalePrefix(pathname: string, locale: string): string {
  if (LOCALE_PREFIX_PATTERN.test(pathname)) return pathname;
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

/**
 * lib/supabase/middleware.ts (role rank guard, MFA aal2 step-up) เป็นไฟล์ที่
 * ห้ามแตะ — โครงการนี้จึงไม่สามารถทำให้ตัว updateSession() รู้จัก locale
 * prefix ได้โดยตรง (มันเทียบ pathname กับ ROLE_REQUIRED_PREFIXES/
 * LOGIN_REQUIRED_PREFIXES ตรงๆ และ redirect ไปยัง path เปล่าอย่าง /login,
 * /403, /setup-mfa, /mfa-challenge) จึงทำ 2 อย่างที่นี่แทนโดยไม่แก้ไฟล์นั้น:
 *
 * 1. ก่อนเรียก updateSession() สร้าง request จำลองที่ตัด locale prefix ออก
 *    จาก pathname แล้ว (คงทุก header/cookie เดิมไว้) เพื่อให้การเทียบ prefix
 *    ภายในไฟล์นั้นทำงานถูกต้องเหมือนไม่มี i18n เข้ามาเกี่ยวข้องเลย
 * 2. ถ้า updateSession() ตัดสินใจ redirect (Location header ของ response) ให้
 *    เติม locale prefix กลับเข้าไปใน pathname ปลายทาง (และใน query param
 *    ?redirect= ถ้ามี) ก่อนส่งต่อ — ไม่ได้สร้าง response ใหม่ ใช้ response
 *    เดิมของ updateSession() เพื่อคง cookie/header อื่นๆ ที่มันตั้งไว้ครบถ้วน
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // /api/* ไม่เกี่ยวกับ locale เลย — คงพฤติกรรมเดิมทุกประการ (session
    // refresh ผ่าน updateSession() เหมือนก่อนมี i18n)
    return updateSession(request);
  }

  const localeMatch = pathname.match(LOCALE_PREFIX_PATTERN);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const strippedPathname = localeMatch
    ? pathname.slice(localeMatch[0].length) || "/"
    : pathname;

  const strippedUrl = request.nextUrl.clone();
  strippedUrl.pathname = strippedPathname;
  const strippedRequest = new NextRequest(strippedUrl, {
    headers: request.headers,
    method: request.method,
  });

  const authResponse = await updateSession(strippedRequest);

  const redirectLocation = authResponse.headers.get("location");
  if (redirectLocation) {
    const redirectUrl = new URL(redirectLocation);
    redirectUrl.pathname = addLocalePrefix(redirectUrl.pathname, locale);
    const redirectParam = redirectUrl.searchParams.get("redirect");
    if (redirectParam?.startsWith("/")) {
      redirectUrl.searchParams.set("redirect", addLocalePrefix(redirectParam, locale));
    }
    authResponse.headers.set("location", redirectUrl.toString());
    return authResponse;
  }

  const intlResponse = intlMiddleware(request);
  authResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });
  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * ทำงานกับทุก path ยกเว้นไฟล์ static, รูปภาพที่ปรับแต่งโดย Next.js,
     * /api/health (endpoint สาธารณะสำหรับ uptime monitor ไม่ต้องใช้ session
     * — ยกเว้นไว้เพื่อไม่ให้ทุก health check เรียก Supabase Auth โดยไม่จำเป็น)
     * และไฟล์ PWA (manifest.webmanifest, sw.js, workbox-*.js, offline.html)
     * ที่ต้อง serve เป็น static asset ตรงๆ ที่ root path (ไม่มี locale
     * prefix) เท่านั้น — ถ้าไม่ยกเว้น intlMiddleware จะ redirect
     * /manifest.webmanifest ไปเป็น /th/manifest.webmanifest ซึ่งไม่มีไฟล์
     * จริงอยู่ (404) ทำให้ browser ลง PWA ไม่ได้เลย offline.html เองก็ต้อง
     * ยกเว้นด้วยเหตุผลเดียวกัน (PWA Phase 2) — service worker ต้อง fetch
     * มันได้ตรงๆ ที่ /offline.html เสมอตอนออฟไลน์ ไม่ใช่ /th/offline.html
     * ไฟล์เหล่านี้ generate อัตโนมัติตอน build โดย @ducanh2912/next-pwa
     * (ยกเว้น offline.html ที่เป็นไฟล์ static เขียนมือ) ไม่เกี่ยวกับ locale
     * ใดๆ ทั้งสิ้น
     */
    "/((?!_next/static|_next/image|favicon.ico|covers/|mock-pdfs/|api/health|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|worker-.*\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
