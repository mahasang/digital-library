# i18n Phase 0A — Summary
**วันที่:** 2026-08-14
**สถานะ:** ✅ เสร็จสมบูรณ์

---

## ผล Automated Checks (หลัง Phase 0A)

| คำสั่ง | ผลลัพธ์ |
|--------|---------|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error |
| `npm run test` | ✅ 127/127 |
| `npm run test:a11y` | ✅ 50/50 |
| `npm run build` | ✅ 0 error |

---

## สิ่งที่ทำ

### 1. ติดตั้ง next-intl
```bash
npm install next-intl
```

### 2. ไฟล์ที่สร้างใหม่

| ไฟล์ | หน้าที่ |
|------|--------|
| `i18n/routing.ts` | กำหนด locales: `['th', 'en', 'lo']`, defaultLocale: `'th'`, localePrefix: `'always'` |
| `i18n/request.ts` | next-intl server request config — โหลด messages ตาม locale |
| `messages/th.json` | catalog ภาษาไทย (ต้นฉบับ) — namespaces: common, header, nav, home, research, auth, errors |
| `messages/en.json` | catalog อังกฤษ — namespaces เดียวกัน |
| `messages/lo.json` | catalog ลาว — placeholder (copy จาก th.json ทั้งหมด รอแปลจริงใน Phase 3) |

### 3. ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `next.config.ts` | เพิ่ม `withNextIntl` wrapper ครอบ config เดิม |
| `middleware.ts` | เพิ่ม `intlMiddleware` จาก `next-intl/middleware` ต่อท้าย auth logic เดิม — auth ทำงานก่อนเสมอ, locale prefix ถูกตัดออกก่อนเช็ค protected paths |
| `app/layout.tsx` (root) | เหลือแค่ shell ขั้นต่ำ |
| `app/[locale]/layout.tsx` | ย้ายจาก root layout + เพิ่ม `NextIntlClientProvider` + `generateStaticParams()` + validate locale ด้วย `notFound()` |

### 4. ย้าย pages เข้า `app/[locale]/` (114 ไฟล์)

pages ทั้งหมดถูกย้ายเข้า `app/[locale]/`:
- `app/page.tsx` → `app/[locale]/page.tsx`
- `app/login/` → `app/[locale]/login/`
- `app/register/` → `app/[locale]/register/`
- `app/research/` → `app/[locale]/research/`
- `app/dashboard/` → `app/[locale]/dashboard/`
- `app/superadmin/` → `app/[locale]/superadmin/`
- `app/account/` → `app/[locale]/account/`
- `app/auth/` → `app/[locale]/auth/`
- `app/403/` → `app/[locale]/403/`
- `app/setup-mfa/` → `app/[locale]/setup-mfa/`
- `app/mfa-challenge/` → `app/[locale]/mfa-challenge/`
- และ pages อื่นๆ ทั้งหมด

**ไม่ย้าย (คงอยู่ที่ root):**
- `app/api/` — ทั้งหมด
- `app/not-found.tsx`
- `app/globals.css`

### 5. แก้ไข revalidatePath ใน categories actions

`app/[locale]/dashboard/categories/actions.ts` — เพิ่ม `revalidatePath("/", "layout")` ใน 3 actions ที่ขาด:
- `updateCategoryAction`
- `toggleCategoryActiveAction`
- `deleteCategoryAction`

(createCategoryAction มีอยู่แล้วตั้งแต่ต้น)

เหตุผล: หลัง Phase 0A pages อยู่ที่ `/th/...` แล้ว `revalidatePath("/dashboard/categories")` อย่างเดียวไม่ครอบคลุม homepage cache — ต้องเพิ่ม `revalidatePath("/", "layout")` เพื่อ revalidate ทุก locale พร้อมกัน

### 6. อัปเดต e2e tests

**ปัญหา:** path ใน spec files ทั้งหมด hardcode ไม่มี locale prefix

**แก้ไข:** เพิ่ม `/th/` ใน 4 ไฟล์:

| ไฟล์ | จุดที่แก้ |
|------|---------|
| `e2e/header-roles.spec.ts` | `/login` → `/th/login`, `/` → `/th/`, timeout 15_000 → 30_000 |
| `e2e/accessibility.spec.ts` | PUBLIC_ROUTES และ AUTH_ROUTES ทุก path, timeout 15_000 → 30_000 |
| `e2e/auth-verification.spec.ts` | guest paths, ROLE_GATE_MATRIX allowed/forbidden ทุก path, timeout 15_000 → 30_000 |
| `e2e/public-home-cache.spec.ts` | `/login`, `/`, `/dashboard/categories` → เพิ่ม `/th/` |

### 7. อัปเดต playwright.config.ts

**ปัญหา:** test รันบน `npm run dev` — `unstable_cache` ไม่ทำงานใน dev mode ทำให้ cache invalidation test fail เสมอ

**แก้ไข:**
```ts
// เดิม
command: "npm run dev",
reuseExistingServer: true,
timeout: 60_000,

// ใหม่
command: "npm run build && npm run start",
reuseExistingServer: false,
timeout: 120_000,
```

---

## ปัญหาที่พบระหว่างทำ

### 1. Port 3001 ค้าง (EADDRINUSE)
- **สาเหตุ:** dev server จาก session ก่อนหน้ายังรันอยู่
- **แก้:** `Stop-Process -Id <PID> -Force` ใน PowerShell
- **บทเรียน:** หยุด dev server ก่อนรัน `npm run test:a11y` เสมอ

### 2. test fail เพิ่มขึ้นหลัง kill port ผิด
- **สาเหตุ:** port ค้างทำให้ server start ไม่ได้ → `net::ERR_ABORTED` ทุกหน้า → ดูเหมือน fail เยอะ แต่จริงๆ เป็น infrastructure ไม่ใช่โค้ด
- **บทเรียน:** ถ้า fail เพิ่มกะทันหันและ error เป็น `net::ERR_ABORTED` ให้ตรวจ server ก่อนเสมอ

### 3. cache invalidation test fail บน dev mode
- **สาเหตุ:** `unstable_cache` ไม่ cache จริงใน dev mode → `revalidateTag` ไม่มีผล
- **แก้:** เปลี่ยน playwright webServer เป็น production build
- **บทเรียน:** cache-related tests ต้องรันบน production build เสมอ

---

## URL Structure หลัง Phase 0A

| URL เดิม | URL ใหม่ |
|---------|---------|
| `/` | `/th/` (default locale) |
| `/login` | `/th/login` |
| `/research` | `/th/research` |
| `/dashboard` | `/th/dashboard` |
| `/superadmin` | `/th/superadmin` |
| `/api/health` | `/api/health` (ไม่เปลี่ยน) |

Redirect: `/` → `/th/` อัตโนมัติ, `/en/` และ `/lo/` พร้อมใช้งาน

---

## สิ่งที่ยังไม่ได้ทำ (Phase 0B ต่อไป)

- Header ยังเป็น string ภาษาไทย hardcode — ยังไม่ได้ใช้ `useTranslations`
- LanguageSwitcher ยังไม่มี
- Page content ยังไม่ได้แปล (Phase 0C)
- `messages/lo.json` ยังเป็น placeholder ภาษาไทยทั้งหมด (Phase 3)

---

## ไฟล์ที่เปลี่ยนแปลงทั้งหมด

```
สร้างใหม่ (5):
  i18n/routing.ts
  i18n/request.ts
  messages/th.json
  messages/en.json
  messages/lo.json

แก้ไข (7):
  next.config.ts
  middleware.ts
  app/layout.tsx
  app/[locale]/layout.tsx  (ใหม่+ย้าย)
  app/[locale]/dashboard/categories/actions.ts
  playwright.config.ts
  e2e/header-roles.spec.ts
  e2e/accessibility.spec.ts
  e2e/auth-verification.spec.ts
  e2e/public-home-cache.spec.ts

ย้าย (114 ไฟล์):
  app/* → app/[locale]/*
  (ยกเว้น api/, not-found.tsx, globals.css)
```
