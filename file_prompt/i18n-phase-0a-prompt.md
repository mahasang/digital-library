# i18n Phase 0A — Infrastructure Prompt สำหรับ Claude Code / Cursor

## บริบทโปรเจกต์

Next.js 15 App Router + TypeScript + Supabase (RLS + Auth)
ระบบห้องสมุดดิจิทัล/คลังงานวิจัย มี roles: guest, member, staff, librarian, admin, super_admin

**สถานะปัจจุบัน (baseline ผ่านทั้งหมด):**
- `npm run lint` → 0 error
- `npx tsc --noEmit` → 0 error
- `npm run test` → 127/127 passed
- `npm run test:a11y` → 50/50 passed
- `npm run build` → 69 routes, 0 error

**สิ่งที่ห้ามแตะในทุกกรณี:**
- Supabase RLS policies และ migrations
- `lib/supabase/middleware.ts` — logic auth, role rank guard, MFA aal2 step-up
- signed URL security (`lib/storage/`)
- audit logs, MFA enrollment/challenge flow
- ไฟล์ใน `/api/` ทั้งหมด (ไม่ต้องการ locale prefix)

---

## งานที่ต้องทำ: i18n Phase 0A — Infrastructure เท่านั้น

ติดตั้ง `next-intl` และวางโครงสร้าง 3 ภาษา (ไทย/อังกฤษ/ลาว)
**ยังไม่แปล string ใน component ใดเลยในรอบนี้** — ทำแค่ infrastructure ให้พร้อมก่อน

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect ก่อนแก้ไขทุกครั้ง

```bash
# อ่านไฟล์เหล่านี้ก่อนเริ่มเขียนโค้ด
cat middleware.ts
cat next.config.ts          # หรือ next.config.js ถ้าไม่มี .ts
cat app/layout.tsx
cat package.json | grep -E '"next"|"next-intl"'
ls app/
```

### ขั้น 1 — ติดตั้ง dependency

```bash
npm install next-intl
```

### ขั้น 2 — สร้างไฟล์ใหม่ (ห้ามแก้ไขไฟล์เดิมในขั้นนี้)

สร้างไฟล์ต่อไปนี้ตามเนื้อหาในหัวข้อ "เนื้อหาไฟล์" ด้านล่าง:

1. `i18n/routing.ts`
2. `i18n/request.ts`
3. `messages/th.json`
4. `messages/en.json`
5. `messages/lo.json` (placeholder = copy th.json)

### ขั้น 3 — แก้ไข next.config.ts

**อ่าน `next.config.ts` ก่อน** แล้วเพิ่มเฉพาะ `withNextIntl` wrapper
โดย**คงค่า config เดิมทุกอย่างไว้ทั้งหมด** ไม่ลบหรือเปลี่ยนแปลงส่วนอื่น

### ขั้น 4 — แก้ไข middleware.ts

**อ่าน middleware.ts ทั้งไฟล์ก่อน** จากนั้น:
- เพิ่ม `intlMiddleware` จาก `next-intl/middleware`
- **auth logic เดิมทั้งหมดต้องทำงานก่อน** (Supabase session refresh, role rank, MFA aal2)
- เพิ่ม `intlMiddleware` เป็นขั้นสุดท้าย ต่อจาก auth เสมอ
- route ที่ขึ้นต้นด้วย `/api/` ต้องข้าม intl middleware ทั้งหมด
- ตัด locale prefix (`/th`, `/en`, `/lo`) ออกก่อนเช็ค protected paths ทุกครั้ง
- copy auth cookies จาก auth response ไปยัง intl response ก่อน return

### ขั้น 5 — ย้าย app/layout.tsx → app/[locale]/layout.tsx

**อ่าน `app/layout.tsx` ก่อน** แล้ว:
- สร้าง directory `app/[locale]/`
- ย้าย (หรือสร้างใหม่) `app/[locale]/layout.tsx` โดยเพิ่ม `NextIntlClientProvider`
- เพิ่ม `generateStaticParams()` return ทั้ง 3 locales
- validate locale ด้วย `notFound()` ถ้าไม่ valid
- **คง font, session fetch, Header, Footer เหมือนเดิมทุกอย่าง**
- `app/layout.tsx` เดิม (root) ให้เหลือแค่ `<html><body>{children}</body></html>` หรือลบ
  ถ้า Next.js 15 App Router ไม่ต้องการ root layout แยก

### ขั้น 6 — ย้าย pages ทั้งหมดเข้า app/[locale]/

ย้าย (rename directory) pages เหล่านี้เข้า `app/[locale]/`:
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

**ไฟล์ที่ต้องอยู่ที่ root `app/` เหมือนเดิม (ห้ามย้าย):**
- `app/api/` — ทั้งหมด
- `app/not-found.tsx`
- `app/globals.css`

**ในขั้นนี้ยังไม่ต้องใช้ `useTranslations` ใน page ใดเลย**
ย้ายโครงสร้างไฟล์อย่างเดียว ให้ build ผ่านก่อน

### ขั้น 7 — แก้ไข internal links ที่ hardcode path

ค้นหา `href="/"`, `href="/research"`, `href="/login"`, `href="/dashboard"` ฯลฯ
ใน components ที่ถูกเรียกจาก page ใน `[locale]` และเปลี่ยนเป็น
`usePathname`/`useRouter` จาก `next-intl/navigation` หรือใช้ `Link` จาก
`next-intl` แทน `next/link` เฉพาะ component ที่จำเป็น

**ลำดับความสำคัญ:** แก้เฉพาะที่ทำให้ TypeScript error หรือ navigation พัง
ส่วนที่ยังทำงานได้ปกติ ค่อยแก้ใน Phase 0B

### ขั้น 8 — รัน checks และ report

```bash
# หยุด dev server ก่อน (ห้ามรัน build พร้อม dev)
# ล้าง cache
rm -rf .next

npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
npm run build
```

รายงานผลทุกคำสั่ง พร้อมระบุ:
- ไฟล์ที่สร้างใหม่ทั้งหมด
- ไฟล์ที่แก้ไขทั้งหมด (พร้อมสรุปว่าแก้อะไร)
- warning/error ที่พบและวิธีแก้
- ความเสี่ยงที่เหลืออยู่

---

## เนื้อหาไฟล์

### `i18n/routing.ts`

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['th', 'en', 'lo'] as const,
  defaultLocale: 'th',
  localePrefix: 'always'   // ทุก locale มี prefix: /th/, /en/, /lo/
});

export type Locale = (typeof routing.locales)[number];
```

### `i18n/request.ts`

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
```

### `next.config.ts` (เฉพาะส่วนที่เพิ่ม)

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// ... config เดิม ...

export default withNextIntl(nextConfig);
```

### `middleware.ts` (pattern การเพิ่ม — อ่านไฟล์จริงก่อน แล้ว adapt)

```ts
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ข้าม API และ static files ทั้งหมด
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // --- auth logic เดิมทั้งหมด ---
  // (คง Supabase session refresh, role rank guard, MFA aal2 ไว้เหมือนเดิม)
  // เพิ่มเฉพาะ: ตัด locale prefix ออกก่อนเช็ค protected paths
  // เช่น: const cleanPath = pathname.replace(/^\/(th|en|lo)/, '') || '/';
  // แล้วใช้ cleanPath แทน pathname ในการเช็ค /dashboard, /superadmin ฯลฯ

  // --- intl middleware (ต้องมาสุดท้ายเสมอ) ---
  const intlResponse = intlMiddleware(request);

  // copy cookies จาก auth response → intl response
  authResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
};
```

### `app/[locale]/layout.tsx` (pattern — adapt จากไฟล์จริง)

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
// ... imports เดิมจาก app/layout.tsx ทั้งหมด

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  // ... session fetch เดิม ...

  return (
    <html lang={locale}>   {/* เปลี่ยนจาก lang="th" hardcode */}
      <body>
        <NextIntlClientProvider messages={messages}>
          {/* Header, children, Footer เหมือนเดิมทุกอย่าง */}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
```

### `messages/th.json`

```json
{
  "common": {
    "loading": "กำลังโหลด...",
    "error": "เกิดข้อผิดพลาด",
    "retry": "ลองอีกครั้ง",
    "cancel": "ยกเลิก",
    "save": "บันทึก",
    "delete": "ลบ",
    "edit": "แก้ไข",
    "view": "ดู",
    "download": "ดาวน์โหลด",
    "search": "ค้นหา",
    "filter": "กรอง",
    "clear": "ล้าง",
    "submit": "ส่ง",
    "confirm": "ยืนยัน",
    "close": "ปิด",
    "back": "กลับ",
    "next": "ถัดไป",
    "previous": "ก่อนหน้า",
    "required": "จำเป็น",
    "optional": "ไม่บังคับ"
  },
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
    "skipToContent": "ข้ามไปยังเนื้อหาหลัก"
  },
  "nav": {
    "language": "ภาษา",
    "languageLabel": "เลือกภาษา",
    "th": "ไทย",
    "en": "English",
    "lo": "ລາວ"
  },
  "home": {
    "title": "คลังงานวิจัยดิจิทัล",
    "subtitle": "ค้นหาและเข้าถึงงานวิจัย วิทยานิพนธ์ และเอกสารวิชาการ",
    "searchPlaceholder": "ค้นหางานวิจัย...",
    "searchButton": "ค้นหา",
    "browseAll": "ดูทั้งหมด",
    "featuredResearch": "งานวิจัยแนะนำ",
    "recentResearch": "งานวิจัยล่าสุด",
    "categories": "หมวดหมู่",
    "viewAll": "ดูทั้งหมด"
  },
  "research": {
    "pageTitle": "คลังงานวิจัย",
    "pageSubtitle": "ค้นหาและกรองงานวิจัยขององค์กรจากคลังเอกสารดิจิทัล — รวมค้นหาเนื้อหาภายในไฟล์ PDF",
    "searchPlaceholder": "ค้นหาชื่อเรื่อง ผู้แต่ง คีย์เวิร์ด...",
    "noResults": "ไม่พบงานวิจัยที่ตรงกับเงื่อนไข",
    "noResultsHint": "ลองเปลี่ยนคำค้นหาหรือลบตัวกรองบางรายการ",
    "totalResults": "{count} รายการ",
    "filterBy": "กรองโดย",
    "sortBy": "เรียงโดย",
    "sortNewest": "ใหม่ล่าสุด",
    "sortOldest": "เก่าที่สุด",
    "sortTitle": "ชื่อเรื่อง",
    "sortRelevance": "ความเกี่ยวข้อง",
    "allCategories": "ทุกหมวดหมู่",
    "allYears": "ทุกปี",
    "accessLevel": "ระดับการเข้าถึง",
    "allAccess": "ทุกระดับ"
  },
  "auth": {
    "loginTitle": "เข้าสู่ระบบ",
    "registerTitle": "สมัครสมาชิก",
    "email": "อีเมล",
    "password": "รหัสผ่าน",
    "forgotPassword": "ลืมรหัสผ่าน?",
    "noAccount": "ยังไม่มีบัญชี?",
    "hasAccount": "มีบัญชีอยู่แล้ว?",
    "loginHere": "เข้าสู่ระบบที่นี่",
    "registerHere": "สมัครสมาชิกที่นี่"
  },
  "errors": {
    "notFound": "ไม่พบหน้าที่ต้องการ",
    "forbidden": "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
    "serverError": "เกิดข้อผิดพลาดในระบบ กรุณาลองอีกครั้ง",
    "sessionExpired": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
  }
}
```

### `messages/en.json`

```json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "retry": "Try again",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "view": "View",
    "download": "Download",
    "search": "Search",
    "filter": "Filter",
    "clear": "Clear",
    "submit": "Submit",
    "confirm": "Confirm",
    "close": "Close",
    "back": "Back",
    "next": "Next",
    "previous": "Previous",
    "required": "Required",
    "optional": "Optional"
  },
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
    "skipToContent": "Skip to main content"
  },
  "nav": {
    "language": "Language",
    "languageLabel": "Select language",
    "th": "ไทย",
    "en": "English",
    "lo": "ລາວ"
  },
  "home": {
    "title": "Digital Research Repository",
    "subtitle": "Search and access research papers, theses, and academic documents",
    "searchPlaceholder": "Search research...",
    "searchButton": "Search",
    "browseAll": "Browse All",
    "featuredResearch": "Featured Research",
    "recentResearch": "Recent Research",
    "categories": "Categories",
    "viewAll": "View All"
  },
  "research": {
    "pageTitle": "Research Repository",
    "pageSubtitle": "Search and filter organizational research from the digital document repository — including full-text PDF search",
    "searchPlaceholder": "Search by title, author, keywords...",
    "noResults": "No research found matching your criteria",
    "noResultsHint": "Try changing your search terms or removing some filters",
    "totalResults": "{count} results",
    "filterBy": "Filter by",
    "sortBy": "Sort by",
    "sortNewest": "Newest first",
    "sortOldest": "Oldest first",
    "sortTitle": "Title",
    "sortRelevance": "Relevance",
    "allCategories": "All Categories",
    "allYears": "All Years",
    "accessLevel": "Access Level",
    "allAccess": "All Levels"
  },
  "auth": {
    "loginTitle": "Sign In",
    "registerTitle": "Create Account",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot password?",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "loginHere": "Sign in here",
    "registerHere": "Sign up here"
  },
  "errors": {
    "notFound": "Page not found",
    "forbidden": "You don't have permission to access this page",
    "serverError": "A server error occurred. Please try again.",
    "sessionExpired": "Your session has expired. Please sign in again."
  }
}
```

### `messages/lo.json`

ให้ copy เนื้อหาจาก `messages/th.json` ทั้งหมด (placeholder สำหรับแปลในภายหลัง)

---

## เกณฑ์ความสำเร็จ Phase 0A

Phase 0A ถือว่าสำเร็จเมื่อ:

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error (warning เดิมที่ไม่เกี่ยวข้องยังโอเค)
- [ ] `npm run test` → 127/127 (ไม่น้อยกว่าเดิม)
- [ ] `npm run test:a11y` → 50/50 (ไม่น้อยกว่าเดิม)
- [ ] `npm run build` → 0 error, build สำเร็จ
- [ ] `curl http://localhost:3000/th` → redirect หรือ 200 ถูกต้อง
- [ ] `curl http://localhost:3000/en` → 200 ถูกต้อง
- [ ] `curl http://localhost:3000/lo` → 200 ถูกต้อง
- [ ] `curl http://localhost:3000/` → redirect ไป `/th/` อัตโนมัติ
- [ ] `curl http://localhost:3000/api/health` → ผ่านปกติ (ไม่โดน locale redirect)
- [ ] `/th/dashboard`, `/th/superadmin` → auth guard ยังทำงานปกติ (redirect ไป login ถ้าไม่ได้ login)
- [ ] string ใน component ยังเป็นภาษาไทย hardcode เหมือนเดิมทั้งหมด (ยังไม่ได้แปล — Phase 0B)

---

## ข้อควรระวังพิเศษ

1. **middleware.ts คือจุดเสี่ยงสูงสุด** — อ่านไฟล์จริงให้ครบก่อน แล้วค่อย merge
   logic อย่าเขียนทับโดยไม่ดูของเดิม

2. **locale prefix ในการ redirect** — เมื่อ auth guard ต้องการ redirect ไป `/login`
   ต้องเปลี่ยนเป็น `/${locale}/login` เสมอ (ดึง locale จาก request URL)

3. **ห้ามรัน `npm run build` พร้อม `npm run dev`** — ล้าง `.next` ก่อน build เสมอ

4. **`app/not-found.tsx`** — ถ้าโปรเจกต์มี อย่าย้ายเข้า `[locale]` ให้อยู่ที่ root

5. **Server Action paths** — action ที่ใช้ `redirect()` จาก `next/navigation`
   ต้อง update path ให้มี locale prefix ด้วย เช่น `redirect(\`/\${locale}/login\`)`
   ตรวจด้วย `grep -r "redirect(" app/ --include="*.ts"` หลังย้ายไฟล์

6. **`auth/callback/route.ts`** — มักมี hardcode redirect URL ตรวจและแก้ด้วย

7. **ถ้า test จำนวนลดลง** — หยุดและ report ทันที ห้าม merge จนกว่า test จะกลับมาผ่านครบ
