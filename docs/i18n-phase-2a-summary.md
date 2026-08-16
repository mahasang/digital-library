# i18n Phase 2A — Summary
**วันที่:** 2026-08-14
**สถานะ:** ✅ เสร็จสมบูรณ์

---

## ผล Automated Checks

| คำสั่ง | ผลลัพธ์ |
|--------|---------|
| `npx tsc --noEmit` | ✅ 0 error (project-wide รวม sub-pages ที่ยังไม่แปล) |
| `npm run lint` | ✅ 0 error (8 warning เดิม) |
| `npm run test` | ✅ 127/127 |
| `npm run build` | ✅ 0 error |
| `npm run test:a11y` | ✅ 50/50 |

---

## สิ่งที่ทำ

### ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `messages/th.json` | เพิ่ม 10 top-level namespaces ใหม่ (ดูรายละเอียดด้านล่าง) |
| `messages/en.json` | เพิ่ม keys เดียวกัน — แปลเป็นอังกฤษ |
| `messages/lo.json` | เพิ่ม keys เดียวกัน — placeholder (copy จาก th.json) |
| `lib/labels.ts` | เพิ่ม `@deprecated` JSDoc บน Record exports ทั้ง 9 ตัว — ไม่เปลี่ยน content หรือ shape ใดๆ |
| `app/[locale]/superadmin/layout.tsx` | เปลี่ยน redirect → `@/i18n/navigation`, ใช้ `return redirect(...)` ทุก call site |
| `components/superadmin/SuperAdminSidebar.tsx` | เปลี่ยน Link/usePathname → `@/i18n/navigation`, NAV_GROUPS → `groupKey`/`labelKey`, แปล aria-labels และ back link |
| `app/[locale]/superadmin/overview/page.tsx` | เพิ่ม `generateMetadata`, แปล sub-components ทั้ง 9 ตัว, เปลี่ยน `roleLabels[role]` → `tRoles(role)` และ `statusLabels[status]` → `tStatuses(status)` |

---

## Namespaces ใหม่ใน messages

| Namespace | จำนวน keys | ใช้สำหรับ |
|-----------|-----------|---------|
| `roles` | 6 | role labels ทั้งระบบ |
| `statuses` | 8 | document status labels |
| `accessLevels` | 5 + 5 descriptions | access level labels + descriptions |
| `scanStatuses` | 5 | file scan status labels |
| `extractionStatuses` | 5 | PDF extraction status labels |
| `ocrStatuses` | 6 | OCR status labels |
| `accessRequestTypes` | 2 | access request type labels |
| `accessRequestStatuses` | 7 | access request status labels |
| `auditActions` | **48 entries** | audit log action labels |
| `superadmin` | 50+ (รวม `superadmin.nav.*`) | superadmin overview page + sidebar |

---

## สิ่งที่พบระหว่างทำ

### 1. Keys ขาดจาก prompt 3 จุด
ตรวจสอบ string จริงในไฟล์แล้วพบ keys ที่ prompt ไม่ได้ระบุ:
- `superadmin.noUsersYet` — `"ยังไม่มีผู้ใช้งานในระบบ"` (UsersByRoleSection empty state)
- `superadmin.noResearchYet` — `"ยังไม่มีงานวิจัยในระบบ"` (ResearchByStatusSection empty state)
- `superadmin.noData` — `"ยังไม่มีข้อมูล"` (PopularResearchSection + CategoryChart empty state)

### 2. getBackupStatus() reason/guidance text
เป็น UI copy จริง (ไม่ใช่ DB content) แต่อยู่ใน `lib/data/superadmin-stats.server.ts` นอก scope Phase 2A — defer ไว้ Phase 2B อย่างถูกต้อง

### 3. MFA live test limitation
`/superadmin/overview` ต้องผ่าน TOTP MFA challenge จริง — ไม่สามารถทดสอบ browser อัตโนมัติได้ เป็น limitation ที่รู้อยู่แล้วตั้งแต่ต้น (ดู docs/accessibility-audit.md §5)
- ยืนยันได้ว่า redirect ไปที่ `/mfa-challenge` (ไม่ใช่ `/setup-mfa`) → `hasVerifiedMfa` check ใน layout ทำงานถูกต้อง
- **ต้อง manual test `/th/superadmin/overview` และ `/en/superadmin/overview` ด้วย authenticator จริงก่อน ship**

---

## Deprecate Strategy ผลลัพธ์

`lib/labels.ts` Record exports ทั้ง 9 ตัวยังอยู่ครบ แค่มี `@deprecated` JSDoc:

```ts
/**
 * @deprecated ใช้ t('roles.member') จาก next-intl แทน
 * คงไว้สำหรับ sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const roleLabels: Record<UserRole, string> = { ... }
```

ผลลัพธ์:
- 40+ call sites ใน sub-pages ที่ยังไม่แปล → ยัง compile ได้ทั้งหมด
- `tsc --noEmit` → 0 error project-wide
- `canDownload()`, `canReadOnline()` → ไม่เปลี่ยนแปลง

---

## Pattern ใหม่ที่ใช้ใน Phase 2A

### roleLabels/statusLabels → root-scoped translators
```tsx
// overview/page.tsx sub-components
const tRoles = await getTranslations('roles');
const tStatuses = await getTranslations('statuses');

// เดิม
<dt>{roleLabels[role]}</dt>
<dt>{statusLabels[status]}</dt>

// ใหม่
<dt>{tRoles(role)}</dt>       // "Member" หรือ "สมาชิก"
<dt>{tStatuses(status)}</dt>  // "Published" หรือ "เผยแพร่แล้ว"
```

### Sub-components call getTranslations() เอง
แต่ละ async sub-component ใน overview page call `getTranslations()` เองโดยตรง ไม่ต้อง pass `t` ลงไป เพราะ next-intl cache request-scoped:
```tsx
async function UsersByRoleSection() {
  const t = await getTranslations('superadmin');
  const tRoles = await getTranslations('roles');
  // ...
}
```

---

## Inconsistency ที่เหลืออยู่ (Phase 2B)

| รายการ | สถานะ |
|--------|-------|
| `lib/labels.ts` Record exports — deprecated แต่ยังไม่ลบ | Phase 2B — ลบพร้อมแปล sub-pages |
| `getBackupStatus()` reason/guidance text | Phase 2B |
| superadmin sub-pages ทั้งหมด (users, categories, settings ฯลฯ) | Phase 2B |
| dashboard sub-pages (approvals, users, categories ฯลฯ) | Phase 2B |
| `messages/lo.json` ยังเป็น placeholder | Phase 3 |
| Manual verify superadmin ด้วย TOTP จริง | ก่อน ship |

---

## สถานะ i18n โดยรวม

```
Phase 0A ✅ Infrastructure
Phase 0B ✅ Header + LanguageSwitcher
Phase 0C ✅ Public pages
Cleanup  ✅ Locale-aware navigation
Phase 1  ✅ Dashboard overview + Account
Phase 2A ✅ lib/labels.ts deprecation + Superadmin layout + Overview
─────────────────────────────────────────────────────────────────────
Phase 2B ⏳ Sub-pages (dashboard + superadmin) + labels.ts cleanup
Phase 3  ⏳ lo.json translation จริง
```

---

## ไฟล์ที่เปลี่ยนแปลงทั้งหมด

```
แก้ไข (7):
  messages/th.json
  messages/en.json
  messages/lo.json
  lib/labels.ts
  app/[locale]/superadmin/layout.tsx
  components/superadmin/SuperAdminSidebar.tsx
  app/[locale]/superadmin/overview/page.tsx
```
