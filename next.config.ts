import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "@ducanh2912/next-pwa";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  eslint: {
    dirs: ["app", "components", "lib", "types", "data"],
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

// @ducanh2912/next-pwa วาง runtimeCaching ไว้ใต้ workboxOptions (ต่างจาก
// next-pwa เดิมของ shadowwalker ที่รับ runtimeCaching เป็น top-level option
// ตรงๆ) — ตรวจสอบจาก node_modules/@ducanh2912/next-pwa/dist/index.d.ts จริง
// ก่อนแก้ เพราะ prompt เขียนแบบ top-level ซึ่งไม่ผ่าน tsc (TS2353)
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // ========================================================
  // SECURITY: SW caching rules — ต้องตั้งค่าต่อไปนี้ทุกข้อ
  // ========================================================
  workboxOptions: {
    runtimeCaching: [
      // 1. Supabase API และ Auth — Network Only (ห้าม cache เด็ดขาด)
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
      },
      // 2. Next.js API routes ทั้งหมด — Network Only
      {
        urlPattern: /^\/api\/.*/i,
        handler: "NetworkOnly",
      },
      // 3. Signed URL / Storage (PDF files) — Network Only เด็ดขาด
      //    Signed URL มีอายุสั้น ถ้า cache แล้วจะเปิดไม่ได้หลัง URL หมดอายุ
      {
        urlPattern: /\/storage\/v1\/object\/.*/i,
        handler: "NetworkOnly",
      },
      // 4. Auth callbacks — Network Only
      {
        urlPattern: /\/(th|en|lo|vi)\/(auth|login|register|mfa-challenge|setup-mfa)\/.*/i,
        handler: "NetworkOnly",
      },
      // 5. Dashboard และ Superadmin pages — Network Only (ต้องการ fresh auth)
      {
        urlPattern: /\/(th|en|lo|vi)\/(dashboard|superadmin)\/.*/i,
        handler: "NetworkOnly",
      },
      // 6. Next.js static assets (_next/static) — Cache First (เป็น immutable)
      {
        urlPattern: /^\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year (immutable files)
          },
        },
      },
      // 7. Next.js image optimization — Stale While Revalidate
      {
        urlPattern: /^\/_next\/image\?.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-image",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
        },
      },
      // 8. Public assets (icons, pdf.worker) — Cache First
      {
        urlPattern: /^\/icons\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "public-icons",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      // 9. หน้าสาธารณะ (/th/, /en/, /lo/, /vi/ — research list, home) — Network First
      //    ถ้าออฟไลน์จะใช้ cached version ที่เคยเปิดมาแล้ว
      {
        urlPattern: /\/(th|en|lo|vi)(\/research)?$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "public-pages",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
});

// ครอบ withNextIntl ที่มีอยู่แล้ว — ลำดับสำคัญ: PWA ครอบ Intl ครอบ nextConfig
export default withPWA(withNextIntl(nextConfig));
