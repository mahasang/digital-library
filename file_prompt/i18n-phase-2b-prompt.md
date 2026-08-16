# i18n Phase 2B — Dashboard + Superadmin Sub-pages
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม (Phase 2A เสร็จแล้ว)

- `npm run lint` → 0 error
- `npm run test` → 127/127
- `npm run test:a11y` → 50/50
- `npm run build` → 0 error
- `lib/labels.ts` — Record exports มี `@deprecated` JSDoc แต่ยังอยู่ครบ
- `i18n/navigation.ts` มี Link, useRouter, usePathname, redirect

ถ้า checks ยังไม่ผ่านครบ → หยุดและแจ้งทันที

---

## วัตถุประสงค์ Phase 2B

1. แปล dashboard sub-pages ทุกหน้า (12 หน้า)
2. แปล superadmin sub-pages ทุกหน้า (18 หน้า)
3. ลบ deprecated Record exports จาก `lib/labels.ts` หลังแปลครบ
4. แปล `getBackupStatus()` copy ใน `lib/data/superadmin-stats.server.ts`

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Survey ก่อนเริ่ม

```bash
# อ่านทุก page.tsx ใน dashboard sub-pages
for f in app/\[locale\]/dashboard/*/page.tsx; do echo "=== $f ==="; cat "$f"; done

# อ่านทุก page.tsx ใน superadmin sub-pages
for f in app/\[locale\]/superadmin/*/page.tsx; do echo "=== $f ==="; cat "$f"; done

# ตรวจ call sites ของ deprecated labels ที่เหลือ
grep -rn "roleLabels\|statusLabels\|accessLevelLabels\|accessLevelDescriptions\|scanStatusLabels\|extractionStatusLabels\|ocrStatusLabels\|accessRequestTypeLabels\|accessRequestStatusLabels\|auditActionLabels" \
  app/ components/ --include="*.tsx" --include="*.ts" | grep -v "lib/labels.ts"

# ตรวจ getBackupStatus
cat lib/data/superadmin-stats.server.ts | grep -A 20 "getBackupStatus"
```

จด string hardcode และ label imports ที่พบในแต่ละหน้า ก่อนเขียนโค้ดใดๆ

### ขั้น 1 — อัปเดต messages

**กฎ:** เพิ่ม keys เท่าที่พบจริงจาก survey เท่านั้น — อย่าเพิ่ม keys ที่ไม่ได้ใช้

Pattern สำหรับ dashboard sub-pages (เพิ่มใน namespace `"dashboard"`):
```json
{
  "dashboard": {
    "approvals": {
      "pageTitle": "อนุมัติงานวิจัย",
      "pageDescription": "ตรวจสอบและอนุมัติงานวิจัยที่รอการพิจารณา",
      "heading": "อนุมัติงานวิจัย",
      "subtitle": "ตรวจสอบงานวิจัยที่ส่งเข้ามา อนุมัติ ขอแก้ไข หรือปฏิเสธ พร้อมเผยแพร่งานที่อนุมัติแล้ว",
      "sectionPending": "รอตรวจสอบ",
      "sectionPendingDesc": "งานวิจัยที่ส่งเข้ามาใหม่ รอการตรวจสอบครั้งแรก",
      "sectionRevision": "ขอให้แก้ไข (รอผู้ส่งแก้ไขและส่งกลับ)",
      "sectionRevisionDesc": "งานวิจัยที่เคยตรวจสอบแล้วและขอให้ผู้ส่งแก้ไข",
      "sectionApproved": "อนุมัติแล้ว (รอเผยแพร่)",
      "sectionApprovedDesc": "งานวิจัยที่ผ่านการตรวจสอบแล้ว รอดำเนินการเผยแพร่",
      "emptySection": "ไม่มีรายการในหมวดนี้",
      "noResearcher": "ไม่ระบุผู้วิจัย"
    }
  }
}
```

**สำหรับ en.json:**
```json
{
  "dashboard": {
    "approvals": {
      "pageTitle": "Research Approvals",
      "pageDescription": "Review and approve pending research submissions",
      "heading": "Research Approvals",
      "subtitle": "Review submitted research, approve, request revisions, or reject, then publish approved works",
      "sectionPending": "Pending Review",
      "sectionPendingDesc": "Newly submitted research awaiting first review",
      "sectionRevision": "Revision Requested (awaiting resubmission)",
      "sectionRevisionDesc": "Research previously reviewed and sent back for revisions",
      "sectionApproved": "Approved (pending publication)",
      "sectionApprovedDesc": "Research that has passed review and is ready for publication",
      "emptySection": "No items in this section",
      "noResearcher": "No researcher specified"
    }
  }
}
```

**ทำแบบเดียวกันสำหรับทุก sub-page** โดยใช้ pattern:
- namespace: `dashboard.{subpage}.*` สำหรับ dashboard
- namespace: `superadmin.{subpage}.*` สำหรับ superadmin
- เพิ่มเฉพาะ keys ที่พบจาก survey จริงเท่านั้น

### ขั้น 2 — แปล dashboard sub-pages (ทีละหน้า)

**หน้าที่ต้องแปล:**
```
dashboard/approvals/page.tsx       — ApprovalSection component ในไฟล์เดียวกัน
dashboard/access-requests/page.tsx
dashboard/audit-logs/page.tsx
dashboard/authors/page.tsx
dashboard/categories/page.tsx
dashboard/data-quality/page.tsx
dashboard/duplicate-reviews/page.tsx
dashboard/organizations/page.tsx
dashboard/reports/page.tsx
dashboard/research/page.tsx
dashboard/settings/page.tsx
dashboard/users/page.tsx
```

**Pattern สำหรับทุกหน้า:**

```tsx
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return {
    title: t('approvals.pageTitle'),
    description: t('approvals.pageDescription'),
  };
}

export default async function SomePage() {
  // redirect → @/i18n/navigation (ใช้ return redirect(...) เสมอ)
  if (!user) return redirect('/login?redirect=/dashboard/approvals');
  if (rank < 30) return redirect('/403');

  const t = await getTranslations('dashboard');

  return (
    <div>
      <h1>{t('approvals.heading')}</h1>
      <p>{t('approvals.subtitle')}</p>
      ...
    </div>
  );
}
```

**สำหรับ roleLabels/statusLabels ที่ใช้อยู่:**
```tsx
// เดิม
import { roleLabels } from "@/lib/labels";
{roleLabels[r]}

// ใหม่
import { useTranslations } from 'next-intl'; // Client Component
// หรือ
import { getTranslations } from 'next-intl/server'; // Server Component
const tRoles = await getTranslations('roles');
{tRoles(r)}
```

**ข้อควรระวัง:**
- ถ้า label ถูกใช้ใน Client Component → `useTranslations`
- ถ้าถูกใช้ใน Server Component → `getTranslations`
- ถ้าอยู่ใน prop ที่ส่งจาก Server → Client → แปลที่ Server แล้วส่ง string ลงไป

**ข้อมูลจาก DB ห้ามแปล:**
- `item.titleTh`, `item.titleEn` — ชื่องานวิจัย
- `u.fullName`, `u.email`, `u.organizationName` — ข้อมูลผู้ใช้
- `category.nameTh`, `category.nameEn` — ชื่อหมวดหมู่
- `r.name` — ชื่อผู้วิจัย

**ข้อมูลที่ต้องแปล:**
- heading, subtitle, metadata title/description
- column headers ในตาราง
- empty state messages
- filter/sort labels
- button text
- status labels ที่ map จาก enum (ใช้ translation keys แทน)

### ขั้น 3 — แปล superadmin sub-pages (ทีละหน้า)

**หน้าที่ต้องแปล:**
```
superadmin/users/page.tsx
superadmin/categories/page.tsx
superadmin/organizations/page.tsx
superadmin/system-settings/page.tsx
superadmin/security/page.tsx
superadmin/notifications/page.tsx
superadmin/ocr/page.tsx
superadmin/pdf-processing/page.tsx
superadmin/file-security/page.tsx
superadmin/data-quality/page.tsx
superadmin/jobs/page.tsx
superadmin/cron-monitoring/page.tsx
superadmin/storage/page.tsx
superadmin/audit-logs/page.tsx
superadmin/system-logs/page.tsx
superadmin/system-health/page.tsx
superadmin/backups/page.tsx
superadmin/roles/page.tsx
superadmin/mfa-status/page.tsx
```

**Pattern เดียวกับ dashboard** แต่ใช้ namespace `superadmin.{subpage}.*`

**roleLabels ใน superadmin/users/page.tsx:**
```tsx
// เดิม
import { roleLabels } from "@/lib/labels";
{roleLabels[r]}     // ใน role badge
{roleLabels[r]}     // ใน select option

// ใหม่ (Server Component)
const tRoles = await getTranslations('roles');
{tRoles(r)}
```

### ขั้น 4 — แปล sub-page [id] routes (ถ้ามี)

ตรวจสอบ:
```bash
ls app/\[locale\]/dashboard/approvals/
ls app/\[locale\]/dashboard/research/
ls app/\[locale\]/superadmin/users/
```

ถ้ามี `[id]/page.tsx` → แปลด้วย pattern เดียวกัน
ถ้ามี `[id]/edit/page.tsx` → แปลด้วย

### ขั้น 5 — แปล getBackupStatus() ใน superadmin-stats.server.ts

```bash
cat lib/data/superadmin-stats.server.ts
```

`reason` และ `guidance` text ใน `getBackupStatus()` เป็น UI copy ที่ควรแปล
แต่ function นี้เป็น `.ts` ไม่ใช่ component — ใช้ pattern เดียวกับ `workspace-links.ts`:

**ตัวเลือก A:** เปลี่ยน return type ให้คืน key แทน string แล้วแปลที่ call site
```ts
// เดิม
return { reason: "Supabase ยังไม่รองรับ...", guidance: "ดูข้อมูล..." }

// ใหม่
return { reasonKey: "backupUnavailableReason", guidanceKey: "backupUnavailableGuidance" }
```

**ตัวเลือก B:** คง string ไทยไว้ถ้าเป็น hardcoded static text ที่ไม่เปลี่ยน (defer Phase 3)

ประเมินหลัง inspect จริงแล้วเลือก option ที่เหมาะสม

### ขั้น 6 — ลบ deprecated labels จาก lib/labels.ts

**ทำหลังขั้น 2–4 เสร็จและ tsc ผ่านแล้วเท่านั้น**

```bash
# ตรวจว่ายังมี call sites เหลืออยู่หรือไม่
grep -rn "roleLabels\|statusLabels\|accessLevelLabels\|accessLevelDescriptions\|scanStatusLabels\|extractionStatusLabels\|ocrStatusLabels\|accessRequestTypeLabels\|accessRequestStatusLabels\|auditActionLabels" \
  app/ components/ --include="*.tsx" --include="*.ts" | grep -v "lib/labels.ts"
```

ถ้าผลว่างเปล่า → ลบ deprecated Record exports ออกได้
ถ้ายังมีเหลือ → แปลไฟล์นั้นก่อนแล้วค่อยลบ

**คงไว้:**
- `canDownload()`, `canReadOnline()` — helper functions ยังใช้อยู่
- import statements จาก types — ไม่แตะ

### ขั้น 7 — ตรวจ components ที่ใช้ labels

sub-pages บาง page delegate การแสดงผลให้ components:
- `UserManager`, `CategoryManager`, `SettingsForm` ฯลฯ
- components เหล่านี้อาจมี `roleLabels`/`statusLabels` hardcode อยู่ภายใน
- ตรวจด้วย grep และแปลถ้าพบ

```bash
grep -rn "roleLabels\|statusLabels\|accessLevelLabels" \
  components/dashboard/ components/superadmin/ --include="*.tsx"
```

### ขั้น 8 — รัน checks หลังแปลครบ

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Checkpoint ระหว่างทาง:**
รัน `npx tsc --noEmit` หลังแปลทุก 3-4 หน้า อย่ารอจนแปลหมดแล้วค่อยตรวจ

---

## กฎสำคัญ

1. **ใช้ `return redirect(...)` เสมอ** (บทเรียน Phase 1)
2. **ห้ามลบ deprecated labels ก่อน tsc ผ่าน** — ลบทีหลังหลังแปลครบแล้ว
3. **ห้ามแปล dynamic content จาก DB** — titleTh, fullName, email, nameTh ฯลฯ
4. **ถ้า label ใช้ใน Client Component** → pass translation string จาก Server ลงมา หรือให้ Client Component เรียก `useTranslations` เอง
5. **ถ้า test จำนวนลดลง** → หยุดทันที
6. **ถ้า tsc มี error เพิ่มขึ้น** → แสดงว่าลบ labels เร็วเกินไป หรือแปล type ผิด — หยุดและรายงาน

---

## เกณฑ์ความสำเร็จ Phase 2B

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] `npm run build` → 0 error
- [ ] dashboard sub-pages ทุกหน้า heading/metadata ถูก locale
- [ ] superadmin sub-pages ทุกหน้า heading/metadata ถูก locale
- [ ] `roleLabels`, `statusLabels` ฯลฯ ไม่มีใน grep ของ app/ components/ อีกต่อไป
- [ ] `lib/labels.ts` — deprecated Records ถูกลบออก, `canDownload`/`canReadOnline` ยังอยู่
- [ ] redirect ทุก call site ใช้ `@/i18n/navigation`

---

## ความเสี่ยงที่ต้องระวัง

1. **Phase 2B ใหญ่มาก** — ถ้าพบปัญหาซับซ้อนในหน้าใด ให้ skip ไปหน้าถัดไปก่อน แล้ว report ปัญหาไว้ท้าย
2. **Client Components ที่ได้รับ label จาก props** — ต้องแปลที่ Server Component แล้วส่ง string แปลแล้วลงไป
3. **[id] routes** อาจมี form actions และ Server Actions — ห้ามแตะ action logic ใดๆ แปลเฉพาะ UI string
4. **Port 3001 ค้าง** ก่อน test:a11y: PowerShell `Stop-Process -Id $(Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force`
5. **messages files ใหญ่มาก** — merge ด้วย script แทนการ edit มือเพื่อป้องกัน JSON syntax error
