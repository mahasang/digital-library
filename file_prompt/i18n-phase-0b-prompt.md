# i18n Phase 0B — Header + LanguageSwitcher
# Prompt สำหรับ Claude Code / Cursor

## บริบทและ prerequisite

**Phase 0A ต้องผ่านก่อนทั้งหมด:**
- `npm run lint` → 0 error
- `npx tsc --noEmit` → 0 error
- `npm run test` → 127/127 (หรือมากกว่า)
- `npm run test:a11y` → 50/50 (หรือมากกว่า)
- `npm run build` → 0 error
- `/th/`, `/en/`, `/lo/` → แต่ละ locale โหลดได้
- `i18n/routing.ts`, `i18n/request.ts`, `messages/th.json`, `messages/en.json`, `messages/lo.json` มีอยู่แล้ว
- `app/[locale]/layout.tsx` มี `NextIntlClientProvider` แล้ว

ถ้า Phase 0A ยังไม่ผ่านครบ → หยุดและแจ้งทันที ห้ามเริ่ม Phase 0B

---

## งานที่ต้องทำ: Phase 0B

แปล string ใน **Header เท่านั้น** และสร้าง **LanguageSwitcher** component ใหม่
ยังไม่แตะ page content ใดเลย (นั่นคือ Phase 0C)

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect ก่อนเขียนโค้ดทุกครั้ง

```bash
# อ่านไฟล์ที่จะแก้ก่อนเสมอ
cat components/layout/Header.tsx
cat components/layout/UserMenu.tsx       # ถ้ามี
cat components/auth/LogoutButton.tsx
cat app/\[locale\]/layout.tsx
cat messages/th.json                     # ยืนยัน keys ที่มีอยู่แล้ว
```

### ขั้น 1 — สร้าง LanguageSwitcher component (ใหม่ทั้งหมด)

สร้าง `components/layout/LanguageSwitcher.tsx`

**Requirements:**
- เป็น Client Component (`'use client'`)
- ใช้ `useLocale`, `useTranslations` จาก `next-intl`
- ใช้ `useRouter`, `usePathname` จาก `next-intl/navigation` (ไม่ใช่ `next/navigation`)
- แสดง dropdown หรือ button group สำหรับ 3 ภาษา: ไทย / English / ລາວ
- ภาษาที่ active ต้องมี visual indicator (bold, underline, หรือ aria-current="true")
- ต้องมี `aria-label` ที่ได้จาก `t('nav.languageLabel')`
- เมื่อสลับภาษา ต้องคง path ปัจจุบันไว้ เช่น `/th/research` → `/en/research`
- ไม่ reload หน้าทั้งหน้า (ใช้ router.replace หรือ Link จาก next-intl)
- รองรับ keyboard navigation (tab + enter)

**Pattern ที่แนะนำ:**

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<string, string> = {
  th: 'ไทย',
  en: 'English',
  lo: 'ລາວ',
};

export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div role="navigation" aria-label={t('languageLabel')}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          aria-current={loc === locale ? 'true' : undefined}
          lang={loc}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
```

**ปรับ style ให้เข้ากับ design system เดิมของโปรเจกต์** (Tailwind classes ที่ใช้อยู่แล้ว)
อย่าเพิ่ม library ใหม่เพื่อ component นี้โดยเฉพาะ

### ขั้น 2 — แก้ไข Header.tsx

**อ่าน Header.tsx ก่อน** แล้ว:

1. เพิ่ม `import { useTranslations } from 'next-intl'` (ถ้า Server Component ใช้ `getTranslations`)
2. เพิ่ม `import { LanguageSwitcher } from './LanguageSwitcher'`
3. แทนที่ string ต่อไปนี้ด้วย translation keys:

| String เดิม (hardcode ไทย) | Key ใน messages |
|---------------------------|----------------|
| `"หน้าแรก"` | `header.home` |
| `"คลังงานวิจัย"` | `header.research` |
| `"เข้าสู่ระบบ"` | `header.login` |
| `"สมัครสมาชิก"` | `header.register` |
| `"ออกจากระบบ"` | `header.logout` |
| `"กำลังออกจากระบบ..."` | `header.loggingOut` |
| `"บัญชีของฉัน"` | `header.myAccount` |
| `"แดชบอร์ด"` | `header.dashboard` |
| `"ผู้ดูแลระบบ"` | `header.admin` |
| `"ข้ามไปยังเนื้อหาหลัก"` (skip link) | `header.skipToContent` |

4. วาง `<LanguageSwitcher />` ในตำแหน่งที่เหมาะสมใน Header
   - แนะนำ: ด้านขวาสุดของ nav bar ก่อน account area
   - ต้องไม่กระทบ layout ของ element อื่น

**ข้อควรระวัง:**
- Header อาจเป็น Server Component (`async function`) → ใช้ `getTranslations` จาก `next-intl/server`
- ถ้า Header มี Client Component ย่อย (เช่น UserMenu, LogoutButton) → แยก translation prop ลงไปหรือให้ component ย่อยเรียก `useTranslations` เอง
- ห้ามเปลี่ยน logic การตรวจสอบ session/user/role ใดๆ ทั้งสิ้น

### ขั้น 3 — แก้ไข LogoutButton.tsx (ถ้าจำเป็น)

ถ้า `LogoutButton.tsx` มี string `"ออกจากระบบ"` หรือ `"กำลังออกจากระบบ..."` hardcode:
- เพิ่ม prop `logoutLabel` และ `loggingOutLabel` แบบ optional พร้อม default value ภาษาไทย
- หรือให้ component เรียก `useTranslations('header')` เองโดยตรง (ถ้าเป็น Client Component อยู่แล้ว)
- ห้ามเปลี่ยน `handleLogout` logic หรือ dynamic import pattern เดิม

### ขั้น 4 — เพิ่ม keys ที่ขาดใน messages (ถ้าพบ)

ถ้า inspect Header แล้วพบ string ที่ยังไม่มี key ใน `messages/th.json`:
- เพิ่มใน `messages/th.json` ก่อน
- เพิ่ม key เดียวกันใน `messages/en.json` พร้อม English translation
- เพิ่ม key เดียวกันใน `messages/lo.json` (copy จาก th ก่อน)
- ห้ามลบ key เดิมที่มีอยู่แล้ว

### ขั้น 5 — ตรวจ aria และ skip link

ตรวจสอบว่า:
- Skip link (`ข้ามไปยังเนื้อหาหลัก`) ยังทำงานถูกต้อง และ text มาจาก translation
- `aria-label` บน nav element ได้รับค่าที่ถูกต้องตาม locale
- `lang` attribute บน html element ตรงกับ locale ปัจจุบัน (ควรทำตั้งแต่ Phase 0A แล้ว)

### ขั้น 6 — รัน checks และ report

```bash
rm -rf .next

npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
npm run build
```

**Manual smoke test หลัง dev server ขึ้น:**
```bash
npm run dev
# เปิด http://localhost:3000/th
# คลิกสลับ EN → URL เปลี่ยนเป็น /en, text Header เปลี่ยนเป็น English
# คลิกสลับ LO → URL เปลี่ยนเป็น /lo, text Header เปลี่ยน (placeholder ไทย)
# ที่ /en/research คลิก TH → เปลี่ยนเป็น /th/research (path คงเดิม)
# ทดสอบ keyboard: Tab ไปถึง LanguageSwitcher, Enter สลับภาษาได้
```

รายงานผล:
- ไฟล์ที่สร้างใหม่
- ไฟล์ที่แก้ไข (พร้อมสรุปว่าแก้อะไร)
- test count ก่อน/หลัง (ต้องไม่ลดลง)
- screenshot หรือ URL path ยืนยัน language switching ทำงานได้

---

## เกณฑ์ความสำเร็จ Phase 0B

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → ไม่น้อยกว่า baseline Phase 0A
- [ ] `npm run test:a11y` → ไม่น้อยกว่า baseline Phase 0A
- [ ] `npm run build` → 0 error
- [ ] `/th/` → Header แสดงภาษาไทย
- [ ] `/en/` → Header แสดงภาษาอังกฤษ
- [ ] `/lo/` → Header แสดง (placeholder ไทย ยังโอเค)
- [ ] สลับภาษาที่ `/th/research` → URL เปลี่ยนเป็น `/en/research` (path คงเดิม)
- [ ] LanguageSwitcher มี `aria-label` และ `aria-current` ที่ถูกต้อง
- [ ] Session/user/role logic ใน Header ไม่เปลี่ยนแปลง
- [ ] `LogoutButton` dynamic import pattern ยังเหมือนเดิม
- [ ] ไม่มี string ภาษาไทย hardcode เหลือใน Header (ยกเว้น lo.json ที่ยัง placeholder)

---

## ไฟล์ที่ต้องแก้ (คาดการณ์)

| ไฟล์ | การกระทำ | ความเสี่ยง |
|------|----------|-----------|
| `components/layout/LanguageSwitcher.tsx` | สร้างใหม่ | ต่ำ |
| `components/layout/Header.tsx` | เพิ่ม translations + LanguageSwitcher | กลาง |
| `components/auth/LogoutButton.tsx` | เพิ่ม translation support (ถ้าจำเป็น) | ต่ำ |
| `components/layout/UserMenu.tsx` | เพิ่ม translations (ถ้ามี string ใน component นี้) | ต่ำ |
| `messages/th.json` | เพิ่ม keys ที่พบระหว่าง inspect (ถ้ามี) | ต่ำ |
| `messages/en.json` | เพิ่ม keys เดียวกัน (ถ้ามี) | ต่ำ |
| `messages/lo.json` | เพิ่ม keys เดียวกัน (placeholder) | ต่ำ |

**ห้ามแตะ:**
- `middleware.ts` — ไม่มีงานเพิ่มใน Phase นี้
- `lib/supabase/` ทุกไฟล์
- `app/[locale]/layout.tsx` — เสร็จแล้วใน Phase 0A
- page files ทุกไฟล์ — จะทำใน Phase 0C
- RLS, migrations, audit logs

---

## ข้อควรระวังพิเศษ

1. **Header อาจ mix Server + Client Components** — ตรวจก่อนว่า Header.tsx เป็น Server หรือ Client Component
   - Server Component → ใช้ `getTranslations('header')` จาก `next-intl/server` (async)
   - Client Component → ใช้ `useTranslations('header')` (sync hook)
   - ถ้า Header เป็น Server Component แต่ UserMenu เป็น Client → pass translation strings เป็น props ลงไป หรือให้ UserMenu เรียก `useTranslations` เอง

2. **`next-intl/navigation` vs `next/navigation`** — LanguageSwitcher ต้องใช้ `useRouter` และ `usePathname` จาก `next-intl/navigation` เสมอ ไม่ใช่ `next/navigation` มิฉะนั้น locale จะไม่ถูกส่งไปด้วยตอน navigate

3. **LogoutButton dynamic import** — ตรวจสอบว่า pattern `await import('@/lib/supabase/client')` ภายใน `handleLogout()` ยังคงอยู่ครบหลังแก้ไข ห้ามเปลี่ยน import pattern นี้

4. **NotificationBell** — ถ้ามี string ใน NotificationBell ที่อยู่ใน Header ให้บันทึกไว้แต่ยังไม่แปลในรอบนี้ (Phase 0C หรือหลังจากนั้น) เพื่อ scope ให้แคบ

5. **ถ้า test จำนวนลดลง** → หยุดและ report ทันที ห้าม merge
