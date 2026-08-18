# PWA Phase 1 — Web App Manifest + Icons + Service Worker (Basic)

## Context

โปรเจกต์นี้คือ Next.js 15 App Router + TypeScript + Supabase digital research library
- URL structure: `app/[locale]/` รองรับ `/th/`, `/en/`, `/lo/` (next-intl v4, localePrefix: `always`, defaultLocale: `th`)
- Auth: Supabase cookie-based session, MFA (aal2) บังคับสำหรับ `/superadmin/*`
- PDF access: Signed URL อายุสั้น — ห้าม cache เด็ดขาด
- Dev port: 3001
- OS: Windows, shell: Git Bash

## Scope — ทำเฉพาะสิ่งต่อไปนี้เท่านั้น

1. สร้าง `public/manifest.webmanifest`
2. สร้าง placeholder icons ใน `public/icons/` (SVG → PNG ผ่าน sharp หรือ canvas)
3. เพิ่ม `<link rel="manifest">` และ `<meta name="theme-color">` ใน `app/[locale]/layout.tsx`
4. ติดตั้ง `next-pwa` และ config Service Worker ใน `next.config.ts`
5. ตั้งค่า SW caching rules ให้ปลอดภัย
6. รัน lint + tsc + test + build แล้วรายงานผล

## ห้ามทำ (Out of Scope)

- ห้ามแตะ RLS, middleware auth logic, signed URL logic, MFA flow
- ห้ามแตะ `app/api/` ทุกไฟล์
- ห้ามแตะ i18n messages หรือ translation logic
- ห้ามแตะ Supabase client, server actions, หรือ database schema
- ห้าม deploy หรือเปลี่ยน production config

---

## Step 1 — ตรวจไฟล์ก่อนทำ

ตรวจไฟล์ต่อไปนี้ก่อนเขียนโค้ดใดๆ:

```bash
# ดูโครงสร้าง public/
ls public/

# ดู next.config.ts ทั้งหมด
cat next.config.ts

# ดู app/[locale]/layout.tsx ส่วน <head> / metadata
cat "app/[locale]/layout.tsx"

# ดู middleware.ts เพื่อเข้าใจ matcher
cat middleware.ts

# ตรวจ next-pwa compatibility กับ Next.js 15
npm ls next
npm info @ducanh2912/next-pwa versions --json 2>/dev/null | tail -5
```

รายงานสิ่งที่พบก่อนดำเนินการต่อ

---

## Step 2 — ติดตั้ง next-pwa

ใช้ `@ducanh2912/next-pwa` ซึ่งเป็น fork ที่ support Next.js 13+ App Router
(อย่าใช้ `next-pwa` ตัวเดิมของ shadowwalker ซึ่ง outdated และไม่รองรับ App Router)

```bash
npm install @ducanh2912/next-pwa
```

ถ้า install แล้วพบ peer dependency warning กับ next 15 ให้รายงานพร้อม error message
ก่อนดำเนินการต่อ

---

## Step 3 — สร้าง Icons

สร้าง placeholder icons 2 ขนาดที่ PWA ต้องการขั้นต่ำ
เป็น SVG อย่างง่ายที่แสดงตัวอักษร "E" (ย่อจาก Ebooks) บนพื้นสี่เหลี่ยม

**สร้าง `public/icons/icon-192.svg`:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#1D4ED8"/>
  <text x="96" y="130" font-family="sans-serif" font-size="110" font-weight="700"
    text-anchor="middle" fill="white">E</text>
</svg>
```

**สร้าง `public/icons/icon-512.svg`:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1D4ED8"/>
  <text x="256" y="345" font-family="sans-serif" font-size="290" font-weight="700"
    text-anchor="middle" fill="white">E</text>
</svg>
```

> หมายเหตุ: SVG ใช้ได้กับ Chrome/Android โดยตรง ไม่ต้องแปลงเป็น PNG
> สำหรับ production จริงควรเปลี่ยนเป็น PNG และออกแบบ logo จริง
> แต่สำหรับ Phase 1 นี้ SVG เพียงพอสำหรับทดสอบการทำงาน

---

## Step 4 — สร้าง Web App Manifest

สร้างไฟล์ `public/manifest.webmanifest`:

```json
{
  "name": "ห้องสมุดงานวิจัย",
  "short_name": "Ebooks",
  "description": "ระบบห้องสมุดดิจิทัลและที่เก็บงานวิจัย",
  "start_url": "/th/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1D4ED8",
  "lang": "th",
  "dir": "ltr",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "categories": ["education", "books"]
}
```

**ข้อสังเกตสำคัญ:**
- `start_url: "/th/"` เพราะ defaultLocale คือ `th` และ middleware จะ redirect `/` → `/th/` อยู่แล้ว
- `scope: "/"` ครอบทุก locale (`/th/`, `/en/`, `/lo/`)
- ยังไม่ใส่ `shortcuts` หรือ `screenshots` ใน Phase 1 นี้

---

## Step 5 — เพิ่ม manifest link ใน layout

เปิด `app/[locale]/layout.tsx` แล้วเพิ่มใน metadata export หรือใน `<head>` ตามโครงสร้างที่มีอยู่

**ถ้า layout ใช้ Next.js `export const metadata`:**

```typescript
export const metadata: Metadata = {
  // ... metadata เดิมที่มีอยู่ ...
  manifest: "/manifest.webmanifest",
  themeColor: "#1D4ED8",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ebooks",
  },
};
```

**ถ้า layout ไม่มี metadata export หรือมีแบบ dynamic:**

เพิ่ม `<link>` และ `<meta>` โดยตรงใน `<head>` ของ component แทน

ให้ตรวจดูโครงสร้างจริงใน `app/[locale]/layout.tsx` ก่อนแล้วเลือกวิธีที่เหมาะสม

---

## Step 6 — Config next-pwa ใน next.config.ts

เปิด `next.config.ts` แล้วเพิ่ม wrapper ของ `@ducanh2912/next-pwa`
**ต้องครอบ `withNextIntl` ที่มีอยู่แล้ว** ไม่ใช่แทนที่

```typescript
import withPWAInit from "@ducanh2912/next-pwa";
// ... import เดิมที่มี (withNextIntl ฯลฯ) ...

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // ========================================================
  // SECURITY: SW caching rules — ต้องตั้งค่าต่อไปนี้ทุกข้อ
  // ========================================================
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
      urlPattern: /\/(th|en|lo)\/(auth|login|register|mfa-challenge|setup-mfa)\/.*/i,
      handler: "NetworkOnly",
    },
    // 5. Dashboard และ Superadmin pages — Network Only (ต้องการ fresh auth)
    {
      urlPattern: /\/(th|en|lo)\/(dashboard|superadmin)\/.*/i,
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
    // 9. หน้าสาธารณะ (/th/, /en/, /lo/ — research list, home) — Network First
    //    ถ้าออฟไลน์จะใช้ cached version ที่เคยเปิดมาแล้ว
    {
      urlPattern: /\/(th|en|lo)(\/research)?$/i,
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
});

// ครอบ withNextIntl ที่มีอยู่แล้ว — ลำดับสำคัญ: PWA ครอบ IntL ครอบ nextConfig
export default withPWA(withNextIntl(nextConfig));
```

**ตรวจสอบ:** ให้ดูโครงสร้าง `next.config.ts` จริงก่อน แล้วปรับให้ `withPWA` ครอบ `withNextIntl` อย่างถูกต้อง อย่าลบ `withNextIntl` ออก

---

## Step 7 — เพิ่ม SW files เข้า .gitignore

`@ducanh2912/next-pwa` จะ generate ไฟล์ต่อไปนี้ใน `public/` ตอน build:
- `public/sw.js`
- `public/workbox-*.js`
- `public/worker-*.js`

ไฟล์เหล่านี้ถูก generate อัตโนมัติทุก build — ไม่ควร commit เข้า Git

เพิ่มใน `.gitignore`:
```
# PWA generated files (auto-generated at build time)
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
public/worker-*.js
public/worker-*.js.map
```

---

## Step 8 — รัน Automated Checks

รันคำสั่งต่อไปนี้ตามลำดับ และรายงานผลทุกขั้น:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Unit tests
npm run test

# 4. Build (จะ generate sw.js ด้วย)
npm run build

# 5. ตรวจว่า SW files ถูก generate
ls public/sw.js public/workbox-*.js 2>/dev/null && echo "SW files generated OK" || echo "SW files NOT found"

# 6. ตรวจ manifest ถูก serve ได้
npm run start &
sleep 5
curl -s http://localhost:3001/manifest.webmanifest | head -5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/manifest.webmanifest
# ต้องได้ 200
pkill -f "next start" 2>/dev/null || true
```

**Note สำหรับ Windows:** ถ้า `pkill` ไม่ทำงานใน Git Bash ให้ใช้:
```powershell
Stop-Process -Name "node" -Force
```

---

## Step 9 — ตรวจสอบ Lighthouse PWA Score (ถ้า build ผ่าน)

```bash
npm run build && npm run start &
sleep 8
npx lighthouse http://localhost:3001/th/ \
  --only-categories=pwa \
  --output=json \
  --quiet \
  | python -c "import json,sys; d=json.load(sys.stdin); print('PWA score:', d['categories']['pwa']['score'])"
```

ถ้า Python ไม่มี ให้ report ผล JSON ดิบมาแทน

---

## รายงานผลที่ต้องการ

หลังทำเสร็จให้รายงาน:

1. **ไฟล์ที่สร้างใหม่** (path + ย่อสรุปเนื้อหา)
2. **ไฟล์ที่แก้ไข** (path + สิ่งที่เปลี่ยน)
3. **ผล automated checks** (tsc / lint / test / build)
4. **ผล manifest HTTP check** (status code)
5. **ผล Lighthouse PWA score** (ถ้าทำได้)
6. **ปัญหาที่พบ** (ถ้ามี) + วิธีแก้

---

## ความเสี่ยงและข้อควรระวัง

| ความเสี่ยง | การป้องกัน |
|-----------|-----------|
| SW cache Signed URL → PDF เปิดไม่ได้ | รายการ `urlPattern` สำหรับ `/storage/v1/` ตั้ง `NetworkOnly` |
| SW cache auth response → session เก่าค้าง | `/api/` และ Supabase URL ทั้งหมดตั้ง `NetworkOnly` |
| `withPWA` ครอบผิดลำดับ → `withNextIntl` ไม่ทำงาน | ตรวจ export สุดท้ายให้แน่ใจว่า `withPWA(withNextIntl(nextConfig))` |
| `next-pwa` (shadowwalker) ไม่รองรับ Next.js 15 | ใช้ `@ducanh2912/next-pwa` เท่านั้น |
| SW generate ไฟล์ใน `public/` แล้ว commit → bloat repo | เพิ่มใน `.gitignore` ทุกไฟล์ที่ generate |
| `disable: process.env.NODE_ENV === "development"` ลืมตั้ง → SW รันใน dev → ทำให้ debug ยาก | ตั้งเสมอตามที่ระบุในขั้นตอน 6 |

