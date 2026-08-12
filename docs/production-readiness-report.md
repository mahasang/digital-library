# รายงานความพร้อมใช้งานจริง (Production Readiness Report)

**ผู้ตรวจสอบ:** Release Manager / QA Lead / Security Reviewer (ตรวจสอบผ่าน Claude Code)
**วันที่ตรวจสอบ:** 2026-08-08 (อัปเดตล่าสุด: **2026-08-11 — Hallmark Audit Phase 5 (Dark Mode and Accessibility Close-out) เสร็จสมบูรณ์ — ดูหัวข้อ 0.6**; ก่อนหน้านั้น Final Regression QA รอบ C-1/M-1/M-4 — ดูหัวข้อ 0)
**ขอบเขต:** โค้ด, migrations/RLS, Server Actions, Storage/Signed URL, MFA/CAPTCHA/Rate Limit, Background Jobs/Cron, ระบบค้นหา, เอกสารประกอบ — ตรวจสอบเฉพาะสภาพแวดล้อม local/Docker เท่านั้น **ไม่มีการ deploy จริง ไม่มีการแก้ไขข้อมูล production และไม่มีการใช้ secret จริงใดๆ ตลอดการตรวจสอบทุกรอบ**

---

## 0. Final Regression QA (รอบสุดท้ายหลังแก้ C-1 และ M-1)

การตรวจสอบรอบนี้เป็น **regression QA ครั้งสุดท้ายก่อนตัดสินใจขึ้น production** — ยืนยันซ้ำว่า C-1 (Critical) และ M-4/"M-1 ระบบค้นหา" (Medium) ที่แก้ไปแล้วยังคงถูกแก้จริง ไม่ regress กลับ และไม่กระทบฟีเจอร์อื่นที่ไม่เกี่ยวข้อง

### 0.1 ผล C-1 และ SEARCH-03
✅ **ยังคงแก้ไขสมบูรณ์ ไม่ regress** — ยืนยันซ้ำด้วย `npm run test lib/data/research-search-rls.integration.test.ts` แบบ verbose: **28/28 ผ่านทั้งหมด** ครอบคลุม Guest/Member/Staff/Librarian/Admin/Super Admin + เจ้าของเอกสาร + metadata_only exclusion + raw column access ถูกปฏิเสธ (403/401) ทั้ง anon และ authenticated + RPC คืนเฉพาะ excerpt ที่ตัดความยาวแล้วเสมอ ดูรายละเอียดเต็มในหัวข้อ 2 (C-1) และ `docs/qa-test-plan.md` (SEARCH-03)

### 0.2 ผล M-1 (rank ในระบบค้นหา, บันทึกเป็น M-4)
✅ **ยังคงแก้ไขสมบูรณ์ ไม่ regress** — ยืนยันซ้ำด้วย `lib/search/rank.test.ts` (20 test) + ส่วนเพิ่มใน `lib/data/research-search.pagination.test.ts` (19 test) รวม **39/39 ผ่านทั้งหมด** ครอบคลุม rank ปกติ/null/undefined/NaN/Infinity, ผลลัพธ์คะแนนเท่ากันตัดสินด้วย id, pagination หลายหน้าคงที่, ไม่มี full-text result, title/metadata vs PDF text search ดูรายละเอียดในหัวข้อ 2 (M-4)

### 0.3 หลักฐานใหม่ในรอบนี้ (ไม่เคยทดสอบมาก่อน)
- **Access grant ที่หมดอายุ**: ทดสอบเชิงประจักษ์ (สร้าง/ลบ fixture เองใน local Supabase) — สร้าง grant ประเภท `read` ที่ `expires_at` เป็นอดีต และ grant ประเภท `download` ที่ยัง active เปรียบเทียบกัน ยิง query ที่จำลอง filter เดียวกับ `hasActiveAccessGrantBySlug()` เป๊ะ (`revoked_at is null AND (expires_at is null OR expires_at > now())`) ด้วย session ของผู้ใช้จริง (ไม่ใช่ service role) — **ผลลัพธ์: grant ที่หมดอายุถูกกรองออกถูกต้อง (คืนค่าว่างเปล่า) ส่วน grant ที่ active ยังปรากฏตามปกติ (positive control ยืนยันว่า query ไม่ได้พังจนคืนค่าว่างเสมอ)** สรุปว่า Signed URL จะไม่ถูกออกให้จากสิทธิ์ที่หมดอายุแล้วจริง — ลบข้อมูลทดสอบออกหมดแล้ว
- **RLS spot-check ตารางอ่อนไหว**: ยืนยัน `relrowsecurity = true` ตรงจาก `pg_class` สำหรับ `research_items`, `access_requests`, `favorites`, `download_logs`, `audit_logs`, `document_access_grants`, `reading_history` — ครบทุกตาราง ไม่มีตัวใดถูกปิด RLS โดยไม่ได้ตั้งใจ
- **ไฟล์ความปลอดภัยที่ไม่ได้แก้ไขในรอบ C-1/M-1**: ตรวจ mtime ของ `lib/security/*.server.ts`, `lib/captcha.server.ts`, `lib/rate-limit.server.ts`, `lib/data/favorites.server.ts`, `lib/data/audit-logs.server.ts`, `lib/data/access-requests*.server.ts` — ทุกไฟล์มี timestamp ก่อนวันที่แก้ C-1/M-1 (2026-08-08) ยืนยันว่าไม่ถูกแตะต้องเลย ข้อสรุปเดิมเรื่อง MFA/Turnstile/Rate Limit/File Upload Validation จากการตรวจสอบรอบแรกยังใช้ได้ครบ ไม่มีความเสี่ยง regression จากรอบแก้ไขนี้
- **Mobile Responsive หน้าหลัก**: ตรวจ Tailwind responsive class (`sm:`/`md:`/`lg:`/`xl:`) ใน `Hero.tsx`, `CategorySection.tsx`, `HomeSearchBox.tsx`, `ResearchSection.tsx`, `Header.tsx`, `Footer.tsx` — พบใช้งานจริงรวม 25 จุด ครบทุกไฟล์ที่ตรวจ ยืนยัน compile/render สำเร็จผ่าน dev server จริง (`GET / 200`) **หมายเหตุ: ตรวจแบบ static code review + compile check เท่านั้น ไม่ได้ตรวจผ่าน browser จริงหลาย viewport (ไม่มีเครื่องมือ browser automation ในสภาพแวดล้อมนี้)**
- **Dark/Light Mode**: ยืนยันซ้ำว่ายังไม่มีการรองรับเลย (L-4 เดิม) — ไม่มี `darkMode` config, ไม่มี class `dark:` ในไฟล์หน้าหลักที่ตรวจ

### 0.4 ผล Automated Checks (รันสดในรอบนี้)
| คำสั่ง | ผลลัพธ์ |
| --- | --- |
| `npm run lint` | ✅ ผ่าน — 0 error, 8 warning (คงเดิม, ไม่เป็นบั๊ก — ดู L-1) |
| `npx tsc --noEmit` (type check) | ✅ ผ่าน — 0 error |
| `npm run test` | ✅ ผ่าน — **95/95 test ใน 7 ไฟล์** |
| `npm run build` | ✅ ผ่าน — สร้างครบทุก route โดยไม่มี error |
| Migration reset จากศูนย์ (`supabase db reset`) | ✅ ผ่าน — 32/32 ไฟล์ตามลำดับ + seed data สำเร็จ (ยืนยันซ้ำ 3 ครั้งในรอบการแก้ไข C-1/M-1/QA สุดท้ายนี้ ล้วนสำเร็จ) |

> หมายเหตุปฏิบัติการ: ระหว่างรัน `npm run build` (production) ขณะที่ `npm run dev` กำลังทำงานอยู่ พบว่าทั้งสองคำสั่งเขียนทับ `.next` cache ร่วมกันจนทำให้ dev server พังชั่วคราว (`Cannot find module './XXXX.js'`) — แก้ไขด้วยการหยุด dev server, ลบ `.next`, และรันใหม่ทุกครั้งหลัง build เสร็จ **ไม่กระทบ production build ที่ทดสอบเลย** (เป็นแค่ผลข้างเคียงของการรัน dev+build พร้อมกันบนเครื่องเดียวระหว่างการตรวจสอบเท่านั้น) — ทีมพัฒนาควรทราบว่าไม่ควรรัน `npm run build` ขณะ `npm run dev` ทำงานอยู่บนเครื่องเดียวกัน

### 0.5 สรุป
**ไม่พบ regression ใดๆ จากการแก้ไข C-1 และ M-1/M-4 — ไม่พบปัญหาใหม่ระดับ Critical หรือ High ในรอบตรวจสอบนี้เลย** รายละเอียดปัญหาคงเหลือทั้งหมด (ทุกระดับ) อยู่ในหัวข้อ 2

### 0.6 Hallmark Audit Phase 5 — Dark Mode and Accessibility Close-out (2026-08-11)

ปิด **L-4** (ไม่รองรับ Dark Mode) และยกระดับ **L-5** (Accessibility ตรวจแบบผิวเผิน) จาก grep-level review เป็นการตรวจอัตโนมัติจริงผ่าน axe-core บนเบราว์เซอร์จริง **ไม่มีการแก้ business logic, permission, RLS, API, route, หรือเนื้อหาภาษาไทยใดๆ ในรอบนี้** — ทุกจุดที่แก้เป็น markup class/attribute หรือ CSS token เท่านั้น รายละเอียดเต็มอยู่ที่ `docs/theme-system.md` และ `docs/accessibility-audit.md`

**Dark Mode:**
- ระบบธีม Light/Dark/System เต็มรูปแบบผ่าน `next-themes`, ปุ่มสลับใน Header (เดสก์ท็อป+มือถือ), จำค่าไว้ใน `localStorage`, ไม่มี hydration mismatch
- รีแมป Tailwind stock palette (`gray`/`red`/`green`/`amber`/`blue`/`purple`) เป็น CSS variable ทำให้โค้ดเดิมกว่า 90 ไฟล์จากทุก Phase ก่อนหน้าได้ dark mode อัตโนมัติโดยไม่ต้องแก้โค้ดคอมโพเนนต์เอง (ค่า light เท่ากับ Tailwind default เป๊ะ — ยืนยันด้วย `require('tailwindcss/colors')` จึงไม่มีการเปลี่ยนรูปลักษณ์ใน Light mode)
- แก้บั๊กที่พบระหว่างตรวจสอบเอง: กล่อง/ป้ายสีอ่อนของแบรนด์ (`bg-brand-50`) ค้างเป็น light-only ใน 28 จุด, PDF reader chrome sync ธีมเริ่มต้นจากธีมเว็บ (ตัวหน้ากระดาษ PDF จริงยังคงขาวเสมอ ไม่แตะ react-pdf), Recharts ทำสีอัตโนมัติผ่าน `useTheme()`
- **ปัญหา infra ที่พบระหว่างทาง (ไม่ใช่บั๊กของแอป):** หลังแก้ `tailwind.config.ts`/`globals.css` ต้องล้าง `.next/cache` และ restart dev server ทุกครั้ง มิฉะนั้น Tailwind ใช้ CSS ที่ compile ค้างจากก่อนแก้ (พบเป็น false-negative ระหว่างตรวจสอบเอง — bg ค้าง light แม้ dark token ถูกต้องแล้ว)

**Accessibility:**
- เพิ่ม `@axe-core/playwright` + `@playwright/test` เป็น devDependency ใหม่ (โปรเจกต์เดิมมีแต่ Vitest บน `node` environment ตรวจ contrast/focus ไม่ได้) — ชุดทดสอบ `e2e/accessibility.spec.ts`, รันด้วย `npm run test:a11y`, ครอบคลุม WCAG 2.1 A/AA + best-practice (heading-order/landmark) ทั้ง Light และ Dark **22/22 ผ่าน**
- แก้ contrast: `text-brand-*` (90 จุด/51 ไฟล์) และ `text-gray-400` (207 จุด/87 ไฟล์) ไม่ผ่าน AA บนพื้นหลังใหม่ — สวอปเป็น semantic token/เฉดที่เข้มขึ้น; ประกาศ CSS `color-scheme` ที่ขาดไปทำให้ native date-input contrast ไม่ตรงกัน
- แก้ missing accessible name: `<select>`/`<input type="date">` ที่ไม่มี label (critical ตาม axe), ลิงก์โลโก้ที่มีแต่ไอคอน
- แก้โครงสร้าง DOM: `<dl>` ผิด content model (Hero stats), `<nav>` ซ้ำกันไม่มีชื่อแยก (`landmark-unique`) 8 จุด, heading ข้ามระดับ H1→H3 (`heading-order`) ใน Footer + ResearchCard
- เพิ่ม focus management ให้ dialog ทั้ง 5 จุดในระบบ (focus trap, Escape-to-close, คืนโฟกัสเมื่อปิด) ผ่าน hook กลาง `lib/hooks/useDialogA11y.ts` — ยืนยันด้วย Playwright จริง (ไม่ใช่แค่ static review)
- **ความเสี่ยงคงเหลือที่ยังไม่ได้ทดสอบอัตโนมัติ**: หน้า Super Admin ที่ต้องผ่าน MFA จริง (ต้องใช้ TOTP ที่เปลี่ยนทุก 30 วินาที อัตโนมัติผ่านไม่ได้ในสภาพแวดล้อมนี้ — ตรวจแบบ code review แทนว่าใช้ token system เดียวกันกับหน้าที่ทดสอบผ่านแล้ว), screen reader จริง (NVDA/VoiceOver), mobile touch gesture บนอุปกรณ์จริง — รายละเอียดที่ `docs/accessibility-audit.md` หัวข้อ 5

**Automated checks รันสดในรอบนี้:** `npm run lint` ✅ (0 error, warning เดิม), `npx tsc --noEmit` ✅ (0 error), `npm run test:a11y` ✅ (22/22), `npm run test` และ `npm run build` — ดูหัวข้อ 1 สำหรับผลล่าสุดหลัง merge เข้ากับรอบนี้

---

## 1. สรุปผลโดยย่อ

| หัวข้อ | ผลลัพธ์ |
| --- | --- |
| `npm run lint` | ผ่าน — 0 error, 8 warning (คงเดิมตลอด) |
| `npx tsc --noEmit` | ผ่าน — 0 error |
| `npm run build` | ผ่าน — สร้าง static/dynamic ครบทั้ง 42+ routes |
| `npm run test` | ผ่าน — **95 test ใน 7 ไฟล์** (unit 67 ใน 6 ไฟล์ + integration 28 ใน 1 ไฟล์ ที่ต่อ local Supabase จริง) |
| `npm run test:a11y` (ใหม่ — Phase 5) | ผ่าน — **22/22** (axe-core ผ่าน Playwright, 11 เส้นทาง × 2 ธีม, ดูหัวข้อ 0.6) |
| Migrations (**32 ไฟล์** — เพิ่ม 2 ไฟล์แก้ C-1/M-4) | รันสำเร็จจากศูนย์ผ่าน `supabase db reset` ครบทุกไฟล์ตามลำดับ |
| RLS coverage | ครบทุกตารางที่ควรมี RLS — พบช่องโหว่ระดับ Critical 1 จุด (**C-1 — แก้ไขแล้ว พร้อม regression test อัตโนมัติ**, ดูหัวข้อ 2/3.1) |
| Server Actions authorization | ครอบคลุมดี — พบช่องโหว่ระดับ Medium 1 จุด (แก้แล้ว) |
| ระบบค้นหา (relevance rank/sort stability) | พบช่องโหว่ระดับ Medium 1 จุด (**M-4 — แก้ไขแล้ว พร้อม regression test อัตโนมัติ 39 รายการ**, ดูหัวข้อ 2) |
| Dependency audit | พบช่องโหว่ high severity 3 รายการ ต้องอัปเกรด Next.js major version จึงจะปิดได้ครบ (ดูหัวข้อ 5) |

---

## 2. ปัญหาที่พบ (เรียงตามความรุนแรง)

### Critical

**C-1 (✅ แก้ไขแล้ว). `research_document_texts` เคยเปิดให้ดึงเนื้อหาไฟล์ PDF แบบเต็มได้โดยตรง ข้ามข้อจำกัด `read_only` (ห้ามดาวน์โหลด) ผ่าน REST API ตรงๆ โดยไม่ต้องล็อกอิน**

- **หลักฐานก่อนแก้ไข (ทดสอบจริงกับ local Supabase, ลบข้อมูลทดสอบออกหมดแล้ว):** สร้างงานวิจัยตัวอย่าง `access_level='read_only', status='published'` พร้อมข้อความที่ดึงไว้แล้วในตาราง `research_document_texts` จากนั้นยิง `GET /rest/v1/research_document_texts?select=research_item_id,extracted_text&research_item_id=eq.<id>` ด้วย **`NEXT_PUBLIC_SUPABASE_ANON_KEY` เพียงอย่างเดียว ไม่มี session/login ใดๆ** — ได้ข้อความเต็มของเอกสารกลับมาทันที
- **สาเหตุ:** migration `20260807100000_pdf_fulltext_search.sql` ตั้งใจให้แอปค้นหาผ่าน user-scoped client (RLS บังคับที่ระดับแถว) แทน Service Role โดยเจตนา (มีคอมเมนต์อธิบายไว้ชัดเจนในไฟล์) แต่ RLS policy `research_document_texts_select` อนุญาต SELECT **ทั้งแถว (ทุกคอลัมน์ รวม `extracted_text`/`ocr_text` ดิบ)** ทันทีที่ `research_items` แถวนั้นมองเห็นได้ RLS เป็น row-level ไม่ใช่ column-level การอนุญาตให้เห็นแถวจึงเท่ากับอนุญาตให้เห็นทุกคอลัมน์ รวมเนื้อหาดิบที่แอปตั้งใจให้เห็นแค่ snippet เท่านั้น
- **ผลกระทบก่อนแก้ไข:** ทำลายจุดประสงค์ของ `read_only` (อ่านออนไลน์ได้แต่ห้ามดาวน์โหลด) โดยสิ้นเชิง — ใครก็ตามที่เปิด DevTools เห็น anon key (เป็นค่า public ที่ฝังในโค้ด client โดยเจตนา) สามารถดึงเนื้อหาเต็มของเอกสารทุกฉบับที่เป็น `read_only`/`public` และมีข้อความดึงไว้แล้ว โดยไม่ผ่าน Signed URL, ไม่มีการนับ/บันทึกใน `download_logs`, ไม่มี rate limit ใดๆ เอกสารระดับ `metadata_only` และ `member_only`/`staff_only` ไม่เคยได้รับผลกระทบ (ถูกกันไว้ถูกต้องตั้งแต่แรก)

- **✅ วิธีแก้ไข (คงสถาปัตยกรรม RLS-based เดิมทั้งหมด — ไม่เปลี่ยนไปใช้ Service Role สำหรับค้นหา):**
  1. **Migration ใหม่** `supabase/migrations/20260822100000_restrict_document_text_exposure.sql`:
     - `revoke select on public.research_document_texts from anon, authenticated;` แล้ว `grant select` เฉพาะคอลัมน์ metadata (`extraction_status`, `ocr_status`, timestamps ฯลฯ) — **ตัดสิทธิ์ `extracted_text`/`extracted_text_normalized`/`ocr_text`/`ocr_text_normalized` ออกจาก anon/authenticated โดยสิ้นเชิง ไม่มีข้อยกเว้นตาม rank เลย** (column-level grant ของ Postgres ไม่รู้จัก rank — ต่างจาก RLS)
     - เพิ่มฟังก์ชัน `search_research_document_excerpts(p_raw_query, p_normalized_query)` — **`SECURITY DEFINER`** ที่ **คัดลอกเงื่อนไขการมองเห็นแถวจาก policy `research_document_texts_select` มาไว้ในตัวฟังก์ชันทุกตัวอักษร** (จำเป็นเพราะ SECURITY DEFINER ข้าม RLS โดยธรรมชาติ — ไม่ใช่การผ่อนสิทธิ์ แต่เป็นการบังคับเงื่อนไขเดิมด้วยมือ) คืนค่าเฉพาะ **excerpt ที่ตัดจากรัศมี 1000 ตัวอักษรรอบตำแหน่งที่ตรงคำค้นหาครั้งแรกเท่านั้น** (ไม่เกิน ~2000 ตัวอักษร) ไม่ใช่คอลัมน์เต็ม
     - Hardening ตามข้อกำหนดของ SECURITY DEFINER: ตั้ง `set search_path = public, pg_temp` แบบ fixed กัน search_path hijacking, `revoke all ... from public` ก่อนเสมอแล้วค่อย `grant execute` เฉพาะ `anon, authenticated` (Postgres ให้ EXECUTE แก่ PUBLIC อัตโนมัติเมื่อสร้างฟังก์ชันใหม่ ต้องตัดออกก่อนเสมอ)
  2. **`lib/data/research-search.server.ts`**: เปลี่ยน `collectPdfMatches()` จาก `select` ตรงบนตาราง เป็นเรียก `.rpc("search_research_document_excerpts", ...)` — ตรรกะ `buildSnippet()`/การจัดลำดับ/การ dedup ระหว่างข้อความปกติกับ OCR **ไม่ถูกแก้ไขเลยแม้แต่บรรทัดเดียว** (ทำงานกับ excerpt แทนข้อความเต็มได้ผลลัพธ์เหมือนเดิมทุกกรณี เพราะรัศมี excerpt ใหญ่กว่ารัศมี snippet จริง 120 ตัวอักษรหลายเท่า)

- **หลักฐานหลังแก้ไข (ทดสอบซ้ำด้วยชุดข้อมูลเดิม):**
  - `curl` แบบเดิมทุกประการ (anon key, ไม่ล็อกอิน) → **`403 permission denied for table research_document_texts`** (ปฏิเสธตั้งแต่ชั้น grant ก่อนถึง RLS ด้วยซ้ำ)
  - เรียก RPC ใหม่ด้วย query เดียวกัน → ได้ excerpt ที่มีคำค้นหาอยู่จริง แต่ทดสอบกับเอกสารจำลอง ~25,600 ตัวอักษร → excerpt ที่ได้ยาวไม่เกิน ~2,010 ตัวอักษร (ลดการรั่วไหลลง **>92%** ต่อคำค้นหาหนึ่งครั้ง และไม่มีทางดึง "ทั้งเอกสาร" ได้อีกต่อไปไม่ว่าจะเรียกกี่ครั้งก็ตาม เพราะมีแค่ตำแหน่งที่ตรงคำค้นหาแรกเท่านั้นที่ถูกส่งกลับ)
  - เอกสาร `metadata_only`/`staff_only` ที่ guest ไม่มีสิทธิ์ → RPC คืนค่าว่างเปล่าถูกต้อง (พิสูจน์ว่า authorization ในฟังก์ชันทำงานเทียบเท่า RLS เดิมจริง)
  - **Automated regression test 28 รายการ** ใน `lib/data/research-search-rls.integration.test.ts` (ต่อ local Supabase จริง ไม่ mock) ครอบคลุม Guest/Member/Staff/Librarian/Admin/Super Admin ครบ + เจ้าของเอกสาร + ภาษาไทย/อังกฤษ + query ว่าง/ยาวผิดปกติ/ไม่พบผล + พิสูจน์ว่า `document_access_grants` ที่ active ไม่ทำให้เห็นผลค้นหาเพิ่ม (ตามที่ออกแบบไว้ — grant เป็นชั้นสิทธิ์เสริมสำหรับ Signed URL เท่านั้น) — **ผ่านทั้งหมด รันซ้ำได้ต่อเนื่องหลายรอบโดยไม่มีข้อมูลค้าง** ดูรายละเอียดที่ `docs/qa-test-plan.md` หัวข้อ SEARCH-03
  - เพิ่ม `lib/data/research-search.pagination.test.ts` (13 test, pure unit) ครอบคลุม pagination/sorting/filtering ของ `finalizeResults()` แยกต่างหาก (ไม่ต้องต่อ Supabase)

- **ผลกระทบต่อฟีเจอร์อื่น:** ตรวจสอบครบทุกจุดที่เคย `select` `extracted_text`/`ocr_text` ในโค้ดทั้งระบบก่อนแก้ไข — พบว่ามีเพียง `research-search.server.ts` จุดเดียวเท่านั้นที่อ่านคอลัมน์เหล่านี้ผ่าน client ของผู้ใช้ (`getExtractionStatus`/`getPdfProcessingCandidates`/ทุก background job handler ล้วนอ่านเฉพาะคอลัมน์ metadata หรือใช้ Service Role อยู่แล้ว) จึงมั่นใจได้ว่าไม่มีฟีเจอร์อื่นพังจากการตัด grant นี้ — ยืนยันด้วย `npm run build` ผ่านสะอาดครบทุก route

### High

**H-1 (แก้แล้ว). `app/dashboard/users/actions.ts` ส่งข้อความ error ดิบจาก Postgres/Supabase Auth กลับไปแสดงที่ UI ตรงๆ**

4 จุดใน `changeUserRoleAction`/`toggleUserActiveAction` ใช้ `` `...: ${error.message}` `` แทนที่จะผ่าน `toSafeErrorMessage()` เหมือนไฟล์ `actions.ts` อื่นทุกไฟล์ในโปรเจกต์ (20 ไฟล์ที่เหลือใช้ helper นี้ครบ) — ข้อความจาก Supabase Auth Admin API หรือ constraint violation ของ Postgres อาจหลุดไปแสดงใน `UserManager.tsx` ได้โดยตรง **แก้ไขแล้ว** ในรอบนี้ — เปลี่ยนทั้ง 4 จุดให้ใช้ `toSafeErrorMessage()` ตามรูปแบบเดียวกับไฟล์อื่น (ตรวจสอบด้วย `tsc --noEmit` แล้วผ่าน)

**H-2 (แก้แล้ว). กล่องยืนยัน "พิมพ์ชื่อ/MERGE เพื่อยืนยัน" ก่อนรวมข้อมูล (merge) ผู้วิจัย/หน่วยงาน/งานวิจัย ไม่ได้ถูกตรวจสอบฝั่งเซิร์ฟเวอร์เลย**

Input ที่ให้พิมพ์ยืนยันใน `AuthorSidebarActions.tsx`, `OrganizationManager.tsx`, `DuplicateReviewActionsPanel.tsx` ไม่มี attribute `name` จึงไม่ถูกส่งไปเป็นส่วนหนึ่งของ `FormData` เลย และ Server Action ทั้ง 3 ตัว (`mergeAuthorsAction`, `mergeOrganizationsAction`, `mergeResearchItemsAction`) ไม่เคยอ่าน/ตรวจสอบค่านี้ — แม้ปุ่มจะถูก disable ไว้ที่ฝั่ง client จนกว่าจะพิมพ์ถูกต้อง แต่ผู้ใช้ที่มีสิทธิ์ rank ที่กำหนด (librarian/admin) สามารถเรียก Server Action ตรงได้โดยไม่ต้องพิมพ์ยืนยันอะไรเลย (เช่น ผ่าน script หรือแก้ DOM) ต่างจาก `grantSuperAdminAction`/`revokeSuperAdminAction`/`resetUserMfaAction` ที่ตรวจสอบข้อความยืนยันฝั่งเซิร์ฟเวอร์อย่างถูกต้องอยู่แล้ว **ไม่ใช่การยกระดับสิทธิ์ (ผู้เรียกต้องมี rank ที่ถูกต้องอยู่แล้ว) แต่เป็นการ bypass ด่านป้องกันการกดพลาด/กระทำโดยไม่ตั้งใจซึ่งเป็นการกระทำที่ย้อนกลับยาก**

**แก้ไขแล้ว** ในรอบนี้:
- เพิ่ม `name="confirmText"` ให้ทั้ง 3 input
- `mergeResearchItemsAction`: ตรวจสอบ `confirmText === "MERGE"` ฝั่งเซิร์ฟเวอร์
- `mergeAuthorsAction`/`mergeOrganizationsAction`: ดึงชื่อจริงของ record ต้นทาง (`authors.name` / `organizations.name_th`) จากฐานข้อมูลเอง (ไม่เชื่อค่าที่ client อ้างว่าเป็นชื่อ) แล้วเทียบกับ `confirmText` ที่ส่งมา

### Medium

**M-1. บาง Server Action ใน `/superadmin/*` ตรวจสอบ rank เองแทนใช้ `requireMinRank()`**

`app/superadmin/pdf-processing/actions.ts` และ `lib/jobs/process-now.action.server.ts` เช็ค `rank < 50` เอง แทนที่จะเรียก `requireMinRank(50)` เหมือนไฟล์อื่นในกลุ่ม `/superadmin/*` — ผลลัพธ์ authorization เหมือนกัน (ปฏิเสธถ้า rank ไม่ถึง) แต่ **ไม่ได้ผ่านด่านตรวจสอบ MFA aal2 ที่ `requireMinRank()` บังคับไว้เป็นชั้นป้องกันเสริม (defense-in-depth)** สำหรับ Super Admin ยังไม่บล็อกจริง เพราะ middleware บล็อกการเข้าหน้าอยู่ก่อนแล้ว แต่การเรียก Server Action ตรง (ข้ามหน้า UI) จะไม่ผ่านการตรวจ aal2 ซ้ำ **ยังไม่ได้แก้ไข** — เสนอให้เปลี่ยนมาใช้ `requireMinRank(50)` ให้ตรงกับไฟล์อื่นในรอบถัดไป (ความเสี่ยงต่ำ เพราะยังต้องเป็น super_admin rank ≥ 50 อยู่ดีจึงจะเรียกผ่าน)

> **หมายเหตุกันสับสนคำว่า "rank"**: มีการขอให้แก้ "M-1: rank check ไม่สม่ำเสมอในระบบค้นหา" ในรอบตรวจสอบถัดมา ซึ่ง**ไม่ใช่ finding เดียวกับ M-1 ข้างต้นนี้** (M-1 ข้างต้นคือ RBAC role rank ผ่าน `requireMinRank()`/`user_max_role_rank()` — ยังไม่ได้แก้) คำว่า "rank" ในบริบทค้นหาหมายถึง **relevance rank** (คะแนนความเกี่ยวข้องของผลค้นหา, `MATCH_SOURCE_RELEVANCE`) คนละความหมายกันโดยสิ้นเชิง บันทึกไว้เป็น **M-4** แยกต่างหากด้านล่างเพื่อไม่ให้ทับซ้อนกับ M-1 เดิม

**M-2. เอกสารเก่าบางฟังก์ชันใน `lib/data/*.server.ts` ยัง throw Error ที่มี `error.message` ดิบฝังอยู่**

พบใน `lib/data/queries.ts`, `reports.server.ts`, `favorites.server.ts`, `organizations.server.ts`, `categories.server.ts`, `submissions.server.ts`, `submission-write.server.ts` — เป็น `throw new Error(...)` ที่ถูก catch โดย Next.js error boundary ทั่วไป (ไม่ใช่ return ตรงจาก Server Action) Next.js จะ redact ข้อความจาก thrown exception ไม่ให้ถึง client โดยอัตโนมัติใน production build อยู่แล้ว จึงไม่ใช่ช่องโหว่จริงในทางปฏิบัติ แต่ไม่สอดคล้องกับรูปแบบ `toSafeErrorMessage()` ที่ใช้ทั่วทั้งโปรเจกต์ **ยังไม่ได้แก้ไข** — แนะนำให้ปรับให้สม่ำเสมอในรอบถัดไปเพื่อความง่ายในการดูแลรักษา ไม่ใช่ความเร่งด่วนด้านความปลอดภัย

**M-3. Dependency มีช่องโหว่ high severity 3 รายการที่ต้องอัปเกรด Next.js major version จึงจะปิดได้**

ดูรายละเอียดหัวข้อ 5

**M-4 (✅ แก้ไขแล้ว). Relevance rank (คะแนนความเกี่ยวข้องของผลค้นหา) ไม่มีด่านตรวจสอบค่าที่ไม่ใช่ตัวเลขจำกัด และไม่มีตัวตัดสินลำดับสุดท้ายที่ไม่ซ้ำกัน — ทำให้ผลค้นหาเรียงลำดับไม่คงที่เมื่อคะแนน/วันที่เผยแพร่เท่ากัน**

- **สาเหตุ**: `finalizeResults()` ใน `lib/data/research-search.server.ts` (เดิม) คำนวณ `MATCH_SOURCE_RELEVANCE[a.matchSource]` แล้วนำไปคำนวณ `relB - relA` ตรงๆ — ถ้า `matchSource` เป็นค่าที่ไม่มีอยู่ในตาราง (เช่น เพิ่ม `MatchSource` ใหม่ในอนาคตแล้วลืมอัปเดตตาราง) จะได้ `undefined` ทำให้ผลลัพธ์เป็น `NaN` ซึ่ง ECMAScript ไม่ได้นิยามพฤติกรรมของ `Array.prototype.sort()` เมื่อ comparator คืนค่า `NaN` และเมื่อ relevance/วันที่เผยแพร่เท่ากันพอดี comparator เดิมคืนค่า `0` โดยไม่มีตัวตัดสินลำดับที่ไม่ซ้ำกันต่อ — ลำดับที่เหลือจึงขึ้นกับลำดับ "ต้นทาง" ของ array ซึ่งมาจากลำดับแถวที่ Postgres/RPC คืนมา (Postgres ไม่การันตีลำดับแถวโดยไม่มี `ORDER BY` แม้ query เดิมซ้ำก็ตาม) กระทบทั้งความคาดเดาได้ของผลลัพธ์และความคงที่ของ pagination ข้ามคำขอ พบทั้งในชั้นแอป (`research-search.server.ts`) และชั้น RPC ใหม่ที่เพิ่มตอนแก้ C-1 (`search_research_document_excerpts()` ไม่มี `ORDER BY`)
- **วิธีแก้** (คง RLS/ranking-by-relevance เดิมทั้งหมด ไม่เปลี่ยนพฤติกรรมการเรียงตามความเกี่ยวข้อง):
  1. **`lib/search/rank.ts`** (ใหม่) — utility กลาง: `normalizeRank(value, fallback)` ตรวจว่าค่าเป็นตัวเลขจำกัดจริง (`typeof === "number" && Number.isFinite()`) ไม่ parse string เป็นตัวเลข, `chainComparators(...)` ไล่เทียบ comparator หลายชั้น, `compareByPublishedAtDesc/Asc`, `compareByIdAsc` (ตัวตัดสินสุดท้ายที่ไม่ซ้ำกันเสมอ เพราะ `id` คือ `slug` ที่มี unique constraint)
  2. **`lib/data/research-search.server.ts`**: relevance ผ่าน `normalizeRank()` เสมอ (`relevanceOf()`, exported สำหรับ test), ทุกสาย comparator (ทั้งตอนมี query และตอนเลือก sort option เอง) ต่อด้วย `compareByPublishedAtDesc` แล้วปิดท้ายด้วย `compareByIdAsc` เสมอผ่าน `chainComparators()`
  3. **`lib/search.ts`** (โหมด Mock Data): ใช้ utility ชุดเดียวกัน ปิดท้ายด้วย `compareByIdAsc` เช่นกัน — ตามข้อกำหนด "ใช้ utility เดียวกันในทุก search path"
  4. **`supabase/migrations/20260823100000_search_excerpt_deterministic_order.sql`**: เพิ่ม `ORDER BY research_item_id, is_ocr` ให้ `search_research_document_excerpts()` (RPC ที่เพิ่มตอนแก้ C-1) — **ไม่แก้ไขเงื่อนไขสิทธิ์/RLS ใดๆ ในไฟล์นี้เลย** คัดลอกฟังก์ชันเดิมมาทั้งหมดแล้วเพิ่มแค่ `ORDER BY` ท้ายสุด
  5. **`components/research/ResearchCard.tsx`**: เข้มงวด guard ของ `HighlightedSnippet` จาก `matchStart == null` เฉยๆ เป็น `typeof === "number" && Number.isFinite()` เต็มรูปแบบ — ปิดช่องทางทฤษฎีที่ `matchStart`/`matchEnd` เป็น `NaN` จะทำให้ไฮไลต์ผิดตำแหน่งแบบเงียบๆ (ค่าตัวเลข relevance/rank จริงไม่เคยถูกส่งไปที่ client เลย มีแค่ `matchSource` ซึ่งเป็น string enum และผลลัพธ์ตำแหน่ง snippet ที่คำนวณแล้วเท่านั้น)
- **หลักฐาน**: unit test ใหม่ 39 รายการ (`lib/search/rank.test.ts` 20 รายการ + ส่วนเพิ่มใน `lib/data/research-search.pagination.test.ts` 19 รายการ) ครอบคลุม rank ปกติ/null/undefined/NaN/Infinity/ค่าที่ไม่ใช่ตัวเลข, ผลลัพธ์คะแนน/วันที่เผยแพร่เท่ากัน (พิสูจน์ด้วยการยิง input array ที่สลับลำดับกันแล้วยืนยันผลลัพธ์เหมือนกันทุกประการ), pagination หลายหน้าคงที่ข้าม 3 หน้า, ค้นหาที่ไม่มี full-text result เลย, title/metadata search vs PDF text search — **regression test ของ C-1 ทั้ง 28 รายการยังผ่านครบหลังแก้ไข** (ยืนยันซ้ำหลังทั้งการแก้ TS layer และการเพิ่ม `ORDER BY` ที่ RPC)

### Low / Informational

- **L-1.** 8 ESLint warning (`_prevState`/`_formData` unused) ใน 4 ไฟล์ — เป็น parameter ที่ `useActionState` บังคับให้มี signature ตรงตาม React แม้ไม่ได้ใช้ค่า ไม่ใช่บั๊ก ปลอดภัยที่จะปล่อยไว้
- **L-2.** `console.log()` ธรรมดา (ไม่ใช่ `console.error`) 2 จุด ใน `lib/pdf/process-extraction.server.ts:47` และ `lib/ocr/process-ocr.server.ts:51` — เป็นข้อความสถานะทั่วไป ไม่มีข้อมูลอ่อนไหว แนะนำเปลี่ยนเป็น `console.error`/logger ให้สอดคล้องกับที่อื่นเพื่อความสม่ำเสมอเท่านั้น
- **L-3.** Migration 12 ไฟล์ใช้ `create table` (ไม่มี `if not exists`) และ 13 ไฟล์ใช้ `create policy` (ไม่มี `drop policy if exists` guard) — **ไม่ใช่ปัญหาภายใต้ workflow ที่เอกสารแนะนำ** (`supabase db push`/`migration up` ผ่าน Supabase CLI ซึ่งติดตาม migration ที่ apply แล้วในตาราง `supabase_migrations.schema_migrations` และจะไม่รันไฟล์เดิมซ้ำ) ยืนยันแล้วว่าทั้ง 30 ไฟล์รันสำเร็จเรียงลำดับจากฐานข้อมูลเปล่าผ่าน `supabase db reset` แต่หากมีใครรันไฟล์ SQL ใดไฟล์หนึ่งซ้ำด้วยมือนอกกลไก CLI (เช่น copy-paste ใน SQL Editor) จะพัง — ควรระบุในคู่มือ deploy ว่าห้ามรันไฟล์ migration ด้วยมือนอกจาก `supabase db push`/CLI เท่านั้น
- **L-4 (✅ แก้ไขแล้ว — Phase 5).** ระบบไม่มีการรองรับ Dark Mode เลย — **แก้ไขแล้วในรอบ Hallmark Audit Phase 5 (2026-08-11)** ดูหัวข้อ 0.6 และ `docs/theme-system.md`
- **L-5 (✅ ยกระดับแล้ว — Phase 5).** Accessibility เดิมตรวจแบบผิวเผิน (grep) เท่านั้น — **เปลี่ยนเป็นตรวจอัตโนมัติจริงผ่าน axe-core บนเบราว์เซอร์จริงในรอบ Hallmark Audit Phase 5 (2026-08-11)** ครอบคลุม contrast ratio, accessible name, heading/landmark structure, dialog focus management (22/22 route×theme ผ่าน) ดูหัวข้อ 0.6 และ `docs/accessibility-audit.md` — **ยังไม่ได้ทดสอบ**: screen reader จริง, หน้า Super Admin ที่ต้องผ่าน MFA จริง, mobile touch gesture บนอุปกรณ์จริง (รายละเอียดที่ `docs/accessibility-audit.md` หัวข้อ 5)
- **L-6.** Vercel Cron ที่ตั้งไว้ใน `vercel.json` (`*/5` และ `*/10` นาที) **ใช้งานไม่ได้บนแผน Hobby ฟรี** (จำกัดแค่วันละครั้ง) — README/docs/background-jobs.md ระบุข้อจำกัดนี้ไว้แล้ว แต่ย้ำเป็นรายการตรวจสอบก่อน deploy จริงเพื่อไม่ให้ลืม (ดู `docs/pre-production-checklist.md`)

---

## 3. Security Review — สรุปตามหัวข้อที่ตรวจสอบ

### 3.1 RLS Policies (ตรวจครบทั้ง 30 migration ไฟล์)

ครอบคลุมดี — ทุกตารางที่สร้างมี `enable row level security` เรียกใช้งาน ไม่พบตารางที่ควรมี RLS แต่ไม่มี ตารางที่บรรจุข้อมูลอ่อนไหว (`orcid_oauth_tokens`, `orcid_oauth_states`, `document_access_grants`, `background_jobs`, `job_batches`, `cron_runs`, `rate_limit_events`) ถูกจำกัดสิทธิ์อย่างเข้มงวด ไม่มี grant ให้ anon/authenticated เลยในกรณีที่ไม่ควรมี ไม่พบ policy แบบ `using (true)` บนตารางที่บรรจุข้อมูลอ่อนไหว — ยกเว้น **C-1** ด้านบน ซึ่งเป็นปัญหาเดียวที่พบในการตรวจ RLS รอบนี้ พบ grant/policy mismatch เล็กน้อย (grant DELETE/UPDATE ให้ `authenticated` บนบางตารางโดยไม่มี policy คู่กัน) แต่ RLS ปฏิเสธเป็นค่าเริ่มต้นเมื่อไม่มี policy จึง fail closed ไม่ใช่ช่องโหว่จริง

### 3.2 Authentication / Authorization / Middleware / Server Actions

ตรวจ Server Action ทั้ง 32 ไฟล์ `actions.ts` + `lib/jobs/process-now.action.server.ts` — ไม่พบ action ใดที่ไม่มีการตรวจสอบสิทธิ์เลย ระดับ rank ที่บังคับตรงกับ route guard ใน `middleware.ts` ทุกจุด การตรวจสอบความเป็นเจ้าของ (ownership) มีอยู่ครบในจุดที่ client ส่ง id มาเอง (เช่น `updateSubmissionAction` ตรวจ `submitted_by === user.id`, `changeUserRoleAction`/`toggleUserActiveAction` กันการยกระดับ/ระงับบัญชี super_admin หรือตัวเอง) พบ **H-2** (แก้แล้ว) และ **M-1** (ยังไม่แก้ — ความเสี่ยงต่ำ) ตามที่ระบุด้านบน

### 3.3 Signed URL และ Storage Access Policies

ตรวจ `lib/storage/signed-url.server.ts` ทั้งไฟล์ — ทุกฟังก์ชันตรวจ `accessLevel`/`grant`/`scanStatus` (ปฏิเสธไฟล์ที่ยังไม่ผ่านสแกนความปลอดภัย: `pending`/`infected`/`error`) ก่อนสร้าง Signed URL เสมอ อายุ URL สั้น (อ่าน 30 นาที, ดาวน์โหลด 1 นาที) ตรงตามที่ README ระบุ ไม่พบช่องโหว่ในเส้นทางนี้

### 3.4 MFA / Turnstile / Rate Limiting / Malware Scan

- MFA: `middleware.ts` เรียก `getAuthenticatorAssuranceLevel()` บังคับ step-up (aal2) ก่อนเข้า `/superadmin/*` ทุกเซสชันใหม่ และบังคับตั้งค่า MFA ก่อนใช้งานครั้งแรกสำหรับ super_admin (ยกเว้น `/setup-mfa`, `/mfa-challenge`, `/login` ตามที่ตั้งใจ) — สอดคล้องกับเอกสาร
- Turnstile: ตรวจ token ฝั่งเซิร์ฟเวอร์เสมอผ่าน `verifyCaptchaIfEnabled()` ก่อนสร้างบัญชี/ส่งงานวิจัยใหม่ ไม่เชื่อผลจาก client
- Rate Limit: อิงฐานข้อมูล (`rate_limit_events`), ไม่มี policy ให้ anon/authenticated เข้าถึงตารางนี้โดยตรง (ต้องผ่านฟังก์ชันเท่านั้น) — ถูกต้อง
- Malware Scan: `lib/security/validate-upload.server.ts` ดาวน์โหลดไฟล์กลับมาตรวจ magic-byte + สแกนก่อน insert/update แถวเสมอ (ยกเว้นไฟล์ PDF หลักที่ย้ายเป็น background job ตั้งแต่ช่วงที่ 20 — มี trigger ฐานข้อมูลบล็อกการเผยแพร่ไฟล์ที่ยังไม่ผ่าน/ติดความเสี่ยงเป็นด่านสำรอง) ไม่พบช่องโหว่

### 3.5 การเข้าถึงไฟล์ private/ข้อมูลคำขอของผู้อื่น

ตรวจผ่าน RLS audit (3.1) และ Server Action audit (3.2) แล้ว — `access_requests`/`document_access_grants` จำกัดเฉพาะเจ้าของคำขอ + staff (rank ≥ 30) เท่านั้น ไม่พบช่องทางให้ผู้ใช้อื่นเห็นคำขอ/สิทธิ์ของคนอื่น ไฟล์ private (`research-documents`, `submission-attachments`) เข้าถึงได้ผ่าน Signed URL ที่ตรวจสิทธิ์ก่อนเสมอเท่านั้น (3.3) — **ข้อยกเว้นเดียวคือ C-1** ซึ่งเป็นช่องทางอ้อมผ่านตาราง full-text ไม่ใช่ผ่าน Storage โดยตรง

### 3.6 Environment Variables / .env.example

ตรวจครบ — ไม่พบ secret จริงใน `.env.example` (ทุกค่าว่างเปล่า มีแต่คอมเมนต์อธิบาย) ไม่พบ hardcoded secret ในซอร์สโค้ดทั้งหมด (ทุกค่าอ่านจาก `process.env`) — README เดิม (จากรอบตรวจสอบ/อัปเดตก่อนหน้า) มีตาราง environment variable ครบทุกตัวที่พบใน `.env.example` แล้ว

---

## 4. ปัญหาที่ยังต้องตัดสินใจ

> C-1 และ M-4 ("M-1 ระบบค้นหา") แก้ไขแล้วพร้อมหลักฐาน/regression test อัตโนมัติ ยืนยันซ้ำไม่ regress ในรอบ Final QA (ดูหัวข้อ 0/2) — ไม่อยู่ในรายการนี้อีกต่อไป

1. **M-1 เดิม** (บาง superadmin action ไม่ใช้ `requireMinRank`) — ความเสี่ยงต่ำ แต่ควรตัดสินใจว่าจะรีแฟกเตอร์ให้สอดคล้องกันในรอบถัดไปหรือไม่ ไม่บล็อก launch
2. ~~**Dark Mode**~~ — **แก้ไขแล้วในรอบ Hallmark Audit Phase 5 (ดูหัวข้อ 0.6)** ไม่อยู่ในรายการตัดสินใจอีกต่อไป
3. **E2E test ผ่านเบราว์เซอร์จริง (Playwright)** — integration test ของ C-1/M-4 ทดสอบที่ชั้น Postgres/PostgREST/pure-logic โดยตรง (ชั้นที่ปัญหาเกิดขึ้นจริงทั้งคู่) ตอนนี้มี Playwright จริงแล้วสำหรับ accessibility (`e2e/accessibility.spec.ts`, ดูหัวข้อ 0.6) แต่ยังไม่ใช่ golden-path E2E ครบ flow (ค้นหา→เปิด→ดาวน์โหลด ฯลฯ) — ทีมควรตัดสินใจว่าจะลงทุนเพิ่มก่อนหรือหลัง launch รอบแรก ไม่บล็อก launch (มี manual test plan ทดแทนใน `docs/qa-test-plan.md`)

> **Next.js major version upgrade (ปิดช่องโหว่ postcss/sharp ที่เหลือใน M-3) — ตามคำสั่งชัดเจนของรอบตรวจสอบนี้ ไม่แนะนำให้ทำในรอบ pre-production นี้โดยเด็ดขาด** บันทึกไว้เป็น**งานหลังเปิดใช้งานรุ่นแรก (post-launch backlog) เท่านั้น** — มีความเสี่ยง breaking change สูง (Next.js 15 → 16) ต้องมีรอบทดสอบแยกต่างหากที่ไม่ผูกกับ release นี้ ดูหัวข้อ 5

---

## 5. ความเสี่ยงก่อนขึ้น Production

| ความเสี่ยง | ระดับ | รายละเอียด |
| --- | --- | --- |
| ~~C-1~~ | ~~สูงมาก~~ **แก้ไขแล้ว ยืนยันไม่ regress** | ปิดช่องโหว่แล้วด้วย migration `20260822100000_restrict_document_text_exposure.sql` + regression test อัตโนมัติ 28 รายการ ผ่านซ้ำ 28/28 ในรอบ Final QA (ดูหัวข้อ 0/2) |
| ~~M-4 ("M-1 ระบบค้นหา")~~ | ~~กลาง~~ **แก้ไขแล้ว ยืนยันไม่ regress** | rank normalization + deterministic tiebreak ผ่าน regression test 39 รายการ ผ่านซ้ำ 39/39 ในรอบ Final QA (ดูหัวข้อ 0/2) |
| Dependency (postcss/sharp ใน next) | กลาง | **จงใจไม่แก้ในรอบนี้ตามคำสั่ง** — ต้องอัปเกรด Next.js major version (15→16) จึงปิดได้ครบ ระหว่างนี้ความเสี่ยงจำกัดอยู่ที่การประมวลผลรูปภาพ/CSS build-time ไม่ใช่ runtime request จากผู้ใช้ทั่วไปโดยตรง **บันทึกเป็นงานหลังเปิดใช้งานรุ่นแรกเท่านั้น ห้ามทำติดกับรอบนี้** |
| ยังไม่มี golden-path E2E ผ่านเบราว์เซอร์จริง | กลาง | มี unit test (67) + integration test ต่อ Postgres/Auth จริง (28) + Playwright accessibility suite ใหม่ (22, ดูหัวข้อ 0.6) รวม 117 รายการแล้ว — ยังไม่มี Playwright ทดสอบ golden path เชิงฟีเจอร์ (ค้นหา→เปิด→ดาวน์โหลด) ผ่าน UI จริงทั้ง flow — ดู `docs/qa-test-plan.md` สำหรับ manual test ที่ต้องทำก่อน launch |
| Vercel Cron บนแผน Hobby | ต่ำ-กลาง | ถ้าใช้แผนฟรี งาน background job/health-check watchdog จะไม่ทำงานอัตโนมัติตามความถี่ที่ตั้งไว้ ต้องอัปเกรดแผนหรือใช้ external cron |
| Repository ยังไม่ใช่ Git repo | ต่ำ | ไม่มีการควบคุมเวอร์ชัน — ควร `git init` และ push ก่อน deploy ตามที่ README ระบุไว้แล้ว |
| หน้า Super Admin ที่ต้องผ่าน MFA ยังไม่ผ่าน accessibility test อัตโนมัติ | ต่ำ-กลาง | ต้องใช้ TOTP ที่เปลี่ยนทุก 30 วินาที อัตโนมัติผ่านไม่ได้ในสภาพแวดล้อมนี้ — ตรวจแบบ code review แทน (ใช้ token system เดียวกับหน้าที่ทดสอบผ่านแล้วจริง) แนะนำทดสอบด้วยมือผ่าน MFA จริงอย่างน้อยหนึ่งรอบก่อนเปิดใช้งานสาธารณะ (ดู `docs/accessibility-audit.md` หัวข้อ 5) |

---

## 6. รายการที่ต้องตั้งค่าเองใน Supabase/Vercel

ดูรายการเต็มที่ `docs/pre-production-checklist.md` — สรุปสั้น:

- Environment Variables ทั้งหมดตามตารางใน README.md หัวข้อ "Deploy บน Vercel" (โดยเฉพาะ `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY` ต้องเป็น server-only เสมอ)
- เปิด TOTP MFA ที่ Supabase Dashboard > Authentication > Providers (ไม่เปิดอัตโนมัติสำหรับ Cloud project)
- ตั้งค่า Auth Redirect URLs ให้ชี้โดเมนจริง
- ตั้งค่า Vercel Cron (หรือ external cron หากใช้แผน Hobby) สำหรับ `/api/jobs/process` และ `/api/cron/health-check`
- ตัดสินใจว่าจะรัน `supabase/seed.sql` กับฐานข้อมูล production หรือไม่ (เป็นข้อมูลตัวอย่าง/สาธิตเท่านั้น ไม่ใช่ reference data ที่จำเป็น — ต่างจาก `20260731100300_seed_reference_data.sql` ที่ต้องรันเสมอเพราะเป็นส่วนหนึ่งของ migrations)

---

## 7. คำตัดสิน

## **Ready with Conditions**

ระบบมีคุณภาพโค้ดดี (lint/typecheck/build/test สะอาดทั้งหมด — 95/95 test), สถาปัตยกรรมสิทธิ์การเข้าถึงที่ออกแบบมาอย่างรอบคอบ (RLS + rank + ownership check ซ้อนหลายชั้นสม่ำเสมอ), และมี defense-in-depth ที่จับได้ไม่บ่อยนักในโปรเจกต์ขนาดนี้ (MFA step-up, CAPTCHA server-side verify, malware scan, safe error messages เกือบทั้งหมด)

**สรุปรอบ Final Regression QA:** ทั้ง C-1 (Critical) และ M-4/"M-1 ระบบค้นหา" (Medium) ยืนยันแล้วว่าแก้ไขสมบูรณ์และ**ไม่ regress** ผ่าน automated regression test ที่ต่อฐานข้อมูลจริงซ้ำอีกครั้งในรอบนี้ (67 unit + 28 integration = 95 test ทั้งหมดผ่าน) พร้อมหลักฐานใหม่เพิ่มเติมที่ไม่เคยทดสอบมาก่อน (access grant ที่หมดอายุถูกปฏิเสธถูกต้องจริงผ่าน session ผู้ใช้จริง, RLS ของตารางอ่อนไหวอื่นๆ ยังเปิดใช้งานครบ, ไฟล์ความปลอดภัยหลักไม่ถูกแตะต้องระหว่างการแก้ไข) **ไม่พบปัญหาใหม่ระดับ Critical หรือ High ในรอบตรวจสอบนี้เลย ไม่มี Critical/High ใดค้างอยู่**

ปัญหาที่เหลือทั้งหมด (M-1 เดิม/M-2/M-3/Dark Mode/ไม่มี E2E) เป็นระดับ **Medium ลงมาเท่านั้น ไม่บล็อกการขึ้น production** — **การอัปเกรด Next.js major version (M-3) ถูกจัดเป็นงานหลังเปิดใช้งานรุ่นแรกโดยเจตนา ไม่ใช่เงื่อนไขก่อน launch ตามที่ระบุไว้ในรอบตรวจสอบนี้**

**เงื่อนไขก่อนขึ้น production** (เป็นงานปฏิบัติการมาตรฐาน ไม่ใช่ข้อบกพร่องที่ค้างอยู่):
1. ทำตาม `docs/pre-production-checklist.md` ให้ครบทุกข้อ (ตั้งค่า Environment Variables, เปิด TOTP MFA ใน Supabase Dashboard, ตั้งค่า Auth Redirect URLs, ตั้งค่า Cron/CRON_SECRET, ตัดสินใจเรื่อง `seed.sql`, `git init`)
2. รัน manual test case ที่เหลือใน `docs/qa-test-plan.md` ที่ automated test ยังไม่ครอบคลุม (โดยเฉพาะ golden path ผ่าน UI จริงทั้ง flow เนื่องจากยังไม่มี Playwright E2E — automated test ที่มีครอบคลุมชั้น RLS/ตรรกะหลักแล้วแต่ไม่ใช่ผ่านเบราว์เซอร์จริง)

**หลังเปิดใช้งานรุ่นแรกแล้ว (post-launch backlog — ไม่บล็อก launch นี้):**
- แผนอัปเกรด Next.js major version (M-3) เพื่อปิดช่องโหว่ dependency ที่เหลือ
- ตัดสินใจเรื่อง M-1 เดิม (บาง superadmin action ไม่ใช้ `requireMinRank`) และ M-2 (error message ไม่สม่ำเสมอในบางไฟล์)
- ลงทุนเพิ่ม Playwright E2E สำหรับ golden path เชิงฟีเจอร์ผ่าน UI จริง (ต่อยอดจาก accessibility suite ที่มีแล้ว)
- ทดสอบหน้า Super Admin ที่ต้องผ่าน MFA จริงด้วยมืออย่างน้อยหนึ่งรอบ (accessibility, ดูหัวข้อ 0.6) และทดสอบ screen reader จริง
