# Homepage Rendering Performance — แยกเนื้อหาสาธารณะออกจากข้อมูล Header ที่ผูกกับผู้ใช้

**เพิ่มใน:** Hallmark — header rendering refactor (2026-08). ต่อยอดจาก Hallmark — homepage data-flow optimization และ public homepage caching (ดู `docs/homepage-caching.md`)

เอกสารนี้อธิบายว่า root layout/Header render+stream อย่างไรตอนนี้, อะไรถูกย้ายไปไหน, และทำไมการตรวจสอบสิทธิ์ฝั่งเซิร์ฟเวอร์ยังปลอดภัยเหมือนเดิมทุกประการหลังการแยกส่วนนี้

---

## 1. ปัญหาเดิม

`app/layout.tsx` (root layout — ครอบทุก route ทั้งเว็บ) เดิมเรียก `getSessionUser()` + `getSettings()` + `getCategories()` + (ถ้ามี user) `getMyNotifications()`/`getUnreadNotificationCount()` รวมกันเป็น `Promise.all` เดียวที่ต้องรอให้ **ครบทุกตัว** ก่อน React จะเริ่ม render อะไรได้เลย แม้แต่ `{children}` (เนื้อหาของแต่ละหน้า) — เพราะไม่มี `<Suspense>` คั่นไว้เลยระหว่าง layout กับ children

ผลกระทบ: หน้าแรกที่เป็นเนื้อหาสาธารณะล้วน (ไม่ต้องพึ่งสิทธิ์ผู้ใช้เลย และ cache ไว้แล้วผ่าน `unstable_cache` — ดู `docs/homepage-caching.md`) ต้องรอ query ที่ผูกกับผู้ใช้แต่ละคน (session/notifications ซึ่ง cache ข้ามผู้ใช้ไม่ได้และมักช้ากว่า) เสร็จก่อน ทั้งที่ไม่มีความสัมพันธ์ทางข้อมูลกันเลย

## 2. รุ่นของ Next.js และรูปแบบการ render ที่ใช้

โปรเจกต์นี้ใช้ **Next.js 15.5.22** (`package.json`), App Router — ไม่ใช่ Next.js 16 จึงไม่มี Cache Components (`"use cache"`) ให้ใช้ (เหตุผลเดียวกับที่บันทึกไว้ใน `docs/homepage-caching.md` §2) งานนี้ไม่เกี่ยวกับการ cache ข้อมูลเพิ่มเติม แต่เป็นการจัด **rendering boundary** ด้วยกลไกมาตรฐานของ App Router ที่มีอยู่แล้วทุกเวอร์ชัน: แตก Server Component ย่อยที่ห่อด้วย `<Suspense>` เพื่อให้ React streaming HTML (out-of-order streaming) ส่งส่วนที่พร้อมก่อนออกไปได้ทันที โดยไม่ต้องรอส่วนที่ยังโหลดอยู่

## 3. โครงสร้างก่อน/หลัง

### ก่อน

```
RootLayout (async, ไม่มี Suspense คั่นเลย)
  await Promise.all([
    getSessionUser(),                 // ผูกผู้ใช้ — เปลี่ยนทุกคน
    getSettings(),                    // ใช้ครั้งเดียวสำหรับ Header (ชื่อเว็บ/โลโก้)
    getCategories(),                  // ใช้สำหรับ Footer
    user ? getMyNotifications() : [],
    user ? getUnreadNotificationCount() : 0,
  ])
  -> render <html><body><Header .../>{children}<Footer .../></body></html>
```
`{children}` (เนื้อหาแต่ละหน้า รวมถึงหน้าแรกที่ cache ไว้แล้ว) ต้องรอทุกอย่างข้างบนเสร็จก่อนแม้แต่จะเริ่ม render

### หลัง

```
RootLayout (async, เหลือ await เดียว)
  const { siteName, logoUrl } = await getPublicHomeSettings()   // cached, เบามาก (~4 ฟิลด์)
  -> render:
       <a class="skip-link" href="#main-content">...</a>
       <Header siteName logoUrl
         desktopAccountArea={<Suspense fallback={<HeaderAccountAreaSkeleton variant="desktop"/>}>
                                <HeaderAccountArea variant="desktop" />
                              </Suspense>}
         mobileAccountArea={<Suspense fallback={<HeaderAccountAreaSkeleton variant="mobile"/>}>
                               <HeaderAccountArea variant="mobile" />
                             </Suspense>} />
       <main>{children}</main>                                   <!-- streams ทันที ไม่รอ Header/Footer -->
       <Suspense fallback={<FooterSkeleton/>}><FooterData/></Suspense>
       <Suspense fallback={null}><IdleLogoutGate/></Suspense>
```

`{children}` เริ่ม stream ได้ทันทีหลังจาก `getPublicHomeSettings()` (cached, เร็ว) เสร็จ ไม่ต้องรอ session/notifications ของผู้ใช้อีกต่อไป

## 4. Component ที่ย้าย/สร้างใหม่

| Component | ประเภท | หน้าที่ |
| --- | --- | --- |
| `components/layout/Header.tsx` | Client Component (มีอยู่เดิม, ปรับ) | "เปลือก" ของแถบเมนู — โลโก้/ชื่อเว็บ, เมนูนำทางสาธารณะ, ปุ่มสลับธีม, ปุ่มค้นหา, ปุ่มเปิด/ปิดเมนูมือถือ รับส่วนบัญชีผู้ใช้เป็น React node สำเร็จรูปผ่าน props `desktopAccountArea`/`mobileAccountArea` — ไม่ดึงข้อมูลผู้ใช้เอง |
| `components/layout/HeaderAccountArea.tsx` | Server Component (ใหม่) | ดึง `getSessionUser()` + (ถ้ามี user) `getMyNotifications()`/`getUnreadNotificationCount()` + `buildWorkspaceLinks()` เรนเดอร์เมนูผู้ใช้/กระดิ่งแจ้งเตือน/ลิงก์ตามสิทธิ์ หรือปุ่มเข้าสู่ระบบ/สมัครสมาชิกสำหรับ guest — export `HeaderAccountAreaSkeleton` (loading fallback) คู่กัน |
| `lib/auth/workspace-links.ts` | Plain `.ts` (ใหม่) | Logic ล้วน (role → รายการลิงก์ workspace) แยกออกจาก `.tsx` เพื่อให้ unit-test ได้ตรงด้วย Vitest (ไม่มี JSX plugin ในการตั้งค่า Vitest ของโปรเจกต์) |
| `components/layout/FooterData.tsx` | Server Component (ใหม่) | ดึง `getSettings()` + `getCategories()` (cached) สำหรับ Footer — export `FooterSkeleton` คู่กัน |
| `components/auth/IdleLogoutGate.tsx` | Server Component (ใหม่) | ดึง `getSessionUser()` เพื่อตัดสินใจว่าจะ mount `<IdleLogout/>` หรือไม่ — ไม่มี UI ที่มองเห็น จึง fallback เป็น `null` |
| `app/layout.tsx` | ปรับ | เหลือ await เดียว (`getPublicHomeSettings()`), ห่อ 4 ส่วนที่เหลือด้วย `<Suspense>` แยกกัน |

## 5. อะไร stream อิสระได้แล้วตอนนี้

- **`{children}`** (เนื้อหาของทุกหน้า รวมหน้าแรก) — ไม่ต้องรอ session/notifications/settings เต็มรูปแบบอีกต่อไป รอแค่ `getPublicHomeSettings()` (cached) ที่ระดับ layout เท่านั้น
- **ส่วนบัญชีผู้ใช้ใน Header** (`HeaderAccountArea` ทั้ง desktop/mobile) — แต่ละอันอยู่ใน `<Suspense>` ของตัวเอง หลุดจากเส้นทาง critical ของการ render หน้าแรก
- **Footer** — อยู่ใต้ fold อยู่แล้ว ไม่จำเป็นต้องรอให้พร้อมก่อน `{children}` จะ render
- **`IdleLogoutGate`** — ไม่มี UI ที่มองเห็น ไม่กระทบการแสดงผลใดๆ ระหว่างรอ

ส่วนที่ไม่เปลี่ยนพฤติกรรมการ block: navLinks สาธารณะ (โลโก้/เมนูหลัก/ปุ่มค้นหา/ปุ่มธีม) ยัง render พร้อม Header ทันที ไม่มี skeleton กระพริบ เพราะเป็นส่วนหนึ่งของ "เมนูนำทางสาธารณะ" ที่ไม่ผูกกับผู้ใช้เลย

## 6. เหตุผลด้านความปลอดภัยของการตรวจสอบ session

**ไม่มีการส่ง user/role จาก middleware ผ่าน request header แล้วให้ Server Component เชื่อโดยไม่ตรวจสอบเอง** — ทุกจุดที่ต้องรู้ว่าใคร login อยู่/มีสิทธิ์อะไร ยังคงเรียก `getSessionUser()` (`lib/supabase/session.ts`) ซึ่งยืนยันตัวตนจริงกับ Supabase Auth server ผ่าน `supabase.auth.getUser()` (ไม่ใช่การอ่าน cookie/JWT payload ตรงๆ โดยไม่ตรวจสอบ) เอง อย่างอิสระต่อกัน:

- `middleware.ts` → `lib/supabase/middleware.ts` — ตรวจสอบ/ป้องกัน route ที่ต้องมีสิทธิ์ (login-required prefixes, role-required prefixes, MFA gate สำหรับ `/superadmin`) เรียก `supabase.auth.getUser()` ของตัวเอง **ก่อน** RSC render เสมอ — **ไม่ถูกแตะต้องในงานนี้เลย**
- `HeaderAccountArea` (ทั้ง desktop/mobile variant) — เรียก `getSessionUser()` เอง
- `IdleLogoutGate` — เรียก `getSessionUser()` เอง

`getSessionUser()` ห่อด้วย React `cache()` (memoize เฉพาะภายใน request/การ render เดียวกันเท่านั้น — ไม่ใช่ข้าม request/ผู้ใช้แบบ `unstable_cache`) จึงยังคง**ยืนยันตัวตนจริงกับ Supabase อย่างน้อยหนึ่งครั้งทุก request เสมอ** ไม่มีการข้ามการตรวจสอบ หรือนำผลจาก request ก่อนหน้า/ผู้ใช้อื่นมาใช้ซ้ำแต่อย่างใด — ปลอดภัยเหมือนเดิมทุกประการ เพียงลดจำนวน network round-trip ที่ซ้ำกันภายใน **request เดียวกัน** เท่านั้น (ดู `docs/auth-verification-audit.md` สำหรับรายละเอียดเต็มของ audit นี้)

**ไม่มีข้อมูลผู้ใช้รั่วไหลข้ามผู้ใช้**: `HeaderAccountArea` เป็น Server Component ธรรมดา (ไม่ได้ห่อด้วย `unstable_cache`) — render ใหม่ทุก request จากค่า session ของผู้เรียกจริงเท่านั้น ต่างจาก 5 ฟังก์ชันใน `docs/homepage-caching.md` §1 ที่ cache ข้ามผู้ใช้ได้อย่างปลอดภัยเพราะใช้ client ที่ไม่ผูก cookies เลย

## 7. การทดสอบ

- **`lib/auth/workspace-links.test.ts`** (Vitest, unit) — ยืนยันว่า `buildWorkspaceLinks()` คืนลิงก์ที่ถูกต้องเป๊ะสำหรับทั้ง 6 สถานะ (guest/member/staff/librarian/admin/super_admin) รวมถึงยืนยันว่า `admin` เห็นชุดเดียวกับ `librarian` (ไม่มีลิงก์ superadmin) และ `ROLE_RANK` เรียงลำดับถูกต้อง
- **`e2e/header-roles.spec.ts`** (Playwright) — ทดสอบ desktop/mobile account area จริงสำหรับทุกบทบาท (login จริงผ่าน `E2E_*_EMAIL`/`E2E_*_PASSWORD`), กระดิ่งแจ้งเตือน (empty state + badge), เมนูมือถือเปิด/ปิดอัตโนมัติเมื่อนำทาง
- **`e2e/accessibility.spec.ts`** — axe-core ตรวจ WCAG 2.1 AA รวม landmark/heading structure บนหน้าแรกทั้ง guest และ authenticated (admin) — ครอบคลุม skip-link, focus, contrast (light theme)
- **`lib/data/research-search-rls.integration.test.ts`** — **ไม่ถูกแก้ไข** ยืนยันว่า RLS/authorization behavior ของหน้าค้นหา/รายละเอียดยังคงเดิมทุกประการ

รันทั้งหมด: `npm run lint && npx tsc --noEmit && npm run test && npm run test:a11y && npm run build`

## 8. โอกาสลดความซ้ำซ้อนของการยืนยันตัวตนที่ยังไม่ทำในรอบนี้ (ตั้งใจ)

พบจุดที่ยังเรียกยืนยันตัวตน/ดึงข้อมูลผู้ใช้ซ้ำภายใน **request เดียวกัน** ที่ยังไม่ได้ลดในงานนี้ (ตามข้อกำหนด: ห้ามลบ `getUser()` เพียงเพื่อลดจำนวนครั้ง — ให้บันทึกไว้แทน):

1. **`getMyNotifications()` และ `getUnreadNotificationCount()`** (`lib/data/notifications.server.ts`) — ทั้งสองฟังก์ชัน **ไม่ได้** ห่อด้วย React `cache()` เหมือน `getSessionUser()`/`getCurrentUserRoleRank()` และแต่ละฟังก์ชันเรียก `supabase.auth.getUser()` **ของตัวเอง** ซ้ำอีกชุด (บรรทัด 34 และ 58 ตามลำดับ) แทนที่จะใช้ผลจาก `getSessionUser()` ที่มีอยู่แล้ว เนื่องจาก `HeaderAccountArea` render สองครั้งต่อ request (desktop + mobile variant, คนละ `<Suspense>` — ดู §4), การโหลดหน้าที่ login อยู่หนึ่งครั้งจึงมี:
   - `middleware.ts`: `getUser()` 1 ครั้ง (คนละ phase จาก RSC เสมอ)
   - `getSessionUser()`: `getUser()` จริง 1 ครั้ง (cache ข้าม 2 variant ได้แล้วผ่าน React `cache()`)
   - `getMyNotifications()` × 2 variant: `getUser()` จริง 2 ครั้ง + query การแจ้งเตือนซ้ำ 2 ครั้ง
   - `getUnreadNotificationCount()` × 2 variant: `getUser()` จริง 2 ครั้ง

   รวม **6 ครั้ง** ต่อการโหลดหน้าที่ login อยู่หนึ่งครั้ง (ลดจาก middleware ไม่ได้เพราะทำงานคนละ phase จาก RSC) แต่ 4 ใน 6 ครั้งนี้ (จาก notifications) ลดเหลือ 2 ครั้งได้ถ้าห่อด้วย React `cache()` เหมือน `getSessionUser()` — **ไม่ได้ทำในรอบนี้** เพราะนอกขอบเขตที่ระบุไว้ (การลด `getUser()`/`getSessionUser()` เป็นงานแยกต่างหาก)

**คำแนะนำสำหรับงานถัดไป**: ห่อ `getMyNotifications()`/`getUnreadNotificationCount()` ด้วย React `cache()` เช่นเดียวกับ `getSessionUser()` — ปลอดภัยเพราะยังคง query จริงอย่างน้อยหนึ่งครั้งต่อ request เหมือนเดิม (ไม่ใช่ `unstable_cache` ข้าม request/ผู้ใช้) เพียงลด round-trip ที่ซ้ำกันภายใน request เดียวกันเช่นเดียวกับที่ audit ก่อนหน้าทำกับ `getSessionUser()`/`getCurrentUserRoleRank()` (ดู `docs/auth-verification-audit.md`)
