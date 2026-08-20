# PWA Phase 2 — Final Summary
**วันที่:** 2026-08-19
**สถานะ:** ✅ เสร็จสมบูรณ์ (หลังแก้ bug หลายรอบ)

---

## ผล Automated Checks

| คำสั่ง | ผลลัพธ์ |
|--------|---------|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error |
| `npm run test` | ✅ 127/127 |
| `npm run test:a11y` | ✅ 50/50 |
| `npm run build` | ✅ 0 error |
| SW status | ✅ activated and is running |
| Console errors | ✅ No errors, No warnings |
| offline.html ขณะออฟไลน์ | ✅ แสดงผลถูกต้อง 4 ภาษา |

---

## ไฟล์ที่สร้างใหม่

| ไฟล์ | หน้าที่ |
|------|--------|
| `public/offline.html` | Offline fallback page (4 ภาษา, no-script, dark mode, retry button) |
| `public/sw.js` | Custom Service Worker (manual, ไม่ใช้ library) |
| `components/pwa/ServiceWorkerRegister.tsx` | Client component สำหรับ register SW |

## ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `next.config.ts` | ถอด `@ducanh2912/next-pwa` ออก กลับเป็น `withNextIntl(nextConfig)` ธรรมดา |
| `public/icons/icon-192.svg` | เปลี่ยนจาก placeholder "E" เป็น open-book icon |
| `public/icons/icon-512.svg` | เปลี่ยนจาก placeholder "E" เป็น open-book icon (512×512) |
| `app/layout.tsx` | เพิ่ม `<ServiceWorkerRegister />` |
| `middleware.ts` | เพิ่ม `offline.html` เข้า matcher exclusion |
| `.gitignore` | เอา `public/sw.js` ออกจาก gitignore (manual file ต้อง commit) |
| `package.json` | ถอด `@ducanh2912/next-pwa` ออก |

---

## สิ่งที่ทำงานแล้ว

- ✅ SW register และ activate สำเร็จ (ไม่มี error)
- ✅ Offline → navigate ไปหน้าที่ไม่มี cache → เห็น `offline.html` ทันที
- ✅ offline.html แสดง 4 ภาษา: ไทย, อังกฤษ, ลาว, เวียดนาม
- ✅ ปุ่ม "ลองใหม่ / Retry" ทำงานด้วย `window.location.reload()`
- ✅ Dark mode รองรับผ่าน `prefers-color-scheme`
- ✅ NetworkOnly สำหรับ Supabase, API, auth pages, dashboard, superadmin
- ✅ CacheFirst สำหรับ `/_next/static/` assets
- ✅ Open-book icon 192×192 และ 512×512 render ถูกต้อง
- ✅ Locale routing ทุก locale ไม่ถูกกระทบ
- ✅ `offline.html` เสิร์ฟที่ root (ไม่โดน i18n redirect)

---

## บทเรียนสำคัญจาก Phase 2

### ❌ `@ducanh2912/next-pwa` v10 + Next.js 15 — incompatible

พบ bug 3 จุดที่แก้ไม่ได้จากฝั่งโปรเจกต์:

1. **`_async_to_generator is not defined`** — helper function ไม่ถูก bundle เข้า SW context เมื่อ `handlerDidError` plugin ถูกเรียกใช้
2. **`workbox-*.js` hash เปลี่ยนทุก build** — SW ที่ activate แล้วพยายาม `importScripts()` hash ใหม่ไม่ได้ → activate fail ทุกครั้ง
3. **SW registration ไม่ auto-inject** — v10 ไม่ inject registration script เข้า HTML อัตโนมัติต้องเพิ่ม component เองทุก project

### ✅ Custom SW — วิธีที่ถูกต้องสำหรับโปรเจกต์นี้

`public/sw.js` เขียนเองแบบ vanilla — ไม่มี dependency, ไม่มี build step, ไม่มี hash collision:
- Install: precache `/offline.html` เท่านั้น
- Fetch: NetworkOnly สำหรับ auth/API/Supabase, CacheFirst สำหรับ static assets, offline fallback สำหรับ navigate requests
- ขนาดเล็กกว่า workbox มาก (~50 lines vs ~23KB)
- ควบคุมได้สมบูรณ์ ไม่มี magic behavior

### middleware.ts ต้อง exclude PWA files ทุกไฟล์

ทุกไฟล์ที่อยู่ใน `public/` และต้องเสิร์ฟที่ root path ต้องถูก exclude จาก i18n middleware:
```
manifest.webmanifest, sw.js, workbox-*.js, worker-*.js,
fallback-*.js, offline.html
```
ถ้าไม่ exclude → i18n middleware 307-redirect → SW/manifest ใช้ไม่ได้

---

## สิ่งที่ยังต้องทำ (Phase 3+)

| รายการ | ความสำคัญ | หมายเหตุ |
|--------|-----------|---------|
| PNG icons 192×192 และ 512×512 | สูง | SVG ไม่รองรับ iOS Safari และ Android บางรุ่น |
| `apple-touch-icon` PNG 180×180 | สูง | iOS จำเป็นต้องใช้ PNG |
| แก้ `theme_color` ให้ตรงกับ `--color-accent` | กลาง | `#1D4ED8` vs `#185ff2` (pre-existing จาก Phase 1) |
| Push notifications | ต่ำ | Optional |

---

## โครงสร้าง SW สุดท้าย (`public/sw.js`)

```
install  → precache /offline.html
activate → ลบ cache เก่า + claim clients
fetch    → NetworkOnly: Supabase/API/auth/dashboard/superadmin
         → CacheFirst: /_next/static/*
         → offline fallback: navigate request → /offline.html
```

---

## วิธีทดสอบ offline

1. `npm run build && npm run start`
2. Chrome → `http://localhost:3001/th/` → Reload 2 ครั้ง
3. Application → Service Workers → ตรวจ "activated and is running"
4. Network → Offline
5. เปิด URL ใหม่ที่ไม่เคยเข้า (เช่น `/th/favorites`) → เห็น offline.html ✅
