# Performance Audit — `/research` (Production JavaScript)

**วันที่ตรวจสอบ:** 2026-08-13 (audit ครั้งแรก) — **อัปเดต 2026-08-13: ลงมือทำ item #3 ("ตัด legacy JS polyfill") จริงแล้ว พบว่าทำไม่ได้ในขอบเขตนี้ — ดูหัวข้อ 4.1**
**ประเภท:** Audit only ในรอบแรก — รอบอัปเดตนี้ลงมือทำ**เฉพาะ** legacy JS/polyfill reduction ตามที่ระบุไว้ในหัวข้อ 4.1 เท่านั้น (ทดลองแล้วย้อนกลับ ไม่มีการเปลี่ยนแปลงหลงเหลืออยู่จริง) — ไม่แตะ Supabase/auth/logout/session/Realtime/RLS/caching/UI layout/CSS delivery/deployment/production settings ใดๆ ทั้งสิ้น
**ขอบเขต:** เฉพาะ JavaScript performance ของ route `/research` (หน้าค้นหา/รายการงานวิจัย) เท่านั้น — ไม่ใช่ `/research/[id]` (รายละเอียด) หรือ `/research/[id]/read` (อ่าน PDF)

---

## 0. ยืนยันก่อน: `localhost:3001` รันโหมดไหน — และทำไมถึงสำคัญมาก

**ข้อสรุป: ตัวเลข Lighthouse ที่ให้มา (FCP 2.4s, LCP 3.3s, TBT 9,090ms, CLS 0.013, SI 5.4s) วัดจาก `next dev` (development server) ไม่ใช่ production build** — และความต่างนี้อธิบายปัญหาเกือบทั้งหมดที่รายงานมา

### หลักฐานว่า port 3001 รัน `next dev` ในขณะที่ได้รับตัวเลขเหล่านี้

ตรวจสอบ ณ เวลาที่ทำ audit นี้ (ก่อนสลับไป build production เพื่อเปรียบเทียบ):

1. `dev-server.log` แสดง banner คำสั่งที่รันจริง: `> next dev -p 3001`
2. Log มีข้อความ `○ Compiling /middleware ...`, `○ Compiling /_not-found ...` — **เป็นไปได้เฉพาะใน dev mode เท่านั้น** production build compile ทุกอย่างไว้ล่วงหน้าตอน `next build` ไม่มีการ compile ระหว่าง request
3. HTTP response header: `Cache-Control: no-store, must-revalidate` — ค่าเริ่มต้นของ dev mode
4. HTML ที่ตอบกลับมีคำว่า `next-devtools` ปรากฏอยู่ (dev-only feature)
5. Static asset URL มี query string cache-busting แบบ `?v=<timestamp>` (เช่น `/_next/static/chunks/main-app.js?v=1786611034087`) — เป็นกลไก HMR ของ dev mode เท่านั้น production build ไม่มี query string แบบนี้

### พิสูจน์เชิงประจักษ์ — รัน Lighthouse จริงทั้งสองโหมดเทียบกัน

| Metric | รายงานที่ให้มา | **Dev mode (วัดซ้ำจริง, warmed)** | **Production build (วัดซ้ำจริง)** |
| --- | --- | --- | --- |
| Performance score | — | **45** | **93** |
| FCP | 2.4 s | 1.5 s | 1.4 s |
| LCP | 3.3 s | **8.4 s** | 3.0 s |
| **TBT** | **9,090 ms** | **7,130 ms** | **120 ms** |
| CLS | 0.013 | 0 | 0 |
| Speed Index | 5.4 s | 2.2 s | 2.7 s |

**TBT ต่างกัน 75 เท่า** ระหว่าง production (120ms) กับ dev mode (7,130ms) — ตัวเลขที่รายงานมา (9,090ms) อยู่ในระดับเดียวกับ dev mode ที่วัดซ้ำได้จริง (ความต่างเล็กน้อยเป็นเรื่องปกติ ขึ้นกับสถานะการ compile/load ของเครื่องขณะนั้น)

### สาเหตุทางเทคนิคที่ชัดเจน — bootup-time breakdown ของ dev mode

```
http://localhost:3001/_next/static/chunks/main-app.js  | 6,058 ms  <- ตัวการหลัก
http://localhost:3001/research                          | 1,691 ms
webpack-internal:.../scheduler.development.js           | 1,656 ms
http://localhost:3001/_next/static/chunks/app/layout.js |   649 ms
```

`main-app.js` ของ dev mode ใช้เวลา main thread **6 วินาทีเต็ม** — เพราะ dev mode ห่อทุกโมดูลด้วย `eval()` (เพื่อ source map แบบเรียลไทม์สำหรับ HMR), ส่ง React แบบ unminified พร้อม development warnings/checks เต็มรูปแบบ, และรวม HMR client + React DevTools bridge เข้าไปด้วย — ทั้งหมดนี้ไม่มีอยู่ใน production build เลย เป็นพฤติกรรมปกติของ Next.js dev server ไม่ใช่บั๊กของแอป

**นอกจากนี้**: การ compile ครั้งแรกของ route `/research` ใน dev mode (ก่อน warm) ใช้เวลาถึง **25 วินาที** ก่อนตอบ response แรก — ถ้า Lighthouse ยิงระหว่างที่ route ยังไม่เคย compile มาก่อน อาจอธิบายตัวเลข LCP/TBT ที่สูงกว่านี้อีกได้ (LCP ที่วัดได้ตอน dev mode warmed แล้วคือ 8.4s ซึ่งสูงกว่าตัวเลขที่รายงานมาด้วยซ้ำ — เป็นไปได้ว่าตัวเลขที่รายงานมาวัดตอนที่ route ถูก compile ไปแล้วบางส่วนจากการเข้าใช้งานก่อนหน้า)

**สรุป**: ตัวเลขที่ให้มาไม่ได้สะท้อนประสบการณ์ผู้ใช้จริงใน production เลย เพราะไม่มีใครเข้าเว็บผ่าน `next dev` จริง — **แต่**ยังพบปัญหาจริงเล็กน้อยที่ยังอยู่แม้ใน production build (ดูหัวข้อ 1-6 ด้านล่าง) ซึ่งควรแก้ไขแม้จะไม่ใช่ต้นเหตุของตัวเลข 9 วินาทีที่รายงานมา

---

## 1. Initial JavaScript chunks ที่ route นี้โหลด

จาก production build (`npm run build`, สด ณ วันที่ตรวจสอบ):

```
Route (app)                Size      First Load JS
├ ƒ /research               9.1 kB    120 kB
+ First Load JS shared by all         102 kB
  ├ chunks/1255-cf02c4775860a5ab.js   46 kB
  ├ chunks/4bd1b696-100b9d70ed4e49c1.js  54.2 kB
  └ other shared chunks (total)      2.11 kB
```

| Chunk | ขนาด | หน้าที่ (ยืนยันจากเนื้อหาจริงที่ serve) |
| --- | --- | --- |
| `1255-cf02c4775860a5ab.js` | 46 kB | Shared vendor chunk (ทุก route) — มี legacy-JS polyfill signatures ปน (ดูหัวข้อ 4) |
| `4bd1b696-100b9d70ed4e49c1.js` | 54.2 kB | Shared vendor chunk (ทุก route) — น่าจะเป็น React/Next.js runtime core |
| `4905-543b6c2c53c46a40.js` | 46.98 kB (44 kB ไม่ได้ใช้) | **`@supabase/supabase-js` Realtime client** — ยืนยันด้วยการ grep เนื้อไฟล์จริงพบ string `RealtimeClient`/`realtime-js` — ดูหัวข้อ 3 |
| `app/research/page.js` (ส่วนหนึ่งของ 9.1 kB) | — | โค้ดเฉพาะ route: `ResearchExplorer`, `FilterBar`, `ResearchGrid`, `ResearchCard` |

**120 kB First Load JS ถือว่าเล็กและอยู่ในเกณฑ์ดีมาก** สำหรับ Next.js App Router (เทียบกับ `/superadmin/overview` ที่ 233 kB First Load JS ในโปรเจกต์เดียวกัน ซึ่งมี recharts) — **ไม่พบหลักฐานว่า route นี้มี bundle bloat จากโค้ดของ route เอง**

---

## 2. ทำไม TBT ถึงสูง — รายละเอียด

**ใน production build จริง TBT = 120ms เท่านั้น ไม่ใช่ 9,090ms** (ดูหัวข้อ 0) — คำถามนี้จึงตอบได้ตรงๆ ว่า **TBT 9 วินาทีเป็นผลจาก dev mode ไม่ใช่โค้ดของแอป**

รายละเอียด long tasks ที่วัดได้จริงใน **production**:

```
long task 1: start 823ms,  duration 287ms
long task 2: start 2737ms, duration 143ms
long task 3: start 2880ms, duration 77ms
```

รวม 3 long tasks, ยาวสุด 287ms — ต่ำกว่าเกณฑ์ที่น่ากังวล (Lighthouse ถือว่า >50ms คือ "blocking" แต่ 3 tasks รวมกันไม่ถึง 510ms) ไม่มี "expensive hydration" หรือ "forced reflow" ที่ผิดปกติ — mainthread-work-breakdown แสดง **Style & Layout 644ms** เป็นตัวใหญ่ที่สุด (มากกว่า Script Evaluation 438ms) ซึ่งสอดคล้องกับ LCP element เป็นข้อความธรรมดาที่ต้องรอ CSS/layout เสถียรก่อนจึง paint ได้ (ดูหัวข้อ 6)

**Client component ที่เกี่ยวข้องกับ route นี้**: `ResearchExplorer` (`"use client"`) และ `FilterBar` (`"use client"`) — ทั้งสองเป็น component เล็ก ไม่มี state ซับซ้อน ไม่มี useEffect ที่หนัก ไม่พบสาเหตุของ TBT จากโค้ดเหล่านี้เอง

---

## 3. รายการที่อาจรวมมาโดยไม่จำเป็น

ตรวจสอบด้วยการอ่าน import chain จริงของทุกไฟล์ใน `app/research/page.tsx` → `ResearchExplorer` → `FilterBar`/`ResearchGrid` → `ResearchCard` → `AccessBadge`/`CategoryCover` ทั้งหมด และ grep หา library signature ในไฟล์ JS ที่ serve จริง:

| รายการ | พบหรือไม่ | หลักฐาน |
| --- | --- | --- |
| PDF viewer / flipbook (`react-pageflip`, `react-pdf`) | ❌ ไม่พบ | `grep -rl "FlipbookViewer\|react-pageflip\|react-pdf"` ใน `components/research` และ `app/research` เจอเฉพาะ `FlipbookViewer.tsx`/`FlipbookViewerLoader.tsx`/`app/research/[id]/read/page.tsx` — ไม่มีไฟล์ใดใน chain ของ `/research` (list page) import ไฟล์เหล่านี้เลย |
| Charts (`recharts`) | ❌ ไม่พบ | grep เดียวกันไม่พบ `recharts` ใน chain ของ route นี้ — recharts ถูกจำกัดอยู่ที่ `/superadmin/overview` เท่านั้น (233 kB First Load JS ของหน้านั้น vs 120 kB ของ `/research` ยืนยันการแยกจริง) |
| Rich-text editor | ❌ ไม่พบ | ไม่มีการใช้ rich-text editor ใน component ใดของ route นี้ |
| OCR/PDF processing utilities | ❌ ไม่พบ | `lib/ocr/*`, `lib/pdf/*` เป็น `*.server.ts` (server-only) ไม่ถูก import โดย client component ใน chain นี้เลย |
| Admin/superadmin code | ❌ ไม่พบ | ไม่มี import จาก `app/dashboard/*`/`app/superadmin/*` ใน chain ของ route นี้ |
| **Supabase Realtime** | ✅ **พบ — แต่เป็นปัญหาระดับแอปทั้งหมด ไม่ใช่เฉพาะ route นี้** | chunk `4905-543b6c2c53c46a40.js` (46.98 kB, ใช้จริงแค่ 6%) มี `RealtimeClient`/`realtime-js` — **โหลดบนทั้งหน้าแรกและ `/research` เหมือนกันทุกประการ** (ยืนยันด้วยการเทียบ Lighthouse report ของทั้งสองหน้า, content hash ของ chunk ตรงกัน) ดูรายละเอียดสาเหตุด้านล่าง |
| Large icon libraries | ⚠️ ใช้ `lucide-react` แบบ named import เท่านั้น (`import { Search, ... } from "lucide-react"`) — เป็นรูปแบบที่ tree-shake ได้ ไม่พบหลักฐานว่า bundle รวมไอคอนที่ไม่ได้ใช้ (First Load JS 120 kB รวมทุกอย่างแล้วยังเล็ก) — ไม่ยืนยัน 100% เพราะไม่ได้รัน bundle analyzer เจาะจงไอคอน แต่ไม่มีสัญญาณของปัญหา |
| All research rows loaded into browser | ❌ ไม่พบ | `app/research/page.tsx` เรียก `searchResearchServer({ ..., page, sort })` ซึ่งแบ่งหน้า (pagination) ที่ฐานข้อมูล/เซิร์ฟเวอร์แล้วส่งเฉพาะหน้าปัจจุบันมาให้ `ResearchExplorer` — ไม่ได้ดึงทุกแถวมาไว้ฝั่ง client เลย |

### สาเหตุที่แท้จริงของ Supabase Realtime chunk

`@supabase/supabase-js` (เวอร์ชันที่ใช้ในโปรเจกต์นี้) มีพฤติกรรมที่รู้จักกันดี: class `SupabaseClient` **สร้าง instance ของ `RealtimeClient` เสมอในตัว constructor** ไม่ว่าแอปจะใช้ฟีเจอร์ real-time subscription หรือไม่ก็ตาม — ไม่ใช่โมดูลที่ tree-shake แยกออกได้ด้วยการไม่เรียกใช้

`lib/supabase/client.ts` (browser-side Supabase client factory) ถูก import โดย 4 ไฟล์:
```
components/account/MfaSettings.tsx
components/auth/IdleLogout.tsx
components/auth/LogoutButton.tsx
components/auth/MfaChallengeForm.tsx
components/auth/SetupMfaForm.tsx
```

`IdleLogout`/`LogoutButton` เป็นส่วนหนึ่งของ **"authenticated account area"** ที่ render ผ่าน `HeaderAccountArea`/`IdleLogoutGate` ใน `app/layout.tsx` (root layout — ครอบทุก route ทั้งเว็บ, ดู `docs/homepage-rendering-performance.md`) — เป็นสาเหตุที่น่าจะเป็นไปได้มากที่สุดว่าทำไม chunk นี้จึงโหลดทุกหน้ารวมถึง `/research` แม้ Lighthouse จะทดสอบในฐานะ guest ก็ตาม (ต้องใช้ bundle analyzer เจาะลึกกว่านี้เพื่อยืนยัน chunk-splitting graph แบบเป๊ะๆ — บันทึกไว้เป็นข้อจำกัดของการตรวจสอบนี้)

**นี่ไม่ใช่ปัญหาเฉพาะ `/research`** — เป็นปัญหาระดับ root layout ที่กระทบทุกหน้าเท่ากัน

---

## 4. Unused JavaScript และ Unused CSS (production build, เฉพาะ route นี้)

### Unused JavaScript
| Chunk | ขนาดรวม | ไม่ได้ใช้ | % |
| --- | --- | --- | --- |
| `4905-543b6c2c53c46a40.js` (Supabase Realtime) | 46,982 bytes | **44,056 bytes** | **94%** |

ไม่พบ unused JS อื่นนอกจากรายการนี้ — ยืนยันว่าโค้ดเฉพาะของ route (`page.js` ของ `/research`) ถูกใช้เกือบทั้งหมด ไม่มี dead code จากตัว route เอง

### Legacy JavaScript (polyfill ที่ไม่จำเป็นสำหรับ browser สมัยใหม่)
พบใน shared chunk `1255-cf02c4775860a5ab.js` — **11 KiB** ที่เป็น polyfill/transform สำหรับ:
`Array.prototype.at`, `Array.prototype.flat`, `Array.prototype.flatMap`, `Object.fromEntries`, `Object.hasOwn` — ฟีเจอร์เหล่านี้รองรับใน evergreen browser ทุกตัวมาหลายปีแล้ว เป็นสัญญาณว่า build target (`browserslist`/`.browserslistrc`/`next.config.ts` compiler target) อาจตั้งไว้กว้างเกินความจำเป็น — **เป็นปัญหาระดับแอปทั้งหมด ไม่ใช่เฉพาะ `/research`**

> **⚠️ อัปเดต 2026-08-13 หลังลงมือตรวจสอบจริง (ดูหัวข้อ 4.1): ข้อสันนิษฐานข้างต้นผิด** — ไม่ใช่ปัญหาจาก build target ของโปรเจกต์ที่แก้ได้ด้วย `browserslist` แต่เป็นโค้ดภายในของ Next.js framework เองที่ผูกมาแบบ hard-code ไม่มีเงื่อนไขใดๆ ให้ปรับได้จากฝั่งโปรเจกต์เลย — ดูรายละเอียดเต็มด้านล่าง

### 4.1 ผลการลงมือแก้ไขจริง — Legacy JS/Polyfill reduction (สรุป: **ทำไม่ได้ในขอบเขตนี้**)

**สิ่งที่ทำ**: เพิ่ม `.browserslistrc` กำหนด policy ใหม่แบบมีเอกสารกำกับชัดเจน (evergreen browsers ตั้งแต่ ~2021 ขึ้นไป: `chrome >= 93`, `edge >= 93`, `firefox >= 92`, `safari >= 15.4` — ครอบคลุมทั้ง 5 ฟีเจอร์ที่ถูก polyfill พอดี) เทียบกับ **policy เดิม (โดยนัย ไม่เคยมีการตั้งค่าเลย)** ซึ่งทำให้ Next.js ใช้ค่า default ของตัวเอง (`chrome 64, edge 79, firefox 67, opera 51, safari 12` — ตามเอกสารทางการของ Next.js ที่ [nextjs.org/docs/architecture/supported-browsers](https://nextjs.org/docs/architecture/supported-browsers) เนื่องจากไม่พบ `browserslist` field ใน `package.json` หรือไฟล์ `.browserslistrc` ใดๆ ในโปรเจกต์ก่อนหน้านี้)

**ผลลัพธ์หลังสร้าง production build ใหม่**: **ไม่มีการเปลี่ยนแปลงใดๆ เลย** — chunk `1255-cf02c4775860a5ab.js` ได้ content hash เดิมทุกตัวอักษร และ `legacy-javascript-insight` ยังคงรายงาน wasted bytes เท่าเดิมเป๊ะ (11,721 bytes) ก่อน/หลังไม่ต่างกันแม้แต่ byte เดียว

**สาเหตุที่แท้จริง (สืบจนถึงต้นตอ)**: ดึงเนื้อไฟล์ chunk จริงมาดู พบว่า polyfill เหล่านี้เขียนแบบ **runtime feature-detection** (`Array.prototype.flat||(Array.prototype.flat=function(...){...})`) ไม่ใช่ syntax ที่ SWC down-level ตาม browserslist target ตอน build — ตามด้วยการ grep หา signature นี้ทั่ว `node_modules` พบว่าตรงกับไฟล์เดียวเท่านั้นคือ `node_modules/next/dist/build/polyfills/polyfill-module.js` **ซึ่งเป็นไฟล์ของ Next.js framework เอง ไม่ใช่โค้ดของโปรเจกต์นี้**

ตามรอยต่อไปพบว่าไฟล์นี้ถูกเรียกจาก `node_modules/next/dist/client/app-globals.js` (entry point ของ Next.js App Router client runtime) ด้วยบรรทัด:
```js
require("../build/polyfills/polyfill-module");
```
**ไม่มีเงื่อนไขใดๆ ทั้งสิ้น — ไม่ผูกกับ browserslist, ไม่มี feature detection ระดับ build, ไม่ gate ด้วย `nomodule`** (ตรวจสอบ HTML ที่ตอบกลับจริงยืนยันว่า chunk `1255-*.js` โหลดผ่าน `<script src="..." async>` ธรรมดา — ต่างจาก `polyfills-*.js` ตัวจริงของ Next.js ที่โหลดผ่าน `<script nomodule>` ถูกต้องอยู่แล้วและ modern browser จะข้ามไปเลยไม่โหลดด้วยซ้ำ) `app-globals.js` เป็นส่วนหนึ่งของ client bootstrap ที่ Next.js ผูกไว้กับทุก route ที่ใช้ App Router โดยไม่มีทางเลือกให้ปิดจากฝั่งโปรเจกต์

**ตรวจสอบเพิ่มเติมเพื่อความชัวร์**: grep หาการใช้ `flat()`/`flatMap()`/`Object.fromEntries`/`Object.hasOwn`/`.at()` ในโค้ดของโปรเจกต์เอง (`app/`, `components/`, `lib/`) พบใน 4 ไฟล์ (`SuperAdminSidebar.tsx`, `lib/cron/monitor.server.ts`, `lib/data/superadmin-stats.server.ts`, `lib/security/mfa-admin.server.ts`) — **ไม่มีไฟล์ใดอยู่ใน import chain ของ `/research`เลย** (เป็น superadmin-only หรือ server-only ทั้งหมด) จึงยืนยันว่าแม้จะปรับ browserslist สำเร็จ ก็จะไม่มีผลต่อ bundle ของ `/research` อยู่ดี เพราะจุดเดียวที่ธงขึ้นคือโค้ดของ framework เอง

**การตัดสินใจ**: **ย้อนกลับ (revert) การเพิ่ม `.browserslistrc` ทิ้งทั้งหมด** เพราะ:
1. ไม่ได้ผลลัพธ์ตามเป้าหมายที่ระบุไว้เลย (วัดจริง 0% ลดลง)
2. การเปลี่ยน `browserslist` มีผลข้างเคียงต่อ CSS output ของ Tailwind/Autoprefixer ด้วย (เพราะ tool ทั้งสองอ่านค่า `browserslist` ร่วมกัน) — เมื่อไม่มีผลดีทาง JS มาชดเชย การรับความเสี่ยง (แม้เล็กน้อย) ต่อ CSS output จึงไม่คุ้มและเกินขอบเขตที่ระบุไว้ว่าห้ามแตะ "CSS delivery"
3. ทางเดียวที่จะลด 11 KB นี้ได้จริงคือ patch `node_modules/next` โดยตรง (เปราะบางมาก พังทุกครั้งที่ `npm install`) หรือเปลี่ยนเวอร์ชัน Next.js (นอกขอบเขตที่กำหนดไว้ชัดเจนในรายงานฉบับก่อนหน้าและงานนี้)

**ยืนยันการ revert สมบูรณ์**: ลบ `.browserslistrc`, `rm -rf .next && npm run build` ใหม่ → chunk `1255-cf02c4775860a5ab.js` กลับมามี content hash เดิมทุกตัวอักษร (ตรงกับ build ก่อนแก้ไขเป๊ะ) `git status` ยืนยันไม่มีไฟล์ค้างจากการทดลองนี้เลย

**ตาราง Lighthouse ก่อน/หลัง (production build, route `/research`)** — ตามที่งานนี้กำหนดให้วัดเทียบก่อน/หลังเสมอแม้ผลจะเป็นลบ:

| Metric | ก่อน (baseline เดิม) | หลัง (มี `.browserslistrc`, ก่อน revert) |
| --- | --- | --- |
| Performance score | 93 | 93 |
| FCP | 1.4 s | 1.4 s |
| LCP | 3.0 s | 3.0 s |
| TBT | 120 ms | 130 ms |
| CLS | 0 | 0 |
| Speed Index | 2.7 s | 1.5 s |
| `legacy-javascript-insight` wasted bytes | 11,721 bytes | 11,721 bytes (**เท่าเดิมเป๊ะ**) |

ความต่างเล็กน้อยของ TBT (120→130ms) และ Speed Index (2.7s→1.5s) อยู่ในช่วง run-to-run noise ปกติของ Lighthouse (JS bundle ที่ serve จริงเหมือนกันทุก byte ระหว่างสองรอบนี้ — ไม่ใช่ผลจากการเปลี่ยนแปลงใดๆ) — **สรุป: ไม่มีการเปลี่ยนแปลงที่มีนัยสำคัญทางสถิติเลยในทุก metric**

### 4.2 ผลการรัน lint/TypeScript/unit test/a11y test/build (บน state สุดท้ายหลัง revert)

| คำสั่ง | ผลลัพธ์ |
| --- | --- |
| `npm run lint` | ✅ ผ่าน — 0 error, 8 warning เดิม (ไม่เกี่ยวข้อง, คงเดิมทุกรอบของเซสชันนี้) |
| `npx tsc --noEmit` | ✅ ผ่าน — 0 error |
| `npm run test` (Vitest) | ✅ ผ่าน — **127/127** |
| `npm run build` (production) | ✅ ผ่าน — สร้างครบทุก route, chunk hash ตรงกับ baseline เดิมทุกตัวอักษร |
| `npm run test:a11y` (Playwright, 50 tests) | ⚠️ **48-49/50 ผ่าน จาก 3 รอบที่รันหลังการทดลองนี้** — ดูรายละเอียดด้านล่าง |

**รายละเอียดผล `test:a11y`**: รันเต็มชุด (50 test) ซ้ำ 3 ครั้งหลังลงมือทำงานนี้ (รวมครั้งที่รันบน dev server ที่เพิ่ง `dev:clean` ใหม่สะอาดด้วย) ได้ 48/50, 49/50, 49/50 ตามลำดับ — **ทุกครั้งที่ fail เป็นเทสต์เดียวกันเสมอ**: `e2e/public-home-cache.spec.ts` (เทสต์ลำดับที่ 50 ตัวสุดท้ายของชุด) ที่ timeout บนการ poll ยืนยันว่าหมวดหมู่ทดสอบหายไปจากหน้าแรกหลังลบ (ไม่ใช่ assertion ที่ผิดพลาด — เป็น `toPass({ timeout: 20_000 })` ที่ยังไม่ผ่านภายในเวลาที่กำหนด)

**ตรวจสอบแล้วว่าไม่ใช่ regression จากงานนี้**:
- โค้ด production **ไม่มีการเปลี่ยนแปลงหลงเหลืออยู่เลย** (ยืนยันด้วย content hash ของทุก chunk ตรงกับก่อนเริ่มงาน 100%) — เทสต์นี้ไม่เกี่ยวข้องกับ legacy JS/browserslist/polyfill ที่งานนี้แตะเลยด้วยซ้ำ (เทสต์เรื่อง cache invalidation ของหมวดหมู่)
- รันเทสต์ตัวนี้แยกเดี่ยวๆ (`npx playwright test e2e/public-home-cache.spec.ts`) → **ผ่านสำเร็จทุกครั้ง** (28.8s)
- ตรวจ log ของทั้ง 2 ครั้งที่ fail พบว่าเป็น `Test timeout of 30000ms exceeded` บน `page.goto(..., { waitUntil: "networkidle" })`/`toPass()` — ไม่ใช่ error เชิงตรรกะ/assertion ผิด — สอดคล้องกับหมายเหตุที่เขียนไว้ในตัวเทสต์เองอยู่แล้วว่า `revalidateTag()` "ไม่ได้เร็วแบบ synchronous เป๊ะ...สังเกตได้ตั้งแต่แทบจะทันทีไปจนถึงประมาณ 2-3 วินาที" — ภายใต้ภาระของเครื่องหลังรันชุดทดสอบ/build/Lighthouse ต่อเนื่องมาหลายชั่วโมงในเซสชันนี้ ระยะเวลาดังกล่าวบางครั้งเกิน margin ของเทสต์ได้
- เทสต์ตัวนี้เคย**ผ่าน 50/50 ติดต่อกันหลายรอบก่อนหน้านี้ในเซสชันเดียวกัน**ด้วยโค้ด caching/revalidation ชุดเดียวกันเป๊ะ (ไม่เคยถูกแก้ไขเลยตลอดเซสชันนี้)

**สรุป**: เป็น pre-existing test timing flakiness ของ `public-home-cache.spec.ts` เมื่อรันเป็นเทสต์สุดท้ายของชุดยาว (ไม่ใช่ปัญหาที่งานนี้สร้างขึ้น และไม่ใช่ปัญหาของฟีเจอร์ caching เอง — พิสูจน์แล้วว่าฟีเจอร์ทำงานถูกต้องทั้งตอนรันแยกเดี่ยวและตอนรันรวมที่ไม่ fail) ไม่บันทึกเป็น finding ใหม่ของ audit นี้ เพราะอยู่นอกขอบเขต (audit นี้เจาะจงที่ JavaScript performance ของ `/research` เท่านั้น) แต่บันทึกไว้ตรงนี้เพื่อความโปร่งใสตามที่งานนี้กำหนดให้รายงานผลทดสอบทั้งหมดตามจริง

### Unused CSS rules
**Score 1 (ไม่พบปัญหา)** — Tailwind purge/JIT ทำงานถูกต้อง ไม่มี unused CSS rule ที่มีนัยสำคัญสำหรับ route นี้

### Unminified CSS
**Score 1 (ไม่พบปัญหา)**

---

## 5. Render-blocking fonts, stylesheets, scripts, third-party resources

| รายการ | ผล |
| --- | --- |
| Render-blocking resources | **1 รายการ**: `/_next/static/css/2795e9b72fcb6529.css` (10,549 bytes) — ประเมิน savings ~340ms ต่อ FCP/LCP ถ้า defer/inline critical CSS — เป็น global stylesheet ของทั้งแอป **ไม่ใช่เฉพาะ `/research`** |
| Font display | **ไม่พบปัญหา** (score 1, ไม่มี wasted ms) — สอดคล้องกับการใช้ `next/font` (Noto Sans Thai) ที่จัดการ `font-display` ให้อัตโนมัติอยู่แล้ว (ยืนยันจาก `app/layout.tsx` ที่เห็นก่อนหน้านี้ในโปรเจกต์) |
| Third-party resources | ไม่พบ third-party script ใดๆ โหลดบน route นี้ (ไม่มี analytics/widget ภายนอก) |
| Scripts อื่น | `main-app.js`, `app-pages-internals.js`, `webpack.js`, `polyfills.js` — มาตรฐานของ Next.js ทุก route ใช้เหมือนกัน ไม่มีตัวใดผิดปกติ |

---

## 6. LCP element และเหตุผลที่ปรากฏช้า

**LCP element คือข้อความ (ไม่ใช่รูปภาพ):**

```html
<p class="mt-1.5 text-sm text-gray-500">
  ค้นหาและกรองงานวิจัยขององค์กรจากคลังเอกสารดิจิทัล — รวมค้นหาเนื้อหาภายในไฟล์ PDF
</p>
```
(selector: `section.py-10 > div.mx-auto > div.mb-8 > p.mt-1.5` — คือคำบรรยายใต้หัวข้อ H1 "งานวิจัยทั้งหมด")

**LCP breakdown (production):**
- Time to First Byte: 156ms
- Element render delay: 1,241ms

เพราะเป็นข้อความล้วน (ไม่ใช่รูป) จึง**ไม่มี resource load delay** — เวลาที่เสียไปทั้งหมดคือการรอให้ browser main thread ว่างพอที่จะคำนวณ style/layout แล้ว paint ได้ ตรงกับ mainthread-work-breakdown ที่ชี้ว่า **"Style & Layout" (644ms) เป็นตัวกินเวลามากที่สุด** มากกว่า "Script Evaluation" (438ms) เสียอีก — สอดคล้องกับ render-blocking CSS (หัวข้อ 5) ที่ทำให้ browser ต้องรอโหลด/parse stylesheet ก่อนคำนวณ layout ของข้อความนี้ได้

**สรุป**: LCP ที่ 3.0s (production) ไม่ได้เกิดจาก JavaScript หนักหรือรูปภาพโหลดช้า แต่เกิดจากผลรวมของ render-blocking CSS + main-thread work ก่อนที่ layout จะเสถียรพอให้ paint ข้อความนี้ได้

---

## 7. Prioritized Implementation Plan (ยังไม่ได้ทำ — เพื่อการตัดสินใจเท่านั้น)

### 🟢 Safe now (ความเสี่ยงต่ำ ไม่กระทบ UI/พฤติกรรมที่มองเห็น)

1. ~~ปรับ browserslist/build target ให้แคบลง~~ — **ลงมือทำแล้ว พบว่าทำไม่ได้จริง** วัด 0% ลดลง เพราะ 11 KiB นี้เป็นโค้ดผูกตายตัวใน `next/dist/client/app-globals.js` ของ Next.js framework เอง ไม่ผูกกับ `browserslist` เลย — ดูหัวข้อ 4.1 สำหรับหลักฐานเต็ม **ย้อนกลับการเปลี่ยนแปลงแล้ว ไม่มีทางแก้ในขอบเขตนี้นอกจาก patch `node_modules` โดยตรงหรือเปลี่ยนเวอร์ชัน Next.js (นอกขอบเขต)**
2. **ตรวจสอบว่า `.claude`/production checklist ไม่มีการรัน `next build` ขณะ `next dev` ทำงานอยู่** — ไม่ใช่การแก้โค้ด แต่เป็นกระบวนการทำงานที่ป้องกัน `.next` cache เสียหาย (พบเป็นปัญหาซ้ำหลายครั้งในเซสชันนี้)
3. **เพิ่ม Lighthouse CI ให้รันกับ production build เท่านั้น** (ไม่ใช่ dev server) — ป้องกันไม่ให้มีใครนำตัวเลข dev mode มาใช้ตัดสินใจผิดพลาดอีกในอนาคต (เอกสารนี้เป็นตัวอย่างว่าตัวเลขต่างกันได้ถึง 75 เท่า)

### 🟡 Needs visual regression test (เปลี่ยน markup/CSS loading ที่อาจกระทบการแสดงผล)

4. **Inline critical CSS หรือ defer non-critical CSS** สำหรับ stylesheet หลัก (10.5 KB) — ประหยัด ~340ms FCP/LCP แต่ต้องทดสอบ visual ให้แน่ใจว่าไม่มี Flash of Unstyled Content (FOUC) หรือ layout shift ระหว่างที่ CSS ที่ defer มาโหลดทีหลัง — เกี่ยวข้องกับทุก route ไม่ใช่แค่ `/research`
5. **พิจารณาย้ายคำบรรยายใต้หัวข้อ (LCP element) ให้ไม่ต้องรอ CSS ภายนอกทั้งก้อน** (เช่น inline critical style เฉพาะส่วน above-the-fold) — ต้องทดสอบ visual เพราะกระทบ layout/font loading path โดยตรง

### 🔴 Needs auth/security review (แตะ Supabase client/session handling)

6. **ทบทวนว่า `IdleLogout`/`LogoutButton`/MFA components (ที่ import `lib/supabase/client.ts`) จำเป็นต้องอยู่ใน route ทุกหน้าจริงหรือไม่ หรือควร lazy-load เฉพาะเมื่อจำเป็น** — เกี่ยวข้องกับ session/idle-logout/MFA โดยตรง **ต้องมี security review ก่อนแตะ** เพราะการเปลี่ยนวิธีโหลด Supabase client (เช่น dynamic import, แยก Realtime ออกจาก client instance) มีความเสี่ยงกระทบ auth flow/session monitoring ที่ทำงานอยู่เบื้องหลังทุกหน้า — **นี่คือโอกาสประหยัดที่ใหญ่ที่สุด (44 KB ทุก route)** แต่ต้องระวังที่สุดเช่นกัน

---

## Top 5 การเปลี่ยนแปลงที่แนะนำ — เรียงตามผลกระทบ

| # | การเปลี่ยนแปลง | ผลกระทบคาดการณ์ | ไฟล์ที่เกี่ยวข้อง | หลักฐาน |
| --- | --- | --- | --- | --- |
| 1 | **แยก/lazy-load Supabase Realtime ออกจาก client bundle ที่ใช้แค่ auth/logout** (ต้อง security review) | ลด First Load JS **~44 KB ทุก route** (รวม `/research`) — TBT บน low-end device ลดลงตามสัดส่วน scripting time ของ chunk นี้ (~59-77ms ที่วัดได้ใน bootup-time) | `lib/supabase/client.ts`, `components/auth/IdleLogout.tsx`, `components/auth/LogoutButton.tsx` | Chunk `4905-543b6c2c53c46a40.js`: 46,982 bytes, wasted 44,056 bytes (94%), มี `RealtimeClient`/`realtime-js` — โหลดเหมือนกันทั้งหน้าแรกและ `/research` |
| 2 | **Defer/inline critical CSS ของ stylesheet หลัก** (ต้อง visual regression test) | LCP/FCP ลดลง **~340ms** | `app/globals.css`, `app/layout.tsx` (การโหลด stylesheet) | `render-blocking-insight`: `/_next/static/css/2795e9b72fcb6529.css` (10,549 bytes), estimated savings LCP/FCP 340-350ms |
| 3 | ~~ตัด legacy JS polyfill ที่ไม่จำเป็น~~ | **❌ ทำไม่ได้ — ลงมือทำจริงแล้ววัดผล 0%** ผูกตายตัวใน Next.js framework เอง ไม่ใช่ config ของโปรเจกต์ | ทดลองที่ `.browserslistrc` (ย้อนกลับแล้ว) | `legacy-javascript-insight` ก่อน/หลังเท่ากันเป๊ะ (11,721 bytes) — ต้นตอคือ `node_modules/next/dist/client/app-globals.js` เรียก `require("../build/polyfills/polyfill-module")` แบบไม่มีเงื่อนไข ดูหัวข้อ 4.1 |
| 4 | **ใช้เฉพาะ production build วัดผล performance เสมอ ไม่ใช้ dev server** (process change, safe now) | ป้องกันการตัดสินใจผิดพลาดจากตัวเลขที่เกินจริง 75 เท่า — ไม่มีผลต่อ TBT จริงเพราะ TBT จริงคือ 120ms อยู่แล้ว แต่ป้องกัน false-positive ในอนาคต | ไม่มี (กระบวนการทำงาน) | เปรียบเทียบ TBT: dev 7,130ms vs production 120ms (60x) — หัวข้อ 0 |
| 5 | **ปรับ LCP element ให้ paint เร็วขึ้นโดยไม่ต้องรอ layout เต็มหน้า** (ต้อง visual regression test) | Element render delay ลดลงจาก **1,241ms** — LCP โดยรวมดีขึ้นตามสัดส่วน | `app/research/page.tsx` (โครงสร้าง H1/คำบรรยาย), CSS ที่เกี่ยวข้อง | `lcp-breakdown-insight`: elementRenderDelay 1,241ms จาก LCP รวม, mainthread-work-breakdown ชี้ Style & Layout (644ms) เป็นตัวใหญ่สุด |

**หมายเหตุสำคัญที่สุด**: ถ้าเป้าหมายคือแก้ตัวเลข TBT 9,090ms ที่รายงานมา **ไม่ต้องแก้โค้ดเลย** — แค่วัดผลกับ production build (`npm run build && npm run start`) แทน dev server ก็จะเห็น TBT ที่แท้จริงคือ 120ms อยู่แล้ว รายการที่ 1, 2, 5 ข้างต้นเป็นการปรับปรุงเพิ่มเติมสำหรับ production build ที่ดีอยู่แล้วให้ดียิ่งขึ้นไปอีก ไม่ใช่การแก้ "บั๊ก" ที่ทำให้หน้าใช้งานไม่ได้ — **รายการที่ 3 (legacy JS polyfill) ปิดเป็น "ไม่สามารถทำได้" แล้วหลังลงมือตรวจสอบจริงในรอบนี้ (2026-08-13)**
