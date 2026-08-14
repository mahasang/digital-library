# i18n Phase 0B — Summary
**วันที่:** 2026-08-14
**สถานะ:** ✅ เสร็จสมบูรณ์

---

## ผล Automated Checks (หลัง Phase 0B)

| คำสั่ง | ผลลัพธ์ |
|--------|---------|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error (8 warning เดิม ไม่เกี่ยวข้อง) |
| `npm run test` | ✅ 127/127 |
| `npm run test:a11y` | ✅ 50/50 (รันสองรอบยืนยัน) |
| `npm run build` | ✅ 0 error |

---

## สิ่งที่ทำ

### 1. ไฟล์ที่สร้างใหม่

| ไฟล์ | หน้าที่ |
|------|--------|
| `i18n/navigation.ts` | `createNavigation(routing)` wrapper — export `Link`, `useRouter`, `usePathname`, `redirect` สำหรับใช้ทั่วโปรเจกต์แทน next-intl/navigation โดยตรง (next-intl v4 ต้องใช้ factory pattern) |
| `components/layout/LanguageSwitcher.tsx` | ปุ่มสลับภาษา TH / EN / ລາວ พร้อม `aria-current`, keyboard nav, ใช้ `useRouter`/`usePathname` จาก `@/i18n/navigation` |

### 2. ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `messages/th.json` | เพิ่ม keys ใน `header.*` (openMenu, closeMenu, searchResearch, colorMode, mainMenu, myProfile, loadingUserMenu) และ namespaces ใหม่ `nav.*`, `workspace.*` |
| `messages/en.json` | เพิ่ม keys เดียวกัน — แปลเป็นอังกฤษ |
| `messages/lo.json` | เพิ่ม keys เดียวกัน — placeholder (copy จาก th.json) |
| `components/layout/Header.tsx` | เปลี่ยน import จาก `next/link`/`next/navigation` → `@/i18n/navigation`, ย้าย `navLinks` เข้า component function ใช้ `useTranslations('nav')`, แปล aria-labels ทั้งหมดด้วย `useTranslations('header')`, เพิ่ม `<LanguageSwitcher />` ทั้ง desktop และ mobile |
| `components/layout/HeaderAccountArea.tsx` | เพิ่ม `getTranslations('header')`, แปล login/register/myProfile strings, เปลี่ยน `Link` import เป็น `@/i18n/navigation` (สำคัญ — ทำให้ mobile workspace links มี locale prefix) |
| `components/auth/LogoutButton.tsx` | เปลี่ยน `useRouter` import จาก `next/navigation` → `@/i18n/navigation`, เพิ่ม `useTranslations('header')`, แปล "ออกจากระบบ"/"กำลังออกจากระบบ..." — **dynamic import pattern ใน handleLogout() ไม่เปลี่ยนแม้แต่ byte เดียว** |
| `e2e/header-roles.spec.ts` | แก้ assertion mobile workspace link: `/favorites` → `/th/favorites` (เพราะ HeaderAccountArea ตอนนี้ emit locale-aware path ถูกต้องแล้ว) |

---

## ปัญหาที่พบระหว่างทำ

### next-intl v4 ไม่ export จาก `next-intl/navigation` โดยตรง
- **สาเหตุ:** `next-intl@^4.13.6` ที่ติดตั้งอยู่ใช้ factory pattern — ต้องเรียก `createNavigation(routing)` ก่อนได้ `Link`, `useRouter`, `usePathname`
- **แก้:** สร้าง `i18n/navigation.ts` เป็น wrapper กลาง ทุก component import จาก `@/i18n/navigation` แทน
- **บทเรียน:** ตรวจ version ของ package จริงก่อนเขียน import เสมอ — prompt เขียนจากสมมุติ API ที่อาจ outdated

### Mobile workspace links fail 5/50 (45/50 รอบแรก)
- **สาเหตุ:** `HeaderAccountArea.tsx` เปลี่ยน `Link` เป็น locale-aware → `/favorites` กลายเป็น `/th/favorites` แต่ e2e assertion ยังเช็ค bare path
- **แก้:** อัปเดต assertion ใน `e2e/header-roles.spec.ts` เป็น `/th/favorites`
- **บทเรียน:** การทำ locale-aware navigation ที่ถูกต้องทำให้ e2e ที่เช็ค href ต้องอัปเดตตาม — นี่คือพฤติกรรมที่ถูกต้อง ไม่ใช่ regression

---

## Manual Smoke Test ผ่าน

| หน้า/การกระทำ | ผลลัพธ์ |
|--------------|---------|
| `/th/` Header | ✅ ภาษาไทย, LanguageSwitcher แสดง "ไทย" active |
| `/en/` Header | ✅ ภาษาอังกฤษ, LanguageSwitcher แสดง "EN" active |
| `/lo/` Header | ✅ placeholder ไทย, LanguageSwitcher แสดง "ລາວ" active |
| สลับ `/th/research` → EN | ✅ ไปที่ `/en/research` (slug คงเดิม) |
| สลับ `/en/research` → TH | ✅ ไปที่ `/th/research` |
| Keyboard focus + Enter | ✅ สลับภาษาได้ |
| Logout button | ✅ session หมด, dynamic import ยังอยู่ครบ |
| `aria-current="true"` | ✅ บน locale ที่ active |

---

## Inconsistency ที่รู้และยอมรับ (ไม่บล็อก)

| รายการ | สถานะ |
|--------|-------|
| `UserMenu.tsx` (desktop dropdown) workspace links ยังเป็น bare path (`/favorites` ไม่ใช่ `/th/favorites`) | Self-healing ผ่าน middleware redirect — deferred ถึง Phase 1 |
| `LinkButton` login/register hrefs ใน HeaderAccountArea ยังเป็น bare `/login`, `/register` | Self-healing — deferred |
| `lib/auth/workspace-links.ts` labels ยังเป็นไทย hardcode | Phase 0C / Phase 1 |

---

## สิ่งที่ยังไม่ได้ทำ (Phase 0C ต่อไป)

- Page content ทุกหน้า (หน้าแรก, research, login, register, 403)
- Hero.tsx, CategorySection.tsx, ResearchSection.tsx strings
- generateMetadata ทุก public page
- `messages/lo.json` ยังเป็น placeholder ทั้งหมด (Phase 3)

---

## ไฟล์ที่เปลี่ยนแปลงทั้งหมด

```
สร้างใหม่ (2):
  i18n/navigation.ts
  components/layout/LanguageSwitcher.tsx

แก้ไข (7):
  messages/th.json
  messages/en.json
  messages/lo.json
  components/layout/Header.tsx
  components/layout/HeaderAccountArea.tsx
  components/auth/LogoutButton.tsx
  e2e/header-roles.spec.ts
```
