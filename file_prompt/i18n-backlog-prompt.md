# i18n Backlog — Auth Pages + Home + About

## Context

- next-intl v4, locales: `lo` (default), `th`, `en`, `vi`, localePrefix: `always`
- `NextIntlClientProvider` อยู่ใน `app/[locale]/layout.tsx` แล้ว
- Messages catalog มี namespace: `common`, `header`, `nav`, `home`, `research`, `auth`, `errors`, `authors`
- ทุก locale มีคำแปลครบแล้ว — งานนี้คือ **wire component เข้ากับ catalog** ไม่ใช่แปลใหม่
- Server Component → `getTranslations('namespace')`
- Client Component → `useTranslations('namespace')`
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope

1. **Auth pages**: `login`, `register`, `auth/forgot-password`, `auth/reset-password`
2. **Home page**: `app/[locale]/page.tsx` + components ใน `components/home/`
3. **About page**: `app/[locale]/about/page.tsx`
4. รัน lint + tsc + test + build

## ห้ามทำ

- ห้ามแตะ RLS, middleware, signed URL, MFA flow, `app/api/`
- ห้ามแตะ dashboard หรือ superadmin pages
- ห้ามแตะ Supabase client, server actions, database schema
- ห้ามแก้ catalog `messages/*.json` (แปลครบแล้ว — ใช้ key ที่มีอยู่เท่านั้น)
- ห้ามแตะ `public/sw.js`, `public/offline.html`

---

## Step 1 — ตรวจ keys ใน catalog ก่อนทำ

```bash
# ดู keys ทั้งหมดใน namespace auth, home, errors
cat messages/lo.json | python -c "
import json,sys
d=json.load(sys.stdin)
for ns in ['auth','home','errors','common']:
    print(f'=== {ns} ===')
    def flat(obj, prefix=''):
        for k,v in obj.items():
            if isinstance(v,dict): flat(v, prefix+k+'.')
            else: print(f'  {prefix}{k}: {repr(v[:40]) if isinstance(v,str) else v}')
    flat(d.get(ns,{}))
"

# ดูไฟล์ที่ต้องแก้
cat "app/[locale]/login/page.tsx"
cat "app/[locale]/register/page.tsx"
cat "app/[locale]/page.tsx" | head -60
cat "app/[locale]/about/page.tsx"
cat components/home/Hero.tsx
cat components/auth/LoginForm.tsx | head -60
cat components/auth/RegisterForm.tsx 2>/dev/null | head -60 || echo "ไม่พบไฟล์"
```

รายงาน keys ที่พบและโครงสร้าง component ก่อนดำเนินการต่อ

---

## Step 2 — Auth Pages

### หลักการ
- `page.tsx` = Server Component → `getTranslations`
- Form components (`LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`) = Client Component → `useTranslations`
- **อย่าส่ง `t` เป็น prop** — ให้แต่ละ component เรียก `useTranslations` เองในกรณีที่เป็น Client Component

### Login page (`app/[locale]/login/page.tsx`)

```tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('loginTitle') };
}

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <AuthFormShell title={t('loginTitle')} description={t('loginDescription')}>
      <LoginForm />
    </AuthFormShell>
  );
}
```

### LoginForm (Client Component)

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function LoginForm() {
  const t = useTranslations('auth');
  // ใช้ t('emailLabel'), t('passwordLabel'), t('loginButton'),
  // t('forgotPassword'), t('noAccount'), t('registerLink') ฯลฯ
  // ตรวจ key จริงใน catalog ก่อนใช้
}
```

### Pattern เดียวกันสำหรับ
- `register/page.tsx` + `RegisterForm` → namespace `auth`
- `auth/forgot-password/page.tsx` + `ForgotPasswordForm` → namespace `auth`
- `auth/reset-password/page.tsx` + `ResetPasswordForm` → namespace `auth`

**สำคัญ:** ตรวจ keys จริงใน `messages/lo.json` → `auth` namespace ก่อนเขียน ห้าม assume key name

---

## Step 3 — Home Page

### `app/[locale]/page.tsx` (Server Component)

```tsx
import { getTranslations } from 'next-intl/server';
import Hero from '@/components/home/Hero';
// ... imports อื่นๆ

export default async function HomePage() {
  const t = await getTranslations('home');
  // ส่ง translated strings เป็น prop ให้ components
  // หรือถ้า component เป็น Server Component ให้ใช้ getTranslations ในนั้นเอง
}
```

### `components/home/Hero.tsx`

ตรวจก่อนว่าเป็น Server หรือ Client Component:
```bash
head -3 components/home/Hero.tsx
```

- ถ้า Server → ใช้ `getTranslations`
- ถ้า Client → ใช้ `useTranslations`

### `components/home/HomeSearchBox.tsx`, `CategorySection.tsx`, `ResearchSection.tsx`

ตรวจแต่ละไฟล์ก่อนแล้วใช้ pattern ที่เหมาะสม

---

## Step 4 — About Page

`app/[locale]/about/page.tsx` ตรวจโครงสร้างจริงแล้วใช้:

```tsx
import { getTranslations } from 'next-intl/server';

export default async function AboutPage() {
  const t = await getTranslations('about'); // หรือ namespace อื่นที่มี
  // ถ้าไม่มี namespace 'about' ใน catalog ให้ใช้ 'common' หรือ hardcode ไว้ก่อน
  // แล้วรายงานว่าต้องเพิ่ม keys ใด
}
```

---

## Step 5 — Error messages (Supabase Auth errors)

ตรวจ `lib/supabase/error-messages.ts`:
```bash
cat lib/supabase/error-messages.ts | head -40
```

ถ้ามี error message hardcode ภาษาไทย ให้ย้ายไปใช้ namespace `errors` จาก catalog
ถ้าซับซ้อนเกินไปให้บันทึกไว้เป็น backlog แต่ไม่แก้ในรอบนี้

---

## Step 6 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npm run test:a11y
```

---

## รายงานผลที่ต้องการ

1. keys ที่พบใน namespace `auth` และ `home` (จาก Step 1)
2. ไฟล์ที่แก้ไขและ pattern ที่ใช้ (Server/Client)
3. keys ที่ไม่มีใน catalog (ถ้ามี) — รายงานแต่ไม่ต้องเพิ่มเอง
4. ผล tsc / lint / test / build / test:a11y
5. ปัญหาที่พบ + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| `useTranslations` ใน Server Component | ตรวจ `'use client'` ก่อนเสมอ |
| `getTranslations` ใน Client Component | ตรวจ `'use client'` ก่อนเสมอ |
| Key ไม่มีใน catalog → runtime error | ตรวจ keys ใน Step 1 ก่อนเขียนโค้ด |
| Server Action ที่ส่ง error message ภาษาไทย hardcode | บันทึกไว้เป็น backlog ไม่แก้ในรอบนี้ |
| `AuthFormShell` รับ title เป็น prop → ต้องแปลที่ page level | ส่ง `t('loginTitle')` จาก page ลงมา |
