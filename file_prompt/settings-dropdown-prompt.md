# Settings Dropdown — Pill Trigger (แบบ A)
# Prompt สำหรับ Claude Code / Cursor

## วัตถุประสงค์

รวม `LanguageSwitcher` และ `ThemeToggle` เข้าเป็น component เดียวชื่อ
`SettingsDropdown` — ปุ่ม pill แสดงภาษาปัจจุบัน + ไอคอน theme ปัจจุบัน
คลิกเปิด dropdown รวมทั้งสองส่วนในที่เดียว

---

## ขั้น 0 — Inspect ก่อนเริ่ม

```bash
cat components/layout/LanguageSwitcher.tsx
cat components/layout/ThemeToggle.tsx
cat components/layout/Header.tsx
grep -rn "LanguageSwitcher\|ThemeToggle" app/ components/ --include="*.tsx" | grep -v "LanguageSwitcher.tsx\|ThemeToggle.tsx"
```

---

## ขั้น 1 — สร้าง SettingsDropdown.tsx

สร้างไฟล์ใหม่ `components/layout/SettingsDropdown.tsx`

**Requirements:**
- `'use client'`
- ใช้ `useLocale`, `useTranslations` จาก `next-intl`
- ใช้ `useRouter`, `usePathname` จาก `@/i18n/navigation`
- ใช้ `useSearchParams` จาก `next/navigation`
- ใช้ `useTheme` จาก `next-themes`
- ใช้ `useState`, `useEffect`, `useRef` จาก `react`

**โครงสร้าง UI:**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<string, string> = {
  th: 'ไทย',
  en: 'EN',
  lo: 'ລາວ',
};

const LOCALE_FLAGS: Record<string, string> = {
  th: '🇹🇭',
  en: '🇬🇧',
  lo: '🇱🇦',
};

const THEME_OPTIONS = [
  { value: 'light', labelKey: 'themeLight', icon: Sun },
  { value: 'system', labelKey: 'themeSystem', icon: Monitor },
  { value: 'dark', labelKey: 'themeDark', icon: Moon },
] as const;

export function SettingsDropdown() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ปิด dropdown เมื่อกด Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    const query = Object.fromEntries(searchParams.entries());
    router.replace({ pathname, query }, { locale: newLocale });
    setOpen(false);
  };

  const activeThemeOption = mounted
    ? THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[1]
    : THEME_OPTIONS[1];

  const ThemeIcon = activeThemeOption.icon;

  return (
    <div ref={ref} className="relative">
      {/* Pill trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('settingsLabel')}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
      >
        {/* dot สีน้ำเงินแสดงว่า locale active */}
        <span className="h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" aria-hidden="true" />
        <span className="font-medium text-gray-700">{LOCALE_LABELS[locale]}</span>
        <span className="mx-0.5 h-3 w-px bg-gray-200" aria-hidden="true" />
        <ThemeIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <svg
          className={`h-3 w-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label={t('settingsLabel')}
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-lg"
        >
          {/* ── ส่วนภาษา ── */}
          <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {t('languageLabel')}
          </div>
          {routing.locales.map((loc) => (
            <button
              key={loc}
              type="button"
              lang={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                loc === locale
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base" aria-hidden="true">{LOCALE_FLAGS[loc]}</span>
              <span className="flex-1 text-left">
                {loc === 'th' ? 'ไทย' : loc === 'en' ? 'English' : 'ລາວ'}
              </span>
              {loc === locale && (
                <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          {/* divider */}
          <div className="my-1 border-t border-gray-100" />

          {/* ── ส่วน theme ── */}
          <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {t('themeLabel')}
          </div>
          <div className="grid grid-cols-3 gap-1 px-3 pb-3">
            {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={mounted && theme === value}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition-colors ${
                  mounted && theme === value
                    ? 'border-brand-200 bg-accent-soft text-accent-ink'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## ขั้น 2 — เพิ่ม translation keys ใน messages

เพิ่มใน `messages/th.json` ภายใน namespace `"nav"`:
```json
"settingsLabel": "ตั้งค่าภาษาและธีม",
"themeLabel": "โหมดสี",
"themeLight": "สว่าง",
"themeSystem": "ระบบ",
"themeDark": "มืด"
```

เพิ่มใน `messages/en.json`:
```json
"settingsLabel": "Language and theme settings",
"themeLabel": "Color mode",
"themeLight": "Light",
"themeSystem": "System",
"themeDark": "Dark"
```

เพิ่มใน `messages/lo.json` (copy จาก th):
```json
"settingsLabel": "ตั้งค่าภาษาและธีม",
"themeLabel": "โหมดສີ",
"themeLight": "ສວ່າງ",
"themeSystem": "ລະບົບ",
"themeDark": "ມືດ"
```

---

## ขั้น 3 — แทนที่ใน Header.tsx

**อ่าน Header.tsx จริงก่อน** แล้ว:

1. เพิ่ม import:
```tsx
import { SettingsDropdown } from '@/components/layout/SettingsDropdown';
```

2. ลบ import เก่า:
```tsx
// ลบออก
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import ThemeToggle from '@/components/layout/ThemeToggle';
```

3. แทนที่ใน desktop nav — หา pattern นี้ใน Header:
```tsx
// เดิม
<LanguageSwitcher />
<ThemeToggle />
```
เปลี่ยนเป็น:
```tsx
<SettingsDropdown />
```

4. แทนที่ใน mobile menu — หา pattern ที่มี `LanguageSwitcher` และ `ThemeToggle` ในส่วน mobile:
```tsx
// เดิม (มีอยู่ใน mobile section)
<div ...>
  <span>{tHeader('colorMode')}</span>
  <ThemeToggle />
</div>
<div ...>
  <span>{t('languageLabel')}</span>
  <LanguageSwitcher />
</div>
```
เปลี่ยนเป็น:
```tsx
<div className="mb-1 px-3 py-1.5">
  <SettingsDropdown />
</div>
```

5. ลบ `tHeader('colorMode')` และ `t('languageLabel')` ที่ไม่ได้ใช้แล้ว (ถ้ามี)

---

## ขั้น 4 — คง LanguageSwitcher.tsx และ ThemeToggle.tsx ไว้

**ห้ามลบไฟล์เก่า** — อาจมีการใช้งานในที่อื่น หรือ import ใน mobile menu
ถ้า grep พบว่าไม่มีที่ใดใช้แล้ว → บันทึกไว้ในรายงาน แต่ไม่ลบในรอบนี้

---

## ขั้น 5 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Manual smoke test:**
```bash
npm run dev
# /th/ → เห็น pill button "ไทย + laptop icon"
# คลิก → dropdown เปิด แสดงภาษา 3 ตัว + โหมดสี 3 ปุ่ม
# คลิก EN → URL เปลี่ยนเป็น /en/ dropdown ปิด pill เปลี่ยนเป็น "EN"
# คลิก ปุ่มมืด → ธีมเปลี่ยน ไอคอนใน pill เปลี่ยนเป็น moon
# กด Escape → dropdown ปิด
# คลิกนอก dropdown → ปิด
# /th/research?category=xxx → สลับ EN → /en/research?category=xxx (query คงเดิม)
# mobile: hamburger menu → เห็น SettingsDropdown ใน mobile panel
```

---

## เกณฑ์ความสำเร็จ

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] Pill trigger แสดงภาษาและ theme icon ปัจจุบัน
- [ ] Dropdown เปิด/ปิดด้วยคลิก, Escape, คลิกนอก
- [ ] สลับภาษาแล้ว query string คงเดิม
- [ ] สลับ theme แล้วไอคอนใน trigger เปลี่ยน
- [ ] `aria-expanded`, `aria-pressed`, `aria-label` ครบถ้วน
- [ ] ไม่มี hydration mismatch จาก theme (ใช้ mounted flag)

---

## ข้อห้าม

- ห้ามลบ `LanguageSwitcher.tsx` หรือ `ThemeToggle.tsx`
- ห้ามแตะ auth, middleware, session logic
- ห้ามเปลี่ยน routing หรือ i18n config
- ถ้า test ลดลง → หยุดทันที
