# i18n Phase 0C — Public Pages + Shared Strings
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม (Phase 0A + 0B เสร็จแล้ว)

- `npm run lint` → 0 error
- `npm run test` → 127/127
- `npm run test:a11y` → 50/50
- `npm run build` → 0 error
- Header/LanguageSwitcher แปลแล้วทุก locale
- `i18n/navigation.ts` มีอยู่แล้ว (createNavigation wrapper)
- messages/th.json มี namespaces: common, header, nav, workspace, home, research, auth, errors

ถ้า checks ยังไม่ผ่านครบ → หยุดและแจ้งทันที

---

## สิ่งที่พบจาก inspect จริง (สำคัญมาก — อ่านก่อนเขียนโค้ด)

### app/[locale]/page.tsx (HomePage)
- Server Component (async)
- ส่ง string hardcode ลง props:
  - `title="งานวิจัยล่าสุด"`, `description="เรียงตามวันที่เผยแพร่ ใหม่ไปเก่า"` → ResearchSection
  - `title="งานวิจัยยอดนิยม"`, `description="เรียงตามยอดเข้าชมสะสมสูงสุดในระบบ"` → ResearchSection
- ไม่มี metadata export

### components/home/Hero.tsx
- Server Component (ไม่ async)
- string hardcode ที่ต้องแปล:
  - `"ค้นคว้าและเผยแพร่งานวิจัยขององค์กร\nในรูปแบบดิจิทัล ทุกที่ ทุกเวลา"` (h1)
  - `"รวบรวมงานวิจัย บทความวิชาการ และเอกสาร eBook..."` (p)
  - stats labels: `"งานวิจัยที่เผยแพร่"`, `"หมวดหมู่งานวิจัย"`, `"หน่วยงานที่ร่วมเผยแพร่"`
- `siteName` มาจาก settings (database) — ไม่แปล
- `publishedCount`, `categoryCount`, `organizationCount` มาจาก database — ไม่แปล

### components/home/ResearchSection.tsx
- รับ `title` และ `description` เป็น props (string)
- string ที่ hardcode ในตัวเอง: `"ดูทั้งหมด"` (Link)
- `Link href="/research"` → ต้องเปลี่ยนเป็น next-intl Link

### components/home/CategorySection.tsx
- string hardcode:
  - `"หมวดหมู่งานวิจัย"` (h2)
  - `"เลือกชมงานวิจัยตามสาขาวิชาที่คุณสนใจ"` (p)
  - `"ดูทั้งหมด"` (Link)
  - `"{count} รายการ"` (ใน loop)
- `category.nameTh` มาจาก database — ไม่แปล
- `Link href="/research"` และ `href={/research?category=...}` → ต้องเปลี่ยนเป็น next-intl Link

### app/[locale]/research/page.tsx (ResearchListPage)
- Server Component (async)
- string hardcode:
  - `"งานวิจัยทั้งหมด"` (h1)
  - `"ค้นหาและกรองงานวิจัยขององค์กรจากคลังเอกสารดิจิทัล — รวมค้นหาเนื้อหาภายในไฟล์ PDF"` (p)
  - `"กำลังโหลด..."` (Suspense fallback)
- metadata: `title: "ค้นหางานวิจัย"`, `description: "..."` — ต้องแปลด้วย generateMetadata

### app/[locale]/login/page.tsx (LoginPage)
- Server Component (async)
- string hardcode ใน AuthFormShell props:
  - `title="เข้าสู่ระบบ"`, `description="..."`, footer link `"สมัครสมาชิก"`
- string hardcode ใน alert boxes:
  - `"ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบ"`
  - `"ระบบออกจากระบบให้อัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 100 นาที กรุณาเข้าสู่ระบบใหม่"`
  - `"ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"`
- `Link href="/register"` → เปลี่ยนเป็น next-intl Link
- metadata: `title: "เข้าสู่ระบบ"` — ต้องแปล

### app/[locale]/register/page.tsx (RegisterPage)
- Server Component (async)
- string hardcode: `title="สมัครสมาชิก"`, `description="..."`, footer link `"เข้าสู่ระบบ"`
- `Link href="/login"` → เปลี่ยนเป็น next-intl Link
- metadata: `title: "สมัครสมาชิก"` — ต้องแปล

### app/[locale]/403/page.tsx (ForbiddenPage)
- Server Component (ไม่ async) — ต้องทำให้ async เพื่อใช้ getTranslations
- string hardcode:
  - `"ไม่มีสิทธิ์เข้าถึงหน้านี้"` (h1)
  - `"บัญชีของคุณไม่มีสิทธิ์เพียงพอ..."` (p)
  - `"กลับหน้าแรก"`, `"โปรไฟล์ของฉัน"` (buttons)
- metadata: `title: "ไม่มีสิทธิ์เข้าถึง"` — ต้องแปล
- `LinkButton href="/"` และ `href="/account"` → เปลี่ยนเป็น next-intl Link

---

## งานที่ต้องทำ: Phase 0C

### ขอบเขต (ทำ)
1. อัปเดต messages 3 ไฟล์ — เพิ่ม keys ใหม่
2. `app/[locale]/page.tsx` — แปล string props ที่ส่งลง ResearchSection
3. `components/home/Hero.tsx` — แปล strings
4. `components/home/ResearchSection.tsx` — แปล "ดูทั้งหมด" + เปลี่ยน Link
5. `components/home/CategorySection.tsx` — แปล strings + เปลี่ยน Link
6. `app/[locale]/research/page.tsx` — แปล strings + generateMetadata
7. `app/[locale]/login/page.tsx` — แปล strings + metadata + Link
8. `app/[locale]/register/page.tsx` — แปล strings + metadata + Link
9. `app/[locale]/403/page.tsx` — แปล strings + metadata + Link

### ไม่ทำใน Phase นี้
- `components/research/ResearchExplorer` และ components ย่อย — ซับซ้อน Phase 1
- `components/home/HomeSearchBox` — ดู scope ด้านล่าง
- dashboard, superadmin, account pages — Phase 1+
- `lib/auth/workspace-links.ts` — Phase 1
- `UserMenu.tsx` — Phase 1

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect ก่อนทุกครั้ง

```bash
cat components/home/HomeSearchBox.tsx   # ดูว่ามี string hardcode อะไรบ้าง
cat messages/th.json                    # ยืนยัน keys ที่มีอยู่แล้ว
```

### ขั้น 1 — อัปเดต messages (3 ไฟล์)

เพิ่ม keys ต่อไปนี้ใน `messages/th.json` (additive — ห้ามลบ key เดิม):

**ใน namespace `"home"` (มีอยู่แล้วบางส่วน เพิ่มที่ขาด):**
```json
{
  "home": {
    "title": "คลังงานวิจัยดิจิทัล",
    "subtitle": "ค้นหาและเข้าถึงงานวิจัย วิทยานิพนธ์ และเอกสารวิชาการ",
    "searchPlaceholder": "ค้นหางานวิจัย...",
    "searchButton": "ค้นหา",
    "browseAll": "ดูทั้งหมด",
    "featuredResearch": "งานวิจัยแนะนำ",
    "recentResearch": "งานวิจัยล่าสุด",
    "categories": "หมวดหมู่",
    "viewAll": "ดูทั้งหมด",
    "heroHeading": "ค้นคว้าและเผยแพร่งานวิจัยขององค์กร\nในรูปแบบดิจิทัล ทุกที่ ทุกเวลา",
    "heroSubtitle": "รวบรวมงานวิจัย บทความวิชาการ และเอกสาร eBook จากบุคลากรและหน่วยงานภายในองค์กร พร้อมระบบค้นหา อ่านออนไลน์ และดาวน์โหลดตามสิทธิ์การเข้าถึง",
    "statPublished": "งานวิจัยที่เผยแพร่",
    "statCategories": "หมวดหมู่งานวิจัย",
    "statOrganizations": "หน่วยงานที่ร่วมเผยแพร่",
    "categoryHeading": "หมวดหมู่งานวิจัย",
    "categorySubtitle": "เลือกชมงานวิจัยตามสาขาวิชาที่คุณสนใจ",
    "categoryCount": "{count} รายการ",
    "viewAllResearch": "ดูทั้งหมด",
    "latestTitle": "งานวิจัยล่าสุด",
    "latestDescription": "เรียงตามวันที่เผยแพร่ ใหม่ไปเก่า",
    "popularTitle": "งานวิจัยยอดนิยม",
    "popularDescription": "เรียงตามยอดเข้าชมสะสมสูงสุดในระบบ"
  }
}
```

**ใน namespace `"research"` (มีอยู่แล้วบางส่วน เพิ่มที่ขาด):**
```json
{
  "research": {
    "pageTitle": "คลังงานวิจัย",
    "pageHeading": "งานวิจัยทั้งหมด",
    "pageSubtitle": "ค้นหาและกรองงานวิจัยขององค์กรจากคลังเอกสารดิจิทัล — รวมค้นหาเนื้อหาภายในไฟล์ PDF",
    "pageDescription": "ค้นหา กรอง และเรียงลำดับงานวิจัยขององค์กรตามหมวดหมู่ ปี และความนิยม — ค้นหาได้ทั้งข้อมูลบรรณานุกรมและเนื้อหาภายในไฟล์ PDF",
    "loading": "กำลังโหลด..."
  }
}
```

**เพิ่ม namespace `"login"` ใหม่:**
```json
{
  "login": {
    "pageTitle": "เข้าสู่ระบบ",
    "pageDescription": "เข้าสู่ระบบห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
    "title": "เข้าสู่ระบบ",
    "description": "เข้าสู่ระบบเพื่อเข้าถึงงานวิจัยระดับสมาชิกและบันทึกรายการโปรด",
    "noAccount": "ยังไม่มีบัญชีผู้ใช้?",
    "registerLink": "สมัครสมาชิก",
    "confirmedEmail": "ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบ",
    "sessionTimeout": "ระบบออกจากระบบให้อัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 100 นาที กรุณาเข้าสู่ระบบใหม่",
    "passwordResetSuccess": "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
  }
}
```

**เพิ่ม namespace `"register"` ใหม่:**
```json
{
  "register": {
    "pageTitle": "สมัครสมาชิก",
    "pageDescription": "สมัครสมาชิกห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร",
    "title": "สมัครสมาชิก",
    "description": "สมัครสมาชิกเพื่อเข้าถึงงานวิจัยและฟีเจอร์เพิ่มเติมของห้องสมุดดิจิทัล",
    "hasAccount": "มีบัญชีผู้ใช้อยู่แล้ว?",
    "loginLink": "เข้าสู่ระบบ"
  }
}
```

**แก้ไข namespace `"errors"` (มีอยู่แล้ว เพิ่มที่ขาด):**
```json
{
  "errors": {
    "notFound": "ไม่พบหน้าที่ต้องการ",
    "forbidden": "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
    "forbiddenTitle": "ไม่มีสิทธิ์เข้าถึง",
    "forbiddenHeading": "ไม่มีสิทธิ์เข้าถึงหน้านี้",
    "forbiddenBody": "บัญชีของคุณไม่มีสิทธิ์เพียงพอสำหรับการเข้าถึงหน้านี้ หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ",
    "backHome": "กลับหน้าแรก",
    "myProfile": "โปรไฟล์ของฉัน",
    "serverError": "เกิดข้อผิดพลาดในระบบ กรุณาลองอีกครั้ง",
    "sessionExpired": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
  }
}
```

**`messages/en.json`** — เพิ่ม keys เดียวกัน (แปลเป็นอังกฤษ):
```json
{
  "home": {
    "heroHeading": "Research and publish your organization's research\nin digital format, anywhere, anytime",
    "heroSubtitle": "A collection of research papers, academic articles, and eBooks from organizational personnel and departments, with search, online reading, and permission-based download.",
    "statPublished": "Published Research",
    "statCategories": "Research Categories",
    "statOrganizations": "Contributing Organizations",
    "categoryHeading": "Research Categories",
    "categorySubtitle": "Browse research by field of interest",
    "categoryCount": "{count} items",
    "viewAllResearch": "View All",
    "latestTitle": "Latest Research",
    "latestDescription": "Sorted by publication date, newest first",
    "popularTitle": "Popular Research",
    "popularDescription": "Sorted by total views"
  },
  "research": {
    "pageHeading": "All Research",
    "pageSubtitle": "Search and filter organizational research from the digital repository — including full-text PDF search",
    "pageDescription": "Search, filter, and sort organizational research by category, year, and popularity — search both bibliographic data and PDF content",
    "loading": "Loading..."
  },
  "login": {
    "pageTitle": "Sign In",
    "pageDescription": "Sign in to the digital research library",
    "title": "Sign In",
    "description": "Sign in to access member-level research and save favorites",
    "noAccount": "Don't have an account?",
    "registerLink": "Sign up",
    "confirmedEmail": "Email confirmed successfully. Please sign in.",
    "sessionTimeout": "You were signed out automatically due to 100 minutes of inactivity. Please sign in again.",
    "passwordResetSuccess": "Password reset successful. Please sign in with your new password."
  },
  "register": {
    "pageTitle": "Sign Up",
    "pageDescription": "Sign up for the digital research library",
    "title": "Create Account",
    "description": "Sign up to access research and additional features of the digital library",
    "hasAccount": "Already have an account?",
    "loginLink": "Sign in"
  },
  "errors": {
    "forbiddenTitle": "Access Denied",
    "forbiddenHeading": "You don't have access to this page",
    "forbiddenBody": "Your account doesn't have sufficient permissions to access this page. If you believe this is an error, please contact an administrator.",
    "backHome": "Back to Home",
    "myProfile": "My Profile"
  }
}
```

**`messages/lo.json`** — copy จาก th.json ทุก key ที่เพิ่ม (placeholder)

### ขั้น 2 — app/[locale]/page.tsx

Server Component — ใช้ `getTranslations`:

```tsx
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('home');

  // ... data fetching เหมือนเดิม ...

  return (
    <>
      <Hero ... />
      <CategorySection ... />
      <ResearchSection
        title={t('latestTitle')}
        description={t('latestDescription')}
        icon={Clock}
        items={latest}
        tone="muted"
        variant="latest"
      />
      <ResearchSection
        title={t('popularTitle')}
        description={t('popularDescription')}
        icon={TrendingUp}
        items={popular}
        variant="popular"
      />
    </>
  );
}
```

### ขั้น 3 — components/home/Hero.tsx

Server Component — ใช้ `getTranslations` (ต้องทำให้ async):

```tsx
import { getTranslations } from 'next-intl/server';

export default async function Hero({ siteName, publishedCount, categoryCount, organizationCount }) {
  const t = await getTranslations('home');

  const stats = [
    { icon: FileText, label: t('statPublished'), value: `${publishedCount}+` },
    { icon: BookMarked, label: t('statCategories'), value: `${categoryCount}` },
    { icon: Users2, label: t('statOrganizations'), value: `${organizationCount}` },
  ];

  return (
    <section ...>
      ...
      <h1 ...>
        {t('heroHeading')}   {/* แทน hardcode Thai */}
      </h1>
      <p ...>
        {t('heroSubtitle')}  {/* แทน hardcode Thai */}
      </p>
      ...
    </section>
  );
}
```

**หมายเหตุ:** `siteName` ยังคงรับจาก props (มาจาก database) ไม่ใช้ translation

### ขั้น 4 — components/home/ResearchSection.tsx

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';  // เปลี่ยนจาก next/link

export default async function ResearchSection({ title, description, ... }) {
  const t = await getTranslations('home');

  return (
    <section ...>
      ...
      <Link href="/research" ...>
        {t('viewAllResearch')} <ArrowRight className="h-4 w-4" />
      </Link>
      ...
    </section>
  );
}
```

### ขั้น 5 — components/home/CategorySection.tsx

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';  // เปลี่ยนจาก next/link

export default async function CategorySection({ categories, countByCategoryId }) {
  const t = await getTranslations('home');

  return (
    <section ...>
      <h2 ...>{t('categoryHeading')}</h2>
      <p ...>{t('categorySubtitle')}</p>
      <Link href="/research" ...>
        {t('viewAllResearch')} <ArrowRight className="h-4 w-4" />
      </Link>

      {categories.map((category) => {
        const count = countByCategoryId[category.id] ?? 0;
        return (
          <Link
            key={category.id}
            href={`/research?category=${category.id}`}  // next-intl Link จะ handle locale เอง
            ...
          >
            ...
            <h3 ...>{category.nameTh}</h3>  {/* ข้อมูลจาก DB ไม่แปล */}
            <p ...>{t('categoryCount', { count })}</p>
          </Link>
        );
      })}
    </section>
  );
}
```

### ขั้น 6 — app/[locale]/research/page.tsx

```tsx
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'research' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function ResearchListPage({ searchParams }) {
  const t = await getTranslations('research');

  // ... params parsing เหมือนเดิม ...

  return (
    <section className="py-10 sm:py-12">
      <Container>
        <div className="mb-8">
          <h1 ...>{t('pageHeading')}</h1>
          <p ...>{t('pageSubtitle')}</p>
        </div>

        <Suspense fallback={<div className="text-sm text-gray-500">{t('loading')}</div>}>
          <ResearchExplorer ... />
        </Suspense>
      </Container>
    </section>
  );
}
```

### ขั้น 7 — app/[locale]/login/page.tsx

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function LoginPage({ searchParams }) {
  const t = await getTranslations('login');
  const params = await searchParams;
  // ...

  return (
    <AuthFormShell
      title={t('title')}
      description={t('description')}
      footer={
        <>
          {t('noAccount')}{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            {t('registerLink')}
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured() ? (
        <SupabaseNotConfiguredNotice />
      ) : (
        <>
          {params.confirmed === "1" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t('confirmedEmail')}</p>
            </div>
          )}
          {params.timeout === "1" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t('sessionTimeout')}</p>
            </div>
          )}
          {params.reset === "success" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t('passwordResetSuccess')}</p>
            </div>
          )}
          <LoginForm redirectTo={redirectTo} />
        </>
      )}
    </AuthFormShell>
  );
}
```

### ขั้น 8 — app/[locale]/register/page.tsx

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'register' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function RegisterPage() {
  const t = await getTranslations('register');
  // ...

  return (
    <AuthFormShell
      title={t('title')}
      description={t('description')}
      footer={
        <>
          {t('hasAccount')}{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            {t('loginLink')}
          </Link>
        </>
      }
    >
      ...
    </AuthFormShell>
  );
}
```

### ขั้น 9 — app/[locale]/403/page.tsx

ต้องเปลี่ยนเป็น async function:

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'errors' });
  return { title: t('forbiddenTitle') };
}

export default async function ForbiddenPage() {
  const t = await getTranslations('errors');

  return (
    <div ...>
      <Container ...>
        <span ...><ShieldAlert className="h-8 w-8" /></span>
        <h1 ...>{t('forbiddenHeading')}</h1>
        <p ...>{t('forbiddenBody')}</p>
        <div className="mt-6 flex gap-3">
          <Link href="/" ...>   {/* LinkButton ถ้า import ได้ */}
            {t('backHome')}
          </Link>
          <Link href="/account" ...>
            {t('myProfile')}
          </Link>
        </div>
      </Container>
    </div>
  );
}
```

**หมายเหตุ:** ถ้า `LinkButton` รับ `href` และ `as` prop ให้ใช้ต่อได้ — แต่ถ้าใช้ `next/link` ภายใน ให้ตรวจสอบและเปลี่ยนเป็น next-intl Link

### ขั้น 10 — ตรวจ HomeSearchBox

```bash
cat components/home/HomeSearchBox.tsx
```

ถ้ามี string hardcode → แปลด้วย `useTranslations('home')` (Client Component)
ถ้าไม่มี → ข้ามได้

### ขั้น 11 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Manual smoke test:**
```bash
npm run dev
# /th/         → หน้าแรกภาษาไทยทั้งหมด, stats ถูก
# /en/         → หน้าแรกภาษาอังกฤษ, stats ยังแสดงเหมือนเดิม (ตัวเลขจาก DB)
# /th/research → heading/subtitle ภาษาไทย
# /en/research → heading/subtitle ภาษาอังกฤษ
# /th/login    → form ภาษาไทย
# /en/login    → form ภาษาอังกฤษ
# /th/403      → error page ภาษาไทย
# /en/403      → error page ภาษาอังกฤษ
# สลับภาษาที่ /th/research?category=xxx → /en/research?category=xxx (query string คงเดิม)
```

---

## เกณฑ์ความสำเร็จ Phase 0C

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] `/th/` → หน้าแรกภาษาไทยครบ
- [ ] `/en/` → หน้าแรกภาษาอังกฤษครบ
- [ ] `/th/research` และ `/en/research` → heading/subtitle ถูก locale
- [ ] metadata title เปลี่ยนตาม locale (ตรวจใน browser tab)
- [ ] category count แสดง format ถูก locale (`10 รายการ` vs `10 items`)
- [ ] ชื่องานวิจัย/ชื่อหมวดหมู่จาก database ยังแสดงข้อมูลเดิม (ไม่แปล)
- [ ] Link ใน public pages ใช้ next-intl navigation (ตรวจว่าสลับภาษาแล้ว path ถูก)
- [ ] auth flow (login/logout/register) ยังทำงานปกติ

---

## ข้อห้าม

- ห้ามแปล dynamic content จาก database:
  - `category.nameTh`, `category.nameEn`
  - ชื่องานวิจัย, ชื่อผู้วิจัย, บทคัดย่อ
  - `siteName` จาก settings
- ห้ามแตะ `ResearchExplorer` และ components ย่อย — Phase 1
- ห้ามแตะ dashboard, superadmin, account pages — Phase 1+
- ห้ามแตะ `middleware.ts`, `lib/supabase/`, auth logic
- ถ้า test จำนวนลดลง → หยุดทันที ห้าม commit

---

## ความเสี่ยงที่ต้องระวัง

1. **Hero.tsx เปลี่ยนเป็น async** — ตรวจสอบว่า parent component ที่เรียก Hero
   ไม่มี issue กับ async Server Component

2. **ResearchSection และ CategorySection เปลี่ยนเป็น async** — เช่นเดียวกัน
   ตรวจ parent ที่ใช้ทั้งสองนี้ว่ายังรับ async component ได้

3. **`generateMetadata` ต้องการ locale จาก params** — pattern:
   ```tsx
   export async function generateMetadata({
     params,
   }: {
     params: Promise<{ locale: string }>;
   }): Promise<Metadata> {
     const { locale } = await params;
     const t = await getTranslations({ locale, namespace: 'xxx' });
     return { title: t('pageTitle') };
   }
   ```

4. **Port 3001 ค้าง** — ก่อนรัน `npm run test:a11y` ให้ตรวจก่อนเสมอ:
   PowerShell: `Stop-Process -Id $(Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force`

5. **`{count} รายการ` ใน CategorySection** — ต้องใช้ next-intl ICU format:
   key: `"categoryCount": "{count} รายการ"` แล้วเรียก `t('categoryCount', { count })`
