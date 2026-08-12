# Accessibility Audit — Hallmark Audit Phase 5

**ขอบเขต:** Dark Mode and Accessibility Close-out (2026-08). ตรวจด้วย [axe-core](https://github.com/dequelabs/axe-core) ผ่าน Playwright บนเบราว์เซอร์จริง (ไม่ใช่ jsdom) ครอบคลุม WCAG 2.1 A/AA + กฎ best-practice ของ axe (heading order, landmark uniqueness ฯลฯ) ร่วมกับ manual code review สำหรับสิ่งที่เครื่องมืออัตโนมัติตรวจไม่ได้ (focus trap, keyboard flow, screen-reader semantics)

**ไม่มีการแก้ business logic, permission, RLS, API, route, หรือเนื้อหาภาษาไทยใดๆ ระหว่างการแก้ไขทั้งหมดในเอกสารนี้** — ทุกจุดที่แก้เป็นการเปลี่ยน class/attribute ของ markup หรือ CSS token เท่านั้น

---

## 1. เครื่องมือและวิธีทดสอบ

- `@axe-core/playwright` + `@playwright/test` (เพิ่มใหม่เป็น devDependency — โปรเจกต์เดิมมีแต่ Vitest ซึ่งรันบน `node` environment ไม่มี browser จริง ตรวจ contrast/focus ไม่ได้)
- ทดสอบสัญจร: `e2e/accessibility.spec.ts`
- รันด้วย `npm run test:a11y` (= `playwright test`, ใช้ `playwright.config.ts` — เชื่อมกับ dev server ที่รันอยู่แล้วผ่าน `reuseExistingServer: true` หรือสั่ง `npm run dev` เองถ้ายังไม่ได้รัน)
- Tag ที่ตรวจ: `wcag2a`, `wcag2aa`, `wcag21aa`, `best-practice` (tag หลังสุดจำเป็น — กฎ `heading-order`/`landmark-one-main`/`page-has-heading-one`/`region` ของ axe ไม่มี wcag tag ของตัวเอง ถ้าไม่เติม tag นี้จะไม่ถูกตรวจเลย)

### เส้นทางที่ทดสอบ (แต่ละเส้นทาง ตรวจทั้งโหมด Light และ Dark)

| กลุ่ม | เส้นทาง |
| --- | --- |
| Public | หน้าแรก (`/`), ค้นหางานวิจัย (`/research`), รายละเอียดงานวิจัย, เข้าสู่ระบบ, สมัครสมาชิก |
| Authenticated (role `admin`) | โปรไฟล์บัญชี, รายการโปรด, การแจ้งเตือน, Dashboard ภาพรวม, Dashboard รายงาน |
| Super Admin (role `super_admin`, มี MFA) | หน้ายืนยันตัวตนขั้นที่สอง (`/mfa-challenge`) |

**หมายเหตุสำคัญ:** เส้นทางที่ต้อง**ผ่าน MFA จริง** (เช่น `/superadmin/overview`, `/superadmin/settings`) **ตรวจอัตโนมัติไม่ได้** ในสภาพแวดล้อมนี้เพราะต้องใช้รหัส TOTP 6 หลักที่เปลี่ยนทุก 30 วินาที — ดูหัวข้อ 5 (ความเสี่ยงคงเหลือ) สำหรับรายละเอียดและแนวทางลดความเสี่ยง

### วิธีรันซ้ำ

```bash
npm run dev            # เปิด dev server ที่ localhost:3001 ไว้ก่อน (แยก terminal)
npm run test:a11y      # รัน e2e/accessibility.spec.ts
```

ทดสอบเส้นทางที่ต้องล็อกอินต้องมี `.env.local` ตั้งค่า:

```
E2E_ADMIN_EMAIL=<บัญชี role admin ที่มีอยู่จริง>
E2E_ADMIN_PASSWORD=<...>
E2E_SUPERADMIN_EMAIL=<บัญชี role super_admin ที่มีอยู่จริง>
E2E_SUPERADMIN_PASSWORD=<...>
```

ถ้าไม่ตั้งค่า ชุดทดสอบที่ต้องล็อกอินจะ **skip ตัวเองอัตโนมัติ** (ไม่ fail) — เหมือนรูปแบบที่ integration test เดิมของโปรเจกต์ใช้อยู่แล้ว (`test/setup-env.ts`)

**ผลล่าสุด: 22/22 ผ่านทั้งหมด** (ทุกเส้นทาง × ทั้งสองธีม) หลังแก้ไขครบตามหัวข้อ 2

---

## 2. ปัญหาที่พบและแก้ไขแล้ว

### 2.1 Contrast (สีตัวอักษร/พื้นหลัง)

**A. `text-brand-600/700/800/900` ใช้เป็นสีลิงก์/ไอคอนที่ไม่เปลี่ยนตามธีม — อ่านไม่ออกบนพื้นมืดใหม่**

สีแบรนด์ (`#134bd6` เป็นต้น) วัด contrast ได้เพียง **2.48–2.67:1** บนพื้นหลังมืดใหม่ (`#0b1220`/`#111a2e`) ต่ำกว่าเกณฑ์ WCAG AA (4.5:1) มาก — เพราะสีนี้ถูกออกแบบมาให้อ่านบนพื้นขาวเท่านั้น ไม่เคยถูกทดสอบบนพื้นมืดมาก่อน (เว็บไม่มี dark mode มาก่อน Phase 5) พบใน **90 จุด, 51 ไฟล์** (ลิงก์ธรรมดา, ไอคอน, tab underline ที่ active)

**แก้ไข:** สวอปเป็น semantic token ที่ theme-aware อยู่แล้ว — `text-brand-700/600` → `text-accent`, `text-brand-800` → `text-accent-strong`, `text-brand-900` → `text-accent-ink` (สคริปต์ regex ที่ตรง scope เป๊ะ, ยืนยันด้วย `tsc --noEmit` และ re-grep ว่าไม่เหลือ `text-brand-(600|700|800|900)` ใน `app`/`components`)

**B. `text-gray-400` ใช้เป็นตัวหนังสือ/caption จริง — ไม่ผ่าน AA ทั้งสองธีม**

`gray-400` (`#9ca3af` light / `#4a5878` dark หลังรีแมป) วัด contrast ได้ **2.2–2.6:1** ทั้งสองธีม (Tailwind เองเตือนไว้ว่า gray-400 ไม่ควรใช้เป็นตัวหนังสือปกติ ควรใช้ตั้งแต่ gray-500 ขึ้นไป) พบ **207 จุด, 87 ไฟล์** — ใช้เป็น caption/timestamp/empty-state text ทั่วทั้งแอป

**แก้ไข:** สวอป `text-gray-400` → `text-gray-500` ทั้งหมด (ผ่านเกณฑ์ 4.3–5.15:1 ในบริบทส่วนใหญ่) ยกเว้นจุดที่วางอยู่บนพื้น `bg-accent-soft` (การ์ดแจ้งเตือนที่ยังไม่อ่าน) ซึ่ง gray-500 ยังขาดไปเล็กน้อย (4.29–4.30:1) — จุดเหล่านั้นใช้ `text-gray-600` แทน (6.4–7.7:1)

**C. Native date input (`<input type="date">`) พื้นหลัง/ตัวอักษรไม่ตรงกัน**

ดูหัวข้อ 2.3 (`color-scheme`)

### 2.2 กล่อง/ป้ายสีอ่อนของแบรนด์ที่ค้างเป็น light mode

`bg-brand-50` + `text-brand-700` ใช้เป็น "การ์ดสีอ่อนของแบรนด์" (active nav, badge, ปุ่มรอง, กล่องข้อมูลสำคัญในหน้า research detail) ใน **28 จุด, ~25 ไฟล์** — เพราะ `brand-*` เป็นค่าคงที่โดยตั้งใจ (ดู `docs/theme-system.md` หัวข้อ 4) รูปแบบนี้เลยกลายเป็นกล่องสีฟ้าอ่อนค้างอยู่กลางหน้าจอมืด (ไม่ใช่ปัญหา contrast ตรงๆ — ตัวหนังสือในกล่องยังอ่านออก แต่ผิดธีมเห็นชัด)

**แก้ไข:** เพิ่ม token ใหม่ `--color-accent-soft-hover` (คู่กับ `--color-accent-soft`/`--color-accent-ink` ที่มีอยู่แล้วจาก Phase 0) แล้วสวอป `bg-brand-50` → `bg-accent-soft`, `hover:bg-brand-100` → `hover:bg-accent-soft-hover`, ข้อความคู่กัน → `text-accent-ink` ดูรายละเอียดสถาปัตยกรรมที่ `docs/theme-system.md` หัวข้อ 5

### 2.3 `color-scheme` ไม่ได้ประกาศ — native form control ไม่ตรงธีม

ไม่มีการประกาศ CSS property `color-scheme` มาก่อนเลย ทำให้ `<input type="date">`, scrollbar, checkbox/radio ของเบราว์เซอร์เดาธีมจาก OS แทนที่จะตามธีมของแอป — ในบางกรณี native chrome กลายเป็นพื้นเข้ม (`#3b3b3b`, ค่าคงที่ของ Chromium) ขณะที่ตัวหนังสือ inherit สีอ่อนแบบ light-mode มา ทำให้ contrast เหลือ **3.07:1**

**แก้ไข:**
1. ประกาศ `color-scheme: light` / `color-scheme: dark` คู่กับทุกบล็อกธีมใน `globals.css` (ดู `docs/theme-system.md` หัวข้อ 6)
2. ใส่ `text-gray-900` ตรงๆ บน `<input type="date">` ทุกตัวที่พบ (8 ไฟล์) แทนการพึ่ง inheritance — กัน contrast พังซ้ำถ้า native background เปลี่ยนพฤติกรรมอีกในอนาคต

### 2.4 Missing accessible names (ฟอร์ม/ลิงก์)

- `<select>` กรองหมวดหมู่/ปี/สิทธิ์/เรียงลำดับใน `FilterBar.tsx` (หน้าค้นหางานวิจัย) และใน `app/dashboard/reports/page.tsx` — ไม่มี label ผูกเลย (**critical** ตาม axe) → เพิ่ม `aria-label` ที่สื่อความหมายทุกตัว
- `<input type="date">` ช่วงวันที่ใน `app/dashboard/page.tsx`, `app/superadmin/overview/page.tsx` — ไม่มี label → เพิ่ม `aria-label` หรือ `<label htmlFor>` ที่เชื่อมจริง (เลือกตามว่ามี label ที่มองเห็นอยู่แล้วหรือไม่)
- ลิงก์โลโก้ที่มีแต่ไอคอน (ไม่มีตัวหนังสือ) ใน `AuthFormShell.tsx` (หน้า login/register) — เพิ่ม `aria-label="กลับสู่หน้าแรก"`

### 2.5 โครงสร้าง `<dl>` ไม่ถูกต้อง (Hero stats)

`components/home/Hero.tsx` มี `<div><Icon/><dd>...</dd><dt>...</dt></div>` ภายใน `<dl>` — ตาม content model ของ HTML, `<div>` ที่เป็นลูกของ `<dl>` ต้องมีแค่ `<dt>`/`<dd>` เท่านั้น (ไอคอนที่แทรกอยู่ทำให้ผิดสเปก) แก้โดยย้ายไอคอนเข้าไปเป็นส่วนหนึ่งของ `<dt>` (decorative, `aria-hidden`) แทนที่จะเป็นพี่น้องนอก `<dt>`/`<dd>`

### 2.6 Landmark ซ้ำกันโดยไม่มีชื่อแยก (`landmark-unique`)

พบ `<nav>` มากกว่าหนึ่งจุดในหน้าเดียวกันที่ไม่มี `aria-label` เลย ทำให้ screen reader ไม่สามารถแยกแยะได้ว่า "navigation" ที่ได้ยินซ้ำๆ คืออันไหน:

| ไฟล์ | จุด | Label ที่เพิ่ม |
| --- | --- | --- |
| `Header.tsx` | เมนูหลักเดสก์ท็อป | "เมนูหลัก" |
| `app/research/[id]/page.tsx` | breadcrumb | "เส้นทางการนำทาง" |
| `DashboardSidebar.tsx` | แถบมือถือ / แถบข้างเดสก์ท็อป | "เมนูแดชบอร์ด (มือถือ)" / "เมนูแดชบอร์ด" |
| `SuperAdminSidebar.tsx` | แถบมือถือ / แถบข้างเดสก์ท็อป | "เมนู Super Admin (มือถือ)" / "เมนู Super Admin" |

`SuperAdminSidebar.tsx` เวอร์ชันเดสก์ท็อปเดิมสร้าง `<nav>` แยกต่างหาก**ต่อกลุ่มเมนูย่อยหนึ่งอัน** (วนลูป `NAV_GROUPS.map`) ทำให้เกิด nav landmark ซ้ำหลายอันในหน้าเดียว **ไม่ใช่แค่ไม่มีชื่อ แต่มากเกินความจำเป็นเชิงความหมาย** — รวมกลุ่มย่อยทั้งหมดเป็น `<nav>` เดียว (label เดียว) แล้วเปลี่ยนกลุ่มย่อยแต่ละอันเป็น `<div>` ธรรมดาแทน (โครงสร้างภาพเดิมไม่เปลี่ยน ใช้ `gap` เดิมทุกประการ)

`AccountShell.tsx` มี `aria-label` ถูกต้องอยู่แล้วตั้งแต่ก่อนหน้านี้ — ใช้เป็นตัวอย่างอ้างอิงตอนแก้จุดอื่น

### 2.7 Heading order ข้ามระดับ (`heading-order`)

- **`Footer.tsx`**: หัวข้อ 3 คอลัมน์ท้ายเว็บ (`หมวดหมู่งานวิจัย`/`เมนูลัด`/`ติดต่อเรา`) เป็น `<h3>` แบบไม่มีเงื่อนไข — หน้าที่ไม่มี `<h2>` เลยก่อนถึง footer (login, register, favorites, notifications, mfa-challenge) จะกลายเป็น H1 → H3 ข้ามระดับ เปลี่ยนเป็น `<h2>` ทั้งหมด (การถอยระดับกลับมาที่ h2 สำหรับ landmark ใหม่ๆ ถือว่าถูกต้องเสมอตาม heading-order ไม่ว่าหน้านั้นจะมี h2 มาก่อนหรือไม่)
- **`ResearchCard.tsx`**: ชื่อเรื่องงานวิจัยในการ์ดเป็น `<h3>` แต่หน้า `/research` (ค้นหา) ไม่มี `<h2>` คั่นระหว่าง H1 กับการ์ด → เปลี่ยนเป็น `<h2>` (ใช้ได้ถูกต้องทั้งบนหน้า search ที่ตามหลัง H1 ตรงๆ และบนหน้าแรก/รายละเอียดที่มี H2 ของ section คั่นอยู่แล้ว เพราะ heading ระดับเดียวกันติดกันเป็นพี่น้องที่ถูกต้องเสมอ)

### 2.8 Dialog ไม่จัดการ focus

Dialog ทั้ง 5 จุดในระบบ (`BulkAllMatchingFilterDialog`, `JobBatchDetailDrawer`, `MfaResetConfirmDialog`, `SuperAdminRoleConfirmDialog`, `AuthorSidebarActions`'s merge dialog) มี `role="dialog"` + `aria-modal="true"` แต่ไม่เคย:
- ดัก Tab/Shift+Tab ให้วนอยู่ในกล่อง (กด Tab ต่อจากปุ่มสุดท้ายจะหลุดไปโฟกัสเนื้อหาหลังฉากหลัง)
- ปิดด้วยปุ่ม Escape
- คืนโฟกัสกลับไปที่ปุ่มที่เปิด dialog เมื่อปิด

**แก้ไข:** สร้าง hook กลาง `lib/hooks/useDialogA11y.ts` ใช้ร่วมกันทั้ง 5 จุด — ดัก focus trap, Escape-to-close (เว้นตอน pending/submitting), และคืนโฟกัสอัตโนมัติ ผูก `aria-labelledby` ชี้ไปที่ `<h3>` หัวเรื่องของแต่ละ dialog ด้วย (เดิมไม่มีชื่อ dialog ที่ screen reader ประกาศทันทีตอนเปิด)

จุดที่ปุ่มเปิด/กล่อง dialog เป็น component เดียวกันที่สลับ return ของตัวเอง (`BulkAllMatchingFilterDialog`, merge dialog ใน `AuthorSidebarActions`) มีเคสพิเศษ: ปุ่มเดิมที่เคยโฟกัสอยู่ **ถูก unmount ทิ้งจริงเมื่อสลับไปแสดง dialog** (React reconcile คนละ subtree) ทำให้ reference ที่ hook เก็บไว้ตอนเปิดกลายเป็น node ที่หลุดจาก DOM แล้วตอนปิด `.focus()` จึงไม่มีผล — แก้เพิ่มด้วย `ref`/`useEffect` เฉพาะจุดใน 2 ไฟล์นี้เพื่อคืนโฟกัสไปที่ปุ่มตัวใหม่ที่ remount กลับมาแทน (ยืนยันด้วยการทดสอบจริงผ่าน Playwright: เปิด dialog → Escape → โฟกัสกลับไปที่ปุ่ม "รวมเข้ากับผู้วิจัยอื่น" ถูกต้อง)

### 2.9 `prefers-reduced-motion`

เพิ่ม CSS กลาง (ยังไม่เคยมีมาก่อน) ที่ปิด/ย่อ animation และ transition ทั้งหมดให้เหลือ `0.001ms` เมื่อผู้ใช้ตั้งค่า "ลดการเคลื่อนไหว" ไว้ที่ระดับ OS — ครอบคลุมทุก animation ในเว็บโดยไม่ต้องแก้ทีละ component (รวมถึง chart animation ของ Recharts, transition ของ dropdown/dialog)

---

## 3. ตรวจด้วยตนเอง (Manual review)

นอกเหนือจากที่ axe ตรวจอัตโนมัติได้:

- **Skip link**: ยืนยันแล้วว่า `app/layout.tsx` มี `<a href="#main-content">` และ `<main id="main-content" tabIndex={-1}>` ตรงกัน อยู่ใน root layout เดียว รับประกันว่าทุกหน้ามี `<main>` เดียว (ไม่มีทางซ้ำเพราะไม่มีหน้าไหนประกาศ `<main>` เพิ่มเอง)
- **Focus visible**: ตรวจ CSS ว่าไม่มีการปิด `outline` ทิ้งโดยไม่มี state ทดแทน (Tailwind's `focus-visible:outline` patterns ใช้อยู่ทั่วไปในปุ่ม/ลิงก์แล้วจาก Phase ก่อนหน้า — Phase 5 ไม่ได้แตะ)
- **Reader (PDF) chrome**: ตรวจด้วยสายตาว่าหน้ากระดาษยังคงพื้นขาวเสมอทั้งสองธีม (ไม่แตะ react-pdf) — ปุ่มเครื่องมือรอบๆ (ซูม/ดาวน์โหลด/สลับธีมในตัว reader) ใช้ token ของตัวเอง (`--reader-*`) ไม่ปนกับธีมเว็บ ตามที่ตั้งใจไว้ตั้งแต่ Phase 2
- **Dialog focus trap/Escape/restore**: ทดสอบจริงผ่าน Playwright บนเบราว์เซอร์จริง (ไม่ใช่แค่ static review) — ดูหัวข้อ 2.8

---

## 4. สิ่งที่ยังไม่ได้แก้ (ตั้งใจ ไม่อยู่ในสโคป)

- **`focus-visible:outline-brand-600`** (ใช้เป็นสี focus ring ทั่วแอป) ยังเป็นค่าคงที่ ไม่ได้สวอปเป็น `--color-focus-ring` — ตรวจสอบแล้วว่าสีนี้ (`#185ff2`) ยังมองเห็นชัดเจนบนพื้นมืดใหม่ (เป็นสีสว่าง ตัดกับพื้นเข้มได้ดี) ไม่ใช่ปัญหาจริง แต่เพื่อความสม่ำเสมอในอนาคตอาจพิจารณาสวอปเป็น `--color-focus-ring` (ซึ่งมีค่า dark ที่ต่างกันเล็กน้อยอยู่แล้ว) ในรอบถัดไป — **ไม่ใช่ WCAG violation ปัจจุบัน จึงไม่แตะในรอบนี้**
- **`ring-brand-600/20`** (ขอบ badge จางๆ, `Badge.tsx`) ยังเป็นค่าคงที่เช่นกัน — เป็น decorative ring บางมาก ไม่กระทบ contrast ของเนื้อหา ปล่อยไว้ตามเดิม

---

## 5. ความเสี่ยงคงเหลือ / สิ่งที่ควรตรวจเพิ่มก่อนเปิดใช้งานสาธารณะ

1. **หน้า Super Admin ที่ผ่าน MFA gate** (`/superadmin/overview`, `/superadmin/settings`, และหน้า superadmin อื่นๆ ทั้งหมด) **ยังไม่ได้ผ่านการทดสอบอัตโนมัติแบบ end-to-end จริง** เพราะต้องใช้รหัส TOTP ที่เปลี่ยนทุก 30 วินาที อัตโนมัติผ่านไม่ได้ในสภาพแวดล้อมนี้ — ตรวจแบบ code review แทน (ยืนยันว่าใช้ token system เดียวกันกับหน้าที่ทดสอบผ่านแล้วจริง เช่น `/dashboard/reports` ซึ่งแชร์ `SystemSettingsForm.tsx`/`Panel.tsx`/pattern เดียวกันทุกประการ) **แนะนำให้ทีมทดสอบด้วยมือผ่าน MFA จริงอย่างน้อยหนึ่งรอบก่อนเปิดใช้งานสาธารณะ** โดยเฉพาะหน้า Settings ที่มี file-upload control
2. **Screen reader จริง** (NVDA/JAWS/VoiceOver) ยังไม่ได้ทดสอบ — axe ตรวจ semantic HTML/ARIA ได้ดีแต่ไม่ใช่ตัวแทนสมบูรณ์ของประสบการณ์ผู้ใช้ screen reader จริง (การอ่านลำดับ, การประกาศ live region ของ toast/notification เป็นต้น) แนะนำให้ทดสอบ golden path (ค้นหา → เปิดเอกสาร → อ่าน) ด้วย screen reader จริงอย่างน้อยหนึ่งรอบ
3. **Mobile viewport แบบ interactive จริง** — ตรวจผ่าน screenshot หลายจุดและ responsive class review แต่ไม่ได้ทดสอบ touch gesture จริงบนอุปกรณ์จริง
4. **`prefers-reduced-motion`** ตรวจแค่ว่า CSS rule ถูกประกาศถูกต้อง (ตรวจด้วย DevTools emulation) — ยังไม่ได้ทดสอบครบทุก animation ในแอปเป็นรายจุด
5. Contrast ของ Recharts chart colors (`OverviewCharts.tsx`) คำนวณด้วยค่าคงที่ที่เลือกด้วยมือ (ไม่ใช่ token) — ตรวจด้วยสายตาแล้วว่าอ่านง่ายทั้งสองธีม แต่ไม่ได้รันผ่าน axe เพราะ SVG chart ส่วนใหญ่ axe ไม่ตรวจ contrast ของ path/line โดยตรง
