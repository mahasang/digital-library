# i18n Footer — แปล Footer ทั้ง 3 ตัว
# Prompt สำหรับ Claude Code / Cursor

## ขอบเขต

แปล string hardcode ไทยใน 4 ไฟล์:
- `components/layout/FooterSwitcher.tsx` — เปลี่ยน usePathname
- `components/layout/Footer.tsx` — footer หลัก (public pages)
- `components/layout/ReaderFooter.tsx` — footer หน้าอ่าน PDF
- `components/layout/OperationalFooter.tsx` — footer dashboard/superadmin

---

## ขั้น 0 — Inspect ก่อน

```bash
cat components/layout/FooterSwitcher.tsx
cat components/layout/Footer.tsx
cat components/layout/ReaderFooter.tsx
cat components/layout/OperationalFooter.tsx
cat messages/th.json | grep -A 5 '"footer"'
```

---

## ขั้น 1 — เพิ่ม messages keys

เพิ่ม namespace `"footer"` ใน `messages/th.json`:

```json
{
  "footer": {
    "copyright": "สงวนลิขสิทธิ์",
    "allRightsReserved": "สงวนลิขสิทธิ์ทุกประการ",
    "researchCategories": "หมวดหมู่งานวิจัย",
    "quickLinks": "ลิงก์ด่วน",
    "browseResearch": "ค้นหางานวิจัย",
    "about": "เกี่ยวกับเรา",
    "contact": "ติดต่อเรา",
    "submitResearch": "ส่งงานวิจัย",
    "backToTop": "กลับด้านบน",
    "viewAllCategories": "ดูหมวดหมู่ทั้งหมด",
    "moreCategories": "และอีก {count} หมวดหมู่",
    "exitReader": "ออกจากโหมดอ่าน",
    "backToResearch": "กลับไปหน้ารายละเอียด",
    "adminPanel": "แผงควบคุม",
    "systemVersion": "เวอร์ชันระบบ"
  }
}
```

เพิ่มใน `messages/en.json`:
```json
{
  "footer": {
    "copyright": "Copyright",
    "allRightsReserved": "All rights reserved",
    "researchCategories": "Research Categories",
    "quickLinks": "Quick Links",
    "browseResearch": "Browse Research",
    "about": "About Us",
    "contact": "Contact",
    "submitResearch": "Submit Research",
    "backToTop": "Back to top",
    "viewAllCategories": "View all categories",
    "moreCategories": "and {count} more categories",
    "exitReader": "Exit Reader",
    "backToResearch": "Back to details",
    "adminPanel": "Admin Panel",
    "systemVersion": "System version"
  }
}
```

เพิ่มใน `messages/lo.json` (copy th), `messages/vi.json` (แปลเวียดนาม):
```json
{
  "footer": {
    "copyright": "Bản quyền",
    "allRightsReserved": "Bảo lưu mọi quyền",
    "researchCategories": "Danh mục nghiên cứu",
    "quickLinks": "Liên kết nhanh",
    "browseResearch": "Duyệt nghiên cứu",
    "about": "Giới thiệu",
    "contact": "Liên hệ",
    "submitResearch": "Gửi nghiên cứu",
    "backToTop": "Lên đầu trang",
    "viewAllCategories": "Xem tất cả danh mục",
    "moreCategories": "và {count} danh mục khác",
    "exitReader": "Thoát chế độ đọc",
    "backToResearch": "Quay lại chi tiết",
    "adminPanel": "Bảng quản trị",
    "systemVersion": "Phiên bản hệ thống"
  }
}
```

**ข้อสำคัญ:** อ่าน footer ทั้ง 3 ไฟล์จริงก่อน แล้วเพิ่ม keys เฉพาะที่มีอยู่จริง
อย่าเพิ่ม key ที่ไม่ได้ใช้

---

## ขั้น 2 — FooterSwitcher.tsx

เปลี่ยน `usePathname` จาก `next/navigation` → `@/i18n/navigation`:

```tsx
// เดิม
import { usePathname } from "next/navigation";

// ใหม่
import { usePathname } from "@/i18n/navigation";
```

`usePathname` จาก next-intl คืน path ไม่มี locale prefix
ดังนั้น regex patterns ต้องอัปเดต:

```ts
// เดิม
const READ_ROUTE_PATTERN = /^\/research\/[^/]+\/read\/?$/;
const OPERATIONAL_ROUTE_PATTERN = /^\/(dashboard|superadmin)(\/|$)/;

// ใหม่ — เหมือนเดิม (next-intl usePathname ตัด locale ออกแล้ว)
const READ_ROUTE_PATTERN = /^\/research\/[^/]+\/read\/?$/;
const OPERATIONAL_ROUTE_PATTERN = /^\/(dashboard|superadmin)(\/|$)/;
```

**หมายเหตุ:** regex ไม่ต้องเปลี่ยน เพราะ usePathname จาก next-intl
คืน `/research/xxx/read` ไม่ใช่ `/th/research/xxx/read`

---

## ขั้น 3 — Footer.tsx (footer หลัก)

เป็น Client Component — ใช้ `useTranslations`:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';  // ถ้ามี Link เดิมจาก next/link

export default function Footer({ settings, categories }) {
  const t = useTranslations('footer');

  // แทนที่ string hardcode:
  // "หมวดหมู่งานวิจัย" → t('researchCategories')
  // "ลิงก์ด่วน" → t('quickLinks')
  // "ค้นหางานวิจัย" → t('browseResearch')
  // "เกี่ยวกับเรา" → t('about')
  // "ติดต่อเรา" → t('contact')
  // "ส่งงานวิจัย" → t('submitResearch')
  // "กลับด้านบน" → t('backToTop')
  // "สงวนลิขสิทธิ์" → t('copyright')
  // "ดูหมวดหมู่ทั้งหมด" → t('viewAllCategories')
  // `และอีก {n} หมวดหมู่` → t('moreCategories', { count: n })

  // settings.siteName มาจาก database — ไม่แปล
  // settings.contactEmail มาจาก database — ไม่แปล
  // category.nameTh มาจาก database — ไม่แปล
}
```

---

## ขั้น 4 — ReaderFooter.tsx (footer หน้าอ่าน PDF)

เป็น Client Component — ใช้ `useTranslations`:

```tsx
const t = useTranslations('footer');

// แทนที่ string hardcode:
// "ออกจากโหมดอ่าน" → t('exitReader')
// "กลับไปหน้ารายละเอียด" → t('backToResearch')
// "สงวนลิขสิทธิ์" → t('copyright')
```

---

## ขั้น 5 — OperationalFooter.tsx (footer dashboard/superadmin)

เป็น Client Component — ใช้ `useTranslations`:

```tsx
const t = useTranslations('footer');

// แทนที่ string hardcode:
// "แผงควบคุม" → t('adminPanel')
// "สงวนลิขสิทธิ์" → t('copyright')
// "เวอร์ชันระบบ" → t('systemVersion')
```

---

## ขั้น 6 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

**Manual smoke test:**
```bash
npm run dev
# /th/ → Footer ภาษาไทย
# /en/ → Footer ภาษาอังกฤษ
# /vi/ → Footer ภาษาเวียดนาม
# /th/dashboard → OperationalFooter ภาษาไทย
# /en/dashboard → OperationalFooter ภาษาอังกฤษ
# /th/research/[id]/read → ReaderFooter ภาษาไทย
# /en/research/[id]/read → ReaderFooter ภาษาอังกฤษ
```

---

## เกณฑ์ความสำเร็จ

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → ไม่น้อยกว่าเดิม
- [ ] `npm run build` → 0 error ไม่มี MISSING_MESSAGE
- [ ] Footer ทั้ง 3 ตัวเปลี่ยนภาษาตาม locale
- [ ] `settings.siteName`, `settings.contactEmail`, `category.nameTh` ยังแสดงข้อมูลจาก DB (ไม่แปล)
- [ ] FooterSwitcher routing ยังทำงานถูกต้อง (reader/operational/main)

---

## ข้อห้าม

- ห้ามแตะ `FooterData.tsx` — ไม่มีงานในไฟล์นี้
- ห้ามแปล dynamic content จาก database
- ห้ามแตะ auth, middleware, session logic
- ถ้า test ลดลง → หยุดทันที
