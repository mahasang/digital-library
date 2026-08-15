# i18n Phase 2A — lib/labels.ts + Superadmin Layout + Overview
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม (Phase 0–1 + Cleanup เสร็จแล้ว)

- `npm run lint` → 0 error
- `npm run test` → 127/127
- `npm run test:a11y` → 50/50
- `npm run build` → 0 error
- `i18n/navigation.ts` มี Link, useRouter, usePathname, redirect
- dashboard overview + account แปลครบแล้ว (Phase 1)

ถ้า checks ยังไม่ผ่านครบ → หยุดและแจ้งทันที

---

## โครงสร้างที่พบจาก inspect จริง

### lib/labels.ts
- Record objects hardcode ไทยทั้งหมด ใช้ทั่วทั้ง dashboard + superadmin:
  - `roleLabels` — 6 entries
  - `statusLabels` — 8 entries  
  - `accessLevelLabels` — 5 entries
  - `accessLevelDescriptions` — 5 entries
  - `scanStatusLabels` — 5 entries
  - `extractionStatusLabels` — 5 entries
  - `ocrStatusLabels` — 6 entries
  - `accessRequestTypeLabels` — 2 entries
  - `accessRequestStatusLabels` — 7 entries
  - `auditActionLabels` — 40+ entries
- ถูกใช้แบบ `roleLabels[role]`, `statusLabels[status]` ฯลฯ ทั่วทั้ง codebase

### app/[locale]/superadmin/layout.tsx
- redirect จาก `next/navigation` — 3 จุด
- ไม่มี string UI hardcode

### components/superadmin/SuperAdminSidebar.tsx
- Client Component ("use client")
- `NAV_GROUPS` array — 6 กลุ่ม, 19 items, label hardcode ไทยทั้งหมด
- group labels hardcode: `"ผู้ใช้และสิทธิ์"`, `"เนื้อหา"`, `"การตั้งค่า"`, `"งานพื้นหลัง"`, `"ระบบและการตรวจสอบ"`
- string hardcode: `"เมนู Super Admin"`, `"Super Admin"`, `"← กลับไป Admin Dashboard"`
- `aria-label` hardcode: `"เมนู Super Admin (มือถือ)"`, `"เมนู Super Admin"`
- `Link` จาก `next/link`, `usePathname` จาก `next/navigation`

### app/[locale]/superadmin/overview/page.tsx
- Server Component ซับซ้อนมาก — มี sub-components จำนวนมากในไฟล์เดียว
- ใช้ `roleLabels` และ `statusLabels` จาก `lib/labels.ts` โดยตรง
- string hardcode ไทยจำนวนมากใน heading, Panel titles, EmptyState, table headers
- `Link` จาก `next/link`
- `QuickLinksPanel` มี links hardcode labels

---

## Strategy สำหรับ lib/labels.ts (Strategy A — Translation Keys)

**ปัญหา:** Record objects ใน `lib/labels.ts` เป็น plain objects ใช้ `getTranslations`/`useTranslations` ไม่ได้

**วิธีแก้:** แปลง labels เป็น translation keys ใน messages แล้วเปลี่ยน call site จาก:
```ts
roleLabels[role]        // "สมาชิก"
statusLabels[status]    // "รอตรวจสอบ"
```
เป็น:
```ts
t(`roles.${role}`)      // lookup จาก messages
t(`statuses.${status}`) // lookup จาก messages
```

**คง `lib/labels.ts` ไว้** สำหรับ helper functions (`canDownload`, `canReadOnline`) และ type-safe constants ที่ไม่ใช่ UI string — แต่ Record label objects ย้ายไปอยู่ใน messages แทน

---

## งานที่ต้องทำ: Phase 2A

### ขอบเขต (ทำ)
1. `messages/*.json` — เพิ่ม namespaces สำหรับ labels ทั้งหมด
2. `lib/labels.ts` — deprecate/remove label Records, คง helpers ไว้
3. `app/[locale]/superadmin/layout.tsx` — redirect
4. `components/superadmin/SuperAdminSidebar.tsx` — แปล NAV_GROUPS + Link
5. `app/[locale]/superadmin/overview/page.tsx` — แปล strings ทั้งหมด

### ไม่ทำใน Phase นี้
- superadmin sub-pages (users, categories, settings ฯลฯ) — Phase 2B
- dashboard sub-pages (approvals, users ฯลฯ) — Phase 2B
- call sites ของ labels ใน sub-pages — Phase 2B

**หมายเหตุ:** call sites ของ `roleLabels`/`statusLabels` ใน sub-pages ที่ยังไม่แปล
จะ TypeScript error หลังลบ Record objects — **ให้ deprecate แทนลบ** (ดูขั้น 2)

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect ก่อนทุกครั้ง

```bash
cat lib/labels.ts
cat app/\[locale\]/superadmin/layout.tsx
cat app/\[locale\]/superadmin/overview/page.tsx
cat messages/th.json

# ตรวจว่า labels ถูกใช้ที่ไหนบ้าง
grep -rn "roleLabels\|statusLabels\|accessLevelLabels\|scanStatusLabels\|extractionStatusLabels\|ocrStatusLabels\|accessRequestTypeLabels\|accessRequestStatusLabels\|auditActionLabels" \
  app/ components/ --include="*.tsx" --include="*.ts" | grep -v "lib/labels.ts"
```

ดูผล grep — จะเห็นว่ามี call sites ใน sub-pages ที่ยังไม่แปลจำนวนเท่าไร
นี่เป็นข้อมูลสำคัญสำหรับตัดสินใจว่าจะ deprecate หรือลบใน Phase นี้

### ขั้น 1 — อัปเดต messages (3 ไฟล์)

เพิ่ม namespaces ต่อไปนี้ใน `messages/th.json`:

```json
{
  "roles": {
    "guest": "ผู้เยี่ยมชม",
    "member": "สมาชิก",
    "staff": "บุคลากร",
    "librarian": "บรรณารักษ์",
    "admin": "ผู้ดูแลระบบ",
    "super_admin": "ผู้ดูแลระบบสูงสุด"
  },
  "statuses": {
    "draft": "ฉบับร่าง",
    "pending_review": "รอตรวจสอบ",
    "revision_requested": "ขอให้แก้ไข",
    "approved": "อนุมัติแล้ว",
    "published": "เผยแพร่แล้ว",
    "rejected": "ถูกปฏิเสธ",
    "archived": "จัดเก็บถาวร",
    "merged": "ถูกรวมเข้ากับรายการอื่น"
  },
  "accessLevels": {
    "public": "เข้าถึงสาธารณะ",
    "member_only": "เฉพาะสมาชิก",
    "staff_only": "เฉพาะบุคลากร",
    "read_only": "อ่านออนไลน์เท่านั้น",
    "metadata_only": "แสดงเฉพาะข้อมูลเบื้องต้น",
    "descriptions": {
      "public": "ผู้เข้าชมทุกคนสามารถอ่านและดาวน์โหลดเอกสารฉบับเต็มได้",
      "member_only": "ต้องเข้าสู่ระบบในฐานะสมาชิกจึงจะอ่านและดาวน์โหลดได้",
      "staff_only": "จำกัดเฉพาะบุคลากรขององค์กรเท่านั้น",
      "read_only": "อ่านออนไลน์ได้ แต่ไม่อนุญาตให้ดาวน์โหลดไฟล์",
      "metadata_only": "แสดงเฉพาะชื่อเรื่อง บทคัดย่อ และข้อมูลผู้วิจัย ไม่สามารถอ่านฉบับเต็ม"
    }
  },
  "scanStatuses": {
    "pending": "รอสแกนความปลอดภัย (background job)",
    "clean": "ตรวจสอบแล้ว ปลอดภัย",
    "infected": "พบความเสี่ยงด้านความปลอดภัย",
    "error": "ตรวจสอบไม่สำเร็จ",
    "skipped": "ยังไม่ได้สแกนจริง (โหมดจำลอง/ข้อมูลเก่า)"
  },
  "extractionStatuses": {
    "pending": "รอประมวลผล",
    "processing": "กำลังประมวลผล",
    "completed": "สำเร็จ — ค้นหาเนื้อหาได้",
    "no_text_found": "ไม่พบข้อความ (อาจเป็นไฟล์สแกน)",
    "failed": "ประมวลผลไม่สำเร็จ"
  },
  "ocrStatuses": {
    "not_required": "ยังไม่จำเป็นต้อง OCR",
    "pending": "รอ OCR",
    "processing": "กำลัง OCR",
    "completed": "OCR สำเร็จ — ค้นหาเนื้อหาได้ (อาจมีความคลาดเคลื่อน)",
    "failed": "OCR ไม่สำเร็จ",
    "blocked": "ยังไม่ได้ทำ OCR (ติดปัญหาการตั้งค่า/นโยบาย)"
  },
  "accessRequestTypes": {
    "read": "อ่านออนไลน์",
    "download": "ดาวน์โหลด"
  },
  "accessRequestStatuses": {
    "pending": "รอตรวจสอบ",
    "under_review": "กำลังพิจารณา",
    "approved": "อนุมัติแล้ว",
    "rejected": "ถูกปฏิเสธ",
    "more_information_required": "ต้องการข้อมูลเพิ่มเติม",
    "cancelled": "ยกเลิกโดยผู้ขอ",
    "expired": "สิทธิ์หมดอายุ"
  },
  "auditActions": {
    "research_create": "สร้างงานวิจัย",
    "research_update": "แก้ไขงานวิจัย",
    "research_status_change": "เปลี่ยนสถานะงานวิจัย",
    "category_create": "เพิ่มหมวดหมู่",
    "category_update": "แก้ไขหมวดหมู่",
    "category_enable": "เปิดใช้งานหมวดหมู่",
    "category_disable": "ปิดใช้งานหมวดหมู่",
    "category_delete": "ลบหมวดหมู่",
    "category_reorder": "จัดลำดับหมวดหมู่",
    "category_move_parent": "ย้ายหมวดหมู่",
    "organization_create": "เพิ่มหน่วยงาน",
    "organization_update": "แก้ไขหน่วยงาน",
    "organization_enable": "เปิดใช้งานหน่วยงาน",
    "organization_disable": "ปิดใช้งานหน่วยงาน",
    "organization_delete": "ลบหน่วยงาน",
    "organization_reorder": "จัดลำดับหน่วยงาน",
    "user_role_change": "เปลี่ยนบทบาทผู้ใช้",
    "user_role_add": "เพิ่มบทบาทผู้ใช้",
    "user_role_remove": "ถอดถอนบทบาทผู้ใช้",
    "super_admin_grant": "มอบสิทธิ์ Super Admin",
    "super_admin_revoke": "ถอดถอนสิทธิ์ Super Admin",
    "user_enable": "เปิดใช้งานบัญชี",
    "user_disable": "ระงับบัญชี",
    "user_suspend": "ระงับบัญชี",
    "user_suspend_temporary": "ระงับบัญชีชั่วคราว",
    "settings_update": "แก้ไขการตั้งค่าระบบ",
    "system_settings_update": "แก้ไขการตั้งค่าระบบขั้นสูง",
    "security_settings_update": "แก้ไขการตั้งค่าความปลอดภัย",
    "notification_settings_update": "แก้ไขการตั้งค่าการแจ้งเตือน",
    "storage_file_delete": "ลบไฟล์ค้างใน Storage",
    "file_upload_rejected": "ปฏิเสธไฟล์อัปโหลด (ตรวจสอบไม่ผ่าน/พบความเสี่ยง)",
    "mfa_reset": "รีเซ็ต MFA ของผู้ใช้",
    "research_text_reprocess": "สั่งประมวลผลข้อความ PDF ใหม่",
    "access_request_approve": "อนุมัติคำขอเข้าถึงเอกสาร",
    "access_request_reject": "ปฏิเสธคำขอเข้าถึงเอกสาร",
    "access_request_more_info": "ขอข้อมูลเพิ่มเติมสำหรับคำขอเข้าถึงเอกสาร",
    "access_request_cancel": "ยกเลิกคำขอเข้าถึงเอกสาร",
    "access_grant_revoke": "เพิกถอนสิทธิ์เข้าถึงเอกสาร",
    "author_create": "เพิ่มผู้วิจัย",
    "author_update": "แก้ไขผู้วิจัย",
    "author_enable": "เปิดใช้งานผู้วิจัย",
    "author_disable": "ปิดใช้งานผู้วิจัย",
    "author_orcid_verify": "ยืนยัน ORCID ของผู้วิจัย",
    "author_merge": "รวมข้อมูลผู้วิจัย",
    "organization_merge": "รวมข้อมูลหน่วยงาน",
    "research_merge": "รวมงานวิจัย",
    "duplicate_review_confirm": "ยืนยันว่างานวิจัยซ้ำกัน",
    "duplicate_review_dismiss": "ยืนยันว่างานวิจัยไม่ซ้ำกัน"
  },
  "superadmin": {
    "pageTitle": "ภาพรวมระบบ — Super Admin",
    "heading": "ภาพรวมระบบ",
    "subtitle": "สรุปสถานะระบบทั้งหมดสำหรับ Super Admin — ผู้ใช้ งานวิจัย พื้นที่จัดเก็บ และเหตุการณ์สำคัญ",
    "sectionActionRequired": "ต้องดำเนินการ",
    "sectionMonitoring": "ติดตามการทำงานของระบบ",
    "sectionReference": "ข้อมูลอ้างอิง",
    "pendingReview": "งานวิจัยรอตรวจสอบ — กดเพื่อไปหน้าอนุมัติ",
    "alertsTitle": "การแจ้งเตือนและปัญหาสำคัญของระบบ",
    "noAlerts": "ไม่พบปัญหาสำคัญในขณะนี้",
    "quickLinksTitle": "ลิงก์ด่วน",
    "quickLinkDlq": "งานล้มเหลวถาวร (DLQ)",
    "quickLinkCron": "ตรวจสอบ Cron/Worker",
    "quickLinkSecurity": "ความปลอดภัย",
    "quickLinkAccessRequests": "คำขอเข้าถึงเอกสาร",
    "storageTitle": "พื้นที่ Storage ที่ใช้งาน",
    "storageFiles": "{count} ไฟล์",
    "backupTitle": "สถานะ Backup ล่าสุด",
    "auditLogTitle": "รายการ Audit Log ล่าสุด",
    "auditLogViewAll": "ดูประวัติทั้งหมด →",
    "auditColActor": "ผู้กระทำ",
    "auditColAction": "การกระทำ",
    "auditColEntity": "ประเภทข้อมูล",
    "auditColDate": "วันที่/เวลา",
    "refTotalUsers": "ผู้ใช้ทั้งหมด",
    "refNewMembers": "สมาชิกใหม่ (30 วันล่าสุด)",
    "refTotalResearch": "งานวิจัยทั้งหมด",
    "refTotalViews": "ยอดเข้าชมสะสม",
    "refTotalDownloads": "ยอดดาวน์โหลดสะสม",
    "refReadsInRange": "อ่านออนไลน์ (30 วันล่าสุด)",
    "usersByRoleTitle": "ผู้ใช้ทั้งหมด แยกตามบทบาท",
    "unassignedRole": "ยังไม่มีบทบาท",
    "researchByStatusTitle": "งานวิจัยทั้งหมด แยกตามสถานะ",
    "popularResearchTitle": "งานวิจัยยอดนิยม",
    "trendsTitle": "แนวโน้มเชิงลึก",
    "trendDateFrom": "จากวันที่",
    "trendDateTo": "ถึงวันที่",
    "trendDateToLabel": "ถึง",
    "trendGranularityDay": "รายวัน",
    "trendGranularityMonth": "รายเดือน",
    "trendViewData": "ดูข้อมูล",
    "chartNewMembers": "สมาชิกใหม่",
    "chartViewsDownloads": "ยอดเข้าชมและดาวน์โหลด",
    "chartByCategory": "งานวิจัยตามหมวดหมู่",
    "chartByStatus": "สัดส่วนงานวิจัยตามสถานะ",
    "noDataInRange": "ไม่มีข้อมูลในช่วงเวลาที่เลือก",
    "noNewMembersInRange": "ไม่มีสมาชิกใหม่ในช่วงเวลาที่เลือก",
    "noBuckets": "ยังไม่มี Bucket ในระบบ",
    "noBucketsDesc": "เมื่อมีการตั้งค่า Storage bucket แล้ว จะแสดงพื้นที่ใช้งานที่นี่",
    "noAuditLog": "ยังไม่มีรายการ Audit Log",
    "noAuditLogDesc": "เมื่อมีการดำเนินการสำคัญในระบบ จะบันทึกไว้ที่นี่",
    "unavailable": "ไม่พร้อมใช้งาน",
    "unavailableDesc": "ไม่สามารถดึงข้อมูลนี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง",
    "unavailableStorage": "ไม่สามารถดึงข้อมูลพื้นที่ Storage ได้ในขณะนี้",
    "colTitle": "ชื่อเรื่อง",
    "colViews": "เข้าชม",
    "colDownloads": "ดาวน์โหลด",
    "nav": {
      "overview": "ภาพรวมระบบ",
      "groupUsers": "ผู้ใช้และสิทธิ์",
      "users": "ผู้ใช้งาน",
      "roles": "บทบาทและสิทธิ์",
      "mfaStatus": "สถานะ MFA",
      "groupContent": "เนื้อหา",
      "categories": "จัดลำดับหมวดหมู่",
      "organizations": "จัดลำดับหน่วยงาน",
      "groupSettings": "การตั้งค่า",
      "systemSettings": "ตั้งค่าระบบขั้นสูง",
      "security": "ความปลอดภัย",
      "notifications": "การแจ้งเตือน",
      "ocr": "ตั้งค่า OCR",
      "groupJobs": "งานพื้นหลัง",
      "pdfProcessing": "ประมวลผล PDF",
      "fileSecurity": "ความปลอดภัยไฟล์",
      "dataQuality": "คุณภาพข้อมูล",
      "jobs": "งานล้มเหลวถาวร (DLQ)",
      "cronMonitoring": "ตรวจสอบ Cron/Worker",
      "groupSystem": "ระบบและการตรวจสอบ",
      "storage": "Storage",
      "auditLogs": "Audit Log",
      "systemLogs": "System Logs",
      "systemHealth": "System Health",
      "backups": "Backups",
      "mobileTitle": "เมนู Super Admin",
      "mobileLabel": "เมนู Super Admin (มือถือ)",
      "desktopLabel": "เมนู Super Admin",
      "backToDashboard": "← กลับไป Admin Dashboard"
    }
  }
}
```

**`messages/en.json`** — เพิ่ม keys เดียวกัน แปลเป็นอังกฤษ:
```json
{
  "roles": {
    "guest": "Guest",
    "member": "Member",
    "staff": "Staff",
    "librarian": "Librarian",
    "admin": "Administrator",
    "super_admin": "Super Administrator"
  },
  "statuses": {
    "draft": "Draft",
    "pending_review": "Pending Review",
    "revision_requested": "Revision Requested",
    "approved": "Approved",
    "published": "Published",
    "rejected": "Rejected",
    "archived": "Archived",
    "merged": "Merged with another entry"
  },
  "accessLevels": {
    "public": "Public Access",
    "member_only": "Members Only",
    "staff_only": "Staff Only",
    "read_only": "Read Online Only",
    "metadata_only": "Metadata Only",
    "descriptions": {
      "public": "All visitors can read and download the full document",
      "member_only": "Must be logged in as a member to read and download",
      "staff_only": "Restricted to organizational staff only",
      "read_only": "Can read online, but downloading is not permitted",
      "metadata_only": "Shows only title, abstract, and researcher info; full text unavailable"
    }
  },
  "scanStatuses": {
    "pending": "Pending security scan (background job)",
    "clean": "Scanned — safe",
    "infected": "Security risk detected",
    "error": "Scan failed",
    "skipped": "Not yet scanned (simulation/legacy data)"
  },
  "extractionStatuses": {
    "pending": "Pending processing",
    "processing": "Processing",
    "completed": "Completed — searchable",
    "no_text_found": "No text found (may be a scanned file)",
    "failed": "Processing failed"
  },
  "ocrStatuses": {
    "not_required": "OCR not yet required",
    "pending": "Pending OCR",
    "processing": "Processing OCR",
    "completed": "OCR completed — searchable (may have errors)",
    "failed": "OCR failed",
    "blocked": "OCR not performed (configuration/policy issue)"
  },
  "accessRequestTypes": {
    "read": "Read Online",
    "download": "Download"
  },
  "accessRequestStatuses": {
    "pending": "Pending Review",
    "under_review": "Under Review",
    "approved": "Approved",
    "rejected": "Rejected",
    "more_information_required": "More Information Required",
    "cancelled": "Cancelled by Requester",
    "expired": "Access Expired"
  },
  "auditActions": {
    "research_create": "Create Research",
    "research_update": "Update Research",
    "research_status_change": "Change Research Status",
    "category_create": "Create Category",
    "category_update": "Update Category",
    "category_enable": "Enable Category",
    "category_disable": "Disable Category",
    "category_delete": "Delete Category",
    "category_reorder": "Reorder Categories",
    "category_move_parent": "Move Category Parent",
    "organization_create": "Create Organization",
    "organization_update": "Update Organization",
    "organization_enable": "Enable Organization",
    "organization_disable": "Disable Organization",
    "organization_delete": "Delete Organization",
    "organization_reorder": "Reorder Organizations",
    "user_role_change": "Change User Role",
    "user_role_add": "Add User Role",
    "user_role_remove": "Remove User Role",
    "super_admin_grant": "Grant Super Admin",
    "super_admin_revoke": "Revoke Super Admin",
    "user_enable": "Enable Account",
    "user_disable": "Disable Account",
    "user_suspend": "Suspend Account",
    "user_suspend_temporary": "Temporarily Suspend Account",
    "settings_update": "Update System Settings",
    "system_settings_update": "Update Advanced System Settings",
    "security_settings_update": "Update Security Settings",
    "notification_settings_update": "Update Notification Settings",
    "storage_file_delete": "Delete Orphaned Storage File",
    "file_upload_rejected": "File Upload Rejected (failed checks/risk detected)",
    "mfa_reset": "Reset User MFA",
    "research_text_reprocess": "Reprocess PDF Text",
    "access_request_approve": "Approve Access Request",
    "access_request_reject": "Reject Access Request",
    "access_request_more_info": "Request More Information for Access Request",
    "access_request_cancel": "Cancel Access Request",
    "access_grant_revoke": "Revoke Document Access",
    "author_create": "Create Author",
    "author_update": "Update Author",
    "author_enable": "Enable Author",
    "author_disable": "Disable Author",
    "author_orcid_verify": "Verify Author ORCID",
    "author_merge": "Merge Authors",
    "organization_merge": "Merge Organizations",
    "research_merge": "Merge Research",
    "duplicate_review_confirm": "Confirm Duplicate Research",
    "duplicate_review_dismiss": "Dismiss Duplicate Research"
  },
  "superadmin": {
    "pageTitle": "System Overview — Super Admin",
    "heading": "System Overview",
    "subtitle": "Full system status for Super Admin — users, research, storage, and key events",
    "sectionActionRequired": "Action Required",
    "sectionMonitoring": "System Monitoring",
    "sectionReference": "Reference Data",
    "pendingReview": "Research pending review — click to go to approvals",
    "alertsTitle": "System Alerts and Critical Issues",
    "noAlerts": "No critical issues found at this time",
    "quickLinksTitle": "Quick Links",
    "quickLinkDlq": "Failed Jobs (DLQ)",
    "quickLinkCron": "Cron/Worker Monitor",
    "quickLinkSecurity": "Security",
    "quickLinkAccessRequests": "Access Requests",
    "storageTitle": "Storage Usage",
    "storageFiles": "{count} files",
    "backupTitle": "Latest Backup Status",
    "auditLogTitle": "Recent Audit Log",
    "auditLogViewAll": "View full history →",
    "auditColActor": "Actor",
    "auditColAction": "Action",
    "auditColEntity": "Entity Type",
    "auditColDate": "Date/Time",
    "refTotalUsers": "Total Users",
    "refNewMembers": "New Members (last 30 days)",
    "refTotalResearch": "Total Research",
    "refTotalViews": "Total Views",
    "refTotalDownloads": "Total Downloads",
    "refReadsInRange": "Online Reads (last 30 days)",
    "usersByRoleTitle": "All Users by Role",
    "unassignedRole": "No role assigned",
    "researchByStatusTitle": "All Research by Status",
    "popularResearchTitle": "Popular Research",
    "trendsTitle": "In-Depth Trends",
    "trendDateFrom": "From date",
    "trendDateTo": "To date",
    "trendDateToLabel": "to",
    "trendGranularityDay": "Daily",
    "trendGranularityMonth": "Monthly",
    "trendViewData": "View Data",
    "chartNewMembers": "New Members",
    "chartViewsDownloads": "Views and Downloads",
    "chartByCategory": "Research by Category",
    "chartByStatus": "Research by Status",
    "noDataInRange": "No data in selected period",
    "noNewMembersInRange": "No new members in selected period",
    "noBuckets": "No buckets configured",
    "noBucketsDesc": "Storage usage will appear here once buckets are configured",
    "noAuditLog": "No audit log entries yet",
    "noAuditLogDesc": "Important system actions will be recorded here",
    "unavailable": "Unavailable",
    "unavailableDesc": "This data cannot be retrieved at this time. Please try again later.",
    "unavailableStorage": "Storage usage data is currently unavailable",
    "colTitle": "Title",
    "colViews": "Views",
    "colDownloads": "Downloads",
    "nav": {
      "overview": "System Overview",
      "groupUsers": "Users & Permissions",
      "users": "Users",
      "roles": "Roles & Permissions",
      "mfaStatus": "MFA Status",
      "groupContent": "Content",
      "categories": "Category Order",
      "organizations": "Organization Order",
      "groupSettings": "Settings",
      "systemSettings": "Advanced System Settings",
      "security": "Security",
      "notifications": "Notifications",
      "ocr": "OCR Settings",
      "groupJobs": "Background Jobs",
      "pdfProcessing": "PDF Processing",
      "fileSecurity": "File Security",
      "dataQuality": "Data Quality",
      "jobs": "Failed Jobs (DLQ)",
      "cronMonitoring": "Cron/Worker Monitor",
      "groupSystem": "System & Audit",
      "storage": "Storage",
      "auditLogs": "Audit Log",
      "systemLogs": "System Logs",
      "systemHealth": "System Health",
      "backups": "Backups",
      "mobileTitle": "Super Admin Menu",
      "mobileLabel": "Super Admin menu (mobile)",
      "desktopLabel": "Super Admin menu",
      "backToDashboard": "← Back to Admin Dashboard"
    }
  }
}
```

**`messages/lo.json`** — copy จาก th.json (placeholder)

### ขั้น 2 — lib/labels.ts (Deprecate Strategy)

**ห้ามลบ Record objects ออก** เพราะ sub-pages ที่ยังไม่แปลยังใช้อยู่
ให้ **เพิ่ม JSDoc deprecation comment** แทน:

```ts
/**
 * @deprecated ใช้ t('roles.member') จาก next-intl แทน
 * คงไว้สำหรับ sub-pages ที่ยังไม่ได้แปล — จะลบใน Phase 2B
 */
export const roleLabels: Record<UserRole, string> = { ... }

/**
 * @deprecated ใช้ t('statuses.draft') จาก next-intl แทน
 */
export const statusLabels: Record<DocumentStatus, string> = { ... }

// ... deprecated comment ทุก Record object ...
```

**คงไว้ไม่เปลี่ยน:**
- `canDownload()`, `canReadOnline()` — helper functions ไม่ใช่ UI labels
- `accessLevelDescriptions` — อาจใช้ใน form descriptions (ตรวจก่อน)

### ขั้น 3 — app/[locale]/superadmin/layout.tsx

```tsx
import { redirect } from '@/i18n/navigation';

export default async function SuperAdminLayout({ children }) {
  // ...
  if (!user) return redirect('/login?redirect=/superadmin');
  if (rank < SUPER_ADMIN_RANK) return redirect('/403');
  if (!user.hasVerifiedMfa) return redirect('/setup-mfa?redirect=/superadmin');
  // ...
}
```

ใช้ `return redirect(...)` เสมอ (บทเรียนจาก Phase 1 — TypeScript narrowing)

### ขั้น 4 — components/superadmin/SuperAdminSidebar.tsx

```tsx
'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
// ... icon imports เหมือนเดิม

interface NavItem {
  href: string;
  labelKey: string;   // เปลี่ยนจาก label
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  groupKey: string;   // เปลี่ยนจาก label — "" สำหรับกลุ่มที่ไม่มีหัวข้อ
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "",
    items: [{ href: "/superadmin/overview", labelKey: "nav.overview", icon: LayoutDashboard }],
  },
  {
    groupKey: "nav.groupUsers",
    items: [
      { href: "/superadmin/users", labelKey: "nav.users", icon: Users },
      { href: "/superadmin/roles", labelKey: "nav.roles", icon: ShieldCheck },
      { href: "/superadmin/mfa-status", labelKey: "nav.mfaStatus", icon: ShieldQuestion },
    ],
  },
  {
    groupKey: "nav.groupContent",
    items: [
      { href: "/superadmin/categories", labelKey: "nav.categories", icon: FolderTree },
      { href: "/superadmin/organizations", labelKey: "nav.organizations", icon: Building2 },
    ],
  },
  {
    groupKey: "nav.groupSettings",
    items: [
      { href: "/superadmin/system-settings", labelKey: "nav.systemSettings", icon: Settings },
      { href: "/superadmin/security", labelKey: "nav.security", icon: Lock },
      { href: "/superadmin/notifications", labelKey: "nav.notifications", icon: Bell },
      { href: "/superadmin/ocr", labelKey: "nav.ocr", icon: ScanText },
    ],
  },
  {
    groupKey: "nav.groupJobs",
    items: [
      { href: "/superadmin/pdf-processing", labelKey: "nav.pdfProcessing", icon: FileCog },
      { href: "/superadmin/file-security", labelKey: "nav.fileSecurity", icon: ShieldAlert },
      { href: "/superadmin/data-quality", labelKey: "nav.dataQuality", icon: Copy },
      { href: "/superadmin/jobs", labelKey: "nav.jobs", icon: AlertOctagon },
      { href: "/superadmin/cron-monitoring", labelKey: "nav.cronMonitoring", icon: ActivitySquare },
    ],
  },
  {
    groupKey: "nav.groupSystem",
    items: [
      { href: "/superadmin/storage", labelKey: "nav.storage", icon: HardDrive },
      { href: "/superadmin/audit-logs", labelKey: "nav.auditLogs", icon: ScrollText },
      { href: "/superadmin/system-logs", labelKey: "nav.systemLogs", icon: FileWarning },
      { href: "/superadmin/system-health", labelKey: "nav.systemHealth", icon: Activity },
      { href: "/superadmin/backups", labelKey: "nav.backups", icon: DatabaseBackup },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function SuperAdminSidebar() {
  const t = useTranslations('superadmin');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const currentItem = ALL_ITEMS.find((item) => isActive(item.href));

  return (
    <>
      {/* Mobile dropdown */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="..."
        >
          <span className="flex items-center gap-2">
            {currentItem ? <currentItem.icon className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
            {currentItem ? t(currentItem.labelKey) : t('nav.mobileTitle')}
          </span>
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {mobileOpen && (
          <nav aria-label={t('nav.mobileLabel')} className="...">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.groupKey && (
                  <p className="...">{t(group.groupKey)}</p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="...">
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            ))}
            <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="...">
              {t('nav.backToDashboard')}
            </Link>
          </nav>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20 flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-800">
            <Crown className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Super Admin</span>
          </div>

          <nav aria-label={t('nav.desktopLabel')} className="flex flex-col gap-4">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.groupKey && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {t(group.groupKey)}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="...">
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <Link href="/dashboard" className="...">
            {t('nav.backToDashboard')}
          </Link>
        </div>
      </aside>
    </>
  );
}
```

### ขั้น 5 — app/[locale]/superadmin/overview/page.tsx

ไฟล์นี้ซับซ้อนมาก — **อ่านไฟล์จริงก่อนทุกครั้ง** แล้วแปลตาม pattern:

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
  const t = await getTranslations({ locale, namespace: 'superadmin' });
  return { title: t('pageTitle') };
}
```

**sub-components ที่อยู่ในไฟล์เดียวกัน:**
- เป็น async functions — ใช้ `getTranslations('superadmin')` ได้เลย
- แต่ต้องรับ `t` เป็น parameter หรือ call `getTranslations` ใน sub-component แต่ละตัว
- **แนะนำ:** call `getTranslations` ใน sub-component แต่ละตัวเอง (ไม่ต้อง pass t)
  เพราะ next-intl cache request-scoped อยู่แล้ว ไม่มี performance penalty

**roleLabels → t('roles.xxx') pattern:**
```tsx
// เดิม
<dt className="text-xs text-gray-500">{roleLabels[role]}</dt>

// ใหม่
const t = await getTranslations('superadmin');
const tRoles = await getTranslations('roles');
<dt className="text-xs text-gray-500">{tRoles(role)}</dt>
```

**statusLabels → t('statuses.xxx') pattern:**
```tsx
// เดิม
<dt className="text-xs text-gray-500">{statusLabels[status]}</dt>

// ใหม่
const tStatuses = await getTranslations('statuses');
<dt className="text-xs text-gray-500">{tStatuses(status)}</dt>
```

**QuickLinksPanel — เปลี่ยน label + Link:**
```tsx
async function QuickLinksPanel() {
  const t = await getTranslations('superadmin');

  const links = [
    { href: "/superadmin/jobs", labelKey: "quickLinkDlq" },
    { href: "/superadmin/cron-monitoring", labelKey: "quickLinkCron" },
    { href: "/superadmin/security", labelKey: "quickLinkSecurity" },
    { href: "/dashboard/access-requests", labelKey: "quickLinkAccessRequests" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="...">
          {t(link.labelKey)}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
```

**หมายเหตุ:** `r.titleTh`, `log.actorName`, `log.action`, `log.entityType`,
`bucket.bucketId`, `alert.message` มาจาก database — **ไม่แปล**

### ขั้น 6 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Manual smoke test:**
```bash
npm run dev
# /th/superadmin/overview → heading/nav ภาษาไทย
# /en/superadmin/overview → heading/nav ภาษาอังกฤษ
# roleLabels section → แปลตาม locale
# statusLabels section → แปลตาม locale
# Sidebar nav groups/items → ถูก locale
# Mobile dropdown → ถูก locale
# Quick links → ถูก locale
```

---

## เกณฑ์ความสำเร็จ Phase 2A

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] `/th/superadmin/overview` → Thai ครบ
- [ ] `/en/superadmin/overview` → English ครบ
- [ ] role labels (UsersByRoleSection) → แปลตาม locale
- [ ] status labels (ResearchByStatusSection) → แปลตาม locale
- [ ] Sidebar nav → ถูก locale ทั้ง mobile/desktop
- [ ] `lib/labels.ts` Records ยังอยู่ (deprecated comment) — ไม่ลบ
- [ ] sub-pages ที่ใช้ `roleLabels`/`statusLabels` ยัง compile ได้ (ไม่ break)
- [ ] `canDownload()`, `canReadOnline()` ยังทำงานปกติ

---

## ข้อห้าม

- ห้ามลบ Record objects ใน `lib/labels.ts` — แค่ deprecate comment
- ห้ามแตะ superadmin sub-pages — Phase 2B
- ห้ามแตะ dashboard sub-pages — Phase 2B
- ห้ามแปล dynamic content จาก DB
- ถ้า test จำนวนลดลง → หยุดทันที
- ถ้า `tsc --noEmit` มี error ใน sub-pages ที่ยังไม่แปล → แสดงว่า labels.ts ถูกแก้มากเกินไป หยุดและรายงาน

---

## ความเสี่ยงที่ต้องระวัง

1. **Overview page มี sub-components หลายตัวในไฟล์เดียว** — แต่ละตัวเป็น async function
   แนะนำให้ call `getTranslations()` ใน sub-component แต่ละตัวเอง ไม่ต้อง pass t ลงไป

2. **`t(role)` vs `t(`roles.${role}`)` ** — ถ้า namespace คือ `'roles'` ให้เรียก `t(role)`
   ถ้า namespace คือ root ให้เรียก `t(`roles.${role}`)` — ตรวจสอบให้ถูกต้อง

3. **`usePathname` จาก next-intl** คืน path ไม่มี locale prefix
   `isActive()` logic เดิมใช้ได้โดยไม่ต้องแก้

4. **Port 3001 ค้าง** — ก่อน test:a11y:
   PowerShell: `Stop-Process -Id $(Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force`
