# i18n Phase 1 — Protected Pages (Dashboard + Account)
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม

- Phase 0A + 0B + 0C + Cleanup เสร็จแล้วครบ
- `npm run lint` → 0 error
- `npm run test` → 127/127
- `npm run test:a11y` → 50/50
- `npm run build` → 0 error
- `i18n/navigation.ts` มี Link, useRouter, usePathname, redirect
- Public pages แปลครบ, navigation locale-aware ทั้งระบบ

ถ้า checks ยังไม่ผ่านครบ → หยุดและแจ้งทันที

---

## โครงสร้างที่พบจาก inspect จริง

### files ที่จะแก้ใน Phase 1

```
lib/auth/workspace-links.ts       — 6 labels hardcode ไทย (plain .ts ไม่ใช่ component)
app/[locale]/dashboard/layout.tsx — redirect จาก next/navigation
app/[locale]/dashboard/page.tsx   — Server Component, strings hardcode, Link next/link
components/dashboard/DashboardSidebar.tsx — Client Component, NAV_ITEMS hardcode ไทย 13 items
app/[locale]/account/page.tsx     — Server Component, strings hardcode, redirect, Link
components/account/AccountShell.tsx — Client Component, NAV_ITEMS hardcode ไทย 4 items
```

### files ที่ยังไม่แตะ (defer)

```
lib/labels.ts                     — roleLabels, statusLabels ฯลฯ ใช้ร่วมกับ superadmin
                                    แปลพร้อม Phase 2 (superadmin) ดีกว่า
app/[locale]/dashboard/approvals/ — sub-pages ทั้งหมด Phase 2+
app/[locale]/dashboard/users/     — Phase 2+
app/[locale]/dashboard/categories/ — Phase 2+
(ทุก dashboard sub-page อื่นๆ)
app/[locale]/superadmin/          — Phase 2
```

---

## งานที่ต้องทำ: Phase 1

### ขอบเขต
1. `messages/*.json` — เพิ่ม keys ใหม่
2. `lib/auth/workspace-links.ts` — เปลี่ยน label hardcode เป็น translation keys
3. `app/[locale]/dashboard/layout.tsx` — เปลี่ยน redirect
4. `app/[locale]/dashboard/page.tsx` — แปล strings + Link
5. `components/dashboard/DashboardSidebar.tsx` — แปล NAV_ITEMS + Link + usePathname
6. `app/[locale]/account/page.tsx` — แปล strings + redirect + Link
7. `components/account/AccountShell.tsx` — แปล NAV_ITEMS + Link + usePathname

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect ก่อนทุกครั้ง

```bash
cat lib/auth/workspace-links.ts
cat app/\[locale\]/dashboard/layout.tsx
cat app/\[locale\]/dashboard/page.tsx
cat components/dashboard/DashboardSidebar.tsx
cat app/\[locale\]/account/page.tsx
cat components/account/AccountShell.tsx
cat messages/th.json
```

### ขั้น 1 — อัปเดต messages (3 ไฟล์)

เพิ่ม keys ต่อไปนี้ใน `messages/th.json` (additive — ห้ามลบ key เดิม):

**namespace `"workspace"` (มีอยู่แล้ว — เพิ่มที่ขาด):**
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

**namespace `"dashboard"` ใหม่:**
```json
{
  "dashboard": {
    "pageTitle": "แดชบอร์ด",
    "pageSubtitle": "ภาพรวมระบบห้องสมุดดิจิทัล",
    "heading": "แดชบอร์ด",
    "mobileNavLabel": "เมนูแดชบอร์ด (มือถือ)",
    "desktopNavLabel": "เมนูแดชบอร์ด",
    "actionRequired": "ต้องดำเนินการ",
    "referenceData": "ข้อมูลอ้างอิง",
    "pendingReview": "งานวิจัยรอตรวจสอบ — กดเพื่อไปหน้าอนุมัติ",
    "totalMembers": "จำนวนสมาชิกทั้งหมด",
    "totalResearch": "งานวิจัยทั้งหมด",
    "totalViews": "ยอดเข้าชมสะสม",
    "totalDownloads": "ยอดดาวน์โหลดสะสม",
    "dateRangeStats": "สถิติตามช่วงวันที่",
    "dateFrom": "จากวันที่",
    "dateTo": "ถึงวันที่",
    "dateToLabel": "ถึง",
    "viewData": "ดูข้อมูล",
    "readsInRange": "อ่านออนไลน์ในช่วงนี้",
    "downloadsInRange": "ดาวน์โหลดในช่วงนี้",
    "newMembersInRange": "สมาชิกใหม่ในช่วงนี้",
    "popularResearch": "งานวิจัยยอดนิยม",
    "noData": "ยังไม่มีข้อมูล",
    "colTitle": "ชื่อเรื่อง",
    "colViews": "เข้าชม",
    "colDownloads": "ดาวน์โหลด",
    "nav": {
      "overview": "ภาพรวม",
      "approvals": "อนุมัติงานวิจัย",
      "accessRequests": "คำขอเข้าถึงเอกสาร",
      "research": "จัดการงานวิจัย",
      "duplicateReviews": "ตรวจสอบงานวิจัยซ้ำ",
      "authors": "ผู้วิจัย",
      "organizations": "หน่วยงาน",
      "dataQuality": "คุณภาพข้อมูล",
      "categories": "หมวดหมู่",
      "reports": "รายงาน",
      "users": "ผู้ใช้งาน",
      "auditLog": "Audit Log",
      "settings": "ตั้งค่า"
    }
  }
}
```

**namespace `"account"` ใหม่:**
```json
{
  "account": {
    "pageTitle": "โปรไฟล์ของฉัน",
    "pageDescription": "จัดการข้อมูลโปรไฟล์และบัญชีผู้ใช้ของคุณ",
    "heading": "โปรไฟล์ของฉัน",
    "subtitle": "จัดการข้อมูลส่วนตัวและดูสิทธิ์การใช้งานของบัญชีคุณ",
    "noName": "ไม่ระบุชื่อ",
    "quickLinks": "ลิงก์ด่วน",
    "myAccessRequests": "คำขอเข้าถึงเอกสารของฉัน",
    "notificationSettings": "ตั้งค่าการแจ้งเตือน",
    "editProfile": "แก้ไขข้อมูลโปรไฟล์",
    "editProfileNote": "ข้อมูลนี้จะแสดงต่อเจ้าหน้าที่เมื่อคุณส่งงานวิจัยหรือคำขอเข้าถึงเอกสาร",
    "mfaSection": "ความปลอดภัยบัญชี — ยืนยันตัวตนสองขั้นตอน (MFA)",
    "mfaNote": "เพิ่มการยืนยันตัวตนขั้นที่สองด้วยแอปยืนยันตัวตน (TOTP) เพื่อความปลอดภัยของบัญชี",
    "orcidSection": "ORCID",
    "orcidNote": "เชื่อมโยงรหัส ORCID ของคุณเพื่อยืนยันตัวตนนักวิจัย",
    "nav": {
      "favorites": "รายการโปรด",
      "readingHistory": "ประวัติการอ่าน",
      "profile": "โปรไฟล์ของฉัน",
      "notifications": "การแจ้งเตือน"
    },
    "navLabel": "เมนูบัญชีของฉัน"
  }
}
```

**`messages/en.json`** — เพิ่ม keys เดียวกัน แปลเป็นอังกฤษ:
```json
{
  "dashboard": {
    "pageTitle": "Dashboard",
    "pageSubtitle": "Digital library system overview",
    "heading": "Dashboard",
    "mobileNavLabel": "Dashboard menu (mobile)",
    "desktopNavLabel": "Dashboard menu",
    "actionRequired": "Action Required",
    "referenceData": "Reference Data",
    "pendingReview": "Research pending review — click to go to approvals",
    "totalMembers": "Total Members",
    "totalResearch": "Total Research",
    "totalViews": "Total Views",
    "totalDownloads": "Total Downloads",
    "dateRangeStats": "Statistics by Date Range",
    "dateFrom": "From date",
    "dateTo": "To date",
    "dateToLabel": "to",
    "viewData": "View Data",
    "readsInRange": "Online reads in period",
    "downloadsInRange": "Downloads in period",
    "newMembersInRange": "New members in period",
    "popularResearch": "Popular Research",
    "noData": "No data yet",
    "colTitle": "Title",
    "colViews": "Views",
    "colDownloads": "Downloads",
    "nav": {
      "overview": "Overview",
      "approvals": "Research Approvals",
      "accessRequests": "Access Requests",
      "research": "Manage Research",
      "duplicateReviews": "Duplicate Review",
      "authors": "Authors",
      "organizations": "Organizations",
      "dataQuality": "Data Quality",
      "categories": "Categories",
      "reports": "Reports",
      "users": "Users",
      "auditLog": "Audit Log",
      "settings": "Settings"
    }
  },
  "account": {
    "pageTitle": "My Profile",
    "pageDescription": "Manage your profile and account settings",
    "heading": "My Profile",
    "subtitle": "Manage your personal information and view your account permissions",
    "noName": "No name provided",
    "quickLinks": "Quick Links",
    "myAccessRequests": "My Access Requests",
    "notificationSettings": "Notification Settings",
    "editProfile": "Edit Profile",
    "editProfileNote": "This information will be shown to staff when you submit research or request document access",
    "mfaSection": "Account Security — Two-Factor Authentication (MFA)",
    "mfaNote": "Add a second layer of authentication using an authenticator app (TOTP) to secure your account",
    "orcidSection": "ORCID",
    "orcidNote": "Link your ORCID ID to verify your researcher identity",
    "nav": {
      "favorites": "Favorites",
      "readingHistory": "Reading History",
      "profile": "My Profile",
      "notifications": "Notifications"
    },
    "navLabel": "My account menu"
  }
}
```

**`messages/lo.json`** — copy จาก th.json (placeholder)

### ขั้น 2 — lib/auth/workspace-links.ts

**ปัญหา:** ไฟล์นี้เป็น plain `.ts` — ใช้ `useTranslations`/`getTranslations` ไม่ได้
**วิธีแก้:** เปลี่ยน `label` hardcode เป็น translation key string แทน
แล้วให้ `HeaderAccountArea.tsx` (Server Component) แปล label ก่อนส่งลง component

**แก้ไข `lib/auth/workspace-links.ts`:**
```ts
// เปลี่ยน WorkspaceLink interface — label เป็น key แทน string แปลแล้ว
export interface WorkspaceLink {
  href: string;
  labelKey: string;   // เปลี่ยนจาก label: string
  iconKey: WorkspaceIconKey;
}

export function buildWorkspaceLinks(user: SessionUser | null): WorkspaceLink[] {
  return [
    ...(user ? [
      { href: "/favorites", labelKey: "workspace.favorites", iconKey: "favorites" as const },
      { href: "/access-requests", labelKey: "workspace.accessRequests", iconKey: "accessRequests" as const },
    ] : []),
    ...(isStaffOrAbove ? [
      { href: "/submit-research", labelKey: "workspace.submitResearch", iconKey: "submitResearch" as const },
      { href: "/my-submissions", labelKey: "workspace.mySubmissions", iconKey: "mySubmissions" as const },
    ] : []),
    ...(isLibrarianOrAbove ? [
      { href: "/dashboard", labelKey: "workspace.dashboard", iconKey: "dashboard" as const },
    ] : []),
    ...(isSuperAdmin ? [
      { href: "/superadmin/overview", labelKey: "workspace.superAdmin", iconKey: "superAdmin" as const },
    ] : []),
  ];
}
```

**แก้ไข `components/layout/HeaderAccountArea.tsx`** — แปล labelKey เป็น label:
```tsx
import { getTranslations } from 'next-intl/server';

export default async function HeaderAccountArea({ variant }) {
  const { user, workspaceLinks, ... } = await loadAccountData();
  const t = await getTranslations();  // root translator — รองรับ namespace ต่างๆ

  // แปล labelKey → label ก่อนส่งลง component
  const translatedLinks = workspaceLinks.map(link => ({
    ...link,
    label: t(link.labelKey),  // เช่น t('workspace.favorites') → "รายการโปรด" หรือ "Favorites"
  }));

  // ส่ง translatedLinks แทน workspaceLinks
  return user ? (
    <>
      <NotificationBell ... />
      <UserMenu user={user} workspaceLinks={translatedLinks} />
    </>
  ) : ...
}
```

**หมายเหตุสำคัญ:**
- `UserMenu.tsx` รับ `workspaceLinks: WorkspaceLink[]` — type อาจต้องอัปเดตถ้า interface เปลี่ยน
- ตรวจสอบว่า `WorkspaceLink` interface ที่ `UserMenu.tsx` import มาตรงกับที่แก้
- unit test `lib/auth/workspace-links.test.ts` อาจต้องอัปเดต assertion ถ้ามี

### ขั้น 3 — app/[locale]/dashboard/layout.tsx

```tsx
import { redirect } from '@/i18n/navigation';  // เปลี่ยนจาก next/navigation

export default async function DashboardLayout({ children }) {
  // ...
  if (!user) redirect('/login?redirect=/dashboard');
  if (rank < 30) redirect('/403');
  // ...
}
```

### ขั้น 4 — app/[locale]/dashboard/page.tsx

Server Component — ใช้ `getTranslations`:

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
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('pageTitle') };
}

export default async function DashboardOverviewPage({ searchParams }) {
  const t = await getTranslations('dashboard');
  // ...

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 ...>{t('heading')}</h1>
        <p ...>{t('pageSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 ...>{t('actionRequired')}</h2>
        <StatCard
          label={t('pendingReview')}
          value={stats.pendingReview}
          tone="action"
          href="/dashboard/approvals"
          ...
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 ...>{t('referenceData')}</h2>
        <div className="grid ...">
          <StatCard label={t('totalMembers')} value={stats.memberCount} ... />
          <StatCard label={t('totalResearch')} value={stats.totalResearch} ... />
          <StatCard label={t('totalViews')} value={stats.totalViews} ... />
          <StatCard label={t('totalDownloads')} value={stats.totalDownloads} ... />
        </div>

        <Panel title={t('dateRangeStats')} action={
          <form ...>
            <input aria-label={t('dateFrom')} ... />
            <span>{t('dateToLabel')}</span>
            <input aria-label={t('dateTo')} ... />
            <button type="submit">{t('viewData')}</button>
          </form>
        }>
          <StatCard label={t('readsInRange')} ... />
          <StatCard label={t('downloadsInRange')} ... />
          <StatCard label={t('newMembersInRange')} ... />
        </Panel>

        <Panel title={t('popularResearch')}>
          {stats.popularResearch.length === 0 ? (
            <EmptyState title={t('noData')} compact />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('colTitle')}</th>
                  <th>{t('colViews')}</th>
                  <th>{t('colDownloads')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.popularResearch.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/research/${r.id}`} ...>
                        {r.titleTh}  {/* DB content — ไม่แปล */}
                      </Link>
                    </td>
                    <td>{r.views.toLocaleString("th-TH")}</td>
                    <td>{r.downloads.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
```

**หมายเหตุ:** `r.titleTh`, `r.views`, `r.downloads` มาจาก database — ไม่แปล

### ขั้น 5 — components/dashboard/DashboardSidebar.tsx

Client Component — ใช้ `useTranslations`:

```tsx
'use client';

import { Link, usePathname } from '@/i18n/navigation';  // เปลี่ยน import ทั้งคู่
import { useTranslations } from 'next-intl';
// ... icon imports เหมือนเดิม

interface NavItem {
  href: string;
  labelKey: string;   // เปลี่ยนจาก label: string
  icon: typeof LayoutDashboard;
  minRank: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard, minRank: 30 },
  { href: "/dashboard/approvals", labelKey: "nav.approvals", icon: ClipboardCheck, minRank: 30 },
  { href: "/dashboard/access-requests", labelKey: "nav.accessRequests", icon: FileQuestion, minRank: 30 },
  { href: "/dashboard/research", labelKey: "nav.research", icon: FileText, minRank: 30 },
  { href: "/dashboard/duplicate-reviews", labelKey: "nav.duplicateReviews", icon: Copy, minRank: 30 },
  { href: "/dashboard/authors", labelKey: "nav.authors", icon: Contact, minRank: 30 },
  { href: "/dashboard/organizations", labelKey: "nav.organizations", icon: Building2, minRank: 30 },
  { href: "/dashboard/data-quality", labelKey: "nav.dataQuality", icon: ShieldCheck, minRank: 30 },
  { href: "/dashboard/categories", labelKey: "nav.categories", icon: FolderTree, minRank: 30 },
  { href: "/dashboard/reports", labelKey: "nav.reports", icon: BarChart3, minRank: 30 },
  { href: "/dashboard/users", labelKey: "nav.users", icon: Users, minRank: 40 },
  { href: "/dashboard/audit-logs", labelKey: "nav.auditLog", icon: ScrollText, minRank: 40 },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: Settings, minRank: 40 },
];

export default function DashboardSidebar({ rank }: { rank: number }) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();  // ตอนนี้มาจาก @/i18n/navigation — คืน path ไม่มี locale prefix
  const items = NAV_ITEMS.filter((item) => rank >= item.minRank);

  function isActive(href: string) {
    // usePathname จาก next-intl คืน path ที่ตัด locale ออกแล้ว
    // เช่น /th/dashboard → /dashboard ดังนั้น logic เดิมยังใช้ได้
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  return (
    <>
      <nav aria-label={t('mobileNavLabel')} className="...">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={...}>
              <Icon className="h-3.5 w-3.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <aside className="...">
        <nav aria-label={t('desktopNavLabel')} className="...">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={...}>
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
```

### ขั้น 6 — app/[locale]/account/page.tsx

```tsx
import { redirect } from '@/i18n/navigation';   // เปลี่ยน redirect
import { Link } from '@/i18n/navigation';         // เปลี่ยน Link
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('pageTitle'), description: t('pageDescription') };
}

export default async function AccountPage({ searchParams }) {
  if (!isSupabaseConfigured()) redirect('/login');

  // ... supabase queries เหมือนเดิม ...

  if (!user) redirect('/login?redirect=/account');

  const t = await getTranslations('account');

  return (
    <AccountShell>
      <h1 ...>{t('heading')}</h1>
      <p ...>{t('subtitle')}</p>

      <div ...>
        <div ...>
          {/* Profile card */}
          <div ...>
            ...
            <p ...>{profile?.full_name || t('noName')}</p>
            ...
            <Badge tone="brand">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabels[role]}  {/* ยังใช้ roleLabels จาก lib/labels.ts — แปลใน Phase 2 */}
            </Badge>
            <LogoutButton ... />
          </div>

          {/* Quick links */}
          <div ...>
            <p ...>{t('quickLinks')}</p>
            <Link href="/access-requests" ...>
              <FileQuestion className="h-4 w-4 text-gray-500" />
              {t('myAccessRequests')}
            </Link>
            <Link href="/profile/notification-settings" ...>
              <Bell className="h-4 w-4 text-gray-500" />
              {t('notificationSettings')}
            </Link>
          </div>
        </div>

        <div ...>
          {/* Edit profile section */}
          <div ...>
            <h2 ...>{t('editProfile')}</h2>
            <p ...>{t('editProfileNote')}</p>
            <ProfileForm ... />
          </div>

          {/* MFA section */}
          <div ...>
            <h2 ...>{t('mfaSection')}</h2>
            <p ...>{t('mfaNote')}</p>
            <MfaSettings ... />
          </div>

          {/* ORCID section */}
          <div ...>
            <h2 ...>{t('orcidSection')}</h2>
            <p ...>{t('orcidNote')}</p>
            <OrcidConnect ... />
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
```

**หมายเหตุ:** `roleLabels[role]` ยังคง hardcode ไทย — defer ถึง Phase 2 พร้อม lib/labels.ts ทั้งหมด

### ขั้น 7 — components/account/AccountShell.tsx

Client Component:

```tsx
'use client';

import { Link, usePathname } from '@/i18n/navigation';  // เปลี่ยน import
import { useTranslations } from 'next-intl';
// ... icon imports เหมือนเดิม

interface AccountNavItem {
  href: string;
  labelKey: string;   // เปลี่ยนจาก label: string
  icon: LucideIcon;
}

const NAV_ITEMS: AccountNavItem[] = [
  { href: "/favorites", labelKey: "nav.favorites", icon: Heart },
  { href: "/reading-history", labelKey: "nav.readingHistory", icon: Clock },
  { href: "/account", labelKey: "nav.profile", icon: UserCircle },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell },
];

export default function AccountShell({ children }) {
  const t = useTranslations('account');
  const pathname = usePathname();  // จาก @/i18n/navigation — ตัด locale ออกแล้ว

  return (
    <div ...>
      <Container>
        <div ...>
          <nav aria-label={t('navLabel')} ...>
            {/* mobile tabs */}
            <ul ...>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? "page" : undefined} ...>
                      <Icon className="h-4 w-4" />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* desktop sidebar */}
            <ul ...>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? "page" : undefined} ...>
                      <Icon className="h-4 w-4" />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </Container>
    </div>
  );
}
```

### ขั้น 8 — ตรวจสอบ WorkspaceLink type consistency

หลังแก้ `workspace-links.ts` ให้ตรวจ:

```bash
# ตรวจว่า WorkspaceLink type ใช้ที่ไหนบ้าง
grep -rn "WorkspaceLink\|workspaceLinks\|labelKey\|\.label" \
  components/layout/UserMenu.tsx \
  components/layout/HeaderAccountArea.tsx \
  lib/auth/workspace-links.ts
```

- `UserMenu.tsx` import `WorkspaceLink` จาก `workspace-links.ts` → type ต้องตรงกัน
- ถ้า `label` field หายไป → `UserMenu.tsx` ที่ render `{link.label}` จะ TypeScript error
- แก้โดย HeaderAccountArea แปล labelKey → label ก่อนส่งลง UserMenu (ดูขั้น 2)

### ขั้น 9 — ตรวจ unit test

```bash
cat lib/auth/workspace-links.test.ts
```

ถ้า test เช็ค `label` field → อัปเดตให้เช็ค `labelKey` แทน
ถ้า test เช็ค `labelKey` value → ตรวจว่าตรงกับ key ใหม่

### ขั้น 10 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Manual smoke test:**
```bash
npm run dev

# Dashboard
# /th/dashboard → heading/nav ภาษาไทย
# /en/dashboard → heading/nav ภาษาอังกฤษ
# sidebar nav active state ถูก locale
# สลับภาษาที่ /th/dashboard → /en/dashboard (ยังอยู่หน้าเดิม)

# Account
# /th/account → heading/nav ภาษาไทย
# /en/account → heading/nav ภาษาอังกฤษ
# nav tabs active state ถูก

# Workspace links (UserMenu dropdown)
# /th/ → login → คลิก user menu → links ภาษาไทย (/th/favorites ฯลฯ)
# /en/ → login → คลิก user menu → links ภาษาอังกฤษ (/en/favorites ฯลฯ)
```

---

## เกณฑ์ความสำเร็จ Phase 1

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] `/th/dashboard` → Thai, `/en/dashboard` → English
- [ ] DashboardSidebar nav labels ถูก locale ทั้ง mobile/desktop
- [ ] `/th/account` → Thai, `/en/account` → English
- [ ] AccountShell nav tabs ถูก locale
- [ ] UserMenu dropdown workspace links ถูก locale (label + href)
- [ ] generateMetadata title ถูก locale (ตรวจ browser tab)
- [ ] redirect ใน dashboard layout และ account ทำงานปกติ
- [ ] `roleLabels[role]` ยังแสดงอยู่ (ไม่ต้องแปล — Phase 2)

---

## ข้อห้าม

- ห้ามแตะ `lib/labels.ts` — Phase 2
- ห้ามแตะ dashboard sub-pages (approvals, users, categories ฯลฯ) — Phase 2
- ห้ามแตะ superadmin pages — Phase 2
- ห้ามแตะ `middleware.ts`, `lib/supabase/`
- ห้ามแปล dynamic content จาก database (titleTh, ชื่อผู้วิจัย ฯลฯ)
- ถ้า test จำนวนลดลง → หยุดทันที

---

## ความเสี่ยงที่ต้องระวัง

1. **WorkspaceLink type เปลี่ยน** — `label` → `labelKey` กระทบ `UserMenu.tsx` และ
   `HeaderAccountArea.tsx` ต้องแก้พร้อมกันให้ครบ ตรวจ TypeScript ให้ผ่านก่อน

2. **workspace-links.test.ts** — unit test อาจ assert `label` field
   ตรวจและอัปเดตก่อน `npm run test`

3. **`usePathname` จาก next-intl** — คืน path ไม่มี locale prefix
   (`/dashboard` ไม่ใช่ `/th/dashboard`) — `isActive()` logic เดิมใช้ได้โดยไม่ต้องแก้

4. **`redirect` จาก next-intl** — เพิ่ม locale prefix อัตโนมัติ
   `redirect('/login')` → `/th/login` ตาม locale ปัจจุบัน

5. **`roleLabels[role]` ยังเป็นไทย** — ยอมรับได้ใน Phase 1
   ผู้ใช้ที่เลือก /en/ จะเห็น role badge เป็นไทย — แก้ใน Phase 2

6. **Port 3001 ค้าง** — ก่อน test:a11y:
   PowerShell: `Stop-Process -Id $(Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force`
