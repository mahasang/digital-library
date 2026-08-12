# Pre-Production Checklist

รายการตรวจสอบก่อนขึ้น production รอบนี้ — เป็น **go/no-go gate ที่ผูกกับผลการตรวจสอบใน [`docs/production-readiness-report.md`](production-readiness-report.md)** โดยตรง (อัปเดตล่าสุดหลัง **Final Regression QA** 2026-08-08 — ยืนยันซ้ำว่า C-1 และ M-1/M-4 ยังแก้ไขสมบูรณ์ ไม่ regress ดูหัวข้อ 0 ของรายงาน) ใช้คู่กับเอกสารที่มีอยู่เดิม:

- ขั้นตอน deploy บน Vercel, environment variables ทั้งหมด, การรัน migrations → [`docs/deployment-checklist.md`](deployment-checklist.md)
- การทดสอบเชิงฟังก์ชัน/สิทธิ์ตามบทบาทแบบละเอียด → [`docs/production-checklist.md`](production-checklist.md)
- Test case แบบละเอียดของแต่ละฟีเจอร์ → [`docs/qa-test-plan.md`](qa-test-plan.md)

เอกสารนี้ไม่ได้ทำซ้ำรายการในสามไฟล์ข้างต้น แต่รวบรวมเฉพาะสิ่งที่ **ต้องทำก่อน** ตามผลการตรวจสอบรอบนี้โดยเฉพาะ

---

## ด่านที่ 1 — Blocker (ต้องผ่านทุกข้อก่อน deploy จริง)

- [x] ~~แก้ไข C-1~~ **✅ แก้ไขแล้ว ยืนยันซ้ำไม่ regress ในรอบ Final QA** — `research_document_texts` เคยเปิดให้ดึงเนื้อหาไฟล์เต็มได้โดยตรงผ่าน REST API แม้เอกสารเป็น `read_only` (ห้ามดาวน์โหลด) ปิดช่องโหว่แล้วด้วย migration `supabase/migrations/20260822100000_restrict_document_text_exposure.sql` — ดูหลักฐานใน `production-readiness-report.md` หัวข้อ 0/2 (Critical, C-1)
- [x] **SEARCH-03** ใน `qa-test-plan.md` ผ่านแล้ว (28/28 ยืนยันซ้ำในรอบ Final QA) — automated regression test (`lib/data/research-search-rls.integration.test.ts`) ยืนยันว่า response ไม่มีเนื้อหาไฟล์เต็มหลุดออกมาในทุกกรณี (`public`/`read_only`/`member_only`/`staff_only`/`metadata_only`) รันซ้ำได้ด้วย `npm run test` (ต้องมี local Supabase รันอยู่)
- [x] ~~แก้ไข M-1 (rank ในระบบค้นหา, บันทึกเป็น M-4)~~ **✅ แก้ไขแล้ว ยืนยันซ้ำไม่ regress ในรอบ Final QA** (39/39) — `lib/search/rank.ts` + `ORDER BY` ที่ RPC ทำให้ผลค้นหาเรียงลำดับคาดเดาได้และ pagination คงที่ ดู `production-readiness-report.md` หัวข้อ 0/2 (M-4)
- [x] Regression ฟีเจอร์ค้นหาเนื้อหา PDF ผ่านแล้ว — SEARCH-01/02/04/06/09/11 มี automated test ครอบคลุมแล้ว (ดู `qa-test-plan.md`), SEARCH-05/07/08 มี unit test แยก (`lib/data/research-search.pagination.test.ts`)
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test` ผ่านทั้งหมด — รันสดซ้ำในรอบ Final Regression QA แล้ว (95 test, 7 ไฟล์, 0 error)
- [x] **Access grant ที่หมดอายุ (ACR-07)** — ทดสอบเชิงประจักษ์ใหม่ในรอบ Final QA: grant ที่หมดอายุถูกปฏิเสธถูกต้องจริงผ่าน session ผู้ใช้จริง ไม่ใช่แค่ทฤษฎี ดู `production-readiness-report.md` หัวข้อ 0.3
- [ ] ยืนยันสิทธิ์การเข้าถึงตามบทบาทครบ 6 ระดับ (Guest/Member/Staff/Librarian/Admin/Super Admin) ผ่าน **UI จริง** ตาม `production-checklist.md` หัวข้อ 1 — ยังเป็น manual test (automated integration test ทดสอบที่ชั้น Postgres โดยตรง ไม่ใช่ผ่านเบราว์เซอร์)

## ด่านที่ 2 — High Priority (ควรทำก่อน แต่ไม่บล็อกถ้ามีแผนแก้ไขชัดเจนภายในสัปดาห์แรกหลัง launch)

- [ ] ตัดสินใจเรื่อง **M-1 เดิม** (บาง Server Action ใน `/superadmin/*` ไม่ใช้ `requireMinRank()` จึงไม่ได้ผ่านด่าน MFA aal2 ซ้ำ — คนละ finding กับ M-1/M-4 ที่แก้ไปแล้วเรื่องระบบค้นหา) — ดูรายละเอียดใน production-readiness-report.md
- [ ] ทดสอบ UP-04 (ไฟล์ทดสอบ EICAR) กับ malware scan provider จริงที่จะใช้งานจริงใน production ก่อนเปิดรับอัปโหลดสาธารณะ

> **Next.js major version upgrade (M-3, ปิดช่องโหว่ dependency `postcss`/`sharp`)**: **ไม่ให้ทำในรอบ pre-production นี้โดยเจตนา** — บันทึกเป็นงานหลังเปิดใช้งานรุ่นแรกเท่านั้น (post-launch backlog) เพราะเป็น breaking change สูง (`next@15.5.22` → `next@16`) ต้องมีรอบทดสอบแยกต่างหากที่ไม่ผูกกับ release นี้ ไม่ต้องวางแผนหรือดำเนินการใดๆ ก่อน launch รอบแรก

## ด่านที่ 3 — ตั้งค่าที่ต้องทำเองใน Supabase Dashboard

- [ ] สร้าง Supabase project สำหรับ production แยกจาก dev/test (ตาม `deployment-checklist.md`)
- [ ] รัน migrations ทั้ง **32 ไฟล์** (เพิ่ม `20260822100000_restrict_document_text_exposure.sql` ที่แก้ C-1 และ `20260823100000_search_excerpt_deterministic_order.sql` ที่แก้ M-4) ผ่าน `supabase db push` หรือ CLI เท่านั้น **ห้ามรันไฟล์ SQL ใน `supabase/migrations/` ด้วยมือทีละไฟล์นอกกลไก CLI** (ดู finding L-3 — บาง migration ไม่มี idempotency guard จึงพังถ้ารันซ้ำนอกระบบ tracking ของ CLI)
- [ ] **ตัดสินใจเรื่อง `supabase/seed.sql`**: เป็นข้อมูลตัวอย่าง/สาธิตเท่านั้น (ไม่ใช่ reference data ที่จำเป็น) — **อย่ารันกับฐานข้อมูล production โดยไม่ได้ตั้งใจ** ต่างจาก migration `20260731100300_seed_reference_data.sql` (roles/categories/organizations) ที่ต้องรันเสมอเพราะเป็นส่วนหนึ่งของ migrations ปกติอยู่แล้ว
- [ ] เปิด TOTP MFA ที่ **Authentication > Providers > Multi-Factor Authentication** (ไม่เปิดอัตโนมัติสำหรับ Cloud project — ต่างจาก local ที่เปิดไว้ให้แล้วใน `supabase/config.toml`)
- [ ] ตั้งค่า Site URL และ Redirect URLs ให้ชี้โดเมนจริง (`https://<โดเมนจริง>/auth/callback`, `/api/orcid/callback` ถ้าเปิดใช้ ORCID)
- [ ] สร้างบัญชี Super Admin คนแรกผ่าน SQL ตามขั้นตอนใน README.md (มีเพียงบัญชีแรกเท่านั้นที่ต้องทำผ่าน SQL)
- [ ] ตรวจสอบ Storage Buckets ครบ 4 อัน (`research-documents`, `research-covers`, `submission-attachments`, `site-assets`) พร้อม policy ถูกต้อง

## ด่านที่ 4 — ตั้งค่าที่ต้องทำเองใน Vercel

- [ ] ตั้งค่า Environment Variables ครบตามตารางใน README.md หัวข้อ "Deploy บน Vercel" — โดยเฉพาะตัวที่ **ต้องเป็น server-only เท่านั้น**: `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `MALWARE_SCAN_API_KEY`, `ORCID_CLIENT_SECRET`, `OCR_PROVIDER_API_KEY`, `LOGGING_BETTERSTACK_SOURCE_TOKEN`
- [ ] **ตรวจสอบแผน Vercel รองรับความถี่ Cron ที่ตั้งไว้**: `vercel.json` กำหนด `/api/jobs/process` ทุก 5 นาที และ `/api/cron/health-check` ทุก 10 นาที — **แผน Hobby (ฟรี) รองรับ Cron แค่วันละครั้งเท่านั้น** ถ้าใช้แผนฟรีต้องอัปเกรดเป็น Pro หรือใช้บริการ Cron ภายนอกยิง endpoint เดียวกันแทน (ดู `docs/background-jobs.md` หัวข้อ 6.2)
- [ ] ตั้งค่า `CRON_SECRET` และยืนยันว่า Cron/บริการภายนอกส่ง header `Authorization: Bearer $CRON_SECRET` ตรงกันทั้งสอง endpoint
- [ ] เปิดใช้งาน Uptime Monitoring เชื่อมกับ `/api/health` (ดู `docs/uptime-monitoring.md`)
- [ ] Push โค้ดขึ้น Git repository ก่อน import เข้า Vercel — **โปรเจกต์นี้ยังไม่ใช่ Git repository** (`git init` ก่อน)

## ด่านที่ 5 — หลัง Deploy ครั้งแรก

- [ ] ทดสอบ Golden Path ครบ: Guest ค้นหา/ดูงานวิจัย public, Member สมัคร/ล็อกอิน/ดาวน์โหลด, Staff ส่งงานวิจัย, Librarian อนุมัติ, Admin จัดการผู้ใช้, Super Admin เข้า `/superadmin` (ผ่าน MFA)
- [ ] ทดสอบว่าอีเมลยืนยันสมัครสมาชิก/ลืมรหัสผ่านพาไปโดเมนจริง ไม่ใช่ `localhost`
- [ ] ทดสอบ `https://<โดเมนจริง>/api/health` ตอบกลับ 200
- [ ] ยืนยันว่า background job ทำงานอัตโนมัติจริง (ไม่ใช่แค่ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ที่กดเอง) — เช็คที่ `/superadmin/cron-monitoring` ว่ามี `cron_runs` ล่าสุดภายในรอบเวลาที่ตั้งไว้
- [ ] ยืนยันว่า `read_only`/`metadata_only` ยังคงบังคับใช้ถูกต้องกับข้อมูลจริง (ไม่ใช่แค่ข้อมูลทดสอบ) หลัง deploy — สุ่มตรวจเอกสารจริง 2-3 รายการ

---

## สรุปสถานะ ณ วันที่ตรวจสอบ (2026-08-08, อัปเดตหลัง Final Regression QA)

| รายการ | สถานะ |
| --- | --- |
| Code quality (lint/typecheck/build/test) | ✅ ผ่านทั้งหมด (95 test, 7 ไฟล์) — รันสดซ้ำในรอบ Final QA |
| Migrations รันจากศูนย์สำเร็จ | ✅ ยืนยันแล้วผ่าน `supabase db reset` (32 ไฟล์) — ยืนยันซ้ำหลายรอบตลอดการแก้ไข |
| H-1 (raw error message leak) | ✅ แก้ไขแล้ว |
| H-2 (merge confirmation bypass) | ✅ แก้ไขแล้ว |
| **C-1 (document text exposure)** | ✅ **แก้ไขแล้ว ยืนยันไม่ regress ในรอบ Final QA (28/28) — ไม่บล็อก deploy** |
| **M-4 (rank ในระบบค้นหา, ขอแก้ในนาม "M-1")** | ✅ **แก้ไขแล้ว ยืนยันไม่ regress ในรอบ Final QA (39/39)** — ไม่ใช่ finding เดียวกับ M-1 เดิมที่เป็น RBAC role rank (ดูหมายเหตุใน production-readiness-report.md) |
| Access grant หมดอายุ (ACR-07) | ✅ ทดสอบเชิงประจักษ์ใหม่ในรอบ Final QA — ปฏิเสธถูกต้องจริง |
| RLS ตารางอ่อนไหวอื่น (research_items/access_requests/favorites/download_logs/audit_logs/document_access_grants/reading_history) | ✅ ยืนยันเปิดใช้งานครบทุกตารางในรอบ Final QA |
| MFA/Turnstile/Rate Limit/File Upload Validation | ✅ ไม่ถูกแตะต้องระหว่างแก้ C-1/M-1 (ยืนยันด้วย mtime) — ข้อสรุปเดิมยังใช้ได้ |
| Mobile Responsive หน้าหลัก | ✅ ยืนยัน Tailwind responsive class ใช้งานจริงครบทุกไฟล์ที่ตรวจ (static review + compile check) |
| Dark Mode | ❌ ไม่รองรับ (informational, ไม่บล็อก — scope decision) |
| M-1 เดิม (RBAC), M-2, M-3 (dependency) | ⚠️ ยังไม่แก้ — ไม่บล็อก แต่ควรมีแผน — **M-3 (Next.js upgrade) ถูกเลื่อนเป็น post-launch backlog โดยเจตนา ห้ามทำรอบนี้** |
| Automated test coverage | ✅ unit test 67 รายการ (6 ไฟล์) + integration test (ต่อ Postgres/Auth จริง) 28 รายการ — ยังไม่มี E2E ผ่านเบราว์เซอร์ |
| **คำตัดสินสุดท้าย** | **Ready with Conditions** — ไม่มี Critical/High ค้างแล้ว เงื่อนไขที่เหลือเป็นงานปฏิบัติการมาตรฐานเท่านั้น (ดู `production-readiness-report.md` หัวข้อ 7) |
