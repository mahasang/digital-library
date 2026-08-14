# QA Production-Readiness Audit — 2026-08-13

**ผู้ตรวจสอบ:** QA/Security Review (ผ่าน Claude Code)
**วันที่ตรวจสอบ:** 2026-08-13
**ประเภทการตรวจสอบ:** Audit-and-test-first (ไม่แก้โค้ด production ระหว่างตรวจสอบ) — ตรวจสอบเฉพาะสภาพแวดล้อม local เท่านั้น ไม่มีการ deploy จริง ไม่มีการแก้ไขข้อมูล production

## 0. ความสัมพันธ์กับเอกสารที่มีอยู่เดิม

โปรเจกต์นี้มีการตรวจสอบ production-readiness แบบละเอียดมาก่อนแล้วที่ [`production-readiness-report.md`](production-readiness-report.md) (2026-08-08, อัปเดต 2026-08-11) ซึ่งพบและแก้ไข **C-1 (Critical)** และ **H-1/H-2 (High)** ครบถ้วนพร้อม regression test อัตโนมัติ คำตัดสินเดิมคือ **"Ready with Conditions"**

เอกสารนี้**ไม่ได้ตรวจซ้ำทุกหัวข้อจากศูนย์** แต่เป็น **audit เชิง differential**:
1. ยืนยันซ้ำว่า C-1/H-1/H-2 ยังคงแก้ไขสมบูรณ์ ไม่ regress
2. ตรวจสอบงานที่ทำเพิ่มเติมหลังรายงานเดิม (homepage query optimization, public homepage caching, header rendering refactor — ทั้งหมดในเซสชันนี้) ว่าไม่สร้างปัญหาใหม่
3. ครอบคลุมหัวข้อที่รายงานเดิม**ไม่เคยตรวจ**: IDOR แบบเจาะจง, secrets-in-source-control แบบเจาะจง, ความพร้อมด้านภาษาลาว, Lighthouse baseline (รายงานเดิมใช้ static review เท่านั้น ไม่เคยรัน Lighthouse จริง), การพิสูจน์เชิงประจักษ์ว่าไม่มีข้อมูลผู้ใช้รั่วไหลใน cached HTML
4. ยืนยันสถานะปัญหา Medium ที่ยังไม่แก้จากรายงานเดิม (M-1 เดิม, M-2) ด้วยหลักฐานสดวันนี้

---

## 1. ผล Automated Checks (รันสดวันนี้)

| คำสั่ง | ผลลัพธ์ |
| --- | --- |
| `npm run lint` | ✅ ผ่าน — 0 error, 8 warning (`_prevState`/`_formData` unused, คงเดิมจากรายงานก่อนหน้า L-1) |
| `npx tsc --noEmit` | ✅ ผ่าน — 0 error |
| `npm run test` | ✅ ผ่าน — **127/127 test ใน 11 ไฟล์** (เพิ่มจาก 95/7 ไฟล์ในรายงานเดิม — มี test ใหม่จากงาน caching/rendering ในเซสชันนี้) |
| `npm run test:a11y` | ✅ ผ่าน — **50/50** (เพิ่มจาก 22/22 เดิม — เพิ่ม `auth-verification.spec.ts`, `header-roles.spec.ts`, `public-home-cache.spec.ts`) |
| `npm run build` (production) | ✅ ผ่าน — สร้างครบทุก route (69 routes) โดยไม่มี error |
| `git status` | Clean ยกเว้นไฟล์ที่แก้ในเซสชันนี้เอง (เอกสาร + `dev-server.log`/`test-results/` ซึ่งเป็น artifact การทดสอบ) |
| `git diff --check` | ✅ ผ่าน — ไม่มี whitespace error/conflict marker ค้าง |

**หมายเหตุปฏิบัติการ (ยืนยันซ้ำจากรายงานเดิม):** การรัน `npm run build` ขณะ `npm run dev` ทำงานอยู่พร้อมกันทำให้ `.next` cache เสียหาย (`Cannot find module`) — ต้องหยุด dev server, ลบ `.next`, รันคำสั่งแยกกันเสมอ พบและแก้ไขปัญหานี้จริงระหว่างเซสชันนี้ (ดูหัวข้อ 5.3)

---

## 2. Findings

> **สถานะ**: QA-01, QA-04, และ QA-05 (เฉพาะ `lib/data/queries.ts`) ได้รับการแก้ไขแล้วในเซสชันนี้ หลังรายงานตามข้อกำหนด "audit and test first, fix only after reporting" — ยืนยันด้วย `npm run lint`/`npx tsc --noEmit`/`npm run test` (127/127) /`npm run build` ผ่านทั้งหมดหลังแก้ไข ไม่มี regression รายละเอียดการแก้ไขอยู่ท้ายแต่ละหัวข้อ

### QA-01 (✅ แก้ไขแล้ว) | Medium | Secret credential ถูก commit เข้า git ใน `.claude/settings.local.json`

- **Reproduction steps:** `git ls-files | grep ".claude/settings"` → พบว่าไฟล์ถูก track (`git check-ignore` คืนค่า not-ignored) เปิดไฟล์ดู → พบ `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` ปรากฏ 3 ครั้ง (บรรทัด 20-22) ในฐานะทั้ง header `apikey` และ `Authorization: Bearer` ของคำสั่ง curl ที่ยิงไปยัง local Supabase (`127.0.0.1:54321`)
- **Expected:** ไฟล์ `*.local.json` (ตามชื่อ/convention ของ Claude Code — เทียบเท่า `.env.local`) ควรอยู่ใน `.gitignore` ไม่ถูก commit เข้า git repository เด็ดขาด โดยเฉพาะเมื่อมี credential ฝังอยู่
- **Actual:** ไฟล์ถูก track และ commit จริง มี secret-role key ฝังอยู่ในประวัติ git แล้ว
- **Affected role/route:** ไม่เกี่ยวกับ role/route ของแอป — เป็นปัญหาระดับ repository hygiene
- **ความเสี่ยงจริง:** key นี้ใช้ได้เฉพาะกับ Supabase instance ที่ `127.0.0.1:54321` (local dev เท่านั้น ไม่ใช่ production) จึงไม่เสี่ยงต่อการรั่วไหลข้อมูล production โดยตรง — แต่ (1) เป็นการฝ่าฝืนหลักการ "ไม่ commit secret" ที่อาจกลายเป็นนิสัยเสี่ยงเมื่อมีคนแปะคำสั่งที่มี credential จริงลงในไฟล์นี้ในอนาคต (2) key จะอยู่ในประวัติ git ตลอดไปแม้จะลบออกจาก working tree ภายหลัง (3) ไฟล์เดียวกันยังมี legacy demo JWT key ของ Supabase local (ที่เป็นค่า public ที่รู้จักกันทั่วไป ไม่ถือเป็นความเสี่ยง) ปนอยู่ ทำให้แยกแยะยากว่าตัวไหนอ่อนไหวจริง
- **Suggested fix:** เพิ่ม `.claude/settings.local.json` ใน `.gitignore`, รัน `git rm --cached .claude/settings.local.json` (คงไฟล์ไว้ใน working tree), และพิจารณาหมุนเวียน (rotate) local Supabase project หากใครกังวลเรื่อง key เดิมค้างอยู่ใน git history (ไม่บังคับเพราะเป็น local-only) — **ไม่แนะนำ rewrite git history** (`git filter-repo`/`BFG`) เว้นแต่ทีมตัดสินใจร่วมกันเนื่องจากกระทบทุกคนที่ clone repo อยู่แล้ว
- **Regression test needed:** เพิ่ม pre-commit hook หรือ CI step ที่ scan รูปแบบ `sb_secret_`/`eyJ...role":"service_role"` ในไฟล์ที่จะ commit (เช่น `gitleaks`/`git-secrets`) เพื่อป้องกันไม่ให้เกิดซ้ำ (ยังไม่ได้เพิ่มในรอบนี้ — นอกขอบเขต narrow fix)
- **✅ แก้ไขแล้ว:** เพิ่ม `.claude/settings.local.json` เข้า `.gitignore` และรัน `git rm --cached` แล้ว (ไฟล์ยังอยู่ใน working tree ของเครื่องนี้) — **ยังไม่ rewrite git history** ตามที่แนะนำไว้ข้างต้น (ต้องให้ทีมตัดสินใจร่วมกันก่อน)

### QA-02 | Low / Informational | ไม่มีสถาปัตยกรรม i18n รองรับหลายภาษา — Lao (และ English) ยังไม่พร้อมใช้งานจริง

- **Reproduction steps:** ค้นหา `next-intl`/`i18n`/`locales/`/`messages/` ทั่วโปรเจกต์ → ไม่พบ config หรือ message catalog ใดๆ ทุก string ในทุก component เป็นภาษาไทยแบบ hardcode ตรงๆ ไม่มีกลไกสลับภาษา
- **Expected:** งานที่ระบุ "Thai/English/Lao readiness" ควรมีอย่างน้อยโครงสร้างที่รองรับการเพิ่มภาษาในอนาคตได้โดยไม่ต้องรื้อ component
- **Actual:** ระบบเป็นภาษาไทยล้วน 100% ไม่มีแม้แต่ภาษาอังกฤษ การเพิ่ม Lao (หรือ English) ในอนาคตต้องรื้อโครงสร้าง (แยก string ออกจาก JSX, เพิ่ม routing/locale switching, แปล UI ทั้งหมด) ไม่ใช่งานเล็ก
- **Affected role/route:** ทุกหน้า ทุก role
- **Suggested fix:** **ไม่แนะนำให้ทำในรอบนี้** (นอกขอบเขตงานที่ระบุไว้ชัดเจน — "without changing locale architecture") บันทึกเป็นงาน post-launch backlog หากทีมต้องการรองรับหลายภาษาจริงในอนาคต แนะนำ `next-intl` (รองรับ App Router เต็มรูปแบบ) เป็นจุดเริ่มต้นเมื่อถึงเวลานั้น
- **Regression test needed:** ไม่มี (ไม่ใช่ regression — เป็นสถานะเดิมของระบบที่ยังไม่เคยมีมาก่อน)

### QA-03 | Low / Informational | Largest Contentful Paint (LCP) อยู่ในช่วง "needs improvement" ตาม Lighthouse

- **Reproduction steps:** รัน `npx lighthouse http://localhost:3001/` กับ production build (`npm run build && npm run start`) → ดูค่า `largest-contentful-paint`
- **Expected:** LCP < 2.5s ตามเกณฑ์ "Good" ของ Core Web Vitals
- **Actual:** LCP = 3.0s (อยู่ในช่วง "Needs Improvement", ไม่ใช่ "Poor" ซึ่งคือ >4s) — Performance score โดยรวม **93/100** ยังถือว่าดีมาก
- **Affected role/route:** หน้าแรก (guest + authenticated เหมือนกัน เพราะเนื้อหาหลักที่ทำให้เกิด LCP คือส่วน hero/research grid ที่ cache ไว้แล้ว)
- **Suggested fix:** ไม่บล็อก launch — ควรตรวจสอบเพิ่มเติมหลัง deploy จริงด้วย real-world network conditions (ตัวเลขนี้วัดจาก local loopback ซึ่งไม่มี network latency จริง ค่า production จริงอาจต่างไป) พิจารณา `next/image` optimization หรือ font loading strategy หากต้องการปรับปรุงในรอบถัดไป
- **Regression test needed:** เพิ่ม Lighthouse CI ในอนาคต (ยังไม่มีในโปรเจกต์นี้) เพื่อติดตาม trend ของ Core Web Vitals ต่อเนื่อง — ไม่มีในรอบนี้

### QA-04 (✅ แก้ไขแล้ว — carried forward, ยืนยันซ้ำก่อนแก้) | Medium | `/superadmin/pdf-processing` และ `lib/jobs/process-now.action.server.ts` ไม่ผ่านด่าน MFA aal2 ซ้ำเมื่อเรียก Server Action ตรง

- carried forward จากรายงานเดิม ("M-1 เดิม") — ยืนยันด้วยหลักฐานสดวันนี้ (ดูหัวข้อ 5.2) ยังคงใช้ `getCurrentUserRoleRank() < SUPER_ADMIN_RANK` เองแทน `requireMinRank(50)` ใน 5 จุดของ `pdf-processing/actions.ts` และ 1 จุดของ `process-now.action.server.ts`
- **Reproduction steps:** อ่าน `lib/data/admin-guard.server.ts` (`requireMinRank`) เทียบกับ `app/superadmin/pdf-processing/actions.ts`/`lib/jobs/process-now.action.server.ts` — ทั้งสองไฟล์ import `getCurrentUserRoleRank`/`SUPER_ADMIN_RANK` ตรง ไม่ import `requireMinRank`
- **Expected:** Server Action ทุกตัวที่ต้องการ rank ≥ 50 ควรผ่าน `requireMinRank(50)` ซึ่งบังคับ MFA `aal2` เพิ่มอีกชั้นเป็น defense-in-depth สำหรับกรณีเรียก Server Action ตรงโดยไม่ผ่านหน้า UI ปกติ (ที่ middleware กันไว้อยู่แล้ว)
- **Actual:** 6 จุดใน 2 ไฟล์นี้ตรวจแค่ rank เฉยๆ ไม่ตรวจ aal2
- **Affected role/route:** super_admin เท่านั้น (rank ≥ 50 อยู่แล้วจึงจะเรียกผ่านได้) — ความเสี่ยงต่ำเพราะยังต้องเป็น super_admin จริง เพียงแค่ไม่ได้ผ่านด่าน MFA ซ้ำถ้าเรียก Server Action ตรงข้าม UI
- **Suggested fix:** เปลี่ยน 6 จุดนี้ให้เรียก `requireMinRank(50)` แทน (pattern เดียวกับไฟล์อื่นใน `/superadmin/*`) — เป็นการแก้ที่ narrow และตรงไปตรงมา
- **Regression test needed:** unit/integration test ยืนยันว่า Server Action เหล่านี้ปฏิเสธเมื่อ `aal.currentLevel !== "aal2"` แม้ rank ผ่านแล้ว (ยังไม่ได้เพิ่มในรอบนี้ — นอกขอบเขต narrow fix)
- **✅ แก้ไขแล้ว:** เปลี่ยนทั้ง 6 จุด (5 จุดใน `app/superadmin/pdf-processing/actions.ts`, 1 จุดใน `lib/jobs/process-now.action.server.ts`) ให้เรียก `requireMinRank(SUPER_ADMIN_RANK)` แทนการตรวจ `rank < SUPER_ADMIN_RANK` เอง — ใช้ `auth.userId` แทน `user.id` เดิมทุกจุดที่เกี่ยวข้อง (`createdBy`, `actorId`, `actorUserId`) ยืนยันด้วย `npx tsc --noEmit`/`npm run lint`/`npm run test` (127/127) ผ่านครบหลังแก้ไข

### QA-05 (✅ แก้ไขบางส่วนแล้ว — เฉพาะ `lib/data/queries.ts`) | Low | Error message ดิบจาก Postgres ยังฝังอยู่ใน `throw new Error()` หลายจุด

- carried forward จากรายงานเดิม (M-2) — ยืนยันด้วยหลักฐานสดวันนี้: `lib/data/queries.ts` มี 9 จุดที่ยังเป็น `` throw new Error(`...: ${error.message}`) `` (บรรทัด 51, 102, 123, 141, 159, 177, 197, 215, 266) ไม่ผ่าน `toSafeErrorMessage()`
- Next.js redact ข้อความจาก thrown exception ให้อัตโนมัติใน production build (ไม่ใช่ช่องโหว่จริงในทางปฏิบัติ) แต่ไม่สอดคล้องกับ pattern ที่ใช้ทั่วโปรเจกต์ — **ไม่บล็อก launch** แนะนำปรับให้สม่ำเสมอในรอบถัดไปเพื่อความง่ายในการดูแลรักษา
- **✅ แก้ไขแล้วเฉพาะ `lib/data/queries.ts` (9 จุดที่รายงานไว้ข้างต้น):** เปลี่ยนเป็น `throw new Error(toSafeErrorMessage(error, fallbackMessage, functionName))` — เรียก logic เดียวกับที่ Server Action อื่นใช้ (log ข้อความจริงฝั่งเซิร์ฟเวอร์ผ่าน `console.error`, โยนข้อความทั่วไปที่ปลอดภัยขึ้นแทน) พฤติกรรม throw-on-error ยังคงเดิมทุกประการ (ฟังก์ชันเหล่านี้เป็น data-layer function ธรรมดา ไม่ใช่ Server Action ที่คืนค่า `ActionResult` จึงยังต้อง throw เหมือนเดิม ไม่เปลี่ยนเป็น return safe message) ยืนยันด้วย `npx tsc --noEmit`/`npm run test` ผ่านครบ
- **⚠️ ยังไม่ได้แก้ (นอกขอบเขตที่รายงาน/ยืนยันในรอบนี้):** ตรวจพบ pattern เดียวกันเพิ่มเติมใน `lib/data/reports.server.ts` (3 จุด), `lib/data/favorites.server.ts` (2 จุด), `lib/data/categories.server.ts` (1 จุด), `lib/data/submissions.server.ts` (1 จุด), `lib/data/submission-write.server.ts` (6 จุด) — **ไม่ได้แก้ในรอบนี้เพราะไม่ได้ระบุ/ยืนยันหลักฐานไว้ในรายงานฉบับนี้ตั้งแต่แรก** (ตามหลัก "audit and report before fix" ต้องรายงานก่อนแล้วจึงแก้ ไม่ใช่ขยายขอบเขตเงียบๆ ระหว่างแก้ไข) บันทึกไว้เป็นงานต่อยอดที่ชัดเจนสำหรับรอบถัดไป — pattern การแก้เหมือนกันทุกประการกับที่ทำใน `queries.ts` ครั้งนี้

---

## 3. หัวข้อที่ตรวจสอบแล้วไม่พบปัญหาใหม่ (สรุปพร้อมหลักฐาน)

### 3.1 IDOR (Insecure Direct Object Reference)

ตรวจ Server Action/query ที่เกี่ยวกับข้อมูลส่วนตัวของผู้ใช้:
- `toggleFavoriteAction` (`app/research/[id]/actions.ts`) — ดึง `user.id` จาก `supabase.auth.getUser()` สดทุกครั้ง ไม่รับจาก client, `.eq("user_id", user.id)` ก่อน delete เสมอ
- `updateNotificationSettingsAction` (`app/profile/notification-settings/actions.ts`) — `user.id` จาก server เสมอ, upsert/delete scope ด้วย `user_id`
- `getFavoriteResearch(user.id)` เรียกจาก `app/favorites/page.tsx` — `user.id` มาจาก `getSessionUser()` (server-verified) ไม่ใช่ route param
- `lib/data/favorites.server.ts`/`access-requests-admin.server.ts` — ทุกฟังก์ชัน scope ด้วย `userId` param ที่ตรวจสอบแล้วว่ามาจาก server session เท่านั้นในทุก call site ที่ตรวจ

**สรุป:** ไม่พบช่องทาง IDOR ในจุดที่ตรวจ — สอดคล้องกับผลตรวจ Server Action ทั้ง 32 ไฟล์ของรายงานเดิม

### 3.2 Cache leak — ไม่มีข้อมูลผู้ใช้เฉพาะบุคคลรั่วไหลเข้า cached homepage HTML

**พิสูจน์เชิงประจักษ์ (ไม่ใช่แค่ตรวจโค้ด):** ใช้ Playwright ยิง `GET /` แบบ guest และแบบ login (member) จริง แล้วเทียบ HTML ทั้งหน้า (ตัดส่วน `<header>` ออกเพราะเป็นส่วนที่ตั้งใจให้ต่างกันตาม role อยู่แล้ว) — **ผลลัพธ์เหมือนกันทุก byte** ยกเว้น query-string timestamp ของ Next.js dev-mode CSS cache-busting (`?v=...`, เป็น dev-mode build artifact ไม่ใช่ข้อมูลผู้ใช้) ยืนยันว่าส่วนที่ cache ไว้ (`getPublicHomeSettings`/`getCategories`/`getPublishedResearchStats`/`getLatestResearch`/`getPopularResearch`) ไม่มีทางพาข้อมูลเฉพาะผู้ใช้คนใดคนหนึ่งไปแสดงซ้ำให้คนอื่นเห็น สอดคล้องกับการตรวจโค้ด (`createPublicClient()` ไม่อ่าน cookies, `HeaderAccountArea` ไม่ถูกห่อด้วย `unstable_cache`)

### 3.3 Performance/Cache regression

- `npm run test:a11y` ครอบคลุม `public-home-cache.spec.ts` ซึ่งทดสอบ pipeline เต็ม (สร้าง/ลบหมวดหมู่จริงผ่าน UI → เห็นผล/หายไปจากหน้าแรกภายในไม่กี่วินาที) — **ผ่าน**
- Header account area ไม่บล็อกการ render หน้าแรกสาธารณะ — ยืนยันด้วยโครงสร้าง `<Suspense>` ใน `app/layout.tsx` (ดู [`homepage-rendering-performance.md`](homepage-rendering-performance.md)) และด้วย CLS = 0.005 จาก Lighthouse (แทบไม่มี layout shift เมื่อ header account area โหลดเสร็จ)
- TTFB วัดจริง: dev mode ~280-450ms (มี overhead compile-on-demand), **production mode ~27-43ms** (5 ครั้งติดต่อกัน)
- Lighthouse (production build, ครั้งแรกที่เคยรันในโปรเจกต์นี้ — ไม่มี baseline เดิมให้เทียบ เอกสารก่อนหน้าใช้ static review เท่านั้น):

  | Metric | ค่า |
  | --- | --- |
  | Performance | 93/100 |
  | Accessibility | 96/100 |
  | Best Practices | 96/100 |
  | SEO | 100/100 |
  | First Contentful Paint | 1.7s |
  | Largest Contentful Paint | 3.0s (ดู QA-03) |
  | Total Blocking Time | 60ms |
  | Cumulative Layout Shift | 0.005 |
  | Server response time | 50ms |

  (เปรียบเทียบ: รันแบบเดียวกันกับ **dev server** ได้ Performance เพียง 64/100, TBT 1,700ms — คาดการณ์ได้ เพราะ dev mode ไม่ minify/optimize แสดงให้เห็นความสำคัญของการวัดกับ production build เท่านั้น)

### 3.4 RLS / Signed URL / MFA / CAPTCHA / Rate Limit / Malware Scan

ไม่พบการเปลี่ยนแปลงใดๆ ในไฟล์เหล่านี้ตั้งแต่รายงานเดิม — ยืนยันด้วยการอ่านโค้ดสดวันนี้ (`lib/rate-limit.server.ts`, `lib/captcha.server.ts` — pattern fail-open เหมือนเดิมทุกประการ) สรุปเดิมของรายงาน 2026-08-08/11 ยังใช้ได้ครบ

### 3.5 Public routes: 404/error state

`GET /research/does-not-exist-xyz` → 404, `GET /this-page-does-not-exist` → 404 — ทำงานถูกต้อง

### 3.6 Audit log สำหรับการกระทำที่อ่อนไหว

**เกือบรายงานเป็นปัญหาโดยผิดพลาด — ตรวจสอบเพิ่มก่อนสรุป:** `app/dashboard/approvals/[id]/actions.ts` (`approveAction`/`rejectAction`/`publishAction`/`archiveAction` ฯลฯ) **ไม่มีการเรียก `logAudit()` โดยตรง** ดูเหมือนช่องโหว่ในตอนแรก — แต่ตรวจสอบ `supabase/migrations/20260801100000_submissions_and_approvals.sql` แล้วพบว่ามี **database trigger** (`trg_research_items_status_change` → `log_research_status_change()`) ที่บันทึกทั้ง `approval_logs` และ `audit_logs` โดยอัตโนมัติทุกครั้งที่ `research_items.status` เปลี่ยน **ไม่ว่าจะเปลี่ยนจากที่ใดในระบบก็ตาม** (รวมถึงกรณีที่ไม่ได้ผ่าน Server Action นี้เลย) — เป็นกลไกที่แข็งแรงกว่าการเรียก `logAudit()` จากแอปเสียอีก (ป้องกัน bypass ผ่าน service role/SQL ตรงไม่ได้ด้วยซ้ำ) **สรุป: ไม่ใช่ปัญหา** บันทึกไว้เพื่อความโปร่งใสว่าตรวจสอบแล้วก่อนตัดสิน ไม่ใช่ปล่อยผ่านโดยไม่ดู

`app/superadmin/users/actions.ts` มี `logAudit()` ครบ 7 จุด (grant/revoke role, toggle active, reset MFA ฯลฯ) — สอดคล้องกับรายงานเดิม

---

## 4. หัวข้อที่ไม่สามารถทดสอบได้ในสภาพแวดล้อมนี้

- **Screen reader จริง** (NVDA/VoiceOver) — เหมือนรายงานเดิม ยังไม่มีเครื่องมือในสภาพแวดล้อมนี้
- **Mobile touch gesture บนอุปกรณ์จริง** — เหมือนรายงานเดิม
- **Golden-path E2E ผ่าน UI จริงแบบเต็ม flow** (ค้นหา→เปิด→ดาวน์โหลด) — มี e2e ครอบคลุมมากขึ้นกว่ารายงานเดิมมาก (50 test ครอบคลุม role gate, header, cache invalidation, download authorization) แต่ยังไม่ใช่ scenario เดียวที่ครบทุกขั้นตอนในเทสต์เดียว — ระดับความเสี่ยงลดลงจากรายงานเดิมอย่างมีนัยสำคัญ
- **Lighthouse บน network จริง** (ไม่ใช่ localhost) — ค่าที่วัดได้เป็น local-loopback เท่านั้น ค่าจริงหลัง deploy อาจต่างกันตาม CDN/ระยะทาง
- **MFA จริงผ่าน TOTP ที่หมุนทุก 30 วินาที** สำหรับหน้า Super Admin — เหมือนรายงานเดิม (แต่ `mfa-challenge` a11y test ผ่านแล้วทั้ง light/dark theme)

---

## 5. หลักฐานการทดสอบเพิ่มเติม (รายละเอียดเชิงเทคนิค)

### 5.1 สภาพแวดล้อมที่ใช้ทดสอบ

- Next.js 15.5.22, local dev server + production build (`npm run start`) บนเครื่องเดียวกัน (สลับกันคนละช่วงเวลา ไม่รันพร้อมกัน)
- Playwright + axe-core (`test:a11y`), Vitest (`test`)
- Lighthouse 13.4.1 (ผ่าน `npx --yes lighthouse`, headless Chrome)
- บัญชีทดสอบจริงผ่าน `E2E_*_EMAIL`/`E2E_*_PASSWORD` ใน `.env.local` (admin/superadmin/member/staff/librarian)

### 5.2 หลักฐาน QA-04 (rank check ไม่ผ่าน aal2) — ก่อนแก้ไข

```
lib/data/admin-guard.server.ts:56-68  — requireMinRank() ตรวจ aal2 เมื่อ minRank >= 50
app/superadmin/pdf-processing/actions.ts:38-41,118-121,211-213,271-274,336-339 — rank < SUPER_ADMIN_RANK เอง (5 จุด)
lib/jobs/process-now.action.server.ts:24-25 — rank < SUPER_ADMIN_RANK เอง (1 จุด)
```

ทั้ง 6 จุดไม่มี `requireMinRank`/`getAuthenticatorAssuranceLevel` ปรากฏในไฟล์เลย ก่อนแก้ไข — **แก้ไขแล้ว** (ดู QA-04 ด้านบน) ยืนยันหลังแก้ว่าทั้ง 6 จุดเรียก `requireMinRank(SUPER_ADMIN_RANK)` แล้วด้วย `grep -n "user\.id\|getCurrentUserRoleRank" app/superadmin/pdf-processing/actions.ts` คืนค่าว่างเปล่า (ไม่มี pattern เดิมหลงเหลือ)

### 5.3 ปัญหา infra ที่พบระหว่างตรวจสอบ (ไม่ใช่บั๊กของแอป — บันทึกไว้เป็นความรู้)

ระหว่างเซสชันนี้พบ `.next` cache เสียหายจริง (`Cannot find module './vendor-chunks/@supabase.js'`, `__webpack_modules__[moduleId] is not a function`) ทำให้ client-side JavaScript ไม่ hydrate — อาการที่สังเกตได้คือฟอร์มค้นหาที่หน้าแรกกดแล้วไม่ทำงาน (เพราะ `onSubmit` handler ไม่ถูก attach) วินิจฉัยว่าเกิดจากการรัน `npm run build` ขณะ `npm run dev` ทำงานอยู่พร้อมกัน (ตรงกับที่รายงานเดิมเคยบันทึกไว้แล้วในหมายเหตุปฏิบัติการ) แก้ไขด้วยการหยุด dev server, ลบ `.next`, รันใหม่ — หลังแก้ไข e2e suite ที่เคย fail ด้วยอาการนี้ (header-roles, auth-verification, public-home-cache, dark-theme contrast) กลับมาผ่านครบ 50/50 **ยืนยันว่าอาการเหล่านั้นทั้งหมดเป็นผลจาก build cache เสีย ไม่ใช่บั๊กจริงในแอป**

---

## 6. คำตัดสิน

## **Ready with Conditions** (ไม่เปลี่ยนจากรายงานเดิม — เงื่อนไขลดลงกว่าเดิมมาก)

ระบบยังคงมีคุณภาพโค้ดดี (lint/typecheck/build/test สะอาดทั้งหมด — เพิ่มจาก 95 เป็น **127 unit/integration test** และเพิ่มจาก 22 เป็น **50 e2e/a11y test** ตั้งแต่รายงานเดิม), C-1/H-1/H-2 ยืนยันไม่ regress, ไม่พบ Critical หรือ High ใหม่ในรอบนี้ — **ยืนยันซ้ำหลังแก้ไขทุกอย่างในหัวข้อนี้: `npm run lint`/`npx tsc --noEmit`/`npm run test` (127/127)/`npm run build` ผ่านทั้งหมด**

**สิ่งที่ดีขึ้นจากรายงานเดิม:**
- Homepage ไม่บล็อกการ render ด้วยข้อมูล session/notification อีกต่อไป (streaming ผ่าน Suspense) — พิสูจน์ด้วย TTFB จริงและ Lighthouse
- มี Lighthouse baseline ครั้งแรกของโปรเจกต์ (Performance 93/100)
- มี e2e coverage เพิ่มขึ้นมาก (role gate ครบ 6 ระดับผ่านเบราว์เซอร์จริง, cache invalidation ผ่านเบราว์เซอร์จริง)
- พิสูจน์เชิงประจักษ์ว่า cached homepage ไม่รั่วไหลข้อมูลผู้ใช้

**ปัญหาที่พบและแก้ไขแล้วในรอบนี้ (audit → report → fix ตามลำดับที่กำหนด):**
1. **QA-01 (Medium) — ✅ แก้แล้ว** — secret ใน `.claude/settings.local.json` ที่ถูก commit เข้า git
2. **QA-04 (Medium, carried forward) — ✅ แก้แล้ว** — 6 จุดใน 2 ไฟล์ไม่ผ่านด่าน aal2 ซ้ำ เปลี่ยนไปใช้ `requireMinRank(50)` แล้ว
3. **QA-05 (Low, carried forward) — ✅ แก้บางส่วนแล้ว** — error message ดิบใน 9 จุดของ `queries.ts` แก้แล้ว, พบ pattern เดียวกันอีก 13 จุดใน 5 ไฟล์อื่นที่**ยังไม่ได้แก้** (นอกขอบเขตที่รายงานไว้ตั้งแต่ต้น — ดู QA-05 หัวข้อ 2)

**ปัญหาที่เหลือ (ไม่บล็อก launch):**
4. QA-05 ส่วนที่เหลือ (`reports.server.ts`/`favorites.server.ts`/`categories.server.ts`/`submissions.server.ts`/`submission-write.server.ts`)
5. QA-02 (i18n readiness สำหรับ Lao) — informational
6. QA-03 (LCP 3.0s) — informational
7. M-3 (Next.js major version upgrade) — ตามคำสั่งเดิม **ไม่ให้ทำในรอบนี้** ยังคงเป็น post-launch backlog
8. L-3 (migration idempotency), L-6 (Vercel Hobby cron limit) — informational เหมือนเดิม ไม่ตรวจซ้ำในรอบนี้ (ไม่มีการเปลี่ยนแปลง)

### เงื่อนไขก่อนขึ้น production (เพิ่มเติมจากรายงานเดิม)

1. ทำตาม [`pre-production-checklist.md`](pre-production-checklist.md) ให้ครบทุกข้อเหมือนเดิม
2. รัน manual test checklist ในหัวข้อ 7 ด้านล่าง (โดยเฉพาะข้อที่เกี่ยวกับ `.claude/settings.local.json` — ทีมอื่นที่ clone repo อยู่แล้วต้องรับทราบว่าไฟล์นี้เลิก track แล้ว)

### Post-launch backlog (ไม่บล็อก)

- QA-05 ส่วนที่เหลือ (5 ไฟล์, 13 จุด — pattern เดียวกับที่แก้ใน `queries.ts` แล้ว)
- M-3 (Next.js major upgrade)
- พิจารณา Lighthouse CI สำหรับติดตาม Core Web Vitals ต่อเนื่อง
- วางแผน i18n (QA-02) หากต้องการรองรับ Lao/English จริงในอนาคต
- พิจารณา rotate local Supabase project (QA-01 — key เดิมยังอยู่ใน git history แม้ untrack แล้ว แต่เป็น local-only key)

---

## 7. Manual Test Checklist สำหรับเจ้าของโปรเจกต์

ก่อนเปิดใช้งานจริง ควรทำด้วยมืออย่างน้อยหนึ่งรอบ (รายการเต็มอยู่ที่ [`production-checklist.md`](production-checklist.md) และ [`qa-test-plan.md`](qa-test-plan.md) — นี่คือรายการย่อที่เจาะจงสิ่งที่เปลี่ยนแปลง/ยังไม่เคยทดสอบผ่านมือจริง):

- [x] **QA-01**: ลบ `.claude/settings.local.json` ออกจาก git tracking แล้ว (`git rm --cached` + เพิ่ม `.gitignore` — ทำในเซสชันนี้) — **ยังต้องทำด้วยมือ**: แจ้งทีมที่ clone repo อยู่แล้วว่าไฟล์นี้เลิก track แล้ว (ไฟล์เดิมจะยังอยู่ในเครื่องพวกเขาแต่ git จะไม่ตามการเปลี่ยนแปลงอีกต่อไปหลัง pull)
- [ ] เปิดหน้าแรกด้วยเบราว์เซอร์จริง (ไม่ใช่ automation) ทั้งตอน guest และ login แล้วดูด้วยตาว่าไม่มี layout shift ตอน header โหลดเสร็จ (มือถือ + desktop)
- [ ] ทดสอบค้นหาที่หน้าแรกจริง — พิมพ์คำค้นแล้วกดปุ่ม ต้องไปหน้า `/research?q=...` (นี่คือจุดที่เพิ่งพบว่าพังจาก build cache เสียระหว่างเซสชันนี้ — ควรทดสอบซ้ำหลัง deploy จริงเสมอ)
- [ ] เผยแพร่/แก้ไข/เก็บถาวรงานวิจัยจริงหนึ่งรายการที่ `/dashboard/approvals` แล้วเช็คว่าหน้าแรกอัปเดตภายในไม่กี่วินาที (ไม่ใช่รอ 60 วินาทีเต็ม)
- [ ] แก้ไขหมวดหมู่/ตั้งค่าสาธารณะจริงหนึ่งรายการ แล้วเช็คว่าหน้าแรกอัปเดตเช่นเดียวกัน
- [ ] Lighthouse จริงกับโดเมน production หลัง deploy (ค่าที่ได้ในรายงานนี้วัดจาก localhost เท่านั้น)
- [ ] รายการเดิมทั้งหมดใน [`pre-production-checklist.md`](pre-production-checklist.md) ด่านที่ 1-5

---

## 8. สรุปการเปลี่ยนแปลง Test Coverage

| | รายงานเดิม (2026-08-11) | รายงานนี้ (2026-08-13) |
| --- | --- | --- |
| Unit/integration test | 95 (7 ไฟล์) | **127 (11 ไฟล์)** |
| E2E/a11y test | 22 (accessibility เท่านั้น) | **50** (accessibility + auth-verification + header-roles + public-home-cache) |
| Lighthouse | ไม่เคยรัน (static review เท่านั้น) | **รันจริง — Performance 93/100** |
| TTFB | ไม่เคยวัด | **วัดจริง — production ~30-50ms** |
| Cache leak proof | เชิงทฤษฎี (code review) | **เชิงประจักษ์ (browser automation diff)** |

---

## 9. ไฟล์ที่เปลี่ยนแปลงในเซสชันนี้ (รวมงานก่อนหน้าการ audit นี้)

**แก้ไขจาก QA fixes ในรอบนี้โดยตรง:**

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `.gitignore` | เพิ่ม `.claude/settings.local.json` (QA-01) |
| `.claude/settings.local.json` | `git rm --cached` — เลิก track (QA-01, ไฟล์ยังอยู่ใน working tree) |
| `app/superadmin/pdf-processing/actions.ts` | เปลี่ยน 5 จุดจาก manual rank check เป็น `requireMinRank()` (QA-04) |
| `lib/jobs/process-now.action.server.ts` | เปลี่ยน 1 จุดจาก manual rank check เป็น `requireMinRank()` (QA-04) |
| `lib/data/queries.ts` | เปลี่ยน 9 จุดจาก raw error throw เป็น `toSafeErrorMessage()` (QA-05, บางส่วน) |
| `docs/qa-production-readiness.md` | ไฟล์รายงานนี้เอง (ใหม่) |

**สร้างใหม่ในเซสชันนี้ (งานก่อนหน้าการ audit):**
- `docs/homepage-rendering-performance.md`

**เปลี่ยนชื่อ/แก้ไขในเซสชันนี้ (งานก่อนหน้าการ audit — public homepage caching):**
- `docs/caching.md` → `docs/homepage-caching.md` (rename)
- `e2e/public-home-cache.spec.ts`, `lib/cache/public-home.ts`, `docs/auth-verification-audit.md`, `docs/membership-system-audit.md` — อัปเดต path reference ตามการ rename ข้างต้น

ไฟล์อื่นที่ปรากฏใน `git status` (`dev-server.log`, `test-results/`) เป็น artifact จากการรัน dev server/test ระหว่างเซสชันนี้เท่านั้น ไม่ใช่การเปลี่ยนแปลงที่ตั้งใจ
