# i18n Phase 0B — Header + LanguageSwitcher
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม (Phase 0A เสร็จแล้ว)

- `npm run lint` → 0 error
- `npm run test` → 127/127
- `npm run test:a11y` → 50/50 (รันบน production build)
- `npm run build` → 0 error
- pages ทั้งหมดอยู่ใน `app/[locale]/` แล้ว
- URL structure: `/th/`, `/en/`, `/lo/` พร้อมใช้งาน
- `next-intl` ติดตั้งและ config แล้วใน `i18n/routing.ts`, `i18n/request.ts`, `next.config.ts`
- `app/[locale]/layout.tsx` มี `NextIntlClientProvider` แล้ว

ถ้า checks ยังไม่ผ่านครบ → หยุดและแจ้งทันที ห้ามเริ่ม Phase 0B

---

## โครงสร้าง Header ปัจจุบัน (จาก inspect จริง)

```
Header.tsx          — Client Component ("use client")
                      รับ desktopAccountArea และ mobileAccountArea เป็น ReactNode props
                      มี navLinks array hardcode ภาษาไทย
                      ใช้ usePathname จาก next/navigation
                      ใช้ Link จาก next/link

HeaderAccountArea.tsx — Server Component (async)
                        แสดง NotificationBell + UserMenu (authenticated)
                        หรือ Login + Register buttons (guest)
                        มี string ภาษาไทย hardcode

LogoutButton.tsx    — Client Component ("use client")
                      มี dynamic import() ของ supabase client (ห้ามเปลี่ยน pattern นี้)
                      ใช้ useRouter จาก next/navigation
                      มี string "ออกจากระบบ" และ "กำลังออกจากระบบ..." hardcode

workspace-links.ts  — ไฟล์ .ts ธรรมดา (ไม่ใช่ component)
                      มี label ภาษาไทย hardcode
                      *** ไม่แปลใน Phase นี้ — เก็บไว้ Phase 0C ***
```

---

## งานที่ต้องทำ: Phase 0B

### ขอบเขต (ทำ)
1. อัปเดต `messages/th.json`, `messages/en.json`, `messages/lo.json` — เพิ่ม keys ใหม่
2. สร้าง `components/layout/LanguageSwitcher.tsx` — ใหม่ทั้งหมด
3. แก้ไข `components/layout/Header.tsx` — แปล strings + เพิ่ม LanguageSwitcher
4. แก้ไข `components/layout/HeaderAccountArea.tsx` — แปล strings
5. แก้ไข `components/auth/LogoutButton.tsx` — แปล strings เท่านั้น

### ไม่ทำใน Phase นี้
- `lib/auth/workspace-links.ts` — label ใน .ts ไม่ใช่ component ทำใน Phase 0C
- page content ทุกไฟล์ — Phase 0C
- dashboard, superadmin, account pages — Phase 1+

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect ไฟล์จริงก่อนทุกครั้ง

```bash
cat components/layout/Header.tsx
cat components/layout/HeaderAccountArea.tsx
cat components/auth/LogoutButton.tsx
cat messages/th.json
```

### ขั้น 1 — อัปเดต messages (3 ไฟล์)

เปิด `messages/th.json` แล้วเพิ่ม/แก้ไข keys ต่อไปนี้:

**ใน namespace `"header"` เพิ่ม:**
```json
{
  "header": {
    "home": "หน้าแรก",
    "research": "คลังงานวิจัย",
    "login": "เข้าสู่ระบบ",
    "register": "สมัครสมาชิก",
    "logout": "ออกจากระบบ",
    "loggingOut": "กำลังออกจากระบบ...",
    "myAccount": "บัญชีของฉัน",
    "dashboard": "แดชบอร์ด",
    "admin": "ผู้ดูแลระบบ",
    "skipToContent": "ข้ามไปยังเนื้อหาหลัก",
    "openMenu": "เปิดเมนู",
    "closeMenu": "ปิดเมนู",
    "searchResearch": "ค้นหางานวิจัย",
    "colorMode": "โหมดสี",
    "mainMenu": "เมนูหลัก",
    "myProfile": "โปรไฟล์ของฉัน",
    "loadingUserMenu": "กำลังโหลดเมนูผู้ใช้"
  }
}
```

**เพิ่ม namespace `"nav"` ใหม่:**
```json
{
  "nav": {
    "home": "หน้าแรก",
    "research": "งานวิจัย",
    "about": "เกี่ยวกับเรา",
    "contact": "ติดต่อเรา",
    "languageLabel": "เลือกภาษา",
    "th": "ไทย",
    "en": "English",
    "lo": "ລາວ"
  }
}
```

**เพิ่ม namespace `"workspace"` ใหม่:**
```json
{
  "workspace": {
    "favorites": "รายการโปรด",
    "accessRequests": "คำขอเข้าถึงเอกสาร",
    "submitResearch": "ส่งงานวิจัย",
    "mySubmissions": "งานของฉัน",
    "dashboard": "แดชบอร์ด",
    "superAdmin": "Super Admin",
    "myProfile": "โปรไฟล์ของฉัน"
  }
}
```

**`messages/en.json`** — เพิ่ม keys เดียวกัน:
```json
{
  "header": {
    "home": "Home",
    "research": "Research Repository",
    "login": "Sign In",
    "register": "Sign Up",
    "logout": "Sign Out",
    "loggingOut": "Signing out...",
    "myAccount": "My Account",
    "dashboard": "Dashboard",
    "admin": "Admin",
    "skipToContent": "Skip to main content",
    "openMenu": "Open menu",
    "closeMenu": "Close menu",
    "searchResearch": "Search research",
    "colorMode": "Color mode",
    "mainMenu": "Main menu",
    "myProfile": "My Profile",
    "loadingUserMenu": "Loading user menu"
  },
  "nav": {
    "home": "Home",
    "research": "Research",
    "about": "About Us",
    "contact": "Contact",
    "languageLabel": "Select language",
    "th": "ไทย",
    "en": "English",
    "lo": "ລາວ"
  },
  "workspace": {
    "favorites": "Favorites",
    "accessRequests": "Access Requests",
    "submitResearch": "Submit Research",
    "mySubmissions": "My Submissions",
    "dashboard": "Dashboard",
    "superAdmin": "Super Admin",
    "myProfile": "My Profile"
  }
}
```

**`messages/lo.json`** — copy keys เดียวกันจาก `th.json` (placeholder)

### ขั้น 2 — สร้าง LanguageSwitcher.tsx

สร้างไฟล์ใหม่ `components/layout/LanguageSwitcher.tsx`:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<string, string> = {
  th: 'ไทย',
  en: 'EN',
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
    <div
      role="navigation"
      aria-label={t('languageLabel')}
      className="flex items-center gap-0.5"
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          aria-current={loc === locale ? 'true' : undefined}
          lang={loc}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            loc === locale
              ? 'bg-brand-600 text-white'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
```

**ข้อกำหนด:**
- ต้องใช้ `useRouter` และ `usePathname` จาก `next-intl/navigation` เท่านั้น ไม่ใช่ `next/navigation`
- ปุ่ม active ต้องมี visual indicator และ `aria-current="true"`
- รองรับ keyboard (tab + enter)

### ขั้น 3 — แก้ไข Header.tsx

**อ่านไฟล์จริงก่อน** แล้วแก้ไขดังนี้:

**3.1 เปลี่ยน imports:**
```tsx
// ลบออก
import Link from "next/link";
import { usePathname } from "next/navigation";

// เพิ่มเข้า
import { useTranslations } from 'next-intl';
import { Link, usePathname } from 'next-intl/navigation';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
```

**3.2 ย้าย navLinks เข้าใน component function และใช้ translation:**
```tsx
export default function Header({ ... }) {
  const t = useTranslations('nav');
  const tHeader = useTranslations('header');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();  // ตอนนี้มาจาก next-intl/navigation

  const navLinks = [
    { href: "/" as const, label: t('home') },
    { href: "/research" as const, label: t('research') },
    { href: "/about" as const, label: t('about') },
    { href: "/contact" as const, label: t('contact') },
  ];
  // ...
}
```

**3.3 แทนที่ string hardcode ด้วย translation:**
- `aria-label="เมนูหลัก"` → `aria-label={tHeader('mainMenu')}`
- `aria-label="ค้นหางานวิจัย"` → `aria-label={tHeader('searchResearch')}`
- `aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}` → `aria-label={open ? tHeader('closeMenu') : tHeader('openMenu')}`
- `"โหมดสี"` → `{tHeader('colorMode')}`

**3.4 วาง LanguageSwitcher — desktop:**
```tsx
<div className="hidden items-center gap-2 md:flex">
  <LanguageSwitcher />
  <ThemeToggle />
  <Link href="/research" aria-label={tHeader('searchResearch')} ...>
    <Search className="h-5 w-5" />
  </Link>
  {desktopAccountArea}
</div>
```

**3.5 วาง LanguageSwitcher — mobile:**
```tsx
<Container className="flex flex-col gap-1 py-3">
  <div className="mb-1 flex items-center justify-between rounded-md px-3 py-1.5">
    <span className="text-xs font-medium text-gray-500">{tHeader('colorMode')}</span>
    <ThemeToggle />
  </div>
  <div className="mb-1 flex items-center justify-between rounded-md px-3 py-1.5">
    <span className="text-xs font-medium text-gray-500">{t('languageLabel')}</span>
    <LanguageSwitcher />
  </div>
  {navLinks.map(...)}
  {mobileAccountArea}
</Container>
```

**หมายเหตุ:** `usePathname` จาก `next-intl/navigation` คืน path ที่ตัด locale ออกแล้ว
(`/research` ไม่ใช่ `/th/research`) — active link detection ยังใช้ logic เดิมได้โดยไม่ต้องแก้

### ขั้น 4 — แก้ไข HeaderAccountArea.tsx

**อ่านไฟล์จริงก่อน** — Server Component (async) ใช้ `getTranslations`:

```tsx
import { getTranslations } from 'next-intl/server';

export default async function HeaderAccountArea({ variant }: { variant: "desktop" | "mobile" }) {
  const { user, notifications, unreadCount, workspaceLinks } = await loadAccountData();
  const t = await getTranslations('header');

  if (variant === "desktop") {
    return user ? (
      <>
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <UserMenu user={user} workspaceLinks={workspaceLinks} />
      </>
    ) : (
      <>
        <LinkButton href="/login" variant="outline" size="sm">
          {t('login')}
        </LinkButton>
        <LinkButton href="/register" variant="primary" size="sm">
          {t('register')}
        </LinkButton>
      </>
    );
  }

  return (
    <>
      {workspaceLinks.map((link) => (
        <Link key={link.href} href={link.href} ...>
          {link.label}  {/* label ของ workspaceLinks ยังเป็น string เดิม ไม่เปลี่ยน */}
        </Link>
      ))}
      {user ? (
        <div ...>
          <Link href="/account" ...>
            <UserCircle className="h-4 w-4" />
            {user.fullName || user.email || t('myProfile')}
          </Link>
          <LogoutButton ... />
        </div>
      ) : (
        <div ...>
          <LinkButton href="/login" variant="outline" size="sm" className="flex-1">
            {t('login')}
          </LinkButton>
          <LinkButton href="/register" variant="primary" size="sm" className="flex-1">
            {t('register')}
          </LinkButton>
        </div>
      )}
    </>
  );
}
```

### ขั้น 5 — แก้ไข LogoutButton.tsx

**อ่านไฟล์จริงก่อน** — ห้ามแตะ handleLogout() เด็ดขาด

```tsx
'use client';

import { useTransition } from "react";
import { useRouter } from 'next-intl/navigation';  // เปลี่ยนจาก next/navigation
import { useTranslations } from 'next-intl';
import { LogOut } from "lucide-react";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('header');

  function handleLogout() {
    startTransition(async () => {
      const { createClient } = await import("@/lib/supabase/client");  // ห้ามแก้บรรทัดนี้
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={className || "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? t('loggingOut') : t('logout')}
    </button>
  );
}
```

### ขั้น 6 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Manual smoke test (dev server):**
```bash
npm run dev
# เปิด http://localhost:3001/th
# ✓ Header แสดงภาษาไทย
# ✓ เห็น LanguageSwitcher (ไทย / EN / ລາວ)
# คลิก EN → URL เปลี่ยนเป็น /en/, Header เปลี่ยนเป็นอังกฤษ
# ที่ /en/research คลิก TH → ไป /th/research (path คงเดิม)
# Logout button แสดงข้อความถูก locale
# Keyboard: Tab ถึง LanguageSwitcher → Enter สลับได้
```

---

## เกณฑ์ความสำเร็จ Phase 0B

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] `/th/` → Header ภาษาไทย, LanguageSwitcher แสดง TH active
- [ ] `/en/` → Header ภาษาอังกฤษ, LanguageSwitcher แสดง EN active
- [ ] `/lo/` → Header ภาษาไทย (placeholder), LanguageSwitcher แสดง ລາວ active
- [ ] สลับที่ `/th/research` → `/en/research` (slug คงเดิม)
- [ ] LanguageSwitcher มี `aria-current="true"` บน locale ที่ active
- [ ] Logout button ใช้งานได้ปกติ session หมดจริง
- [ ] dynamic import pattern ใน LogoutButton ยังอยู่ครบ
- [ ] ไม่มี string ภาษาไทย hardcode เหลือใน Header.tsx, HeaderAccountArea.tsx, LogoutButton.tsx

---

## ข้อห้าม

- ห้ามแตะ `lib/auth/workspace-links.ts` — Phase 0C
- ห้ามแตะ `middleware.ts`
- ห้ามแตะ `lib/supabase/` ทุกไฟล์
- ห้ามเปลี่ยน `dynamic import("@/lib/supabase/client")` pattern ใน LogoutButton
- ห้ามแตะ page files ทุกไฟล์ — Phase 0C
- ถ้า test จำนวนลดลง → หยุดทันที ห้าม commit

---

## ความเสี่ยงที่ต้องระวัง

1. **`next-intl/navigation` vs `next/navigation`** — Header และ LogoutButton ต้องใช้ `useRouter`/`usePathname` จาก `next-intl/navigation` เท่านั้น มิฉะนั้น locale จะหายตอน navigate

2. **Server vs Client Component** — `HeaderAccountArea` เป็น Server Component ใช้ `getTranslations` (async), `Header` และ `LogoutButton` เป็น Client Component ใช้ `useTranslations` (sync hook) ห้ามสลับกัน

3. **`usePathname` จาก next-intl** — คืน path ที่ตัด locale ออกแล้ว (`/research` ไม่ใช่ `/th/research`) — active link detection ยังใช้ logic เดิมได้

4. **Port 3001 ค้าง** — ถ้ารัน `npm run test:a11y` แล้ว error `EADDRINUSE` ให้รันใน PowerShell:
   `Stop-Process -Id $(Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force`
