# i18n Cleanup Pass — Summary
**วันที่:** 2026-08-14
**สถานะ:** ✅ เสร็จสมบูรณ์

---

## ผล Automated Checks

| คำสั่ง | ผลลัพธ์ |
|--------|---------|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error (8 warning เดิม) |
| `npm run test` | ✅ 127/127 |
| `npm run test:a11y` | ✅ 50/50 (สองรอบ) |
| `npm run build` | ✅ 0 error ทุก route รวม dashboard/superadmin |

---

## สิ่งที่ทำ

### ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `components/ui/Button.tsx` | เปลี่ยน `LinkButton` import จาก `next/link` → `@/i18n/navigation` — `Button` (ปุ่มธรรมดา) ไม่แตะ |
| `app/not-found.tsx` | **bug fix** — เปลี่ยน `LinkButton` กลับเป็น `next/link` + inline styles เพื่อหลีกเลี่ยง missing `NextIntlClientProvider` context |
| `components/layout/UserMenu.tsx` | เปลี่ยน `Link` import → `@/i18n/navigation`, แปล "โปรไฟล์ของฉัน" 2 จุดด้วย `useTranslations('header')` |
| `components/home/HomeSearchBox.tsx` | เปลี่ยน `useRouter` import จาก `next/navigation` → `@/i18n/navigation` — `handleSubmit` logic ไม่เปลี่ยน |
| `e2e/header-roles.spec.ts` | แก้ desktop `openUserMenuAndGetLinks()` helper — strip `/th` prefix ที่ extraction point (UserMenu ตอนนี้ emit locale-prefixed href แล้ว) |

---

## Bug สำคัญที่พบและแก้ (Production-breaking)

### `app/not-found.tsx` → 500 error

**สาเหตุ:**
1. `LinkButton` ใน `Button.tsx` เปลี่ยนไปใช้ next-intl `Link` ซึ่งต้องการ `NextIntlClientProvider` ใน render tree
2. `app/not-found.tsx` อยู่นอก `app/[locale]/` โดยเจตนา (Phase 0A design — เป็น fallback สำหรับ path ที่ไม่ match locale segment ใดเลย)
3. จึงไม่มี `NextIntlClientProvider` → runtime error ทุกครั้งที่เข้า 404 page

**ทำไม tsc และ build ไม่เจอ:**
- เป็น runtime error ไม่ใช่ type error
- build ผ่านเพราะไม่ได้ทดสอบ render จริง
- พบตอน manual smoke test เท่านั้น (`curl /th/does-not-exist-xyz`)

**วิธีแก้:**
เปลี่ยน `not-found.tsx` จาก `LinkButton` กลับเป็น plain `next/link` + inline class strings เดียวกัน — ไม่ต้องการ locale context เลย ซึ่งถูกต้องสำหรับหน้าที่ไม่มี locale context อยู่แล้ว

**บทเรียน:** หน้าที่อยู่นอก `app/[locale]/` (ปัจจุบันมีแค่ `not-found.tsx`) ต้องหลีกเลี่ยงการใช้ component ใดๆ ที่ depend on next-intl context ทั้งทางตรงและทางอ้อม

---

## Bonus ที่ได้มาฟรี

- **Header login/register buttons** (ผ่าน `HeaderAccountArea` → `LinkButton`) ตอนนี้มี locale prefix ถูกต้องที่ render แล้ว ไม่ต้องพึ่ง middleware redirect อีกต่อไป
- **`/th/does-not-exist-xyz`** และ **`/en/does-not-exist-xyz`** → 404 (ไม่ใช่ 500) พร้อม links และ content ถูกต้อง

---

## สถานะ Navigation หลัง Cleanup

| Component | ก่อน | หลัง |
|-----------|------|------|
| `LinkButton` | `next/link` (bare) | `@/i18n/navigation` (locale-aware) |
| `UserMenu` desktop links | `next/link` (bare) | `@/i18n/navigation` (locale-aware) |
| `HomeSearchBox` router | `next/navigation` (bare) | `@/i18n/navigation` (locale-aware) |
| `not-found.tsx` links | `LinkButton` (broken) | `next/link` inline (correct) |
| `LogoutButton` router | `@/i18n/navigation` | ✅ ไม่เปลี่ยน (Phase 0B) |
| `LanguageSwitcher` | `@/i18n/navigation` | ✅ ไม่เปลี่ยน (Phase 0B) |

---

## Inconsistency ที่เหลืออยู่ (Phase 1+)

| รายการ | สถานะ |
|--------|-------|
| `lib/auth/workspace-links.ts` labels ยังเป็นไทย hardcode | Phase 1 |
| `ResearchExplorer` และ components ย่อย | Phase 1 |
| dashboard/superadmin/account page content | Phase 1+ |
| `messages/lo.json` ยังเป็น placeholder ทั้งหมด | Phase 3 |

---

## สถานะ i18n โดยรวม

```
Phase 0A ✅ Infrastructure — next-intl, [locale] routing, messages files
Phase 0B ✅ Header + LanguageSwitcher
Phase 0C ✅ Public pages — หน้าแรก, research, login, register, 403
Cleanup  ✅ Locale-aware navigation — LinkButton, UserMenu, HomeSearchBox
──────────────────────────────────────────────────────────────────────
Phase 1  ⏳ Protected pages — dashboard, account, workspace-links
Phase 2  ⏳ Super Admin pages — superadmin/*
Phase 3  ⏳ lo.json translation — แปลจริงภาษาไทย → ลาว
```

**หน้าสาธารณะทุกหน้า + navigation ทั้งระบบ locale-aware ครบแล้ว**
ไม่มีการพึ่ง middleware self-heal สำหรับ public-facing routes อีกต่อไป

---

## ไฟล์ที่เปลี่ยนแปลงทั้งหมด

```
แก้ไข (5):
  components/ui/Button.tsx
  app/not-found.tsx
  components/layout/UserMenu.tsx
  components/home/HomeSearchBox.tsx
  e2e/header-roles.spec.ts
```
