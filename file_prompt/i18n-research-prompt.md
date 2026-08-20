# i18n Phase — Wire translations เข้าหน้า Research + Header + Language Switcher

## Context

- next-intl v4 ติดตั้งและ config แล้ว (`i18n/routing.ts`, `i18n/request.ts`)
- Locales: `th` (default), `en`, `lo`, `vi` — prefix: `always`
- Messages catalog: `messages/th.json`, `messages/en.json`, `messages/lo.json`, `messages/vi.json` — แปลครบแล้ว
- `NextIntlClientProvider` อยู่ใน `app/[locale]/layout.tsx` แล้ว
- ปัญหา: components ยังใช้ string hardcode ไทยทั้งหมด ยังไม่ได้ใช้ `useTranslations` / `getTranslations`
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope — ทำเฉพาะสิ่งต่อไปนี้

1. Header + Navigation — ใช้ translations จาก namespace `header` / `nav`
2. Language Switcher — สร้าง component สลับ locale ผ่าน next-intl `useRouter`
3. หน้า Research (`/[locale]/research`) — search bar, filter dropdowns, labels, empty state
4. รัน lint + tsc + test + build แล้วรายงานผล

## ห้ามทำ (Out of Scope)

- ห้ามแตะ RLS, middleware auth logic, signed URL, MFA flow
- ห้ามแตะ `app/api/` ทุกไฟล์
- ห้ามแตะ `messages/*.json` (catalog แปลครบแล้ว อย่าเปลี่ยน)
- ห้ามแตะ Supabase client, server actions, database schema
- ห้ามแตะ `public/sw.js`, `public/offline.html`
- ห้ามแตะ dashboard หรือ superadmin pages
- ห้าม deploy หรือเปลี่ยน production config

---

## Step 1 — ตรวจไฟล์ก่อนทำ

```bash
# ดู messages catalog — namespace ที่มี
cat messages/th.json | python -c "import json,sys; d=json.load(sys.stdin); print(list(d.keys()))"

# ดู keys ใน namespace research และ header
cat messages/th.json | python -c "
import json,sys
d=json.load(sys.stdin)
print('=== header ===')
print(json.dumps(d.get('header',{}), ensure_ascii=False, indent=2))
print('=== nav ===')
print(json.dumps(d.get('nav',{}), ensure_ascii=False, indent=2))
print('=== research ===')
print(json.dumps(d.get('research',{}), ensure_ascii=False, indent=2))
"

# ดู Header component
cat components/layout/Header.tsx 2>/dev/null || find components -name "Header*" | head -5

# ดู Research page
cat "app/[locale]/research/page.tsx" | head -80

# ดู components ที่ใช้ใน research page
find components/research -name "*.tsx" | head -10
cat components/research/FilterBar.tsx 2>/dev/null | head -60
cat components/research/ResearchExplorer.tsx 2>/dev/null | head -60
```

รายงานโครงสร้าง namespace และ component ที่พบก่อนดำเนินการต่อ

---

## Step 2 — Header + Navigation

เปิด Header component แล้วเพิ่ม translations:

**Server Component:**
```tsx
import { getTranslations } from 'next-intl/server';

export async function Header() {
  const t = await getTranslations('header');
  // ใช้ t('siteName'), t('login'), t('register') ฯลฯ
}
```

**Client Component (ถ้า Header เป็น "use client"):**
```tsx
import { useTranslations } from 'next-intl';

export function Header() {
  const t = useTranslations('header');
  // ใช้ t('siteName'), t('login'), t('register') ฯลฯ
}
```

ให้ตรวจโครงสร้าง Header จริงก่อน แล้วเลือกวิธีที่เหมาะสม

---

## Step 3 — Language Switcher

สร้าง `components/layout/LanguageSwitcher.tsx`:

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

const LOCALES = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
  { code: 'lo', label: 'ລາວ' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="เลือกภาษา / Select language"
      className="..."
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
```

**สำคัญ:** ต้อง import `useRouter` และ `usePathname` จาก `@/i18n/navigation`
ไม่ใช่จาก `next/navigation` — มิฉะนั้น locale จะไม่ถูก handle โดย next-intl

ตรวจ `i18n/navigation.ts` ว่า export `useRouter`/`usePathname` ไว้หรือเปล่า:
```bash
cat i18n/navigation.ts
```

ถ้ายังไม่มี ให้เพิ่ม:
```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

เพิ่ม `<LanguageSwitcher />` เข้า Header ในตำแหน่งที่เหมาะสม

---

## Step 4 — Research Page + Components

### 4.1 Research page (`app/[locale]/research/page.tsx`)

Server Component — ใช้ `getTranslations`:

```tsx
import { getTranslations } from 'next-intl/server';

export default async function ResearchPage({ searchParams }) {
  const t = await getTranslations('research');
  // ส่ง t ผ่าน prop หรือใช้ใน Server Component โดยตรง
}
```

### 4.2 FilterBar / ResearchExplorer (Client Components)

Client Component — ใช้ `useTranslations`:

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function FilterBar() {
  const t = useTranslations('research');

  return (
    <div>
      <input placeholder={t('searchPlaceholder')} />
      <select aria-label={t('filterCategory')}>
        <option value="">{t('allCategories')}</option>
        {/* ... */}
      </select>
      {/* ... */}
    </div>
  );
}
```

### 4.3 Search mode buttons

```tsx
// "ค้นหาทั้งหมด" / "ข้อมูลบรรณานุกรม" / "เนื้อหา PDF"
<button>{t('searchModeAll')}</button>
<button>{t('searchModeBibliographic')}</button>
<button>{t('searchModePdf')}</button>
```

### 4.4 Filter dropdowns

```tsx
// "ทุกหมวดหมู่" / "ทุกปี" / "ทุกระดับสิทธิ์" / "เรียงตาม: ใหม่ล่าสุด"
<option value="">{t('allCategories')}</option>
<option value="">{t('allYears')}</option>
<option value="">{t('allAccessLevels')}</option>
```

### 4.5 Result count

```tsx
// "พบ 10 รายการ"
<p>{t('resultCount', { count: results.length })}</p>
```

ต้องตรวจ key จริงใน `messages/th.json` → `research` namespace ก่อนเขียนโค้ด
อย่า assume key name — ให้ใช้ key ที่มีจริงในไฟล์เท่านั้น

---

## Step 5 — ตรวจ key ก่อน implement

```bash
# ดู key ทั้งหมดที่มีใน namespace research ของทุก locale
for locale in th en lo vi; do
  echo "=== $locale ==="
  cat messages/$locale.json | python -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('research',{})
def flat(obj, prefix=''):
  for k,v in obj.items():
    if isinstance(v,dict): flat(v, prefix+k+'.')
    else: print(f'  {prefix}{k}: {v}')
flat(r)
"
done
```

ถ้า key ไม่ตรงกันระหว่าง locales ให้รายงานก่อนดำเนินการ

---

## Step 6 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npm run test:a11y
```

รายงานผลทุกขั้น

---

## รายงานผลที่ต้องการ

1. namespace และ keys ที่พบใน `messages/th.json` → `research` และ `header`
2. ไฟล์ที่แก้ไขและสิ่งที่เปลี่ยน
3. ผล tsc / lint / test / build / test:a11y
4. ปัญหาที่พบ (ถ้ามี) + วิธีแก้
5. วิธีทดสอบ: เปิด `/th/research` แล้วเปลี่ยน locale → ข้อความต้องเปลี่ยน

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| `useRouter` จาก `next/navigation` แทน `@/i18n/navigation` | ตรวจ import path ทุกครั้ง |
| Key ใน catalog ไม่ตรงกับที่เรียกใน component | ตรวจ key จริงใน Step 5 ก่อนเขียนโค้ด |
| Server Component ใช้ `useTranslations` (hook ใช้ได้แค่ Client) | Server → `getTranslations`, Client → `useTranslations` |
| `ResearchExplorer` รับ prop จาก Server แต่ต้องการ t() | ส่ง translated strings เป็น prop จาก Server หรือเพิ่ม `useTranslations` ใน Client component |
| LanguageSwitcher อยู่นอก `[locale]` layout → ไม่มี NextIntlClientProvider | ตรวจว่า component อยู่ใต้ `app/[locale]/` เสมอ |
