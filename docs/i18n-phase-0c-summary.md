# i18n Phase 0C — Summary
**วันที่:** 2026-08-14
**สถานะ:** ✅ เสร็จสมบูรณ์

---

## ผล Automated Checks (หลัง Phase 0C)

| คำสั่ง | ผลลัพธ์ |
|--------|---------|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error (8 warning เดิม ไม่เกี่ยวข้อง) |
| `npm run test` | ✅ 127/127 |
| `npm run test:a11y` | ✅ 50/50 (รันสามรอบตลอด session) |
| `npm run build` | ✅ 0 error |

---

## สิ่งที่ทำ

### ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|--------------|
| `messages/th.json` | เพิ่ม/แก้ไข namespaces: `home.*` (ครบ), `research.*` (ครบ), `login.*` (ใหม่), `register.*` (ใหม่), `errors.*` (ครบ) |
| `messages/en.json` | เพิ่ม keys เดียวกัน — แปลเป็นอังกฤษ |
| `messages/lo.json` | เพิ่ม keys เดียวกัน — placeholder (copy จาก th.json) |
| `app/[locale]/page.tsx` | เพิ่ม `getTranslations('home')` แปล title/description ที่ส่งลง ResearchSection |
| `components/home/Hero.tsx` | เปลี่ยนเป็น async, แปล heading (แยก 2 บรรทัด), subtitle, stat labels ทั้ง 3 |
| `components/home/ResearchSection.tsx` | เปลี่ยนเป็น async, แปล "ดูทั้งหมด", เปลี่ยน Link → `@/i18n/navigation` |
| `components/home/CategorySection.tsx` | เปลี่ยนเป็น async, แปล heading/subtitle/"ดูทั้งหมด"/ICU count, เปลี่ยน Link → `@/i18n/navigation` |
| `components/home/HomeSearchBox.tsx` | แปล placeholder + submit button ด้วย `useTranslations` (Client Component) |
| `app/[locale]/research/page.tsx` | เพิ่ม `generateMetadata`, แปล heading/subtitle/loading, เปลี่ยน Link |
| `app/[locale]/login/page.tsx` | เพิ่ม `generateMetadata`, แปล title/description/footer/alert messages ทั้ง 3 |
| `app/[locale]/register/page.tsx` | เพิ่ม `generateMetadata`, แปล title/description/footer |
| `app/[locale]/403/page.tsx` | เปลี่ยนเป็น async, เพิ่ม `generateMetadata`, แปล heading/body/buttons |
| `components/layout/LanguageSwitcher.tsx` | **bug fix** — เพิ่ม `useSearchParams()` + ส่ง query string ไปด้วยตอนสลับภาษา |

---

## ปัญหาที่พบระหว่างทำ (สำคัญ)

### 1. Hero.tsx heading ใช้ `<br>` ไม่ใช่ `\n`
- **ปัญหา:** prompt แนะนำให้ใส่ `\n` ใน string เดียว แต่โค้ดจริงใช้ `<br className="hidden sm:block">` เพื่อ responsive line-break
- **แก้:** แยกเป็น 2 keys — `heroHeadingLine1` และ `heroHeadingLine2`
- **บทเรียน:** inspect JSX จริงก่อนเขียน translation key เสมอ — structure ของ markup กำหนด structure ของ key

### 2. Login idle-timeout copy ผิด
- **ปัญหา:** prompt ระบุ "100 นาที" แต่โค้ดจริงใน `IdleLogout.tsx` ใช้ `IDLE_LIMIT_MS = 10 * 60 * 1000` = **10 นาที**
- **แก้:** ใช้ "10 นาที" ตามโค้ดจริง
- **บทเรียน:** ตรวจค่า constant จาก source code จริงก่อนเขียน copy เสมอ ไม่ใช่เดาจาก string ที่เห็น

### 3. Research page metadata title ไม่ตรง
- **ปัญหา:** `research.pageTitle` key ใน Phase 0A ใช้ค่า "คลังงานวิจัย" แต่ metadata จริงในหน้าคือ "ค้นหางานวิจัย"
- **แก้:** แก้ค่า key ให้ตรงกับ metadata จริง
- **บทเรียน:** key ที่สร้างไว้ล่วงหน้าโดยไม่ได้ wire ต้องตรวจสอบใหม่เมื่อถึงเวลาใช้จริง

### 4. HomeSearchBox.tsx ตกหล่นจาก inspect
- **ปัญหา:** prompt ไม่ได้ระบุ HomeSearchBox ว่ามี string hardcode แต่จริงๆ มี 2 จุด (placeholder + submit button) และ wording ไม่ตรงกับ key ใน messages ที่มีอยู่แล้ว
- **แก้:** แปลด้วย `useTranslations('home')` และอัปเดต key ให้ตรงกับ copy จริง
- **บทเรียน:** inspect ทุกไฟล์ใน dependency chain เสมอ ไม่ใช่แค่ไฟล์ที่ prompt ระบุ

### 5. LanguageSwitcher ทำให้ query string หาย (Bug สำคัญ)
- **ปัญหา:** `usePathname()` ไม่รวม query string — `router.replace(pathname, { locale })` จึงทำให้ `?category=xxx` หายทุกครั้งที่สลับภาษา
- **พบเมื่อ:** Phase 0C smoke test เช็ค `/th/research?category=xxx` → EN → ต้องเป็น `/en/research?category=xxx`
- **ทำไมไม่พบใน Phase 0B:** ตอนนั้น CategorySection ยังไม่มี locale-aware links ที่ carry query params
- **แก้:** เพิ่ม `useSearchParams()` ใน `LanguageSwitcher.tsx` แล้วส่ง query ไปด้วย:
  ```tsx
  const searchParams = useSearchParams();
  router.replace(
    { pathname, query: Object.fromEntries(searchParams) },
    { locale: newLocale }
  );
  ```
- **บทเรียน:** test query string preservation ทุกครั้งที่ implement locale switching — ไม่ใช่แค่ path

---

## Manual Smoke Test ผ่าน

| หน้า/การกระทำ | ผลลัพธ์ |
|--------------|---------|
| `/th/` hero heading | ✅ 2 บรรทัด responsive เหมือนเดิม |
| `/en/` hero heading | ✅ 2 บรรทัด responsive ภาษาอังกฤษ |
| `/th/` stat labels | ✅ ภาษาไทย |
| `/en/` stat labels | ✅ ภาษาอังกฤษ |
| Category count | ✅ "2 รายการ" (th) vs "2 items" (en) — ICU format ถูก |
| `category.nameTh` | ✅ ยังเป็นข้อมูลจาก DB ไม่แปล |
| `/th/research` metadata title | ✅ "ค้นหางานวิจัย" |
| `/en/research` metadata title | ✅ "Search Research" |
| `/th/login` alert messages | ✅ ภาษาไทยครบทั้ง 3 |
| `/en/login` alert messages | ✅ ภาษาอังกฤษครบทั้ง 3 |
| `/th/403` → `/en/403` | ✅ แปลครบ |
| สลับภาษาที่ `/th/research?category=engineering` | ✅ → `/en/research?category=engineering` (query คงเดิม) |
| `siteName` | ✅ ยังมาจาก settings (DB) ไม่แปล |

---

## Inconsistency ที่รู้และยอมรับ (ไม่บล็อก)

| รายการ | สถานะ |
|--------|-------|
| `components/ui/Button.tsx` (LinkButton) ยังใช้ `next/link` ภายใน | Self-healing — deferred Phase 1 (shared primitive ใช้ใน 100+ จุด) |
| `HomeSearchBox.tsx` useRouter ยังเป็น `next/navigation` | Self-healing — deferred |
| `UserMenu.tsx` desktop workspace links ยังเป็น bare path | Self-healing — deferred Phase 1 |
| `ResearchExplorer` และ components ย่อย | ยังไม่แปล — Phase 1 |

---

## สถานะ Phase 0 ทั้งหมด

```
Phase 0A ✅ Infrastructure — next-intl, [locale] routing, messages files
Phase 0B ✅ Header + LanguageSwitcher — สลับภาษาได้จาก Header
Phase 0C ✅ Public pages — หน้าแรก, research, login, register, 403 แปลครบ
─────────────────────────────────────────────────────────────────
Phase 1  ⏳ Protected pages — dashboard, account, workspace-links
Phase 2  ⏳ Super Admin pages — superadmin/*
Phase 3  ⏳ lo.json translation — แปลจริงภาษาไทย → ลาว
```

---

## ไฟล์ที่เปลี่ยนแปลงทั้งหมด

```
แก้ไข (13):
  messages/th.json
  messages/en.json
  messages/lo.json
  app/[locale]/page.tsx
  components/home/Hero.tsx
  components/home/ResearchSection.tsx
  components/home/CategorySection.tsx
  components/home/HomeSearchBox.tsx
  app/[locale]/research/page.tsx
  app/[locale]/login/page.tsx
  app/[locale]/register/page.tsx
  app/[locale]/403/page.tsx
  components/layout/LanguageSwitcher.tsx  (bug fix — query string)
```
