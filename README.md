# ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร

เว็บไซต์สำหรับส่ง ตรวจสอบ อนุมัติ ค้นหา และอ่านงานวิจัยในรูปแบบ PDF/eBook ขององค์กร
พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Database, Auth, Storage)

> ดูรายละเอียดข้อกำหนดโครงการฉบับเต็มได้ที่ [`docs/project-spec.md`](docs/project-spec.md)

## เทคโนโลยีที่ใช้

- [Next.js 15](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [Supabase](https://supabase.com/) — ฐานข้อมูล PostgreSQL, Auth, Row Level Security, Storage
- [Zod](https://zod.dev/) — ตรวจสอบความถูกต้องของข้อมูลฟอร์ม
- [Recharts](https://recharts.org/) — กราฟเชิงลึกในหน้า `/superadmin/overview`
- [dnd-kit](https://dndkit.com/) — ลากวางจัดลำดับหมวดหมู่/หน่วยงานในหน้า `/superadmin/categories`, `/superadmin/organizations`
- [react-pdf](https://github.com/wojtekmaj/react-pdf) + [react-pageflip](https://github.com/Nodlik/react-pageflip) — หน้าอ่านออนไลน์แบบ flipbook (เปิดสมุดเสมือนจริง) ที่ `/research/[id]/read`

**หมายเหตุ:** หน้าเว็บสาธารณะ (ค้นหา/ดูรายละเอียด) ยังทำงานได้แม้ไม่ได้ตั้งค่า Supabase
— จะใช้ **ข้อมูลตัวอย่าง (Mock Data)** จาก `data/research.ts` และ `data/categories.ts`
เป็น fallback โดยอัตโนมัติ ส่วนฟีเจอร์ที่ต้องเขียนข้อมูล (ส่งงานวิจัย, อนุมัติ,
รายการโปรด, ประวัติการอ่าน) จำเป็นต้องเชื่อมต่อ Supabase จริงเสมอ
(ดูหัวข้อ [การเชื่อมต่อ Supabase](#การเชื่อมต่อ-supabase))

## วิธีติดตั้งและรันโครงการ

### ข้อกำหนดเบื้องต้น

- Node.js เวอร์ชัน 18.18 ขึ้นไป (แนะนำ 20 LTS หรือใหม่กว่า)
- npm (มาพร้อมกับ Node.js)
- บัญชี [Supabase](https://supabase.com/) (ฟรี) — จำเป็นสำหรับระบบสมาชิก/ส่งงานวิจัย/อนุมัติ
  ไม่จำเป็นสำหรับการรันดูตัวอย่างหน้าเว็บสาธารณะด้วย Mock Data

### ขั้นตอนการติดตั้ง

```bash
# 1. ติดตั้ง dependencies
# (postinstall จะคัดลอก pdf.worker.min.mjs จาก pdfjs-dist ไปไว้ที่ public/
#  อัตโนมัติ — ดู scripts/copy-pdf-worker.js — ไม่ต้องทำอะไรเพิ่มเติม)
npm install

# 2. (ทางเลือก) ตั้งค่า Supabase — ดูรายละเอียดในหัวข้อถัดไป
cp .env.example .env.local

# 3. รันเซิร์ฟเวอร์สำหรับพัฒนา (Development)
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3001](http://localhost:3001)

> **แก้ปัญหา `EADDRINUSE`/`address already in use :::3001`**: มักเกิดจาก
> เซิร์ฟเวอร์ dev รอบก่อนหน้ายังค้างอยู่เบื้องหลัง (โดยเฉพาะบน Windows ที่การ
> ปิด terminal บางครั้งไม่ฆ่า process ลูกของ `npm run dev` ให้ครบ) หาและปิด
> process ที่ถือ port 3001 ค้างไว้ก่อนรันใหม่:
> ```bash
> netstat -ano | grep ":3001" | grep LISTENING   # ดู PID คอลัมน์ขวาสุด
> powershell -Command "Stop-Process -Id <PID> -Force"
> ```

### คำสั่งอื่นๆ

```bash
# ตรวจสอบคุณภาพโค้ดด้วย ESLint
npm run lint

# สร้างไฟล์สำหรับ Production
npm run build

# รันเซิร์ฟเวอร์ Production (หลังจาก build แล้ว)
npm run start
```

## การเชื่อมต่อ Supabase

โปรเจกต์นี้ใช้ [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs)
สำหรับ Auth แบบ cookie-based บน Next.js App Router, PostgreSQL + Row Level Security
(RLS) เป็นฐานข้อมูลหลัก และ Supabase Storage สำหรับไฟล์ PDF/ภาพปก/เอกสารแนบ

### 0. ทดลองใช้งานแบบ Local ทั้งหมดก่อน (ไม่ต้องสร้างโปรเจกต์ Cloud)

หากยังไม่พร้อม deploy จริงและต้องการทดลองใช้งานในเครื่องก่อน ใช้ Supabase CLI
รัน Postgres/Auth/Storage จำลองผ่าน Docker ได้ทั้งหมดโดยไม่ต้องสมัคร Supabase
Cloud เลย — ข้ามไปหัวข้อที่ 3 (รัน Migrations) ได้ทันทีหลังทำตามนี้:

```bash
# ต้องติดตั้ง Docker Desktop ไว้ก่อน (Supabase CLI ใช้ Docker รันแต่ละบริการ)
npx supabase start

# ดึง URL/คีย์ของ local instance (ค่าคงที่มาตรฐาน เหมือนกันทุกเครื่อง ไม่ใช่ secret จริง)
npx supabase status
```

นำค่า `API_URL`, `ANON_KEY`/`PUBLISHABLE_KEY`, `SERVICE_ROLE_KEY`/`SECRET_KEY`
จากผลลัพธ์ไปกรอกใน `.env.local` (ข้ามหัวข้อที่ 1-2 ด้านล่างซึ่งเป็นขั้นตอน
สำหรับโปรเจกต์ Cloud) — คีย์เหล่านี้เป็นคีย์ demo มาตรฐานที่ Supabase CLI สร้าง
ให้ทุกเครื่องเหมือนกัน ปลอดภัยที่จะเก็บไว้ใน `.env.local` (ซึ่งอยู่ใน
`.gitignore` อยู่แล้ว) แต่ไม่ควรใช้ค่าเดียวกันนี้กับโปรเจกต์ production จริง

เครื่องมือที่ได้มาพร้อมกัน:

| เครื่องมือ | URL | ใช้ทำอะไร |
| --- | --- | --- |
| Supabase Studio | http://127.0.0.1:54323 | ดู/แก้ข้อมูลในตารางแบบ GUI, ดู Auth users, ดู Storage buckets |
| Mailpit (กล่องอีเมลจำลอง) | http://127.0.0.1:54324 | ดูอีเมลยืนยันสมัครสมาชิก/ลืมรหัสผ่านที่ระบบส่ง (ไม่ส่งไปอีเมลจริง) |

> `supabase/config.toml` ตั้งค่า `auth.site_url`/`auth.additional_redirect_urls`
> ให้ชี้ไปที่ `http://localhost:3001` ไว้ล่วงหน้าแล้ว (ตรงกับ dev port ของ
> โปรเจกต์นี้ — ดูหัวข้อ [คำสั่งอื่นๆ](#คำสั่งอื่นๆ)) หากรันแอปที่พอร์ตอื่น
> ต้องแก้ค่านี้ในไฟล์เอง แล้วรัน `npx supabase stop` ตามด้วย
> `npx supabase start` ใหม่เพื่อให้มีผล (ข้อมูลในฐานข้อมูลไม่หายเมื่อ stop/start
> ตราบใดที่ไม่ใช้ flag `--no-backup`)

เมื่อพร้อม deploy จริงในภายหลัง ค่อยสร้างโปรเจกต์ Cloud ตามหัวข้อที่ 1 แล้ว
เปลี่ยนค่าใน `.env.local`/Environment Variables บน Vercel จาก local เป็น
cloud project — โค้ดแอปไม่ต้องแก้อะไรเลย เพราะเชื่อมต่อผ่าน environment
variable ชุดเดียวกันทั้งสองกรณี

### 1. สร้างโปรเจกต์ Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com/dashboard](https://supabase.com/dashboard)
2. ไปที่ **Project Settings > API** แล้วคัดลอกค่า `Project URL`, `anon public` key
   และ `service_role` key (ใช้เฉพาะฝั่งเซิร์ฟเวอร์ — ดูคำเตือนด้านล่าง)

### 2. ตั้งค่า Environment Variables

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่าที่ได้จากขั้นตอนที่ 1:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**คำเตือนด้านความปลอดภัย:** `SUPABASE_SERVICE_ROLE_KEY` ข้าม Row Level Security
ทั้งหมด ต้องไม่มี prefix `NEXT_PUBLIC_` (จะถูกฝังในโค้ดฝั่ง client ทันทีถ้ามี)
และห้าม commit ไฟล์ `.env.local` โดยเด็ดขาด โค้ดที่ใช้คีย์นี้อยู่ใน
`lib/supabase/service.ts` และถูก import เฉพาะจากไฟล์ Server Action/Server
Component เท่านั้น (มี `import "server-only"` กำกับไว้เพื่อป้องกันการ bundle
เข้าโค้ดฝั่ง client โดยไม่ตั้งใจ)

### 3. รัน Migrations (สร้างตาราง, ฟังก์ชัน, RLS, Storage Buckets)

ไฟล์ migration ทั้งหมดอยู่ใน [`supabase/migrations/`](supabase/migrations/)
เรียงตามลำดับการรัน:

| ไฟล์ | เนื้อหา |
| --- | --- |
| `20260731100000_schema.sql` | ตารางหลัก 15 ตาราง, Foreign Keys, Constraints, Indexes |
| `20260731100100_functions_triggers.sql` | Trigger functions (`updated_at`, สร้างโปรไฟล์อัตโนมัติเมื่อสมัครสมาชิก) และ RPC functions (`increment_research_views`, `log_research_download`, `log_reading_history`, `user_max_role_rank`) |
| `20260731100200_rls_policies.sql` | เปิดใช้งาน Row Level Security และกำหนด Policy ทุกตาราง |
| `20260731100300_seed_reference_data.sql` | ข้อมูลอ้างอิงหลักที่ระบบต้องมี: บทบาท (roles), หมวดหมู่ (categories), หน่วยงาน (organizations) |
| `20260801100000_submissions_and_approvals.sql` | คอลัมน์เพิ่มเติมสำหรับฟอร์มส่งงานวิจัย, ตาราง `approval_logs`, trigger บันทึกประวัติการเปลี่ยนสถานะอัตโนมัติ |
| `20260801100100_storage_buckets.sql` | สร้าง Storage Buckets 3 อัน และ Storage Policies |
| `20260802100000_admin_dashboard.sql` | `profiles.is_active` (เปิด/ปิดบัญชี), หมวดหมู่หลัก/ย่อย (`parent_id`) และ `is_active` ของหมวดหมู่/หน่วยงาน, ตาราง `settings` (singleton), RLS ให้ admin แก้ไขโปรไฟล์ผู้อื่น/ตั้งค่าระบบได้ |
| `20260802100100_super_admin_role.sql` | บทบาท `super_admin` (rank 50), จำกัดการจัดการตาราง `roles` และการมอบ/ถอดถอนบทบาท super_admin ให้ rank ≥ 50 เท่านั้น, trigger ป้องกันการถอดถอน super_admin คนสุดท้าย, ฟังก์ชัน `superadmin_storage_usage()` |
| `20260803100000_superadmin_phase2.sql` | ขยายตาราง `settings` (การสมัครสมาชิก/ส่งงานวิจัย, ขนาดไฟล์, CAPTCHA, การแจ้งเตือน, Rate Limit — แก้ไขได้เฉพาะ super_admin), bucket `site-assets`, ตาราง `notifications`/`rate_limit_events`, ฟังก์ชัน `check_rate_limit()`, `superadmin_orphaned_storage_objects()`, `superadmin_update_bucket_limit()` |
| `20260804100000_category_org_ordering.sql` | `categories.sort_order`/`organizations.sort_order` (backfill ค่าเดิมอัตโนมัติ), trigger ป้องกัน circular reference ใน `categories.parent_id`, trigger จำกัดการแก้ไข `sort_order` ให้เฉพาะ super_admin, trigger กำหนด `sort_order` อัตโนมัติให้แถวใหม่, ฟังก์ชัน `superadmin_reorder_categories()`, `superadmin_move_category()`, `superadmin_reorder_organizations()` |
| `20260805100000_file_scan_security.sql` | คอลัมน์ `scan_status`/`scanned_at`/`scan_provider`/`scan_reason` บน `research_items` (backfill แถวเดิมเป็น `skipped`/`legacy-pre-scan`), trigger `prevent_publish_unscanned_file()` กันเผยแพร่ไฟล์ที่ยังไม่ผ่านการตรวจสอบ/ติดมัลแวร์ |
| `20260806100000_mfa_reset.sql` | `grant insert on public.notifications to service_role` (แก้ปัญหา service_role ยังต้องมี table-level grant แม้จะมี BYPASSRLS) เพื่อรองรับฟีเจอร์ Super Admin รีเซ็ต MFA ผู้ใช้อื่น |
| `20260807100000_pdf_fulltext_search.sql` | ตาราง `research_document_texts` (ข้อความที่ดึงจาก PDF, สถานะการประมวลผล, RLS สะท้อนสิทธิ์ของ `research_items` แถวเดียวกัน), ฟังก์ชัน `acquire_extraction_lock()`, เปิดใช้งาน `pg_trgm` สำหรับค้นหาเนื้อหา |
| `20260808100000_document_access_requests.sql` | ตารางใหม่ 4 ตัว: `access_requests`, `document_access_grants`, `notification_preferences`, `category_subscriptions` — ขยาย trigger แจ้งเตือนเดิมให้ครอบคลุมผู้ติดตามหมวดหมู่ |
| `20260809100000_data_quality_authority_control.sql` | ขยาย `authors` (`display_name_en`, `normalized_name_*`, ORCID, `merged_into_author_id` ฯลฯ) และ `organizations` (โครงสร้างหลัก/ย่อย, `merged_into_organization_id`), ตาราง `duplicate_research_reviews`, ฟังก์ชัน `find_similar_research_items()` และฟังก์ชัน merge ผู้วิจัย/หน่วยงาน/งานวิจัย (security definer) |
| `20260810100000_background_jobs.sql` | ตาราง `background_jobs` (persistent queue ด้วย `FOR UPDATE SKIP LOCKED`, idempotency key, retry แบบ exponential backoff) รองรับ 4 job type แรก: `pdf_text_extraction`, `file_security_rescan`, `access_expiration`, `category_notification` |
| `20260811100000_access_expiration_and_publish_events.sql` | ขยาย job `access_expiration` ให้ปิด `document_access_grants` ที่หมดอายุ + แจ้งเตือนล่วงหน้า, ฟังก์ชันกลาง `notifyResearchPublished()` ฝั่งแอปที่ทุกเส้นทางเผยแพร่งานวิจัยเรียกร่วมกัน |
| `20260812100000_data_quality_admin_and_mfa_overview.sql` | ตารางเกณฑ์ตรวจงานวิจัยซ้ำแบบ versioned (น้ำหนัก/threshold ปรับได้โดย super_admin), job type ใหม่ `duplicate_scan`, รองรับหน้าภาพรวมสถานะ MFA ของ Super Admin ทุกคน |
| `20260813100000_orcid_oauth_and_ocr.sql` | ตาราง `orcid_oauth_states`/`orcid_oauth_tokens`, คอลัมน์ `orcid_oauth_verified_at`, คอลัมน์ OCR บน `research_document_texts` (`ocr_text`/`ocr_provider`/`ocr_language`/`ocr_confidence`) |
| `20260814100000_background_jobs_reliability.sql` | คอลัมน์ `dead_letter_notified_at` (แจ้งเตือน Super Admin เมื่อ job เข้า DLQ), คอลัมน์ progress (`startedAt`/`updatedAt`) รองรับ concurrency ที่ปรับได้ต่อประเภทงาน |
| `20260815100000_access_expiration_warning_settings.sql` | เพิ่มค่าตั้งใน `settings` สำหรับจำนวนวันแจ้งเตือนก่อนสิทธิ์หมดอายุ (1-30, ค่าเริ่มต้น 3) และเปิด/ปิด in-app/email แยกเฉพาะฟีเจอร์นี้ |
| `20260816100000_orcid_public_api_and_ocr_limits.sql` | คอลัมน์ cache `orcid_api_checked_at`/`orcid_api_public_name` บน `authors`, ค่าตั้งขนาด/จำนวนหน้า/โควตา OCR ที่ปรับได้ใน `settings`, คอลัมน์ `research_items.page_count` |
| `20260817100000_job_batches_lifecycle_schema.sql` | ตาราง `job_batches` (master job) รองรับ pause/resume/cancel และตัวนับ progress แบบ O(1) |
| `20260817110000_bulk_candidate_functions.sql` | SQL function 6 ตัวสำหรับนับ/แบ่งหน้ารายการที่ต้องประมวลผลแบบ join ในฐานข้อมูล (แก้ปัญหา filter parity ที่ PostgREST query builder ฝั่ง JS ทำ join ข้ามตารางไม่ได้) |
| `20260817120000_job_batch_lifecycle_functions.sql` | ฟังก์ชันควบคุมวงจรชีวิต `job_batches` (สร้างแบบ idempotent, หยุดชั่วคราว/ทำงานต่อ/ยกเลิกเฉพาะรายการที่ยัง `pending`) |
| `20260818100000_ocr_progress_and_blocked_status.sql` | สถานะ OCR ใหม่ `blocked` (แยกจาก `failed`), คอลัมน์ `current_page`/`total_pages` สำหรับ progress ระดับหน้าจริงของ provider แบบ `external_api` |
| `20260819100000_worker_concurrency.sql` | ฟังก์ชัน `claim_background_jobs_with_concurrency()` ใช้ `pg_advisory_xact_lock` ต่อประเภทงาน บังคับ concurrency แบบ global ข้าม worker/instance จริง |
| `20260819110000_queue_health.sql` | Query/ฟังก์ชันสรุปสถานะ Queue โดยรวม (worker ที่ active ต่อประเภทงาน, งานที่ lease หมดอายุ, งานที่รอคิวนานผิดปกติ) สำหรับหน้า `/superadmin/jobs` |
| `20260820100000_cron_monitoring.sql` | ตาราง `cron_runs` (ประวัติการทำงานของ cron/worker หลัก 5 ตัว), ค่าตั้งความถี่ที่คาดหวัง/เกณฑ์แจ้งเตือนต่อ cron, job บำรุงรักษาตัวแรก `maintenance_cleanup` |
| `20260821100000_ocr_provider_validation.sql` | ตาราง `ocr_test_runs` (ไม่มี foreign key ไปยัง `research_items`), job type ใหม่ `ocr_test_run` สำหรับ Controlled OCR Test ที่ `/superadmin/ocr` |

**วิธีที่ 1 — ใช้ Supabase CLI (แนะนำ)**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**วิธีที่ 2 — รันด้วยตนเองผ่าน Supabase Dashboard**

เปิด **SQL Editor** ในแดชบอร์ด แล้วรันไฟล์ทั้งหมดในโฟลเดอร์
`supabase/migrations/` ตามลำดับชื่อไฟล์ (เรียงตามวันที่/เวลาอยู่แล้ว — ใช้
`ls supabase/migrations/` เพื่อดูจำนวนไฟล์ล่าสุด และ `npx supabase migration
list` เพื่อเทียบว่า production apply ครบหรือยัง)

### 4. นำเข้าข้อมูลตัวอย่าง (Seed Data)

ไฟล์ [`supabase/seed.sql`](supabase/seed.sql) แปลงข้อมูลตัวอย่างชุดเดียวกับ
`data/research.ts` (10 รายการ) ให้เป็นข้อมูลจริงในฐานข้อมูล สำหรับทดสอบ/สาธิตระบบ
(ยังไม่มีไฟล์ PDF จริงแนบมาด้วย — `pdf_file` ของข้อมูลชุดนี้ยังชี้ไปที่พาธตัวอย่าง
ที่ไม่มีไฟล์จริงใน Storage หากต้องการทดสอบอ่าน/ดาวน์โหลดไฟล์จริง ให้ส่งงานวิจัย
ใหม่ผ่านหน้า `/submit-research` แทน)

```bash
# Local development (Supabase CLI) — รัน migrations + seed.sql ให้อัตโนมัติ
npx supabase db reset

# หรือรันกับฐานข้อมูลบน Supabase Cloud โดยตรง (ต้องรัน migrations ก่อนเสมอ)
psql "$DATABASE_URL" -f supabase/seed.sql
```

> ทดสอบแล้วว่า migrations ทั้งหมด (รวม Storage Buckets/Policies และ trigger
> บันทึกประวัติการอนุมัติ) รันผ่านได้จริงกับ PostgreSQL ผ่าน Docker container
> ระหว่างพัฒนา รวมถึงตรวจสอบ RLS ว่าจำกัดสิทธิ์ตามบทบาทถูกต้องทั้งฝั่งตาราง
> ปกติและ Storage (เช่น staff อัปโหลดไฟล์เข้าโฟลเดอร์ของผู้อื่นไม่ได้
> ผู้ใช้ทั่วไปเห็นไฟล์ private ของคนอื่นไม่ได้ แต่ librarian เห็นได้)

### 5. สร้าง Storage Buckets

Migration `20260801100100_storage_buckets.sql` และ `20260803100000_superadmin_phase2.sql`
สร้าง Bucket ให้อัตโนมัติแล้ว (ผ่าน `insert into storage.buckets`) ไม่ต้องสร้าง
เพิ่มในแดชบอร์ด แต่หากต้องการตรวจสอบว่าตั้งค่าถูกต้อง ไปที่ **Storage** ใน
แดชบอร์ดแล้วตรวจสอบว่ามี 4 bucket นี้:

| Bucket | Public | ขนาดสูงสุด | ชนิดไฟล์ | ใช้เก็บ |
| --- | --- | --- | --- | --- |
| `research-documents` | ไม่ (private) | 50 MB (แก้ไขได้ที่ /superadmin/system-settings) | PDF | ไฟล์ฉบับเต็มของงานวิจัย |
| `research-covers` | ใช่ (public) | 5 MB (แก้ไขได้เช่นกัน) | PNG/JPEG/WEBP/SVG | ภาพหน้าปก |
| `submission-attachments` | ไม่ (private) | 20 MB (แก้ไขได้เช่นกัน) | PDF/รูปภาพ/Word | เอกสารประกอบการส่ง (เช่น หนังสือรับรองลิขสิทธิ์) |
| `site-assets` | ใช่ (public) | 2 MB | PNG/JPEG/WEBP/SVG/ICO | โลโก้และ favicon (อัปโหลดที่ /superadmin/system-settings) |

**รูปแบบพาธไฟล์**: `{auth.uid()}/{draftKey}/{filename}` — ส่วนแรกของพาธคือ
`uid` ของผู้อัปโหลด ใช้เป็นฐานของ Storage RLS Policy (เจ้าของไฟล์หรือ
librarian/admin เท่านั้นที่เข้าถึงไฟล์ใน private bucket ได้โดยตรง)

**การเข้าถึงไฟล์ของผู้อ่านทั่วไป (Guest/Member/Staff ตาม `access_level`)**
ไม่ได้ผ่าน Storage Policy โดยตรง แต่ผ่าน **Signed URL** ที่สร้างขึ้นฝั่งเซิร์ฟเวอร์
(`lib/storage/signed-url.server.ts`) ด้วย Service Role หลังตรวจสอบสิทธิ์ตาม
`access_level`/`status` ของงานวิจัยแล้วเท่านั้น (ลิงก์อ่านหมดอายุใน 30 นาที
ลิงก์ดาวน์โหลดหมดอายุใน 1 นาที) วิธีนี้ทำให้ bucket เอกสารเป็น private ล้วน
ไม่มี public URL ของไฟล์ PDF รั่วไหลออกไปได้เลย

### 6. ตั้งค่า Auth (Supabase Dashboard > Authentication)

- **Email provider**: เปิดใช้งาน (เปิดอยู่โดยค่าเริ่มต้น)
- **Site URL** และ **Redirect URLs**: เพิ่ม `http://localhost:3001/auth/callback`
  (และโดเมนจริงเมื่อ deploy ขึ้น production เช่น `https://your-domain.com/auth/callback`)
- **Confirm email**: เปิดหรือปิดได้ตามต้องการ — โค้ดรองรับทั้งสองกรณี

### 7. สร้างบัญชี Super Admin คนแรก

ระบบไม่มีหน้า UI ให้สมัคร/เลื่อนขั้นเป็น Super Admin ได้เองตั้งแต่ยังไม่มีใครเป็น
Super Admin เลยสักคน (เพราะไม่มีใครมีสิทธิ์เข้าหน้า UI นั้นได้ตั้งแต่แรก
เช่นเดียวกับ Admin คนแรกที่ต้องตั้งด้วยมือเหมือนกัน) **สำหรับบัญชีแรกเท่านั้น**
ต้องมอบสิทธิ์ผ่าน SQL โดยตรง:

1. สมัครสมาชิกตามปกติผ่านหน้า `/register` ก่อน (จะได้บทบาท `member` อัตโนมัติ)
2. เปิด **SQL Editor** ใน Supabase Dashboard (หรือ Studio ที่ `http://127.0.0.1:54323`
   สำหรับ local) แล้วรัน:

```sql
-- แทน 'your-email@example.com' ด้วยอีเมลบัญชีที่สมัครไว้ในขั้นตอนที่ 1
with target_user as (
  select id from public.profiles where email = 'your-email@example.com'
),
super_admin_role as (
  select id from public.roles where name = 'super_admin'
)
insert into public.user_roles (user_id, role_id)
select target_user.id, super_admin_role.id from target_user, super_admin_role
on conflict (user_id, role_id) do nothing;

-- บันทึก audit log สำหรับการมอบสิทธิ์ครั้งนี้ด้วย (ให้ครบตามข้อกำหนดที่ว่า
-- ทุกการเปลี่ยนแปลงบทบาทต้องบันทึก audit_logs แม้จะทำผ่าน SQL โดยตรงก็ตาม
-- ใช้ action เดียวกับที่ /superadmin/users ใช้บันทึกให้อัตโนมัติ เพื่อให้
-- แสดงผลในหน้า "ประวัติที่ถูกดำเนินการกับบัญชีนี้" ได้เหมือนกัน)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select id, 'super_admin_grant', 'profiles', id,
  jsonb_build_object(
    'target_email', email,
    'target_name', coalesce(full_name, email),
    'previous_roles', array['member'],
    'new_roles', array['member', 'super_admin'],
    'reason', 'มอบสิทธิ์ Super Admin คนแรกผ่าน SQL (bootstrap)'
  )
from public.profiles where email = 'your-email@example.com';
```

3. ล็อกอินใหม่อีกครั้ง (หรือรีเฟรชหน้า) แล้วจะเห็นเมนู "Super Admin" ในหน้า
   Header และเข้าถึง `/superadmin/overview` ได้ทันที
4. **ตั้งแต่ตอนนี้เป็นต้นไป ไม่ต้องใช้ SQL อีกแล้ว** — มอบ/ถอดถอนสิทธิ์
   Super Admin ให้คนถัดไปผ่านหน้า `/superadmin/users/[id]` ได้เลย (ต้องพิมพ์
   ยืนยันด้วยคำว่า `CONFIRM` หรืออีเมลของผู้ใช้เป้าหมายก่อนทุกครั้ง — ดู
   รายละเอียดใน [`docs/superadmin-guide.md`](docs/superadmin-guide.md))

**ข้อควรรู้**: ระบบบังคับว่าต้องมี Super Admin เหลืออย่างน้อย 1 คนในระบบเสมอ
(ป้องกันด้วย database trigger) การถอดถอนบทบาทนี้ (ไม่ว่าจะผ่าน UI, โค้ด หรือ
SQL) จึงทำไม่ได้หากเป็นคนสุดท้าย — ต้องมอบสิทธิ์ให้อีกคนก่อนจึงจะถอดถอนคนเดิมได้

### สรุปสถาปัตยกรรมสิทธิ์การเข้าถึง

- **บทบาท (roles)**: `member`(10) → `staff`(20) → `librarian`(30) → `admin`(40)
  → `super_admin`(50) — ตัวเลขคือ rank ใช้เปรียบเทียบสิทธิ์ ยิ่งมากยิ่งสูง
  ผู้ที่ยังไม่เข้าสู่ระบบคือ Guest (ไม่มีแถวใน `user_roles`) สมัครสมาชิกใหม่
  ได้บทบาท `member` อัตโนมัติ เลื่อนขั้นเป็น staff/librarian/admin ได้จากหน้า
  `/dashboard/users` (Admin เท่านั้น — เปลี่ยนบทบาทจริงในตาราง `user_roles`
  ทันที) ส่วนบทบาท `super_admin` มอบ/ถอดถอนได้เฉพาะผู้ที่เป็น super_admin
  อยู่แล้วเท่านั้น (rank ≥ 50) ผ่านหน้า `/superadmin/users/[id]` (ต้องพิมพ์
  ยืนยันด้วยคำว่า `CONFIRM` หรืออีเมลผู้ใช้เป้าหมายก่อนทุกครั้ง) — มีข้อยกเว้น
  เดียวคือ**บัญชีแรกสุดของระบบ**ที่ต้องมอบผ่าน SQL โดยตรงเท่านั้น (ดูหัวข้อ
  "สร้างบัญชี Super Admin คนแรก" ด้านบน) เพราะยังไม่มีใครมีสิทธิ์เข้า UI นั้น
  ระบบบังคับว่าต้องมี super_admin เหลืออย่างน้อย 1 คนเสมอ (ป้องกันด้วย
  database trigger ครอบคลุมทุกเส้นทางรวม cascade delete — ใช้ได้ไม่ว่าจะ
  ถอดถอนผ่าน UI หรือ SQL โดยตรง)
- **เปิด/ปิดสถานะบัญชี** (`/dashboard/users`, Admin เท่านั้น): ใช้ Supabase
  Auth Admin API สั่งระงับบัญชีจริง (`ban_duration`) ไม่ใช่แค่ปรับ flag ในตาราง
  จึงบล็อกการเข้าสู่ระบบได้จริงโดยไม่ลบข้อมูลใดๆ ต้องตั้งค่า
  `SUPABASE_SERVICE_ROLE_KEY` จึงจะใช้งานได้
- **RLS บนตาราง `research_items`**: งานวิจัยที่ `published` และสิทธิ์เป็น
  `public`/`read_only`/`metadata_only` เห็นได้ทุกคน, `member_only` ต้อง rank ≥ 10,
  `staff_only` ต้อง rank ≥ 20; เจ้าของงานเห็นงานของตนเองทุกสถานะ;
  `librarian`/`admin` (rank ≥ 30) เห็นทุกรายการเพื่อตรวจสอบ/อนุมัติ
- **Workflow สถานะเอกสาร**: `draft` → (ผู้ส่งกดส่งตรวจสอบ) → `pending_review`
  → librarian ตัดสินใจ: `approved` / `rejected` / `revision_requested`
  → จาก `approved` librarian กด "เผยแพร่" → `published` — ทุกครั้งที่สถานะ
  เปลี่ยน ระบบบันทึกลง `approval_logs` และ `audit_logs` อัตโนมัติผ่าน
  database trigger (ไม่ใช่โค้ดแอปที่เขียน log เอง จึงมั่นใจได้ว่าไม่มีการ
  เปลี่ยนสถานะครั้งใดหลุดการบันทึก) ผู้ส่งแก้ไขเอกสารได้เฉพาะตอนสถานะเป็น
  `draft`/`revision_requested`; librarian/admin เปลี่ยนสถานะเป็น `archived`
  ได้จากทุกสถานะ (ใช้แทนการลบถาวร — ไม่มีการ hard delete เอกสารที่ผ่าน
  การตรวจสอบแล้วในระบบ)
- **สิทธิ์การเข้าถึงหน้าเว็บ**: บังคับใน `middleware.ts` (เลือก prefix ที่ตรง
  และเจาะจงที่สุดเมื่อมีหลายกฎซ้อนกัน) — ต้องเข้าสู่ระบบสำหรับ `/account`,
  `/favorites`, `/reading-history`, `/access-requests`, `/notifications`,
  `/profile/*`; ต้องเป็น staff ขึ้นไป (rank ≥ 20) สำหรับ `/submit-research`,
  `/my-submissions`; ต้องเป็น librarian ขึ้นไป (rank ≥ 30) สำหรับ `/dashboard/*`
  ทั่วไป (ภาพรวม, อนุมัติ, จัดการงานวิจัย, หมวดหมู่, หน่วยงาน, ผู้วิจัย,
  คุณภาพข้อมูล, งานวิจัยที่อาจซ้ำ, คำขอเข้าถึงเอกสาร, รายงาน — รวมงานวิจัย
  ต้อง rank ≥ 40 ตรวจซ้ำในฟังก์ชัน merge เอง); ต้องเป็น **admin เท่านั้น**
  (rank ≥ 40) สำหรับ `/dashboard/users`, `/dashboard/audit-logs`,
  `/dashboard/settings`; ต้องเป็น **super_admin เท่านั้น** (rank ≥ 50) สำหรับ
  `/superadmin/*` ทั้งหมด (รวมหน้าที่เพิ่มภายหลัง เช่น จัดลำดับหมวดหมู่/หน่วยงาน,
  bulk PDF/OCR/สแกนความปลอดภัยไฟล์, คุณภาพข้อมูลย้อนหลัง, ภาพรวม MFA, Dead-letter
  Queue/Queue Health, ตรวจสอบ Cron/Worker) — Admin ปกติ (rank 40) เข้าไม่ได้
  ถูกพาไปหน้า `/403` เหมือนผู้ใช้ที่ไม่มีสิทธิ์รายอื่น — ผู้ใช้ที่ไม่มีสิทธิ์พอ
  จะถูกพาไปหน้า `/403` ทุกหน้ายังตรวจสอบสิทธิ์ซ้ำที่ฝั่ง Server Component/Server
  Action อีกชั้น (ไม่พึ่งพา middleware เพียงอย่างเดียว) — `/superadmin`
  (Super Admin Dashboard) แยกเลย์เอาต์และแถบเมนูออกจาก `/dashboard`
  (Admin Dashboard) โดยสิ้นเชิง ไม่ใช้ `DashboardSidebar` ร่วมกัน

## Deploy บน Vercel

โปรเจกต์นี้เป็น Next.js มาตรฐาน จึง deploy บน [Vercel](https://vercel.com/) ได้โดยตรง
โดยไม่ต้องตั้งค่าเพิ่มเติมนอกจาก Environment Variables

> ดูรายการตรวจสอบแบบละเอียดก่อน/หลัง deploy ได้ที่
> [`docs/deployment-checklist.md`](docs/deployment-checklist.md)

### ขั้นตอนโดยสรุป

1. **เตรียม Supabase project สำหรับ production** (แยกจาก project ที่ใช้พัฒนา/ทดสอบ
   หากเป็นไปได้) — ทำตามขั้นตอนในหัวข้อ [การเชื่อมต่อ Supabase](#การเชื่อมต่อ-supabase)
   ด้านบนทั้งหมด (สร้างโปรเจกต์ → รัน migrations → นำเข้า seed data ถ้าต้องการ
   → ตรวจสอบ Storage Buckets)
2. **Push โค้ดขึ้น Git repository** (GitHub/GitLab/Bitbucket) — โปรเจกต์นี้ยังไม่ได้
   เป็น Git repository มาก่อน จึงต้อง `git init` แล้ว push เองก่อน import เข้า Vercel
3. **Import โปรเจกต์เข้า Vercel**: [vercel.com/new](https://vercel.com/new) →
   เลือก repository นี้ → Vercel จะตรวจพบว่าเป็น Next.js โดยอัตโนมัติ
   (ไม่ต้องแก้ Build Command / Output Directory)
4. **ตั้งค่า Environment Variables** ในหน้า Project Settings > Environment Variables
   (ดูตารางด้านล่าง) — ใส่ให้ครบทั้ง Production/Preview/Development ตามต้องการ
5. **Deploy** — กด Deploy ในหน้า Vercel (หรือ push ขึ้น branch ที่เชื่อมไว้)
6. **อัปเดต Auth Redirect URLs ใน Supabase** ให้ชี้มาที่โดเมนจริงที่ได้จาก Vercel
   (ดูขั้นตอนที่ 6 ในหัวข้อการเชื่อมต่อ Supabase ด้านบน) — ขาดขั้นตอนนี้แล้ว
   ลิงก์ยืนยันอีเมล/ลืมรหัสผ่านจะย้อนกลับมาที่ `localhost` แทนเว็บจริง

### Environment Variables ที่ต้องตั้งค่าใน Vercel

| ตัวแปร | ค่า | หมายเหตุ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL จาก Supabase | เปิดเผยฝั่ง client ได้ (ปลอดภัยเพราะมี RLS คุ้มกัน) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon public` key จาก Supabase | เปิดเผยฝั่ง client ได้เช่นกัน |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key จาก Supabase | **ต้องตั้งค่าเป็น server-only เท่านั้น** ห้ามใส่ prefix `NEXT_PUBLIC_` เด็ดขาด — Vercel ไม่ใส่ prefix นี้ให้อัตโนมัติอยู่แล้ว แต่ต้องตรวจสอบชื่อตัวแปรให้ตรงเป๊ะ ขาดค่านี้แล้วฟีเจอร์อ่าน/ดาวน์โหลด PDF และระงับบัญชีผู้ใช้จะใช้งานไม่ได้ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key จาก Cloudflare Turnstile | ทางเลือก — ต้องตั้งค่าคู่กับ `TURNSTILE_SECRET_KEY` ด้านล่างและเปิดสวิตช์ที่ `/superadmin/security` จึงจะบังคับ CAPTCHA จริง ไม่มีค่านี้ระบบยังใช้งานได้ปกติ (ไม่แสดง widget) |
| `TURNSTILE_SECRET_KEY` | Secret key จาก Cloudflare Turnstile | **ต้องตั้งค่าเป็น server-only เท่านั้น** ห้ามใส่ prefix `NEXT_PUBLIC_` — ใช้ตรวจสอบ token กับ Cloudflare ฝั่งเซิร์ฟเวอร์เท่านั้น |
| `LOG_PROVIDER` | `sentry` หรือ `betterstack` | ทางเลือก — ไม่ตั้งค่าก็ log ผ่าน console/Vercel Runtime Logs ได้ปกติ ดูหัวข้อ [Centralized Logging](docs/superadmin-guide.md#10-system-logs-superadminsystem-logs) |
| `SENTRY_DSN` | DSN จากโปรเจกต์ Sentry | ใช้เมื่อ `LOG_PROVIDER=sentry` เท่านั้น |
| `LOGGING_BETTERSTACK_SOURCE_TOKEN` | Source Token จาก Better Stack | ใช้เมื่อ `LOG_PROVIDER=betterstack` เท่านั้น — **server-only** |
| `LOGGING_BETTERSTACK_INGEST_URL` | Ingestion endpoint จาก Better Stack | ทางเลือก — เปลี่ยนได้หากบัญชี Better Stack ใช้ endpoint อื่นจากค่าเริ่มต้น ปกติไม่ต้องตั้งค่า |
| `RESEND_API_KEY` | API key จาก [Resend](https://resend.com/) | ทางเลือก (มี free tier) — ใช้ส่งอีเมลแจ้งเตือน (สถานะงานวิจัยเปลี่ยน, งานใหม่ตามหมวดหมู่ที่ติดตาม, สิทธิ์เข้าถึงใกล้หมดอายุ, รีเซ็ต MFA ฯลฯ) ไม่ตั้งค่าระบบแจ้งสถานะ "ยังไม่ได้ตั้งค่า" ชัดเจน ไม่ส่งอีเมลจริง แต่ in-app notification ยังทำงานปกติ — **server-only** |
| `RESEND_FROM_EMAIL` | อีเมลผู้ส่งที่ยืนยัน domain กับ Resend แล้ว | ใช้คู่กับ `RESEND_API_KEY` เท่านั้น |
| `MALWARE_SCAN_PROVIDER` | `clamav` หรือ `http` | ทางเลือก (ช่วงที่ 14) — ปล่อยว่างระบบใช้โหมดจำลอง (mock) พร้อมคำเตือนใน log เสมอ ไม่ใช่การสแกนจริง |
| `CLAMAV_HOST`, `CLAMAV_PORT` | โฮสต์/พอร์ตของ ClamAV daemon (clamd) | ใช้เมื่อ `MALWARE_SCAN_PROVIDER=clamav` เท่านั้น — พอร์ตค่าเริ่มต้น `3310` |
| `MALWARE_SCAN_API_URL`, `MALWARE_SCAN_API_KEY` | URL/API key ของบริการสแกนภายนอก | ใช้เมื่อ `MALWARE_SCAN_PROVIDER=http` เท่านั้น — บริการต้องรับ `multipart/form-data` ฟิลด์ `file` และตอบ JSON `{ clean, threat? }` ตามสัญญาที่กำหนด **`MALWARE_SCAN_API_KEY` ต้องเป็น server-only** |
| `MALWARE_SCAN_REQUIRED` | `true`/`false` | ทางเลือก — override พฤติกรรมบังคับสแกนอัตโนมัติ (เช่น ทดสอบโหมดบังคับใน dev) เมื่อบังคับแล้วแต่ provider ใช้งานไม่ได้ ระบบจะปฏิเสธการอัปโหลดไฟล์ทุกไฟล์ |
| `CRON_SECRET` | Secret สุ่มยาวๆ (เช่น `openssl rand -hex 32`) | **ต้องตั้งค่าเพื่อให้คิว background job ประมวลผลอัตโนมัติได้** (ช่วงที่ 20) — ไม่ตั้งค่า `/api/jobs/process` จะปฏิเสธทุกคำขอเสมอ ต้องตั้งค่า Cron (Vercel Cron หรือบริการภายนอก) ให้ส่ง header เดียวกันนี้ด้วย **ใช้ค่าเดียวกันนี้กับ `/api/cron/health-check` ด้วย (ช่วงที่ 31 — ต้องตั้งเป็น Cron ที่สอง แยกต่างหากจากตัวแรกจริง)** ดู `docs/background-jobs.md` หัวข้อ 6/14 |
| `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET` | จากแอปที่ลงทะเบียนที่ [orcid.org/developer-tools](https://orcid.org/developer-tools) | ทางเลือก (ช่วงที่ 23) — ไม่ตั้งค่าปุ่ม "เชื่อม ORCID" ที่ `/account` จะปิดพร้อมคำแนะนำผู้ดูแล ต้องลงทะเบียน redirect URI `https://<โดเมนจริง>/api/orcid/callback` กับ ORCID ด้วย ดู `docs/orcid-integration.md` |
| `ORCID_OAUTH_ENV` | `production` | **ต้องตั้งเป็น `production` อย่างชัดเจนก่อนขึ้นระบบจริง** — ไม่ตั้งค่าจะใช้ ORCID Sandbox เสมอ (ปลอดภัยไว้ก่อน แต่ใช้เชื่อมบัญชี ORCID จริงไม่ได้) |
| `OCR_PROVIDER`, `OCR_PROVIDER_BASE_URL`, `OCR_PROVIDER_API_KEY` | `self_hosted` หรือ `external_api` + URL บริการ OCR ของคุณเอง | ทางเลือก (ช่วงที่ 23/29, เปลี่ยนชื่อ+รวมเป็นชุดเดียวช่วงที่ 32) — เลือก adapter ผ่าน `OCR_PROVIDER` เดียว, URL/key ใช้ตัวแปรเดียวกันทั้งสองแบบ |
| `OCR_PROVIDER_TIMEOUT_MS` | ตัวเลข (ms) | ทางเลือก (ช่วงที่ 32) — ค่าเริ่มต้น 120000 ถ้าไม่ได้ตั้งค่า จำกัดช่วง 5000-300000 |
| `OCR_LANGUAGES` | เช่น `tha+eng` | ทางเลือก — ภาษาเป้าหมายที่ส่งให้ provider ค่าเริ่มต้นถ้าปล่อยว่างคือ `tha+eng` |
| (ทั้งสองแบบ) | — | ไม่ตั้งค่า `OCR_PROVIDER` (หรือตั้งเป็น `none`) งาน OCR จะ "ถูกระงับ" (`blocked`) เสมอ (ไม่มีโหมดจำลอง/ข้อความ/progress ปลอม) ดู `docs/ocr-operations.md` |
| `OCR_ENABLED` | `true` | **ต้องได้รับอนุมัติจากองค์กรและผ่าน Checklist ใน `docs/ocr-provider-validation.md` ก่อนตั้งค่าเป็น `true`** — ไม่ตั้งค่านี้ ระบบจะปฏิเสธการส่งไฟล์ไปยัง OCR provider เสมอแม้จะตั้งค่า provider ไว้แล้วก็ตาม (fail closed) ใช้ร่วมกันทั้ง 2 provider (เปลี่ยนชื่อจาก `OCR_ALLOW_EXTERNAL_TRANSFER` ช่วงที่ 32) |
| `OCR_ALLOW_PRIVATE_DOCUMENTS` | `true` | ทางเลือก (ช่วงที่ 32, ค่าเริ่มต้น `false`) — จำเป็นเฉพาะ `OCR_PROVIDER=external_api` ถ้าต้องการส่งเอกสารที่ไม่ใช่ `public` ให้ provider ภายนอก |
| `OCR_TEST_MODE` | `true` | ทางเลือก (ช่วงที่ 32, ค่าเริ่มต้น `false`) — เปิด Controlled OCR Test ที่ `/superadmin/ocr` สำหรับทดสอบ provider ด้วยไฟล์ที่ไม่เป็นความลับ **ก่อน**เปิด `OCR_ENABLED` จริง |
| `OCR_MAX_FILE_SIZE_MB`, `OCR_MAX_PAGES`, `OCR_MAX_JOBS_PER_DAY` | ตัวเลข | ทางเลือก (ช่วงที่ 32) — เพดานสูงสุดระดับ deploy คู่กับค่าที่ปรับได้ใน `settings` ผ่าน `/superadmin/ocr` (ค่าจริงที่ใช้คือ `min(env, settings)`) ดู `docs/ocr-operations.md` หัวข้อ 6.0 |

**คำเตือน**: อย่า commit `.env.local` หรือใส่ค่าจริงของตัวแปรเหล่านี้ลงในโค้ด —
ตั้งค่าผ่านหน้า Vercel Dashboard เท่านั้น (ดูหัวข้อ [ตรวจสอบว่าไม่มี Secret ในโค้ด](docs/deployment-checklist.md))

### หลัง Deploy ครั้งแรก

- ทดสอบ Golden Path ให้ครบ: Guest ค้นหา/ดูงานวิจัย public, Member สมัคร/ล็อกอิน/
  ดาวน์โหลด, Staff ส่งงานวิจัย, Librarian อนุมัติ, Admin จัดการผู้ใช้
- ตรวจสอบว่าไฟล์ PDF เปิด/ดาวน์โหลดได้จริง (ต้องมี `SUPABASE_SERVICE_ROLE_KEY`
  ตั้งค่าไว้ใน Vercel)
- ตรวจสอบว่าอีเมลยืนยันสมัครสมาชิก/ลืมรหัสผ่านพาไปที่โดเมนจริง ไม่ใช่ localhost
- ทดสอบ `https://<โดเมนจริง>/api/health` ตอบกลับ `200` แล้วเชื่อมต่อกับบริการ
  Uptime Monitoring ภายนอก (ดู [`docs/uptime-monitoring.md`](docs/uptime-monitoring.md))
- ตั้งค่า `CRON_SECRET` และ Cron job ให้เรียก `/api/jobs/process` เป็นระยะ
  มิฉะนั้นคิวประมวลผลข้อความ PDF/สแกนความปลอดภัยจะไม่ทำงานอัตโนมัติ (ต้องกด
  "ประมวลผลคิวเดี๋ยวนี้" ที่หน้า Super Admin ด้วยมือแทน) — ดู
  [`docs/background-jobs.md`](docs/background-jobs.md) หัวข้อ 6 สำหรับข้อจำกัด
  ของ Vercel Cron บนแผน Hobby และทางเลือกฟรีอื่น
- หากต้องการใช้ MFA สำหรับ Super Admin: เปิดใช้งาน TOTP MFA ที่ **Supabase
  Dashboard > Authentication > Providers > Multi-Factor Authentication** ก่อน
  เสมอ (ไม่เปิดอัตโนมัติสำหรับ Cloud project — ต่างจาก local ที่เปิดไว้ให้แล้ว
  ใน `supabase/config.toml`) ดู [`docs/superadmin-guide.md`](docs/superadmin-guide.md#14-ยืนยันตัวตนสองขั้นตอน-mfa-สำหรับ-super-admin)

## โครงสร้างโปรเจกต์

```
app/                        หน้าเว็บทั้งหมด (Next.js App Router)
├── page.tsx                 หน้าแรก
├── research/
│   ├── page.tsx              รายการงานวิจัย (Server Component — ค้นหา/กรอง/เรียงลำดับ
│   │                          ฝั่งเซิร์ฟเวอร์ รองรับโหมดค้นหา "ทั้งหมด/บรรณานุกรม/เนื้อหา PDF")
│   └── [id]/
│       ├── page.tsx           รายละเอียดงานวิจัย + ปุ่มขอสิทธิ์อ่าน/ดาวน์โหลด
│       ├── actions.ts          Server Actions: signed URL ดาวน์โหลด, toggle รายการโปรด
│       ├── access-request-actions.ts  ส่งคำขอสิทธิ์เข้าถึงเอกสาร (ช่วงที่ 18)
│       └── read/page.tsx      หน้าอ่านเอกสารแบบ Flipbook (ผ่าน Signed URL) + สถานะดึงข้อความ/OCR
├── submit-research/          ส่งงานวิจัย (Staff+, page.tsx + actions.ts, บังคับ CAPTCHA)
├── my-submissions/           งานวิจัยของฉัน (Staff+)
│   ├── page.tsx                รายการงานวิจัยที่ส่งทั้งหมด
│   └── [id]/                   รายละเอียด/แก้ไข (เฉพาะตอน draft/revision_requested)
├── dashboard/                 ส่วนเจ้าหน้าที่/ผู้ดูแล (layout.tsx = sidebar + guard rank≥30)
│   ├── page.tsx                ภาพรวม: สมาชิก/งานวิจัย/รอตรวจสอบ/เข้าชม/ดาวน์โหลด/ยอดนิยม/ช่วงวันที่
│   ├── approvals/               อนุมัติงานวิจัย (Librarian+) — page.tsx + [id]/
│   ├── research/                จัดการงานวิจัยทุกสถานะ (Librarian+)
│   │   ├── page.tsx               ค้นหา/กรอง/แบ่งหน้าแบบ server-side + เก็บถาวรด่วน
│   │   ├── new/                   เพิ่มงานวิจัยโดยตรง (เผยแพร่ทันทีได้)
│   │   └── [id]/edit/             แก้ไข/เปลี่ยนสิทธิ์/สถานะ + ประมวลผลข้อความ PDF ใหม่ ไม่จำกัดเจ้าของ
│   ├── categories/               จัดการหมวดหมู่ (หลัก/ย่อย, เปิด-ปิด, ลบอย่างปลอดภัย)
│   ├── organizations/            จัดการหน่วยงาน (หลัก/ย่อย, คำเตือนชื่อซ้ำ, รวมหน่วยงาน)
│   ├── authors/                  ผู้วิจัยมาตรฐาน (ช่วงที่ 19) — ค้นหา/เพิ่ม/แก้ไข/ปิดใช้งาน/รวม,
│   │   ├── page.tsx                 เชื่อม profile, ตรวจสอบ ORCID กับ Public API (ช่วงที่ 27)
│   │   ├── [id]/page.tsx
│   │   ├── actions.ts
│   │   └── check-similar-actions.ts
│   ├── data-quality/page.tsx     รายงานงานวิจัยไม่มีผู้วิจัย/หน่วยงาน/วันที่เผยแพร่ (ช่วงที่ 19)
│   ├── duplicate-reviews/        คู่งานวิจัยที่อาจซ้ำ — ยืนยัน/ปฏิเสธ (Librarian+),
│   │   ├── page.tsx                 รวมงานวิจัยจริง (Admin เท่านั้น, พิมพ์ MERGE ยืนยัน)
│   │   ├── [id]/page.tsx
│   │   └── actions.ts
│   ├── access-requests/          คำขอสิทธิ์เข้าถึงเอกสารฝั่งเจ้าหน้าที่ (rank≥30, ช่วงที่ 18)
│   │   ├── page.tsx                 อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม/เพิกถอนสิทธิ์
│   │   └── [id]/(page.tsx + actions.ts)
│   ├── users/                    จัดการผู้ใช้ (Admin เท่านั้น) — เปลี่ยนบทบาท/ระงับบัญชี
│   ├── reports/                  รายงาน 4 ประเภท + ส่งออก CSV (export/route.ts)
│   ├── audit-logs/               ประวัติการเปลี่ยนแปลงทั้งหมด (Admin เท่านั้น)
│   └── settings/                 ตั้งค่าองค์กร/หน้าแรก (Admin เท่านั้น)
├── superadmin/                 Super Admin Dashboard (แยกจาก /dashboard, guard rank≥50)
│   ├── layout.tsx                 SuperAdminSidebar + การ์ดสิทธิ์ (rank ≥ 50 เท่านั้น)
│   ├── page.tsx                    redirect ไป /superadmin/overview
│   ├── loading.tsx                 Skeleton ระดับ route
│   ├── error.tsx                   Error boundary (ข้อความทั่วไป ไม่มี error ดิบ)
│   ├── overview/page.tsx           ภาพรวมระบบ + กราฟเชิงลึก (recharts): สมาชิกใหม่,
│   │                                เข้าชม/ดาวน์โหลด, งานวิจัยตามหมวดหมู่/สถานะ
│   │                                (เลือกช่วงวันที่/ความละเอียดได้)
│   ├── users/                      ค้นหา/กรอง, หลายบทบาทต่อคน, ระงับชั่วคราว/ถาวร,
│   │   ├── page.tsx                   มอบ/ถอดถอน super_admin (ยืนยัน CONFIRM/อีเมล),
│   │   ├── actions.ts                  รีเซ็ต MFA ผู้ใช้อื่น, ประวัติที่ถูกดำเนินการกับบัญชี
│   │   └── [id]/page.tsx
│   ├── roles/page.tsx              Role Matrix แบบอ่านอย่างเดียว
│   ├── mfa-status/page.tsx         ภาพรวมสถานะ MFA ของ Super Admin ทุกคน (ช่วงที่ 22)
│   ├── categories/                 จัดลำดับหมวดหมู่แบบลากวาง (@dnd-kit) — super_admin เท่านั้น
│   │   ├── page.tsx                   ต้นไม้หมวดหมู่หลัก/ย่อย ลากวาง + ปุ่มเลื่อนขึ้น-ลง
│   │   └── actions.ts                  reorderCategoriesAction/moveCategoryAction
│   ├── organizations/              จัดลำดับหน่วยงานแบบลากวาง — super_admin เท่านั้น
│   │   ├── page.tsx                   รายการหน่วยงานลากวาง + ปุ่มเลื่อนขึ้น-ลง
│   │   └── actions.ts                  reorderOrganizationsAction
│   ├── system-settings/            โลโก้/favicon (อัปโหลดตรง), social, เปิด-ปิดฟีเจอร์,
│   │   ├── page.tsx                   ขนาดไฟล์สูงสุด (มีผลจริงกับ Storage bucket), สถานะเริ่มต้น
│   │   └── actions.ts
│   ├── security/                   CAPTCHA (ฝัง Turnstile widget จริง + บังคับตรวจสอบแล้ว),
│   │   ├── page.tsx                   Rate Limit, นโยบายยืนยันอีเมล (อ่านอย่างเดียว), บัญชีที่ถูกระงับ
│   │   └── actions.ts
│   ├── storage/                    พื้นที่ใช้งานต่อ bucket, สแกน/ลบไฟล์ค้าง (ยืนยันก่อนลบ)
│   │   ├── page.tsx
│   │   └── actions.ts
│   ├── file-security/              bulk rescan ความปลอดภัยไฟล์เดิมเป็นชุด (ช่วงที่ 20)
│   │   ├── page.tsx
│   │   └── actions.ts
│   ├── pdf-processing/             bulk backfill ข้อความ PDF + แท็บ "OCR เอกสารสแกน" (ช่วงที่ 20/23)
│   │   ├── page.tsx                   filter/batch size/progress/ปุ่มลองใหม่/ประมวลผลทั้งหมด
│   │   └── actions.ts
│   ├── data-quality/               ตรวจสอบงานวิจัยซ้ำย้อนหลังทั้งระบบแบบ background job (ช่วงที่ 22)
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   └── settings/(page.tsx + actions.ts)  ปรับน้ำหนักเกณฑ์ตรวจซ้ำแบบ versioned
│   ├── ocr/                        OCR Readiness Check + Controlled OCR Test (ช่วงที่ 27/29/32)
│   │   ├── page.tsx                   ทดสอบเชื่อมต่อ provider, ปรับเพดานขนาด/หน้า/โควตา OCR
│   │   └── actions.ts
│   ├── jobs/                       Dead-letter Queue + สถานะ Queue โดยรวม + master job
│   │   ├── page.tsx                   (job_batches) pause/resume/cancel (ช่วงที่ 25/28/30)
│   │   └── actions.ts
│   ├── cron-monitoring/            สถานะ cron/worker ล่าสุด, heartbeat, เกณฑ์แจ้งเตือน (ช่วงที่ 31)
│   │   ├── page.tsx
│   │   └── actions.ts
│   ├── notifications/              เปิด-ปิดแจ้งเตือนในระบบ/อีเมล + ตั้งค่าแจ้งเตือนก่อนสิทธิ์
│   │   ├── page.tsx                   หมดอายุ (ช่วงที่ 26) + ปุ่ม "ประมวลผลสิทธิ์ที่หมดอายุทันที"
│   │   └── actions.ts
│   ├── audit-logs/page.tsx         Audit Log พร้อมกรองผู้กระทำ/การกระทำ + pagination
│   ├── system-logs/page.tsx        สถานะเชื่อมต่อ logging provider จริง (LOG_PROVIDER)
│   ├── system-health/page.tsx      ตรวจสอบ Database/Auth/Storage แบบสด + ลิงก์ /api/health
│   └── backups/page.tsx            สถานะ Backup (ไม่พร้อมใช้งานเสมอ) + ลิงก์คู่มือ
├── access-requests/page.tsx   รายการคำขอสิทธิ์เข้าถึงเอกสารของสมาชิกเอง (Member+, ช่วงที่ 18)
├── notifications/page.tsx     การแจ้งเตือนทั้งหมดของผู้ใช้ (ต่อยอดจาก NotificationBell)
├── profile/notification-settings/  เลือกหมวดหมู่ที่ติดตาม + เปิด-ปิดช่องทางแจ้งเตือน (ช่วงที่ 18)
│   ├── page.tsx
│   └── actions.ts
├── mfa-challenge/page.tsx     ยืนยัน MFA ขั้นที่สอง (aal step-up) ก่อนเข้า /superadmin/*
├── setup-mfa/page.tsx         บังคับตั้งค่า MFA (Super Admin ที่ยังไม่มี verified
│                              factor ถูกเด้งมาที่นี่อัตโนมัติก่อนเข้า /superadmin/*)
├── api/
│   ├── health/route.ts             GET /api/health — สำหรับ external uptime monitor (สาธารณะ)
│   ├── jobs/process/route.ts        Worker: claim + ประมวลผล background job (ต้องมี CRON_SECRET)
│   ├── cron/health-check/route.ts   Watchdog แยกจาก worker หลัก — ตรวจ cron/queue ผิดปกติ (ช่วงที่ 31)
│   ├── orcid/callback/route.ts      แลก ORCID authorization code เป็น token (ช่วงที่ 23)
│   └── superadmin/
│       ├── jobs/batches/route.ts    Poll สถานะ job_batches (ช่วงที่ 25/28)
│       └── ocr/test-runs/route.ts   Poll สถานะ Controlled OCR Test (ช่วงที่ 32)
├── favorites/                 รายการโปรด (Member+)
├── reading-history/           ประวัติการอ่าน (Member+)
├── about/page.tsx            เกี่ยวกับเรา
├── contact/page.tsx          ติดต่อเรา
├── login/                    เข้าสู่ระบบ (page.tsx + actions.ts server action)
├── register/                 สมัครสมาชิก (page.tsx + actions.ts server action, บังคับ CAPTCHA)
├── account/                  โปรไฟล์ของฉัน (protected, page.tsx + actions.ts + orcid-actions.ts
│                              เชื่อม/ยกเลิกเชื่อมบัญชี ORCID ของตนเอง — ช่วงที่ 23)
├── auth/
│   ├── callback/route.ts      แลก authorization code เป็น session (ยืนยันอีเมล/ลืมรหัสผ่าน)
│   ├── forgot-password/       ขอลิงก์ตั้งรหัสผ่านใหม่
│   └── reset-password/        ตั้งรหัสผ่านใหม่
├── 403/page.tsx               หน้าไม่มีสิทธิ์เข้าถึง
├── not-found.tsx              หน้า 404
├── layout.tsx                 Root layout (ดึง session ผู้ใช้ส่งให้ Header)
└── globals.css                Global styles (Tailwind)

middleware.ts                 รีเฟรช Supabase session + ป้องกันหน้าตาม role (rank) +
                               บังคับ MFA step-up (aal2) ก่อนเข้า /superadmin/*
instrumentation.ts             Next.js onRequestError hook — ส่ง error ทั้งแอปไปยัง
                               centralized logging provider ผ่าน lib/logging/ อัตโนมัติ

components/
├── layout/                   Header (session + role-aware + NotificationBell), UserMenu, Footer,
│                              notification-actions.ts (mark read/mark all read)
├── ui/                       Container, Button, Badge
├── research/                  ResearchCard, ResearchGrid, FilterBar, ResearchExplorer,
│                              AccessBadge, StatusBadge, DownloadButton, FavoriteButton,
│                              AccessRequestButton (ขอสิทธิ์อ่าน/ดาวน์โหลด — ช่วงที่ 18),
│                              FlipbookViewer (real, ผ่าน Signed URL — เปิดสมุดเสมือนจริง
│                              ด้วย react-pdf + react-pageflip), FlipbookViewerLoader
│                              (โหลด FlipbookViewer แบบ ssr:false ผ่าน next/dynamic
│                              เพราะ pdfjs-dist ใช้ API ของเบราว์เซอร์โดยตรง)
├── submission/                 SubmitResearchForm (ใช้ร่วมกัน 4 หน้า), SubmissionDetailView
├── dashboard/                   DashboardSidebar, StatCard, ArchiveQuickAction,
│                              CategoryManager, OrganizationManager, UserManager,
│                              SettingsForm, ApprovalActions, AuthorCreateForm, AuthorEditForm,
│                              AuthorSidebarActions, ExtractionStatusCard (สถานะดึงข้อความ PDF),
│                              DuplicateReviewActionsPanel, AccessRequestActionsPanel,
│                              RevokeGrantButton (ทั้งหมดเพิ่มในช่วงที่ 17-19)
├── access-requests/            CancelRequestButton, StatusFilterSelect (หน้า /access-requests)
├── notifications/               NotificationRow, MarkAllReadButton (หน้า /notifications)
├── profile/                    NotificationSettingsForm (หน้า /profile/notification-settings)
├── superadmin/                  SuperAdminSidebar (แยกจาก DashboardSidebar, สี amber),
│                              UserRolesEditor, SuperAdminRoleConfirmDialog (มอบ/ถอดถอน
│                              super_admin ต้องพิมพ์ยืนยันก่อนเสมอ), UserStatusControl,
│                              SystemSettingsForm,
│                              SecuritySettingsForm, NotificationSettingsForm,
│                              AccessExpirationWarningSettingsForm (ช่วงที่ 26), OrphanedFileRow,
│                              OverviewCharts (MembersLineChart, ViewsDownloadsLineChart,
│                              CategoryBarChart, StatusPieChart — ใช้ recharts),
│                              CategoryOrderManager, OrganizationOrderManager (ลากวางจัดลำดับ,
│                              ใช้ @dnd-kit, มีปุ่มเลื่อนขึ้น-ลงเป็นทางเลือกแทนการลากด้วย),
│                              MfaResetControl, MfaResetConfirmDialog (รีเซ็ต MFA ผู้ใช้อื่น
│                              ยืนยัน 2 ขั้นแยกจากกันจริง — ยืนยันตัวตนก่อน แล้วจึงพิมพ์
│                              "RESET MFA" + เหตุผล), DuplicateDetectionRulesForm (เกณฑ์ตรวจซ้ำ
│                              แบบ versioned), OcrSettingsForm, OcrConnectivityCheckButton,
│                              OcrTestRunsPanel (Controlled OCR Test), BulkJobSelector,
│                              BulkAllMatchingFilterDialog, JobBatchList, JobBatchDetailDrawer,
│                              JobProgressPoller, RecentJobsPoller, DeadLetterJobList,
│                              RetryJobButton, QueueHealthPanel, ConcurrencySettingsForm,
│                              ProcessQueueNowButton, ProcessAccessExpirationNowButton,
│                              CronMonitoringOverview, CronMonitoringSettingsForm
├── home/                      Hero, HomeSearchBox, CategorySection, ResearchSection
├── contact/                   ContactForm
├── account/                    MfaSettings (enroll/list/unenroll TOTP factor ของตัวเอง),
│                              OrcidConnect (เชื่อม/ยกเลิกเชื่อมบัญชี ORCID — ช่วงที่ 23)
└── auth/                      AuthFormShell, LoginForm, RegisterForm,
                               ForgotPasswordForm, ResetPasswordForm, ProfileForm,
                               LogoutButton, SupabaseNotConfiguredNotice,
                               TurnstileWidget (ฝัง Cloudflare Turnstile จริง),
                               IdleLogout (auto-logout เมื่อไม่มีการใช้งานเกิน 10 นาที),
                               MfaChallengeForm (กรอกรหัส MFA ขั้นที่สองที่ /mfa-challenge),
                               SetupMfaForm (บังคับตั้งค่า TOTP ที่ /setup-mfa สำหรับ
                               Super Admin ที่ยังไม่มี MFA)

lib/
├── supabase/
│   ├── client.ts               Supabase client ฝั่ง Browser
│   ├── server.ts                Supabase client ฝั่ง Server (cookies-based)
│   ├── service.ts               Supabase client ด้วย Service Role (ข้าม RLS — server-only)
│   ├── middleware.ts            ตรรกะรีเฟรช session + ตรวจสอบ role/MFA step-up สำหรับ middleware.ts
│   ├── config.ts                isSupabaseConfigured() / isServiceRoleConfigured()
│   ├── database.types.ts        TypeScript types ของฐานข้อมูล (เขียนด้วยมือ)
│   ├── error-messages.ts        แปล error ของ Supabase Auth เป็นภาษาไทย
│   └── roles.ts / session.ts    Helper อ่านบทบาท/session ผู้ใช้ฝั่งเซิร์ฟเวอร์
├── data/                       Data access layer ต่อฟีเจอร์ (server-only เกือบทั้งหมด)
│   ├── research.server.ts       Data access หน้าสาธารณะ (Supabase + mock fallback)
│   ├── research.client.ts       Data access ฝั่ง Browser (สำหรับ ResearchExplorer)
│   ├── research-search.server.ts  ค้นหาบรรณานุกรม+เนื้อหา PDF ฝั่งเซิร์ฟเวอร์ (ช่วงที่ 17)
│   ├── submissions.server.ts    Data access หน้าจัดการภายใน (ไม่มี mock fallback)
│   ├── submission-write.server.ts  บันทึกความสัมพันธ์ผู้วิจัย/หมวดหมู่/คำสำคัญ
│   ├── favorites.server.ts      รายการโปรด/ประวัติการอ่าน
│   ├── categories.server.ts     หมวดหมู่ (public + getAllCategoriesForAdmin)
│   ├── organizations.server.ts  หน่วยงาน (public + getAllOrganizationsForAdmin)
│   ├── authors-admin.server.ts  ผู้วิจัยมาตรฐาน: ค้นหา/เพิ่ม/แก้ไข/รวม (ช่วงที่ 19)
│   ├── data-quality.server.ts   รายงานคุณภาพข้อมูล (ไม่มีผู้วิจัย/หน่วยงาน/วันที่เผยแพร่)
│   ├── duplicate-research.server.ts  find_similar_research_items() + บันทึกผลตรวจ
│   ├── duplicate-scan-candidates.server.ts  รายการ/ตัวกรองสำหรับ bulk duplicate scan (ช่วงที่ 22/28)
│   ├── duplicate-detection-rules.server.ts  เกณฑ์ตรวจซ้ำแบบ versioned (น้ำหนัก/threshold)
│   ├── access-requests.server.ts       คำขอสิทธิ์เข้าถึงเอกสารฝั่งผู้ใช้ (ช่วงที่ 18)
│   ├── access-requests-admin.server.ts  ฝั่งเจ้าหน้าที่: อนุมัติ/ปฏิเสธ/เพิกถอน
│   ├── access-grants.server.ts          document_access_grants (สิทธิ์เสริมที่ OR กับ access_level)
│   ├── category-subscriptions.server.ts การติดตามหมวดหมู่เพื่อรับแจ้งเตือนงานใหม่
│   ├── notification-preferences.server.ts สวิตช์ in-app/email ต่อผู้ใช้
│   ├── notifications.server.ts  การแจ้งเตือนในระบบของผู้ใช้ปัจจุบัน (สำหรับ Header bell)
│   ├── orcid-profile.server.ts  ผูก/อ่านสถานะเชื่อม ORCID ของผู้ใช้ (ช่วงที่ 23)
│   ├── job-batches.server.ts    master job (job_batches): สร้าง/pause/resume/cancel (ช่วงที่ 25/28)
│   ├── job-type-settings.server.ts  concurrency ที่ปรับได้ต่อประเภทงาน (ช่วงที่ 25)
│   ├── queue-health.server.ts   สถานะ Queue โดยรวม: worker active, lease หมดอายุ, รอคิวนาน (ช่วงที่ 30)
│   ├── pdf-processing.server.ts  รายการ/ตัวกรองสำหรับ bulk PDF text/OCR backfill
│   ├── file-security-candidates.server.ts  รายการ/ตัวกรองสำหรับ bulk file rescan
│   ├── cron-monitoring.server.ts  อ่านประวัติ cron_runs + เกณฑ์แจ้งเตือนต่อ cron (ช่วงที่ 31)
│   ├── ocr-test-runs.server.ts  ผลการทดสอบ Controlled OCR Test (ช่วงที่ 32)
│   ├── settings.server.ts       ตั้งค่าองค์กร/หน้าแรก (มีค่า default เมื่อยังไม่ตั้งค่า)
│   ├── admin-stats.server.ts    สถิติภาพรวม + สถิติแบบเลือกช่วงวันที่
│   ├── admin-users.server.ts    รายชื่อผู้ใช้พร้อมบทบาทปัจจุบัน
│   ├── admin-research.server.ts ค้นหา/กรอง/แบ่งหน้างานวิจัยทุกสถานะ (server-side)
│   ├── admin-guard.server.ts    requireMinRank() — ใช้ต้น Server Action ทุกตัว, ตรวจ aal2
│   │                              ซ้ำเมื่อ minRank ≥ 50
│   ├── audit.server.ts          logAudit() — บันทึก audit_logs จากการกระทำที่ trigger ไม่ครอบคลุม
│   ├── audit-logs.server.ts     อ่าน audit_logs พร้อมชื่อผู้กระทำ (แบ่งหน้า/กรอง ผู้กระทำ/
│   │                              การกระทำ/ประเภท/ช่วงวันที่/entityId) — ไม่ throw raw error ออกไป
│   ├── reports.server.ts        รายงานเข้าชม/ดาวน์โหลด/ยอดนิยม/สมาชิก
│   ├── super-admins.server.ts   grantSuperAdminAction/revokeSuperAdminAction (ยืนยัน CONFIRM/อีเมล)
│   ├── superadmin-stats.server.ts  สถิติเฉพาะ /superadmin/overview (ผู้ใช้/งานวิจัย
│   │                                แยกตามบทบาท-สถานะ, Storage, ไฟล์ค้าง, การแจ้งเตือน) —
│   │                                ทุกฟังก์ชันดัก error เองคืนค่า "ไม่พร้อมใช้งาน"
│   ├── superadmin-users.server.ts  ค้นหา/กรอง/รายละเอียด/ประวัติผู้ใช้ (หลายบทบาทต่อคน)
│   ├── superadmin-charts.server.ts  ข้อมูลกราฟ: สมาชิกใหม่/เข้าชม-ดาวน์โหลดตามช่วงเวลา
│   │                                (รายวัน/รายเดือน), งานวิจัยตามหมวดหมู่
│   ├── system-health.server.ts  ตรวจสอบ Database/Auth/Storage แบบสด (real-time)
│   ├── auth-policy.server.ts    อ่านนโยบายยืนยันอีเมลจริงจาก GoTrue (อ่านอย่างเดียว)
│   └── queries.ts / mappers.ts / types.ts   Query builder และ mapper ร่วม
├── jobs/                       Background job queue (persistent, ฐานข้อมูลเดิม — ช่วงที่ 20)
│   ├── queue.server.ts           enqueue/claim (FOR UPDATE SKIP LOCKED), retry backoff
│   ├── dispatch.server.ts        เลือก handler ตาม job type
│   ├── batch-control.server.ts   pause/resume/cancel job_batches (ช่วงที่ 28)
│   ├── bulk-batch.server.ts      สร้าง job เป็น chunk แบบ resume ได้ (ช่วงที่ 25)
│   ├── dlq.server.ts / dlq-notify.server.ts  Dead-letter Queue + แจ้งเตือน Super Admin (ช่วงที่ 25)
│   ├── enqueue-research-jobs.server.ts  จุดเดียวที่สร้าง job เมื่ออัปโหลด/แก้ไข/เผยแพร่งานวิจัย
│   ├── process-now.action.server.ts  ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ของ Super Admin
│   └── handlers/                 pdf-text-extraction, file-security-rescan, access-expiration,
│                                  category-notification, duplicate-scan, ocr-processing,
│                                  ocr-test-run, maintenance-cleanup (job type ละ 1 ไฟล์)
├── pdf/
│   ├── extract-text.server.ts     ดึงข้อความจาก PDF ด้วย pdfjs-dist (ช่วงที่ 17)
│   ├── extraction-status.server.ts  getExtractionStatus (uuid) / getExtractionStatusBySlug
│   └── process-extraction.server.ts  processResearchDocumentExtraction() — เรียกจาก background job
├── ocr/                        OCR สำหรับ PDF ที่เป็นภาพสแกน (ช่วงที่ 23/27/29/32)
│   ├── ocr-provider.server.ts     Provider abstraction: "http" (sync) / "external_api" (submit+poll)
│   ├── ocr-limits.server.ts       checkOcrEligibility() — ขนาด/หน้า/สิทธิ์เอกสาร/โควตา ก่อนสร้างงาน
│   ├── process-ocr.server.ts      เรียกจาก background job handler
│   ├── process-ocr-test.server.ts Controlled OCR Test (ช่วงที่ 32)
│   └── test-fixtures.server.ts    ไฟล์ทดสอบที่ไม่เป็นความลับ (public/ocr-test-fixtures/)
├── orcid/                      ORCID OAuth + Public API (ช่วงที่ 23/27)
│   ├── orcid-oauth.server.ts      Authorization Code flow ฝั่งเซิร์ฟเวอร์ล้วน
│   ├── orcid-state.server.ts      CSRF state แบบใช้ครั้งเดียว (อายุ 10 นาที)
│   ├── orcid-tokens.server.ts     เก็บ/อ่าน token (service role เท่านั้น)
│   └── orcid-public-api.server.ts ตรวจสอบ ORCID iD กับ Public API (read-only, cache 24 ชม.)
├── cron/
│   ├── cron-runs.server.ts        บันทึกผลการทำงานของ cron/worker แต่ละครั้ง (ช่วงที่ 31)
│   └── monitor.server.ts          Watchdog: ตรวจไม่เคยทำงาน/เกินกำหนด/ล้มเหลวสูง + cooldown แจ้งเตือน
├── publishing/publish-event.server.ts  notifyResearchPublished() — จุดเดียวที่ทุกเส้นทาง
│                                  เผยแพร่งานวิจัยเรียกร่วมกัน (audit/in-app/email/กันแจ้งซ้ำ, ช่วงที่ 21)
├── storage/
│   ├── limits.ts                ข้อจำกัดชนิดไฟล์ (คงที่) + mbToBytes()/ค่า default
│   │                              ปลอดภัย — ขนาดจริงที่แสดงผลดึงจาก settings แบบไดนามิก
│   ├── paths.ts                 สร้างพาธไฟล์แบบ {uid}/{draftKey}/{filename}
│   ├── upload.client.ts         อัปโหลดไฟล์ตรงจาก Browser ไปยัง Storage
│   └── signed-url.server.ts     สร้าง Signed URL (ใช้ Service Role, ตรวจสอบสิทธิ์+grant เพิ่มเติมก่อนเสมอ)
├── security/
│   ├── file-signature.server.ts   ตรวจ magic-byte เนื้อไฟล์จริงเทียบ MIME ที่ประกาศ
│   ├── malware-scanner.server.ts  Abstraction สแกนมัลแวร์ (ClamAV/HTTP/mock ตาม env)
│   ├── validate-upload.server.ts  ดาวน์โหลดไฟล์ที่เพิ่งอัปโหลดกลับมาตรวจสอบ+สแกน (ภาพปก/
│   │                                เอกสารแนบยัง synchronous, PDF หลักย้ายเป็น background job
│   │                                ตั้งแต่ช่วงที่ 20) ลบไฟล์ออกจาก Storage อัตโนมัติหากไม่ผ่าน
│   └── mfa-admin.server.ts        อ่าน/ลบอุปกรณ์ MFA ของผู้ใช้อื่นผ่าน Supabase Auth
│                                    Admin API (ใช้โดย resetUserMfaAction)
├── notifications/
│   ├── email.server.ts             ส่งอีเมลผ่าน Resend (no-op หากยังไม่ตั้งค่า RESEND_API_KEY)
│   ├── access-request-email.server.ts  อีเมลแจ้งผลคำขอสิทธิ์เข้าถึงเอกสาร
│   ├── category-subscribers.server.ts  แจ้งผู้ติดตามหมวดหมู่เมื่อมีงานวิจัยใหม่
│   └── send-in-batches.server.ts       sendInBatches() — ส่งเป็นชุดละ 5 คน กัน burst (ช่วงที่ 30)
├── reports/csv.ts              toCsv() — แปลงข้อมูลเป็น CSV พร้อม UTF-8 BOM (Excel เปิดไทยได้)
├── errors/safe-message.server.ts  toSafeErrorMessage() — แปลง error จาก Postgres/
│                              Supabase เป็นข้อความทั่วไปเสมอ (log รายละเอียดจริงไว้
│                              ฝั่งเซิร์ฟเวอร์) ยกเว้น error code 'P0001' ที่แอปตั้งใจ
│                              raise เองจาก database trigger
├── logging/                     Centralized logging abstraction (ใช้จาก instrumentation.ts)
│   ├── logger.server.ts           logServerError() — จุดเดียวที่ทุก error ผ่าน, เลือก
│   │                                provider จาก LOG_PROVIDER, sanitize ก่อนส่งออกเสมอ
│   ├── sanitize.server.ts         redactSecrets() — ตัด token/secret/connection string
│   ├── types.ts                    LogProvider interface (เพิ่ม provider ใหม่ได้ตาม interface นี้)
│   └── providers/                  console.server.ts (fallback เสมอ), sentry.server.ts
│                                    (Envelope API), better-stack.server.ts (HTTP ingestion)
├── validation/                 Zod schemas (auth.ts, profile.ts, author.ts, organization.ts,
│                              submission.ts, system-settings.ts, security-settings.ts,
│                              access-request.ts, orcid.ts, ocr-settings.ts, bulk-filters.ts
│                              — `.strict()` ปฏิเสธ field ที่ไม่รู้จักเสมอ) — รวม
│                              extension/MIME cross-validation ของไฟล์อัปโหลด
├── actions/types.ts            ActionResult type ร่วมของ Server Actions
├── rate-limit.server.ts        checkRateLimit() — อิงฐานข้อมูล ไม่พึ่งบริการภายนอก
├── captcha.server.ts           verifyCaptchaIfEnabled()/verifyTurnstileToken() —
│                              ตรวจสอบ CAPTCHA กับ Cloudflare จริงฝั่งเซิร์ฟเวอร์
├── search.ts                   ฟังก์ชันค้นหา/กรอง/เรียงลำดับงานวิจัย (client-side)
├── labels.ts                   ป้ายกำกับภาษาไทยของสิทธิ์/สถานะ/บทบาท
└── icons.tsx                   แมประหว่างชื่อไอคอนกับ Lucide Icon component

types/
└── research.ts                 TypeScript types: ResearchItem, SubmissionItem,
                                 ApprovalLogEntry, Category, Organization,
                                 AccessLevel, DocumentStatus, UserRole

data/
├── research.ts                 ข้อมูลตัวอย่างงานวิจัย 10 รายการ (ใช้เป็น fallback)
├── categories.ts               ข้อมูลหมวดหมู่งานวิจัย 8 หมวดหมู่ (แหล่งข้อมูลของ UI)
└── organizations.ts            ข้อมูลหน่วยงานตัวอย่าง (ใช้เป็น fallback)

supabase/
├── config.toml                 ตั้งค่า local Supabase stack (Docker) — Auth site_url/
│                                redirect ชี้ไป http://localhost:3001 ให้ตรงกับ dev port ของโปรเจกต์นี้
├── migrations/                 SQL migrations (schema, functions, RLS, storage, seed อ้างอิง)
└── seed.sql                    ข้อมูลตัวอย่างงานวิจัยสำหรับทดสอบ/สาธิต

docs/
├── project-spec.md             ข้อกำหนดโครงการฉบับเต็ม
├── deployment-checklist.md     รายการตรวจสอบก่อน/หลัง deploy (Vercel/env vars/migration)
├── production-checklist.md     รายการตรวจสอบเชิงฟังก์ชัน/ความปลอดภัยตามบทบาท + Super Admin
├── backup-and-recovery.md      แนวทางสำรองฐานข้อมูล/ไฟล์/Environment Variables และการกู้คืน
│                                + checklist ทดสอบกู้คืนเป็นระยะ
├── uptime-monitoring.md         วิธีเชื่อมต่อ /api/health กับ UptimeRobot/Better Uptime/
│                                Cloudflare Health Checks
├── file-security.md             ชั้นการตรวจสอบไฟล์อัปโหลดทั้งหมด + magic-byte/สแกนมัลแวร์ (ช่วงที่ 14)
├── pdf-full-text-search.md      สถาปัตยกรรมค้นหาข้อความภายในไฟล์ PDF (ช่วงที่ 17)
├── document-access-requests.md  ระบบขอสิทธิ์เข้าถึงเอกสาร + แจ้งงานวิจัยใหม่ตามหมวดหมู่ (ช่วงที่ 18)
├── data-quality.md              ผู้วิจัย/หน่วยงานมาตรฐาน, ตรวจจับ+รวมงานวิจัยซ้ำ (ช่วงที่ 19/22)
├── orcid-integration.md         สถานะยืนยัน ORCID สองระดับ, OAuth, Public API (ช่วงที่ 19/23/27)
├── background-jobs.md           สถาปัตยกรรม background job queue, DLQ, cron/worker (ช่วงที่ 20/21/25/26/30/31)
├── ocr-operations.md            OCR สำหรับ PDF ที่เป็นเอกสารสแกน, provider abstraction (ช่วงที่ 23/27/29)
├── ocr-provider-validation.md   คู่มือทดสอบและเปิดใช้งาน OCR provider จริง (runbook, ช่วงที่ 32)
├── user-guide.md                คู่มือการใช้งานแยกตามบทบาทผู้ใช้
└── superadmin-guide.md          คู่มือ Super Admin ทุกหน้า + CAPTCHA/อีเมล/MFA/logging

public/
├── covers/                     ภาพปกงานวิจัยตัวอย่าง (SVG placeholder, ใช้ในโหมด Mock Data)
├── mock-pdfs/                  ไฟล์ PDF ตัวอย่างสำหรับทดสอบดาวน์โหลด (โหมด Mock Data)
└── ocr-test-fixtures/          ไฟล์ PDF ที่ไม่เป็นความลับสำหรับ Controlled OCR Test (ช่วงที่ 32)
                                 — english-sample, multipage-sample, no-text-scanned-sample
                                 (thai-sample เป็น slot ที่แอดมินต้องเพิ่มไฟล์เอง)
```

## ฟีเจอร์ที่พัฒนาแล้ว

### ช่วงที่ 1 — โครงสร้างเว็บไซต์และ Mock Data
- หน้าแรก, รายการงานวิจัย (ค้นหา/กรอง/เรียงลำดับ), รายละเอียดงานวิจัย,
  หน้าอ่านเอกสาร, เกี่ยวกับเรา, ติดต่อเรา, เข้าสู่ระบบ, สมัครสมาชิก (UI)
- รองรับการแสดงผลบนมือถือ (Responsive) และใช้ภาษาไทยเป็นหลักทั้งระบบ

### ช่วงที่ 2 — Supabase, ฐานข้อมูล และระบบสมาชิกจริง
- เชื่อมต่อ Supabase (PostgreSQL + Auth + RLS) พร้อม Mock Data fallback
- Schema ฐานข้อมูล 15 ตารางพร้อม RLS ตามระดับสิทธิ์ผู้ใช้
- ระบบสมัครสมาชิก, เข้าสู่ระบบ, ออกจากระบบ, ลืมรหัสผ่าน, แก้ไขโปรไฟล์ ผ่าน
  Supabase Auth จริง (Server Actions + Zod validation)
- Middleware ป้องกันหน้า `/account`, นับยอดเข้าชม/ดาวน์โหลด, บันทึกประวัติการอ่าน

### ช่วงที่ 3 — ส่ง จัดการ อนุมัติ และอ่านงานวิจัยจริง
- **Supabase Storage**: 3 buckets (`research-documents` private,
  `research-covers` public, `submission-attachments` private) พร้อม Storage
  RLS Policies (ทดสอบแล้วว่าเจ้าของไฟล์/librarian เข้าถึงได้ตามสิทธิ์จริง)
- **ส่งงานวิจัย** (`/submit-research`, Staff+): ฟอร์มครบทุกฟิลด์ตามที่กำหนด
  (ชื่อไทย/อังกฤษ, บทคัดย่อ, ผู้วิจัยหลายคน, หน่วยงาน, ปี, หมวดหมู่, คำสำคัญ,
  สิทธิ์การเข้าถึง, ข้อมูลลิขสิทธิ์, อัปโหลด PDF/ภาพปก/เอกสารแนบ) พร้อม
  ตรวจสอบชนิด/ขนาดไฟล์ทั้งฝั่ง client (แจ้งผลทันที) และฝั่งเซิร์ฟเวอร์
  (Storage bucket `allowed_mime_types`/`file_size_limit` บังคับอีกชั้น)
- **งานวิจัยของฉัน** (`/my-submissions`, Staff+): ดูสถานะ, ประวัติการเปลี่ยน
  สถานะ, แก้ไขได้เฉพาะตอน `draft`/`revision_requested`
- **อนุมัติงานวิจัย** (`/dashboard/approvals`, Librarian+): ตรวจสอบ, อนุมัติ,
  ไม่อนุมัติ (พร้อมเหตุผล), ขอแก้ไข (พร้อมรายละเอียด), เผยแพร่, จัดเก็บถาวร —
  ทุกการเปลี่ยนสถานะบันทึกลง `approval_logs`/`audit_logs` อัตโนมัติผ่าน
  database trigger
- **PDF Viewer จริง**: หน้าอ่านเอกสารแสดงไฟล์ PDF จริงผ่าน `<iframe>` ที่ชี้ไป
  Signed URL อายุสั้น (ไม่ใช่ Placeholder อีกต่อไป) พร้อมปุ่มเปิดในแท็บใหม่/ดาวน์โหลด
- **Signed URL + สิทธิ์การเข้าถึงไฟล์จริง**: ดาวน์โหลด/อ่านไฟล์ PDF ต้องผ่าน
  Server Action ที่ตรวจสอบ `access_level`/`status` ก่อนออก Signed URL เสมอ —
  ไม่มี public URL ของไฟล์เอกสาร private รั่วไหล และมีการบันทึก `download_logs`
  ทุกครั้งที่ดาวน์โหลดสำเร็จ
- **รายการโปรด** (`/favorites`) และ **ประวัติการอ่าน** (`/reading-history`)
  สำหรับ Member ขึ้นไป พร้อมปุ่มเพิ่ม/ลบรายการโปรดในหน้ารายละเอียดงานวิจัย

### ช่วงที่ 4 — ส่วนเจ้าหน้าที่ ผู้ดูแล สิทธิ์ และรายงาน
- **Dashboard** (`/dashboard`, Librarian+): สถิติภาพรวม (สมาชิก, งานวิจัยทั้งหมด,
  รอตรวจสอบ, ยอดเข้าชม/ดาวน์โหลดสะสม, งานวิจัยยอดนิยม) พร้อมตัวเลือกช่วงวันที่
  (คำนวณจาก `reading_history`/`download_logs`/`profiles.created_at` ที่มี
  timestamp จริง ไม่ใช่ยอดสะสมที่กรองตามวันที่ไม่ได้)
- **จัดการงานวิจัย** (`/dashboard/research`, Librarian+): ค้นหา/กรอง/แบ่งหน้า
  แบบ server-side (ไม่ดึงข้อมูลทั้งหมดมาไว้ฝั่ง client) แก้ไข เปลี่ยนสิทธิ์
  เผยแพร่ทันที และเก็บถาวรได้จากทุกสถานะ — `/dashboard/research/new` และ
  `/dashboard/research/[id]/edit` ใช้ `SubmitResearchForm` ตัวเดียวกับหน้า
  ส่งงานวิจัยของ Staff (ผ่าน prop `extraIntents` และ Server Action คนละตัว)
- **จัดการหมวดหมู่** (`/dashboard/categories`, Librarian+): เพิ่ม/แก้ไข/ปิดใช้งาน
  หมวดหมู่หลักและหมวดหมู่ย่อย (`parent_id`) ลบได้เฉพาะเมื่อไม่มีงานวิจัยหรือ
  หมวดหมู่ย่อยผูกอยู่ (กันลบพลาดข้อมูลอ้างอิง)
- **จัดการหน่วยงาน** (`/dashboard/organizations`, Librarian+): รูปแบบเดียวกับ
  หมวดหมู่ (เพิ่ม/แก้ไข/ปิดใช้งาน/ลบอย่างปลอดภัย)
- **จัดการผู้ใช้งาน** (`/dashboard/users`, Admin เท่านั้น): เปลี่ยนบทบาท
  Member/Staff/Librarian/Admin ได้ทันที และเปิด/ปิดสถานะบัญชีผ่าน Supabase
  Auth Admin API (ระงับบัญชีจริง ไม่ใช่แค่ปรับ flag) โดยไม่ลบข้อมูล
- **รายงาน** (`/dashboard/reports`, Librarian+): การเข้าชม, การดาวน์โหลด,
  งานวิจัยยอดนิยม, สมาชิก — กรองตามช่วงวันที่/หมวดหมู่/ประเภทผู้ใช้ พร้อม
  ส่งออก CSV (มี UTF-8 BOM ให้ Excel เปิดภาษาไทยได้ถูกต้อง) ผ่าน Route Handler
  ที่ตรวจสอบสิทธิ์ซ้ำอีกชั้น (`/dashboard/reports/export`)
- **Audit Log** (`/dashboard/audit-logs`, Admin เท่านั้น): ประวัติการกระทำสำคัญ
  ทั้งหมด — งานวิจัยเปลี่ยนสถานะบันทึกอัตโนมัติผ่าน database trigger (ตั้งแต่
  ช่วงที่ 3) ส่วนการจัดการหมวดหมู่/หน่วยงาน/ผู้ใช้/ตั้งค่าบันทึกผ่าน `logAudit()`
  ในแต่ละ Server Action โดยตรง
- **ตั้งค่าระบบ** (`/dashboard/settings`, Admin เท่านั้น): ชื่อองค์กร โลโก้
  ข้อมูลติดต่อ ข้อความลิขสิทธิ์ และจำนวนงานวิจัยล่าสุด/ยอดนิยมที่แสดงในหน้าแรก
  — ค่าที่ตั้งมีผลจริงกับ Header/Footer/หน้าแรกทันที (ผ่าน `revalidatePath`)
- **หมวดหมู่/หน่วยงานเป็นข้อมูลจริงจาก Supabase แล้ว** (พร้อม Mock Data
  fallback เดิม) — เดิมหน้าเว็บสาธารณะอ่านจาก `data/categories.ts` แบบ static
  ล้วน ตอนนี้ปรับให้ดึงจากฐานข้อมูลจริงเพื่อให้การจัดการผ่าน Dashboard มีผล
  กับเว็บจริง (ยกเว้นป้ายหมวดหมู่เล็กๆ บนการ์ดผลงาน ซึ่งยังคงอ้างอิงจาก
  Mock Data แบบ static เพื่อจำกัดขอบเขตการแก้โค้ดในช่วงนี้)

### ช่วงที่ 5 — ตรวจสอบความพร้อมใช้งานจริงและเตรียม Deploy

- **แก้บั๊กที่บล็อกการ deploy จริง**: `generateStaticParams` ของหน้า
  `/research/[id]` และ `/research/[id]/read` เรียก `cookies()` ระหว่าง build
  ทำให้ `npm run build` ล้มเหลวทันทีที่ตั้งค่า Supabase จริง (ใช้ mock data
  ระหว่างพัฒนาจึงไม่เจอปัญหานี้มาก่อน) — แก้โดยลบออก เพราะทั้งสองหน้าเป็น
  dynamic per-request อยู่แล้วจากการตรวจสอบ session/รายการโปรด/signed URL
- **ปิดช่องโหว่ secret รั่วไหล**: เพิ่ม `supabase/.temp/` และ
  `supabase/.branches/` เข้า `.gitignore` (มี project ref, pooler URL,
  local secrets ของ Supabase CLI ที่ไม่เคยถูกกันไว้มาก่อน) พร้อมปรับ
  `eslint.config.mjs` ให้ไม่สแกนโฟลเดอร์เดียวกันนี้
- **ลดการรั่วไหลของข้อมูลภายในผ่าน error message**: หน้า/ฟีเจอร์ที่ผู้ใช้ทั่วไป
  เข้าถึงได้ (รายการโปรด, การสร้างลิงก์ไฟล์) เปลี่ยนจากแสดง error ดิบของ
  Postgres/Storage (มีชื่อ constraint/schema) เป็นข้อความทั่วไป พร้อม log
  รายละเอียดไว้ฝั่งเซิร์ฟเวอร์แทน
- **ตรวจสอบคุณภาพโค้ด**: `npm run lint`, `npx tsc --noEmit`, `npm run build`
  ผ่านสะอาดทั้งหมด ไม่มี `console.log`/โค้ดทดสอบค้าง และไม่พบ secret ใดๆ
  ในซอร์สโค้ด
- **ตรวจสอบ RLS + สิทธิ์ตามบทบาทแบบทำงานจริง**: สร้างผู้ใช้ทดสอบจริงทั้ง 4
  บทบาทบน local Supabase (Docker) แล้วยืนยันผ่าน SQL ว่า RLS ทำงานตรงตาม
  ที่ออกแบบไว้ทุกกรณี (การมองเห็นงานวิจัยตามสถานะ/สิทธิ์, การแก้ไขเฉพาะเจ้าของ,
  สิทธิ์ `user_roles` เฉพาะ admin, ความเป็นเจ้าของไฟล์ใน Storage)
- **เอกสารสำหรับ deploy จริง**: เพิ่มหัวข้อ "Deploy บน Vercel" ใน README นี้
  พร้อมสร้าง [`docs/deployment-checklist.md`](docs/deployment-checklist.md),
  [`docs/backup-and-recovery.md`](docs/backup-and-recovery.md) และ
  [`docs/user-guide.md`](docs/user-guide.md)

### ช่วงที่ 6 — ระบบ Super Admin

- **บทบาท `super_admin`** (rank 50, สูงสุดในระบบ) — เพิ่มผ่าน migration
  `20260802100100_super_admin_role.sql` ได้สิทธิ์ทุกอย่างของ admin/librarian/
  staff/member โดยอัตโนมัติจากนโยบาย RLS เดิมที่เปรียบเทียบด้วย `rank >= N`
  อยู่แล้ว โดยปิดช่องโหว่การยกระดับสิทธิ์ใหม่ 2 จุดที่เกิดขึ้นเฉพาะเพราะมี
  บทบาทนี้: (1) การจัดการตาราง `roles` เอง และ (2) การมอบ/ถอดถอนบทบาท
  `super_admin` ให้ผู้ใช้อื่น — ทั้งสองจุดจำกัดเฉพาะ rank ≥ 50 เท่านั้น
  บทบาทอื่นทั้งหมด admin (rank ≥ 40) ยังจัดการได้เหมือนเดิมทุกประการ
- **ป้องกันการถอดถอน super_admin คนสุดท้าย**: บังคับด้วย database trigger
  บน `user_roles` (`prevent_last_super_admin_removal`) ครอบคลุมทุกเส้นทาง
  รวมถึงการลบแบบ cascade จาก `auth.users`
- **Super Admin Dashboard** (`/superadmin`, redirect ไป `/superadmin/overview`)
  แยกเลย์เอาต์/แถบเมนู (`SuperAdminSidebar`) ออกจาก Admin Dashboard
  (`/dashboard`) โดยสิ้นเชิง ป้องกันด้วย rank ≥ 50 ทั้งที่ `middleware.ts`
  และซ้ำอีกชั้นที่ `app/superadmin/layout.tsx` — admin ปกติ (rank 40) เข้า
  ไม่ได้ ถูกพาไปหน้า `/403`
- **หน้า Overview**: ผู้ใช้ทั้งหมดแยกตามบทบาท, สมาชิกใหม่ (30 วันล่าสุด),
  งานวิจัยทั้งหมดแยกตามสถานะ, รอตรวจสอบ, ยอดเข้าชม/ดาวน์โหลดสะสม, งานวิจัย
  ยอดนิยม, พื้นที่ Storage ที่ใช้ต่อ bucket (ผ่านฟังก์ชัน
  `superadmin_storage_usage()`), สถานะ Backup ล่าสุด, Audit Log ล่าสุด และ
  การแจ้งเตือนของระบบที่คำนวณจากสัญญาณจริง (เช่น `SUPABASE_SERVICE_ROLE_KEY`
  ไม่ได้ตั้งค่า หรืองานวิจัยรอตรวจสอบค้างนานผิดปกติ) — แต่ละส่วนดึงข้อมูล
  อิสระต่อกันผ่าน `<Suspense>` พร้อม loading skeleton และแสดง "ไม่พร้อมใช้งาน"
  เฉพาะส่วนที่ดึงไม่ได้ (ไม่มีข้อมูลสมมติ ไม่ทำให้ทั้งหน้าพัง)
- **`/dashboard/users`**: แถวที่เป็น super_admin แสดงป้ายกำกับแบบอ่านอย่างเดียว
  แทน dropdown เปลี่ยนบทบาท (ทั้งเพื่อความถูกต้องของการแสดงผลและเพื่อความ
  ชัดเจนว่าการจัดการ super_admin ไม่ได้อยู่ในหน้านี้) — การสร้าง super_admin
  คนแรกทำผ่าน SQL โดยตรงเท่านั้น (ดูหัวข้อด้านบน) ยังไม่มีหน้า UI มอบ/
  ถอดถอนบทบาทนี้ในรอบนี้

### ช่วงที่ 7 — Super Admin ส่วนที่ 2 (Users/Roles/System Settings/Security/Storage/Notifications)

- **ผู้ใช้งาน** (`/superadmin/users`, `/superadmin/users/[id]`): ค้นหา/กรอง
  ตามชื่อ/อีเมล/สถานะ/บทบาท, กำหนดได้หลายบทบาทต่อผู้ใช้หนึ่งคนผ่าน checkbox
  (ต่างจาก `/dashboard/users` ที่เลือกได้ทีละบทบาท), ดูประวัติการทำงาน
  (`audit_logs`), เปิด/ระงับบัญชีถาวรหรือชั่วคราว (ระบุจำนวนวัน) — ทุกการ
  แก้ไขบทบาท/สถานะบันทึก audit log เสมอ
- **บทบาทและสิทธิ์** (`/superadmin/roles`): Role Matrix แบบอ่านอย่างเดียว
  (schema ยังไม่รองรับสิทธิ์แบบละเอียดรายรายการอย่างปลอดภัย)
- **ตั้งค่าระบบขั้นสูง** (`/superadmin/system-settings`): อัปโหลดโลโก้/favicon
  โดยตรง (bucket `site-assets` ใหม่), Social Media, เปิด/ปิดการสมัคร
  สมาชิก-การส่งงานวิจัย (บังคับจริงใน Server Action), สถานะเริ่มต้นของ
  งานวิจัยใหม่, ขนาดไฟล์สูงสุด (มีผลจริงกับ Storage bucket ทันที) — ฟิลด์
  ใหม่ทั้งหมดแก้ไขได้เฉพาะ super_admin เท่านั้น (บังคับด้วย trigger)
- **ความปลอดภัย** (`/superadmin/security`): CAPTCHA (Cloudflare Turnstile —
  ฝัง widget จริงและบังคับตรวจสอบ token ฝั่งเซิร์ฟเวอร์แล้วที่ฟอร์มสมัคร
  สมาชิกและฟอร์มส่งงานวิจัยใหม่ ดูรายละเอียดในช่วงที่ 9), Rate Limit
  แบบอิงฐานข้อมูล (ทำงานจริงทันทีสำหรับสมัครสมาชิก/ส่งงานวิจัย ไม่พึ่งบริการ
  ภายนอก), นโยบายยืนยันอีเมล (อ่านค่าจริงจาก GoTrue แบบอ่านอย่างเดียว),
  รายชื่อบัญชีที่ถูกระงับ
- **Storage** (`/superadmin/storage`): พื้นที่ใช้งานต่อ bucket ทั้ง 4,
  สแกนหาไฟล์ที่ไม่มีการอ้างอิงในฐานข้อมูล (ไฟล์เก่าที่ถูกแทนที่/อัปโหลดค้าง)
  ลบได้หลังยืนยันเท่านั้น พร้อมตรวจสอบซ้ำก่อนลบจริงและบันทึก audit log
- **การแจ้งเตือน** (`/superadmin/notifications`): in-app notifications ทำงาน
  จริงทันที (สร้างอัตโนมัติผ่าน database trigger เดิมที่บันทึก
  approval_logs/audit_logs ทุกครั้งที่สถานะงานวิจัยเปลี่ยน) แสดงผลผ่าน
  กระดิ่งแจ้งเตือนใน Header, อีเมลแจ้งเตือนรองรับผ่าน Resend (ต้องตั้งค่า
  `RESEND_API_KEY` — ไม่มีค่านี้ระบบแจ้งสถานะ "ยังไม่ได้ตั้งค่า" อย่างชัดเจน)

> รายละเอียดวิธีใช้แต่ละหน้าและวิธีตั้งค่า CAPTCHA/อีเมล ดูที่
> [`docs/superadmin-guide.md`](docs/superadmin-guide.md)

### ช่วงที่ 8 — กราฟเชิงลึก, Audit Log ขั้นสูง, System Logs/Health, Backups

- **กราฟเชิงลึกใน `/superadmin/overview`** (ใช้ [recharts](https://recharts.org/)):
  สมาชิกใหม่รายวัน/รายเดือน, ยอดเข้าชม+ดาวน์โหลดตามช่วงเวลา, จำนวนงานวิจัยตาม
  หมวดหมู่, สัดส่วนงานวิจัยตามสถานะ — เลือกช่วงวันที่และความละเอียด (วัน/เดือน)
  ได้ ทุกกราฟดึงข้อมูลอิสระต่อกัน แสดง "ไม่พร้อมใช้งาน"/"ยังไม่มีข้อมูล" แยกส่วน
- **`/superadmin/audit-logs`**: เหมือน `/dashboard/audit-logs` เดิมแต่เพิ่ม
  ตัวกรองผู้กระทำ (ค้นหาชื่อ/อีเมล) และประเภทการกระทำ พร้อม pagination —
  ใช้ data layer ร่วมกัน (`getAuditLogs`) ซึ่งปรับให้ไม่ throw raw error ออกไป
  แสดงในหน้าเว็บอีกต่อไป (คืนค่า "ไม่พร้อมใช้งาน" แทน)
- **`/superadmin/system-logs`**: ระบบยังไม่มี log รวมศูนย์ (centralized logging)
  จริง หน้านี้จึงแสดงคำแนะนำการเชื่อมต่อผู้ให้บริการ (Vercel Log Drains, Axiom,
  Better Stack) แทนการสร้าง log ปลอม พร้อมอธิบายว่า log จริงตอนนี้อยู่ที่ไหนบ้าง
- **`/superadmin/system-health`**: ตรวจสอบสถานะ Database/Auth/Storage แบบสด
  (real-time) ทุกครั้งที่โหลดหน้า พร้อมเวลาตรวจสอบล่าสุด — หากยังไม่ได้ตั้งค่า
  Supabase จะแสดง "ยังไม่สามารถตรวจสอบอัตโนมัติได้" อย่างตรงไปตรงมา
- **`/superadmin/backups`**: แสดงสถานะ Backup แบบตรงไปตรงมาว่า "ไม่พร้อมใช้งาน"
  เสมอ (Supabase ไม่มี API ให้แอปภายนอกอ่าน/สั่งสำรองข้อมูลได้) พร้อมลิงก์ไปยัง
  [`docs/backup-and-recovery.md`](docs/backup-and-recovery.md) — **ไม่มีปุ่ม
  "สำรองข้อมูลตอนนี้" โดยเจตนา** เพราะไม่มี API รองรับจริง

> ดูรายละเอียดเพิ่มเติมที่ [`docs/superadmin-guide.md`](docs/superadmin-guide.md)
> และรายการตรวจสอบก่อนใช้งานจริงที่ [`docs/production-checklist.md`](docs/production-checklist.md)

### ช่วงที่ 9 — CAPTCHA จริง, ขนาดไฟล์แบบไดนามิก, ปิดช่อง error ดิบ

- **Cloudflare Turnstile ฝังจริง**: `components/auth/TurnstileWidget.tsx`
  (โหลดสคริปต์ Cloudflare แบบ client-side, ส่ง token ผ่าน hidden input) ใช้ใน
  `RegisterForm` (`/register`) และ `SubmitResearchForm` เฉพาะตอนอยู่ที่
  `/submit-research` (ฟอร์มส่งงานวิจัยใหม่ — ไม่รวมหน้าแก้ไข/เพิ่มงานวิจัยของ
  Librarian/Admin ที่ใช้ component เดียวกัน) ตรวจสอบ token กับ Cloudflare จริง
  ฝั่งเซิร์ฟเวอร์เสมอผ่าน `verifyCaptchaIfEnabled()` ใน `lib/captcha.server.ts`
  ก่อนสร้างบัญชี/บันทึกงานวิจัยทุกครั้ง — ไม่เชื่อผลจาก client เพียงอย่างเดียว
  เปิดสวิตช์ไว้แต่ตั้งค่าคีย์ไม่ครบจะ fail-open (ไม่บล็อกผู้ใช้ ไม่แสดง widget
  ที่พัง) พร้อม log คำเตือนไว้ฝั่งเซิร์ฟเวอร์เท่านั้น
- **ขนาดไฟล์แบบไดนามิกฝั่ง client**: `SubmitResearchForm` รับค่า
  `maxPdfSizeMb`/`maxCoverSizeMb`/`maxAttachmentSizeMb` จาก `getSettings()`
  ผ่าน prop `fileLimits` แล้วแสดงคำแนะนำ/ตรวจสอบไฟล์ตามค่าจริงที่ผู้ดูแลปรับไว้
  ที่ `/superadmin/system-settings` เสมอ (ไม่ใช้ค่าคงที่อีกต่อไป) — การบังคับ
  จริงยังอยู่ที่ Storage bucket (`file_size_limit`) เหมือนเดิม จึงถูกต้องเสมอ
  แม้ client จะถูกแก้ไข ค่าคงที่ใน `lib/storage/limits.ts` เหลือไว้เฉพาะเป็น
  fallback ปลอดภัยเมื่อยังไม่มีแถวการตั้งค่าในฐานข้อมูล
- **ปิดช่อง error ดิบในหน้า dashboard ภายใน**: สร้าง utility ใช้ซ้ำ
  `toSafeErrorMessage()` (`lib/errors/safe-message.server.ts`) แปลง error จาก
  Postgres/Supabase เป็นข้อความทั่วไปเสมอ (log รายละเอียดจริงไว้ฝั่งเซิร์ฟเวอร์
  เท่านั้น) ยกเว้น error ที่มี `code === 'P0001'` ซึ่งเป็นข้อความภาษาไทยที่แอป
  ตั้งใจ raise เองจาก database trigger (เช่น กันถอดถอน Super Admin คนสุดท้าย)
  จึงปลอดภัยที่จะแสดงตรงๆ — ใช้แทนที่การต่อ string
  `` `...: ${error.message}` `` เดิมในหน้าจัดการหมวดหมู่/หน่วยงาน/ตั้งค่า/
  งานวิจัย (`/dashboard/categories`, `/dashboard/organizations`,
  `/dashboard/settings`, `/dashboard/research/new`,
  `/dashboard/research/[id]/edit`, `/submit-research`, `/my-submissions/[id]`)
  ทั้งหมด

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 9)

- **CAPTCHA บังคับเฉพาะฟอร์มส่งงานวิจัย "ใหม่" ที่ `/submit-research`
  เท่านั้น** ไม่รวมหน้าแก้ไขของเจ้าของงาน (`/my-submissions/[id]`) หรือหน้า
  เพิ่ม/แก้ไขงานวิจัยโดยตรงของ Librarian/Admin (`/dashboard/research/new`,
  `/dashboard/research/[id]/edit`) แม้ทั้งหมดใช้ `SubmitResearchForm` ร่วมกัน
  — เพราะเป็นจุดเสี่ยงต่อการถูกใช้สคริปต์อัตโนมัติสร้างข้อมูลใหม่มากที่สุด
  ส่วนหน้าอื่นเป็นการแก้ไขข้อมูลเดิมหรือจำกัดสิทธิ์ไว้ที่ Librarian/Admin
  อยู่แล้ว
- **CAPTCHA fail-open เมื่อเปิดสวิตช์แต่ตั้งค่าคีย์ไม่ครบ** สอดคล้องกับรูปแบบ
  เดียวกับ `checkRateLimit()` เดิม — เพื่อไม่ให้ super_admin เปิดสวิตช์โดยยัง
  ตั้งค่าไม่ครบแล้วปิดกั้นผู้ใช้ทุกคนโดยไม่ได้ตั้งใจ
- **`toSafeErrorMessage()` แยกแยะ error ด้วย Postgres error code ไม่ใช่
  substring matching** — แม่นยำและปลอดภัยกว่าการเดาจากข้อความ (`code ===
  'P0001'` คือ `raise exception ... using errcode = 'P0001'` ที่แอปเขียนเอง
  ในฝั่งฐานข้อมูลเท่านั้น error code อื่นทั้งหมด รวมถึง constraint violation
  ที่ยังไม่รู้จัก จะถูกแทนที่ด้วยข้อความทั่วไปเสมอ)

> ดูรายละเอียดเพิ่มเติมที่ [`docs/superadmin-guide.md`](docs/superadmin-guide.md)

### ช่วงที่ 10 — มอบ/ถอดถอนบทบาท Super Admin ผ่าน UI อย่างปลอดภัย

- **`/superadmin/users/[id]` — แถวบทบาท Super Admin แยกจากบทบาทอื่น**: คลิก
  checkbox แล้วเปิดกล่องยืนยัน (`SuperAdminRoleConfirmDialog`) เสมอ แทนการ
  toggle ทันทีเหมือนบทบาทอื่น (member/staff/librarian/admin ยัง toggle ทันที
  เหมือนเดิมไม่เปลี่ยนแปลง) — กล่องยืนยันแสดงชื่อ-อีเมลผู้ใช้เป้าหมายชัดเจน
  ต้องพิมพ์คำว่า `CONFIRM` หรืออีเมลผู้ใช้เป้าหมายให้ตรงกันก่อนปุ่มยืนยันจะกด
  ได้ พร้อมช่องกรอกเหตุผล (ไม่บังคับ)
- **`grantSuperAdminAction`/`revokeSuperAdminAction`** (ใหม่ใน
  `app/superadmin/users/actions.ts`): แยกจาก `addUserRoleAction`/
  `removeUserRoleAction` เดิมโดยสิ้นเชิง (ทั้งสองตัวเดิมตอนนี้ปฏิเสธ
  `role=super_admin` แล้ว กันไม่ให้ข้ามหน้ายืนยันได้แม้เรียกตรง) — ตรวจสอบ
  ข้อความยืนยันซ้ำที่ฝั่งเซิร์ฟเวอร์เสมอ (ไม่เชื่อ client เพียงอย่างเดียว)
  บันทึก `audit_logs` ครบ: ผู้กระทำ, อีเมล/ชื่อผู้ถูกเปลี่ยน, บทบาทเดิม
  ทั้งหมด, บทบาทใหม่ทั้งหมด, เหตุผล (ถ้ามี)
- **ประวัติที่ถูกดำเนินการกับบัญชีนี้** (ส่วนใหม่ในหน้า
  `/superadmin/users/[id]`): แสดง `audit_logs` ที่ผู้ใช้คนนี้เป็นเป้าหมาย
  (มอบ/ถอดถอนบทบาท, ระงับ/เปิดใช้งานบัญชี) พร้อมผู้กระทำและเหตุผล — ใช้
  `getAuditLogs()` เดิมที่เพิ่ม filter `entityId` เข้าไป (ไม่สร้างฟังก์ชันใหม่)

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 10)

- **ไม่มีการเปลี่ยนแปลง schema/RLS/trigger ใดๆ ในรอบนี้เลย** — มาตรการความ
  ปลอดภัยหลักทั้งหมด (RLS จำกัดการเขียนแถว `user_roles` ที่ชี้ไปบทบาท
  `super_admin` ให้ rank ≥ 50 เท่านั้น, trigger กันถอดถอน Super Admin คนสุดท้าย)
  มีอยู่แล้วตั้งแต่ Phase 6 (`20260802100100_super_admin_role.sql`) รอบนี้เป็น
  การเพิ่มชั้น UX/UI ยืนยันตัวตนและ audit log ที่ละเอียดขึ้นเท่านั้น
  ไม่ต้องรัน migration ใหม่
- **กล่องยืนยัน (พิมพ์ CONFIRM/อีเมล) เป็นด่านป้องกันการคลิกพลาด ไม่ใช่ด่าน
  อนุญาตสิทธิ์** — สิทธิ์ที่แท้จริงมาจาก `requireMinRank(50)` และ RLS เท่านั้น
  ต่อให้มีคนพยายามเรียก Server Action ตรงๆ ข้ามหน้า UI ก็ยังต้องผ่านการ
  ตรวจสอบข้อความยืนยันที่ฝั่งเซิร์ฟเวอร์ (คืนข้อความ error ทั่วไปถ้าไม่ตรง
  ไม่ใช่การอนุญาตให้ผ่าน) เช่นเดียวกับรูปแบบ "type repo name to delete" ที่
  ใช้กันทั่วไป
- **`addUserRoleAction`/`removeUserRoleAction` เดิมตัดสิทธิ์ `super_admin`
  ออกจากรายการบทบาทที่จัดการได้** (`GENERIC_ASSIGNABLE_ROLES` แทน
  `ASSIGNABLE_ROLES` เดิม) — เพื่อไม่ให้มีทางลัดข้ามกล่องยืนยันได้แม้แต่จาก
  โค้ดฝั่งเดียวกัน สอดคล้องกับหลักการ "จุดเดียวสำหรับการกระทำที่มีความเสี่ยงสูง"
- **`getAuditLogs()` เพิ่ม filter `entityId` แทนการสร้างฟังก์ชันใหม่** — ใช้
  ซ้ำโค้ดที่ทดสอบแล้วจาก Phase 8 (การแบ่งหน้า, การ resolve ชื่อผู้กระทำ,
  การไม่ throw raw error) แทนการเขียน query ประวัติสำหรับหน้านี้ขึ้นใหม่

> ดูรายละเอียดเพิ่มเติมที่ [`docs/superadmin-guide.md`](docs/superadmin-guide.md)

### ช่วงที่ 11 — ความพร้อมใช้งานจริงด้านการเฝ้าระวังและความปลอดภัย

- **Centralized Logging**: `lib/logging/` — abstraction เชื่อมต่อ Sentry
  (Envelope API) หรือ Better Stack/Logtail (HTTP ingestion) เลือกผ่าน
  `LOG_PROVIDER` ไม่ต้องติดตั้ง SDK เพิ่ม ส่ง error ที่ผ่านการตัดข้อมูลอ่อนไหว
  (`redactSecrets()`) ออกอัตโนมัติเฉพาะตอน production ผ่าน Next.js
  `instrumentation.ts` (`onRequestError` hook — จับ error ทั้งแอปโดยไม่ต้องแก้
  โค้ดทุกจุด) ไม่มีคีย์ก็ยัง log ผ่าน console ได้ปกติ (ทดสอบแล้วจริงด้วยการยิง
  error จริงผ่าน route ทดสอบ)
- **Uptime Monitoring**: `/api/health` (ใหม่) — endpoint สาธารณะตรวจ
  application/database/storage แบบปลอดภัย ไม่เปิดเผย secret หรือรายละเอียด
  infrastructure คืน HTTP 503 เมื่อฐานข้อมูลเชื่อมต่อไม่ได้ พร้อมเอกสารตั้งค่า
  UptimeRobot/Better Uptime/Cloudflare Health Checks ใน
  [`docs/uptime-monitoring.md`](docs/uptime-monitoring.md) (ใหม่)
- **MFA สำหรับ Super Admin**: ใช้ความสามารถ TOTP MFA ในตัวของ Supabase Auth
  เต็มรูปแบบ — `/account` มี UI enroll/list/unenroll factor
  (`components/account/MfaSettings.tsx`), `middleware.ts` บังคับ step-up
  (aal1→aal2) จริงก่อนเข้า `/superadmin/*` ทุกเซสชันใหม่สำหรับผู้ที่ตั้งค่าไว้
  แล้ว (เด้งไปหน้า `/mfa-challenge` ใหม่) ผู้ที่ยังไม่ได้ตั้งค่าเห็นแบนเนอร์เตือน
  ทุกหน้า `/superadmin/*` และที่ `/account` — ทดสอบแล้วจริงผ่าน GoTrue REST API
  โดยตรง (enroll → verify → ยืนยัน JWT มี `aal2` จริง)
- **ความปลอดภัยของไฟล์**: ตรวจนามสกุลไฟล์ตรงกับ MIME type ที่ตรวจพบทั้งฝั่ง
  client (`lib/storage/limits.ts`) และ server (`lib/validation/submission.ts`,
  `lib/validation/system-settings.ts` ผ่าน Zod `.refine()`) เอกสาร
  [`docs/file-security.md`](docs/file-security.md) (ใหม่) สรุปชั้นการตรวจสอบ
  ทั้งหมดอย่างตรงไปตรงมา รวมถึงข้อจำกัด (ไม่มี magic-byte/malware scanning ใน
  โค้ดปัจจุบัน) พร้อมคำแนะนำเชื่อมต่อบริการสแกนมัลแวร์ก่อนเปิดใช้งานจริง
- **`docs/backup-and-recovery.md`**: เพิ่มหัวข้อสำรอง Environment Variables
  อย่างปลอดภัย และ checklist การทดสอบกู้คืนที่ละเอียดขึ้นพร้อมรอบเวลาที่แนะนำ
  (ทุก 6 เดือน)

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 11)

- **ไม่ติดตั้ง `@sentry/nextjs` SDK** — ส่งผ่าน Sentry Envelope API ตรงๆ ด้วย
  `fetch` แทน เพื่อลดความเสี่ยงจากการเปลี่ยนแปลงโครงสร้างโปรเจกต์ใหญ่ (SDK
  ต้องแก้ `next.config`, เพิ่ม client-side instrumentation ฯลฯ) — เพียงพอสำหรับ
  ความต้องการหลักคือส่ง error ที่ sanitize แล้วออกไปเก็บนอกระบบ
- **MFA step-up บังคับเฉพาะผู้ที่ตั้งค่าไว้แล้ว ไม่บังคับก่อนใช้งานครั้งแรก** —
  ป้องกันปัญหา "ล็อกตัวเองออกจากระบบ" (Super Admin คนแรกที่สร้างผ่าน SQL จะเข้า
  `/superadmin` ไม่ได้เลยถ้าบังคับ MFA ทันทีโดยยังไม่มีใครตั้งค่าไว้ก่อน) — ใช้
  กลไก AAL (Authenticator Assurance Level) ของ Supabase Auth เอง ไม่ได้สร้าง
  ระบบ session ขนานเพิ่ม
- **`/api/health` แยก matcher ออกจาก middleware หลัก** — เพื่อไม่ให้ทุกการเรียก
  จาก uptime monitor (ทุก 1-5 นาที) ต้องผ่าน Supabase Auth session refresh ซึ่ง
  ไม่จำเป็นสำหรับ endpoint สาธารณะที่ไม่ต้องใช้ session
- **ไม่ implement การตรวจเนื้อไฟล์จริง (magic-byte) หรือสแกนมัลแวร์ในรอบนี้** —
  สถาปัตยกรรมอัปโหลดไฟล์ตรงจาก Browser ไปยัง Storage (ตั้งใจออกแบบไว้ตั้งแต่
  Phase 3 เพื่อประสิทธิภาพ) ทำให้เซิร์ฟเวอร์ของแอปไม่เคยเห็นเนื้อไฟล์จริงเลย
  การเปลี่ยนสถาปัตยกรรมให้ผ่านเซิร์ฟเวอร์เป็นการเปลี่ยนแปลงใหญ่เกินขอบเขตของรอบ
  นี้ — เลือกเขียนเอกสารคำแนะนำที่ตรงไปตรงมาแทนการอ้างว่าปลอดภัยแล้วทั้งที่ยังไม่ได้ทำ

> ดูรายละเอียดเพิ่มเติมที่ [`docs/superadmin-guide.md`](docs/superadmin-guide.md),
> [`docs/uptime-monitoring.md`](docs/uptime-monitoring.md) และ
> [`docs/file-security.md`](docs/file-security.md)

### ช่วงที่ 12 — จัดลำดับหมวดหมู่/หน่วยงานแบบลากวาง (Drag-and-Drop)

- **`categories.sort_order`/`organizations.sort_order`** (ใหม่): backfill ค่า
  เริ่มต้นให้ข้อมูลเดิมอัตโนมัติตามลำดับ `created_at` ในกลุ่มเดียวกัน (categories
  แบ่งกลุ่มตาม `parent_id`) — ไม่กระทบข้อมูล/ความสัมพันธ์งานวิจัยเดิมแต่อย่างใด
- **`/superadmin/categories`**: ลากวางจัดลำดับหมวดหมู่หลัก/ย่อยแบบต้นไม้ (ใช้
  [dnd-kit](https://dndkit.com/)) ลากหมวดหมู่ย่อยข้ามไปหมวดหมู่หลักอื่นได้โดยตรง
  — มีปุ่มเลื่อนขึ้น/ลงและเมนูเลือกหมวดหมู่หลักปลายทางเป็นทางเลือกแทนการลากเสมอ
  (ใช้งานได้แม้บนมือถือ/คีย์บอร์ด) แสดงสถานะ "กำลังบันทึก/บันทึกสำเร็จ/ผิดพลาด"
  ชัดเจน คืนค่าลำดับเดิมอัตโนมัติหากบันทึกไม่สำเร็จ
- **`/superadmin/organizations`**: ลากวางจัดลำดับหน่วยงาน (แบบเดียวกัน ไม่มี
  โครงสร้างหลัก/ย่อย)
- **RPC ใหม่ 3 ตัว** (security definer, ตรวจสอบ rank ≥ 50 เอง, transaction เดียว
  จบในตัว): `superadmin_reorder_categories()`, `superadmin_move_category()`,
  `superadmin_reorder_organizations()`
- **trigger ป้องกัน circular reference** ใน `categories.parent_id` (ใหม่) —
  ทำงานทั้งจาก `/dashboard/categories` เดิมและ `/superadmin/categories` ใหม่
- **trigger จำกัดการแก้ไข `sort_order`** ให้เฉพาะ super_admin (rank ≥ 50) —
  คอลัมน์อื่นของ categories/organizations ยังแก้ไขได้โดย librarian/admin
  (rank ≥ 30) ผ่าน `/dashboard/categories`/`/dashboard/organizations` เดิมทุก
  ประการ ไม่กระทบสิทธิ์เดิม
- **หน้าเว็บสาธารณะและตัวกรองค้นหาเรียงตาม `sort_order` แล้ว** —
  `getCategories()`/`getOrganizations()` (`lib/data/`) เปลี่ยนจากเรียงตาม
  `name_th` เป็นเรียงตาม `sort_order` (หมวดหมู่เรียงแบบต้นไม้แบนราบ: หลักก่อน
  ตามด้วยย่อยของมันเอง)

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 12)

- **จัดลำดับเป็นฟีเจอร์แยกจาก CRUD เดิมโดยสิ้นเชิง** — `/dashboard/categories`/
  `/dashboard/organizations` (เพิ่ม/แก้ไข/ปิดใช้งาน/ลบ, rank ≥ 30) ไม่ถูกแตะ
  ต้องเลย มีแค่หน้าใหม่ `/superadmin/*` (rank ≥ 50) สำหรับจัดลำดับเพิ่มเติม
  เท่านั้น ลดความเสี่ยงต่อฟีเจอร์เดิมให้เหลือน้อยที่สุด
- **ใช้ RPC function (security definer) แทนการอัปเดตหลายแถวจาก client โดยตรง**
  — เพื่อให้การจัดลำดับ/ย้ายทั้งกลุ่มเป็น transaction เดียวจริงตามที่โจทย์
  กำหนด ("ใช้ transaction เมื่อย้าย/เรียงลำดับหลายรายการ") ป้องกันสถานะครึ่งๆ
  กลางๆ หากบันทึกล้มเหลวกลางทาง
- **จำกัดสิทธิ์ `sort_order` ด้วย column-specific trigger
  (`before update of sort_order`)** แทนการเข้มงวด RLS Policy ทั้งแถว — เพื่อไม่
  ให้กระทบสิทธิ์เดิมของ librarian/admin ในการแก้ไขคอลัมน์อื่น (สอดคล้องกับ
  รูปแบบ `protect_superadmin_settings_columns()` จาก Phase 7)
- **`prevent_category_cycle()` เป็น database trigger ระดับตาราง** ไม่ใช่แค่
  ตรวจใน Server Action — เพราะต้องครอบคลุมทั้ง entry point เดิม
  (`/dashboard/categories` dropdown) และใหม่ (`/superadmin/categories` ลากวาง)
  ด้วยจุดเดียว ไม่ให้มีทางหลุดจากจุดใดจุดหนึ่ง
- **ทดสอบ RLS/RPC จริงผ่าน PostgREST HTTP endpoint โดยตรง** (ไม่ใช่แค่ SQL
  จำลอง) — เรียก `superadmin_reorder_organizations` ผ่าน `/rest/v1/rpc/...`
  จริงด้วย token ของ super_admin (สำเร็จ) และ admin ปกติ (ถูกปฏิเสธด้วย
  `P0001` ตามที่ออกแบบ) ยืนยันว่า path ที่แอปใช้จริงทำงานถูกต้อง ไม่ใช่แค่ทดสอบ
  ผ่าน superuser session ใน psql

> ดูรายละเอียดเพิ่มเติมที่ [`docs/superadmin-guide.md`](docs/superadmin-guide.md)

### ช่วงที่ 13 — หน้าอ่านออนไลน์แบบ Flipbook (เปิดสมุดเสมือนจริง)

- **`FlipbookViewer`** (`components/research/`): แทนที่ตัวอ่าน PDF แบบเดิมที่ใช้
  `<iframe>` ธรรมดา (จากช่วงที่ 3) ด้วยหน้าเปิดสมุดเสมือนจริงแบบพลิกหน้าได้จริง
  — render แต่ละหน้าเป็นภาพจริงด้วย [react-pdf](https://github.com/wojtekmaj/react-pdf)
  (ครอบ pdfjs-dist) แล้วส่งให้ [react-pageflip](https://github.com/Nodlik/react-pageflip)
  จัดการ animation การพลิกหน้า มีปุ่มก่อนหน้า/ถัดไป เลื่อนด้วยลูกศรคีย์บอร์ดได้
  แสดงเลขหน้าปัจจุบัน พร้อมปุ่ม "เปิดในแท็บใหม่"/ดาวน์โหลดเดิมครบ
- **Windowed rendering**: render เนื้อหาจริงเฉพาะหน้าที่อยู่ในช่วง ±2 จากหน้า
  ปัจจุบัน (`RENDER_WINDOW`) หน้านอกช่วงแสดงกรอบเปล่าไปก่อน เพื่อไม่ให้ต้อง
  render ทุกหน้าพร้อมกันตอนเปิดเอกสารยาวๆ (ทดสอบจริงกับไฟล์ 19 หน้า)
- **`FlipbookViewerLoader`** (`components/research/`): โหลด `FlipbookViewer`
  ผ่าน `next/dynamic(..., { ssr: false })` — เพราะ pdfjs-dist/react-pageflip
  อ้างอิง API ของเบราว์เซอร์โดยตรง หากปล่อยให้ Next.js server-render component
  นี้ในรอบแรก (ซึ่งเกิดขึ้นแม้เป็น `"use client"` ก็ตาม) จะพังตอน SSR
- **`scripts/copy-pdf-worker.js`** + `postinstall` script: คัดลอก
  `pdf.worker.min.mjs` จาก `pdfjs-dist` ไปไว้ที่ `public/` อัตโนมัติทุกครั้งหลัง
  `npm install` เพื่อเสิร์ฟเป็น static asset ของเว็บเราเอง แทนการพึ่ง CDN
  ภายนอกสำหรับฟีเจอร์หลักของเว็บ (ไม่ commit เข้า Git)

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 13)

- **ใช้ `react-pdf@9.2.1` (พึ่ง `pdfjs-dist@4.8.69`) ไม่ใช่เวอร์ชันล่าสุด
  (`react-pdf@10.x` / `pdfjs-dist@5.x`)** — ทดสอบจริงด้วย headless browser
  (Playwright ติดตั้งชั่วคราวเพื่อ debug แล้วถอดออก) พบว่า `pdfjs-dist@5.4.296`
  มีปัญหา ESM/webpack interop จริงกับ Next.js 15.5.x ทำให้เกิด
  `TypeError: Object.defineProperty called on non-object` ตอนโหลดโมดูลใน
  เบราว์เซอร์ ไม่ว่าจะ import ผ่านทางไหนก็ตาม (แม้แต่โค้ดภายในของ react-pdf
  เองก็พังจุดเดียวกัน) การลดเวอร์ชันแก้ปัญหาได้สมบูรณ์โดยไม่ต้องแก้ config
  ใดๆ เพิ่ม (เคยลองทั้ง `transpilePackages` และ webpack alias `canvas: false`
  แต่พิสูจน์แล้วว่าไม่ใช่สาเหตุจริง จึงไม่ได้เก็บไว้ใน `next.config.ts`)
- **`size="fixed"` + `autoSize={false}` บน `HTMLFlipBook`** ไม่ใช่
  `size="stretch"` + `autoSize` (ค่าเริ่มต้นที่ลองก่อน) — ทั้งสองค่าขัดแย้งกันเอง
  โดยตรง (`stretch` ให้หนังสือปรับขนาดตาม parent, `autoSize` ให้ parent ปรับขนาด
  ตามหนังสือ) ทำให้ขนาดจริงของหน้าหนังสือไม่ตรงกับ `pageWidth` ที่สั่งให้
  react-pdf render ภาพ PDF ทำให้เนื้อหาถูกตัดขอบ (clip) ดูผิดเพี้ยน แก้โดยให้
  โค้ดของเราเองควบคุมขนาดทั้งหมดผ่าน resize listener แล้วส่งค่าคงที่ให้ทั้งสอง
  ฝั่งตรงกันเสมอ
- **ทดสอบด้วยไฟล์ PDF จริงที่อัปโหลดผ่าน Supabase Storage จริง** (ไม่ใช่แค่ mock)
  ทั้งใน `next dev` และ production build (`next build && next start`) ยืนยัน
  ด้วยภาพหน้าจอจริงจาก headless browser ว่าอ่านได้ครบทุกหน้า พลิกหน้าได้ถูกต้อง
  ทั้งจอกว้าง (desktop) และจอแคบ (มือถือ)

### ช่วงที่ 14 — ความปลอดภัยไฟล์อัปโหลด (Magic-byte + สแกนมัลแวร์)

- **`lib/security/file-signature.server.ts`**: ตรวจเนื้อไฟล์จริง (magic bytes)
  ของไฟล์ที่อัปโหลดทุกไฟล์ (PDF/ภาพปก/เอกสารแนบ) เทียบกับ MIME type ที่ประกาศ
  และรายการที่อนุญาตของฟิลด์นั้น — ไม่ตรงข้อใดข้อหนึ่งถือว่าไม่ผ่าน
- **`lib/security/malware-scanner.server.ts`**: abstraction เชื่อมต่อบริการสแกน
  มัลแวร์ผ่าน Environment Variables รองรับ ClamAV (เขียน client เชื่อม clamd
  ด้วยโปรโตคอล INSTREAM ผ่าน Node `net` โดยตรง ไม่มี dependency เพิ่ม) และ
  บริการ HTTP ภายนอกใดๆ ที่ตรงสัญญา (contract) ที่กำหนด มีโหมดจำลอง (mock)
  สำหรับ dev เมื่อไม่ได้ตั้งค่า provider จริง (คำเตือนชัดเจนใน log เสมอ)
- **`lib/security/validate-upload.server.ts`**: จุดเรียกใช้งานหลัก — ดาวน์โหลด
  ไฟล์ที่เพิ่งอัปโหลดกลับมาด้วย Service Role ตรวจ magic-byte แล้วส่งสแกน
  มัลแวร์ ก่อน insert/update แถว `research_items` ทุกครั้ง (ทั้ง 4 จุดที่รับไฟล์:
  ส่งงานวิจัยใหม่, แก้ไขงานวิจัยของตัวเอง, Librarian/Admin เพิ่ม/แก้ไขงานวิจัย
  โดยตรง) — ไฟล์ที่ไม่ผ่านจะถูกลบออกจาก Storage ทันทีและไม่มีแถวถูกสร้าง/แก้ไข
- **คอลัมน์ใหม่ใน `research_items`**: `scan_status`/`scanned_at`/
  `scan_provider`/`scan_reason` บันทึกผลตรวจสอบทุกครั้ง แถวเดิมก่อนมีฟีเจอร์นี้
  ถูก backfill เป็น `skipped`/`legacy-pre-scan` อัตโนมัติ (ไม่กระทบการอ่าน/
  ดาวน์โหลด/สถานะเผยแพร่เดิม)
- **Trigger `prevent_publish_unscanned_file()`** (ใหม่): ด่านสำรองระดับฐานข้อมูล
  กันเผยแพร่เอกสารที่ `scan_status` เป็น `infected`/`error`
- **แสดงผลตรวจสอบไฟล์ในหน้าจัดการภายใน** (`SubmissionDetailView`) — Librarian/
  ผู้ส่งเห็นสถานะการตรวจสอบไฟล์ของตนเอง/ที่กำลังตรวจสอบ

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 14)

- **ตรวจสอบแบบ synchronous ก่อน insert/update แถวเสมอ ไม่ใช่ background job** —
  เนื่องจากโปรเจกต์นี้ไม่มีโครงสร้าง job queue อยู่แล้ว การเพิ่ม queue ใหม่ทั้ง
  ระบบเพื่อฟีเจอร์นี้ถือว่าเกินความจำเป็น (over-engineering) การตรวจสอบทันทีใน
  คำขอเดียวกันยังให้ผลลัพธ์ที่ถูกต้องตามที่โจทย์กำหนดทุกประการ (ปฏิเสธไฟล์ก่อน
  มีแถวเกิดขึ้น ไม่ต้องมีสถานะ "รอผลสแกน" ค้างในสภาวะปกติเลย)
- **ใช้ Service Role ดาวน์โหลดไฟล์กลับมาตรวจ** แทนการอาศัย session ของผู้ใช้ —
  สอดคล้องกับรูปแบบเดิมที่ใช้อยู่แล้วสำหรับ Signed URL (`lib/supabase/service.ts`)
  และไม่ขึ้นกับ Storage RLS ที่อาจเปลี่ยนแปลงในอนาคต
- **เขียน ClamAV client เองด้วย Node `net` แทนการติดตั้ง library สำเร็จรูป** —
  โปรโตคอล INSTREAM ไม่ซับซ้อน (ส่ง chunk คั่นความยาว 4 byte ปิดท้ายด้วย
  zero-chunk) การเขียนเองหลีกเลี่ยง dependency เพิ่มโดยไม่จำเป็น
- **ทดสอบด้วยไฟล์จริงผ่าน Storage จริง** ทั้งกรณีไฟล์ถูกต้องและไฟล์ปลอม (เปลี่ยน
  นามสกุลไฟล์ข้อความธรรมดาเป็น `.pdf`) ยืนยันว่าไฟล์ปลอมถูกลบออกจาก Storage
  จริงและไม่มีแถวถูกสร้าง ทดสอบโปรโตคอล ClamAV/HTTP ทั้งสองแบบ (clean/infected)
  ด้วยเซิร์ฟเวอร์จำลองจริงในเครื่อง (ไม่ใช่ mock ระดับฟังก์ชัน)

### ช่วงที่ 15 — Super Admin รีเซ็ต MFA ของผู้ใช้ที่ทำอุปกรณ์หาย

- **`/superadmin/users/[id]`**: หัวข้อใหม่ "ยืนยันตัวตนสองขั้นตอน (MFA)" แสดง
  สถานะอุปกรณ์ MFA ของผู้ใช้ (ยืนยันแล้ว/ยังไม่ยืนยัน — ไม่แสดง secret/QR/
  recovery code เนื่องจาก Admin API เองก็ไม่คืนข้อมูลเหล่านี้กลับมาอยู่แล้ว)
  พร้อมปุ่ม "รีเซ็ต MFA" (ซ่อนเมื่อดูโปรไฟล์ตัวเอง)
- **Dialog ยืนยัน 2 ขั้นแยกจากกันจริง**: ขั้น 1 พิมพ์อีเมลผู้ใช้เป้าหมายให้ตรง
  เพื่อยืนยันตัวตน ขั้น 2 กรอกเหตุผล (บังคับ) + พิมพ์ `RESET MFA` ให้ตรงกัน
  ทุกตัวอักษร — เข้มกว่า dialog ยืนยัน grant/revoke Super Admin เดิม (ซึ่งรวม
  ทุกอย่างในฟอร์มเดียว) เพราะเป็นการกระทำที่ย้อนกลับไม่ได้และกระทบบัญชีคนอื่น
  โดยตรง
- **`lib/security/mfa-admin.server.ts`**: ใช้ [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-mfa-deletefactor)
  จริง (`supabase.auth.admin.mfa.listFactors`/`deleteFactor`) ผ่าน Service
  Role — ไม่ใช่รัน SQL ลบ `auth.mfa_factors` ตรงๆ อีกต่อไป (แต่ยังใช้วิธี SQL
  เดิมได้เช่นกันหากจำเป็น — ดู `docs/superadmin-guide.md` หัวข้อ 14)
- **หลังรีเซ็ตสำเร็จ**: บันทึก `audit_logs` (`action: "mfa_reset"`) ส่ง in-app
  notification และอีเมล (ถ้าเปิดใช้งาน) แจ้งเจ้าของบัญชี — ผู้ใช้กลับไปอยู่ที่
  สถานะ "ยังไม่ได้ตั้งค่า MFA" ทันที และหากอุปกรณ์เดิมเคยยืนยันแล้วจะถูกออกจาก
  ระบบทันทีในทุกเซสชัน (พฤติกรรมของ Supabase Auth Admin API เอง)

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 15)

- **Super Admin ห้ามรีเซ็ต MFA ของตัวเอง** — ปุ่มซ่อนที่ UI และ Server Action
  ปฏิเสธซ้ำอีกชั้นหาก `userId` เป้าหมายตรงกับผู้เรียก (ทดสอบแล้วจริงด้วยการ
  เรียก Server Action ตรง ไม่ผ่าน UI)
- **แก้ปัญหา `service_role` insert `notifications` ไม่ได้** (migration
  `20260806100000_mfa_reset.sql`) — พบระหว่างทดสอบจริงว่า `service_role` มี
  `BYPASSRLS` แต่ยังต้องมี table-level `GRANT` ตามปกติของ Postgres (ไม่เคย
  grant insert ให้ role ไหนมาก่อน เดิม insert ได้เฉพาะผ่าน trigger security
  definer) จึงต้องเพิ่ม `grant insert on public.notifications to service_role`
- **ทดสอบด่านสิทธิ์ทั้งหมดแบบ black-box จริง** ผ่าน session จริงของบัญชีระดับ
  ต่างๆ (เรียก Server Action ตรงด้วยคุกกี้ของ browser จริง ไม่ใช่แค่ตรวจโค้ด
  ด้วยตา): self-reset ถูกปฏิเสธ, บัญชีที่ไม่ใช่ Super Admin เรียกไม่ได้,
  ข้อความยืนยันผิด/ไม่มีเหตุผลถูกปฏิเสธ, และ flow ที่ถูกต้องลบ factor จริงใน
  `auth.mfa_factors` พร้อมบันทึก audit log และสร้าง notification จริง

### ช่วงที่ 16 — บังคับ MFA สำหรับบัญชี Super Admin

ปิดรายการค้างข้อแรกจาก Phase 15 backlog — Super Admin ที่ยังไม่มี MFA ที่
verified แล้วเข้า `/superadmin` ไม่ได้เลย (เดิมเป็นแค่คำแนะนำ) ส่วนบทบาทอื่น
(Member/Staff/Librarian/Admin) ไม่ได้รับผลกระทบ — MFA ยังเป็นทางเลือกเหมือนเดิม
ทุกประการ (ดูรายละเอียดเต็มที่ `docs/superadmin-guide.md` หัวข้อ 14)

- **`/setup-mfa`** (ใหม่): หน้าบังคับตั้งค่า TOTP — enroll + สแกน QR + ยืนยัน
  รหัส 6 หลัก จัดการ factor ที่ค้างจากการตั้งค่าครั้งก่อนที่ทำไม่เสร็จอย่าง
  ปลอดภัย (unenroll อัตโนมัติก่อนเริ่มรอบใหม่) เสร็จแล้วพากลับไปหน้าที่ตั้งใจ
  จะเข้าโดยอัตโนมัติ
- **`lib/supabase/middleware.ts`**: ใช้ `getAuthenticatorAssuranceLevel()`
  ค่าเดียวแยก 2 กรณี — ไม่มี verified factor เลย (`nextLevel === "aal1"`) →
  เด้งไป `/setup-mfa`, มี factor แต่เซสชันนี้ยังไม่ยืนยันขั้นที่สอง → เด้งไป
  `/mfa-challenge` เหมือนเดิม
- **`app/superadmin/layout.tsx`**: ตรวจ `hasVerifiedMfa` ซ้ำอีกชั้น (defense
  in depth) — ลบแบนเนอร์เตือนแบบเดิมออกเนื่องจากกลายเป็น code ที่ไปไม่ถึงแล้ว
- **`requireMinRank()`** (`lib/data/admin-guard.server.ts`): เมื่อเรียกด้วย
  `minRank >= 50` (ทุก Server Action ใน `app/superadmin/*`) ตรวจ `aal2` ซ้ำอีก
  ชั้นก่อนดำเนินการเสมอ — ป้องกันการเรียก Server Action ตรงโดยไม่ผ่านการนำทาง
  หน้าปกติ
- **`/setup-mfa`, `/mfa-challenge`, `/login`**: ยกเว้นจากด่านบังคับ MFA เสมอ —
  แก้ปัญหา "ล็อกตัวเองออกจากระบบ" (chicken-and-egg lockout) ด้วยการเว้นเฉพาะ
  หน้าตั้งค่าเองออกจากด่านตรวจสอบ แทนที่จะไม่บังคับ MFA เลยแบบเดิม

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 16)

- **บังคับเฉพาะ Super Admin เท่านั้น** — ตามที่โจทย์กำหนด ไม่แตะโครงสร้างของ
  บทบาทอื่นเลย (`requireMinRank()` เดิมสำหรับ rank < 50 ไม่มีการเปลี่ยนแปลง)
- **ทดสอบด้วย TOTP code ที่คำนวณจริงจาก secret ผ่าน browser จริง** (ไม่ใช่แค่
  mock หรืออ่านโค้ด) — เขียนตัวคำนวณ RFC 6238 ชั่วคราวสำหรับทดสอบ ยืนยันครบ
  ทุกสถานการณ์: บล็อกเมื่อไม่มี MFA, ตั้งค่าสำเร็จแล้วเข้าได้จริง, step-up ตาม
  ปกติสำหรับเซสชันใหม่, Server Action ถูกบล็อกที่ `aal1` และผ่านที่ `aal2`,
  และเซสชันที่เคยเป็น `aal2` มาก่อนถูกเด้งกลับ `/setup-mfa` ทันทีหลังถูกรีเซ็ต
  MFA (ไม่มีช่องให้เห็นข้อมูล dashboard หลุดออกมาแม้แต่ครั้งเดียว)
- **ไม่ต้องตั้งค่า Environment Variable ใหม่ใดๆ** — ใช้ความสามารถ MFA ของ
  Supabase Auth ที่มีอยู่แล้วทั้งหมด (ต้องเปิด TOTP MFA ที่ Supabase Dashboard/
  `config.toml` ตามเดิมเท่านั้น — ดูหัวข้อ "สิ่งที่ต้องเปิดใช้งานฝั่ง Supabase
  ก่อนเสมอ" ใน `docs/superadmin-guide.md`)

### ช่วงที่ 17 — ค้นหาข้อความภายในไฟล์ PDF (PDF Full-Text Search)

เพิ่มระบบค้นหาคำที่อยู่ *ภายในเนื้อหา* ไฟล์ PDF ของงานวิจัย ต่อยอดจากระบบค้นหา
บรรณานุกรมเดิม (ชื่อเรื่อง/ผู้วิจัย/คำสำคัญ/บทคัดย่อ) ที่ยังคงทำงานเหมือนเดิมทุก
ประการ — รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/pdf-full-text-search.md`

- **`research_document_texts`** (ตารางใหม่ แยกจาก `research_items`):
  `extracted_text`/`extracted_text_normalized`, `extraction_status` (`pending`/
  `processing`/`completed`/`no_text_found`/`failed`), `extraction_error_message`,
  `source_file_path`/`source_file_hash` (กันใช้ข้อความจากไฟล์คนละเวอร์ชัน) —
  RLS สะท้อนสิทธิ์ของ `research_items` แถวเดียวกันทุกประการ (metadata_only ไม่
  มีใครเห็นข้อความเลย, member_only/staff_only เห็นได้เฉพาะบทบาทที่ผ่านเกณฑ์)
- **ดึงข้อความด้วย `pdfjs-dist`** (มี dependency อยู่แล้วจากช่วงที่ 13 ไม่เพิ่ม
  library ใหม่) — ใช้ `pg_trgm` (ไม่ใช่ PostgreSQL FTS มาตรฐาน) เพราะ FTS ไม่มี
  dictionary ภาษาไทย ทำงานผ่าน `ILIKE` + GIN index บนคอลัมน์ normalized แทน
- **`processResearchDocumentExtraction()`**: ล็อกแบบ atomic กันประมวลผลไฟล์
  เดียวกันซ้ำซ้อน (`acquire_extraction_lock()`), ไม่เคย throw ออกไปหา caller —
  อัปโหลด/เผยแพร่ PDF ไม่มีวันล้มเหลวเพราะดึงข้อความไม่สำเร็จ, ข้อความเดิมไม่ถูก
  ลบทิ้งหากประมวลผลรอบใหม่ล้มเหลว
- **หน้าค้นหา (`/research`)**: เพิ่มตัวเลือกโหมด "ทั้งหมด/ข้อมูลบรรณานุกรม/
  เนื้อหา PDF" — ผลลัพธ์จาก PDF แสดง snippet พร้อมไฮไลต์คำที่ตรง (ตัด/ไฮไลต์
  ด้วยตำแหน่งดิบ ไม่ใช้ `dangerouslySetInnerHTML`) จัดลำดับ: ชื่อเรื่อง >
  ผู้วิจัย/คำสำคัญ > บทคัดย่อ > เนื้อหา PDF แล้วตามด้วยปีเผยแพร่ — ทั้งหมดค้นหา
  ฝั่งเซิร์ฟเวอร์เท่านั้น (`app/research/page.tsx` เปลี่ยนเป็น Server Component
  อ่าน `searchParams` โดยตรง แทนการ fetch-all-then-filter ฝั่ง Client แบบเดิม)
- **หน้าอ่าน PDF (`/research/[slug]/read`)**: แจ้งสถานะว่าค้นหาเนื้อหาได้หรือไม่
  (`completed`) หรือเป็นไฟล์สแกน/ไม่มีข้อความ (`no_text_found`) — ไม่มีข้อความ
  ใดสัญญาว่าจะมี OCR ในอนาคต
- **หน้าจัดการ (`/dashboard/research/[id]/edit`)**: การ์ดสถานะการดึงข้อความ +
  ปุ่ม "ประมวลผลข้อความใหม่" (Librarian/Admin/Super Admin เท่านั้น) — ทุกครั้ง
  ที่กดบันทึกลง Audit Log (`action: "research_text_reprocess"`)

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 17)

- **`ResearchItem.id` คือ slug ไม่ใช่ uuid จริง** (ธรรมเนียมเดิมของโปรเจกต์ เพื่อ
  URL ที่เป็นมิตรกับ SEO) แต่ `research_document_texts.research_item_id` เป็น
  uuid จริงเสมอ — พบบั๊กจากจุดนี้ 3 จุดระหว่างพัฒนา (การจับคู่ผลค้นหา PDF กับ
  `ResearchItem`, การจัดลำดับ/กรองผลลัพธ์, และหน้าอ่าน PDF ที่เรียกสถานะการดึง
  ข้อความ) แก้ด้วยการผูก uuid จริงไว้คู่กับทุก object ที่ส่งผ่านฟังก์ชันภายใน
  แทนการใช้ `item.id` เทียบกับ `research_item_id` ตรงๆ, และแยกฟังก์ชันอ่านสถานะ
  เป็น 2 ตัวชัดเจนตามชนิด id ที่รับ (`getExtractionStatus` รับ uuid สำหรับหน้า
  จัดการ, `getExtractionStatusBySlug` รับ slug สำหรับหน้าสาธารณะ)
- **ทดสอบด้วยไฟล์ PDF จริงหลายภาษา** ไม่ใช่แค่ placeholder — ยืนยันดึงข้อความ
  ภาษาลาว/ไทย/อังกฤษถูกต้องจากไฟล์จริง 19 หน้าที่เคยอัปโหลดไว้ในช่วงที่ 13,
  ทดสอบ RLS จริงด้วยการจำลอง role `anon`/`authenticated` ผ่าน `psql` โดยตรง
  (ไม่ใช่แค่อ่านโค้ดด้วยตา) ยืนยันว่า guest มองไม่เห็นเนื้อหาของงาน
  `member_only` แต่บัญชีระดับ member เห็นได้ปกติ
- **ทดสอบ retry-after-failed จริง**: จำลองไฟล์ดาวน์โหลดไม่ได้ → สถานะ `failed`
  พร้อมข้อความสุภาพ ข้อความเดิมยังอยู่ครบ → กดประมวลผลใหม่ด้วยไฟล์จริง →
  กลับเป็น `completed`, error ถูกล้าง, `source_file_hash`/`source_file_path`
  อัปเดตเป็นของไฟล์ใหม่ทั้งหมด
- **ไม่มีโครงสร้าง job queue ในโปรเจกต์นี้** จึงยังรันแบบ synchronous ในคำขอ
  อัปโหลดเดียวกัน (เหมือนการตรวจ magic-byte/สแกนมัลแวร์เดิม) แต่ออกแบบ
  `processResearchDocumentExtraction(researchItemId, pdfPath)` เป็นฟังก์ชัน
  อิสระโดยเจตนา เพื่อย้ายไปเรียกผ่าน queue/background worker ได้ในอนาคตโดยไม่
  ต้องแก้ signature — ดู `docs/pdf-full-text-search.md` หัวข้อ 8

### ช่วงที่ 18 — ขอสิทธิ์เข้าถึงเอกสาร และแจ้งงานวิจัยใหม่ตามหมวดหมู่

เพิ่มระบบให้ผู้ใช้ที่ไม่มีสิทธิ์อ่าน/ดาวน์โหลดเอกสารส่งคำขอไปยังเจ้าหน้าที่ได้
แทนการเข้าถึงไม่ได้เลย และระบบติดตามหมวดหมู่เพื่อรับแจ้งเตือนงานวิจัยใหม่ —
รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/document-access-requests.md`

- **4 ตารางใหม่**: `access_requests` (คำขอ, 7 สถานะ), `document_access_grants`
  (สิทธิ์ที่อนุมัติแล้วจริง — ถาวรหรือมีวันหมดอายุ), `notification_preferences`
  (4 สวิตช์ต่อผู้ใช้: in-app/email × งานวิจัยใหม่/คำขอเข้าถึง),
  `category_subscriptions` (หมวดหมู่ที่ติดตาม)
- **`document_access_grants` เป็น "ชั้นสิทธิ์เสริม" ที่ OR เข้ากับ
  `access_level` เดิมเท่านั้น ไม่เคยแทนที่หรือเปลี่ยน access_level หลักของ
  เอกสาร** — `getResearchReadUrl`/`getResearchDownloadUrl` เดิม (Phase 3)
  เพิ่มพารามิเตอร์ `hasReadGrant`/`hasDownloadGrant` (ค่าเริ่มต้น `false`) โดย
  ไม่แก้ไข logic เดิมแม้แต่บรรทัดเดียว
- **หน้ารายละเอียดงานวิจัย**: แสดงปุ่ม "ขอสิทธิ์อ่าน/ดาวน์โหลด" เฉพาะเมื่อยัง
  ไม่มีสิทธิ์นั้นจริง (Guest เห็นปุ่มพาไป login ก่อน) กรอกวัตถุประสงค์ (บังคับ)
  + เงื่อนไขการใช้งาน กันคำขอซ้ำด้วย unique index ระดับฐานข้อมูล
- **`/access-requests`**: รายการคำขอของสมาชิกเอง กรองตามสถานะ ยกเลิกได้เฉพาะ
  ตอน pending
- **`/dashboard/access-requests`**: รายการ+รายละเอียดคำขอฝั่งเจ้าหน้าที่ (rank
  ≥ 30) อนุมัติ (กำหนดวันหมดอายุหรือถาวร)/ปฏิเสธ (บังคับเหตุผล)/ขอข้อมูลเพิ่ม
  (บังคับรายละเอียด)/เพิกถอนสิทธิ์ที่เคยอนุมัติ (บังคับเหตุผล) ทุกการกระทำ
  บันทึก Audit Log
- **`/profile/notification-settings`**: เลือกหมวดหมู่ที่ติดตาม + เปิด/ปิด
  ช่องทางแจ้งเตือน — **`/notifications`** หน้าแสดงการแจ้งเตือนทั้งหมด (ต่อยอด
  จาก NotificationBell เดิมที่ปรับลิงก์ "ดูทั้งหมด" มาที่นี่)
- **แจ้งเตือนผู้ติดตามหมวดหมู่เมื่อเผยแพร่งานวิจัยใหม่**: in-app ผ่าน
  trigger เดิม (`log_research_status_change`, Phase 3) ที่ขยายเพิ่ม branch
  ใหม่ ไม่สร้าง trigger แยก — email ส่งจาก Server Action โดยตรง (trigger
  เรียก HTTP ไม่ได้) กันแจ้งซ้ำเมื่อเอกสารอยู่หลายหมวดหมู่

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 18)

- **RLS การมองเห็นแถวของ `research_items` ไม่ถูกแก้ไขเลยแม้แต่จุดเดียว** —
  `member_only`/`staff_only` ยังคงมองไม่เห็นทั้งแถวสำหรับผู้ใช้ rank ไม่ถึง
  เหมือนเดิมทุกประการ (ถ้าเห็นแถวได้ก็มีสิทธิ์เต็มอยู่แล้วผ่าน
  `canReadOnline`/`canDownload` ที่ไม่เช็ค rank) ระบบคำขอสิทธิ์จึงมีผลจริงกับ
  `read_only`/`metadata_only` เป็นหลัก ซึ่งเป็นระดับที่ทุกคนเห็นแถวได้แต่ถูก
  จำกัดเนื้อหาแบบเดียวกันโดยไม่สนใจ rank — ตรงกับโจทย์ "ขอสิทธิ์รายบุคคล" พอดี
  โดยไม่ต้องแตะระบบสิทธิ์เดิมเลย
- **พบและแก้ RLS gap ระหว่างพัฒนา**: กลไก "lazy expire" (เปลี่ยนคำขอที่
  `approved` แต่หมดอายุแล้วเป็น `expired` — ไม่มี job queue/cron ในโปรเจกต์นี้
  จึงเช็คแบบ lazy ทุกครั้งที่เปิดหน้ารายการคำขอ) ใช้ไม่ได้เมื่อ "สมาชิกทั่วไป"
  เป็นคนเปิดหน้าเอง เพราะ RLS เดิมอนุญาตให้เจ้าของคำขอ self-update ได้แค่
  pending→cancelled เท่านั้น ต้องเพิ่มนโยบายใหม่ `access_requests_self_expire`
  ที่อนุญาตเฉพาะ approved→expired และเฉพาะกรณีหมดอายุจริงตามเวลาเท่านั้น —
  ทดสอบยืนยันแล้วว่าใช้งานได้ทั้งฝั่งเจ้าหน้าที่ (rank ≥ 30 ผ่านนโยบายเดิมอยู่
  แล้ว) และฝั่งสมาชิกเอง (ผ่านนโยบายใหม่)
- **ทดสอบด้วย session จริงของบัญชีหลายระดับผ่าน HTTP จริง** (ไม่ใช่แค่อ่าน
  โค้ด) ครบทุกสถานการณ์หลัก: Guest ถูกพาไป login, Member ส่งคำขอได้/ยกเลิกได้
  เฉพาะของตัวเอง, สมาชิกคนอื่นมองไม่เห็นคำขอของผู้อื่น (ยืนยันซ้ำผ่าน RLS
  simulation ด้วย `psql`), Librarian อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม/เพิกถอนได้
  จริงพร้อม Audit Log ครบ, อนุมัติ "อ่าน" ไม่ให้สิทธิ์ "ดาวน์โหลด" โดยอัตโนมัติ,
  สิทธิ์ที่หมดอายุ/ถูกเพิกถอนแล้วสร้าง Signed URL ใหม่ไม่ได้ทันที, การแจ้งเตือน
  ผู้ติดตามหมวดหมู่ทำงานถูกต้องทั้ง in-app และอีเมล (เมื่อเปิดใช้งาน)
- **ไม่ใช้ Service Role ที่ไหนในฟีเจอร์นี้เลย** — ทุก query/mutation ทำผ่าน
  client ของผู้ใช้เองเสมอ (RLS บังคับสิทธิ์จริง) ต่างจาก Phase 17 ที่ต้องใช้
  Service Role สำหรับดาวน์โหลดไฟล์มาประมวลผล เนื่องจากฟีเจอร์นี้ไม่มีขั้นตอน
  ใดที่ต้องข้าม RLS เลย

### ช่วงที่ 19 — คุณภาพข้อมูลและข้อมูลมาตรฐาน (Data Quality / Authority Control)

เพิ่มระบบผู้วิจัย/หน่วยงานมาตรฐาน รองรับ ORCID และตรวจจับงานวิจัยที่อาจซ้ำ
พร้อมกลไก "รวมข้อมูล" (merge) ที่ปลอดภัยสำหรับผู้วิจัย หน่วยงาน และงานวิจัย —
รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/data-quality.md` และ
`docs/orcid-integration.md`

- **ผู้วิจัยมาตรฐาน (`authors`)**: เพิ่ม `display_name_en`,
  `normalized_name_th/en` (auto-maintain ผ่าน trigger), `title_prefix_th/en`,
  `orcid` + `orcid_verified_at`, `biography`, `is_active`,
  `merged_into_author_id` — คอลัมน์ `name` เดิมยังทำหน้าที่ "ชื่อแสดงผลไทย"
  เหมือนเดิมทุกประการ (ไม่เพิ่ม `display_name_th` ซ้ำซ้อน)
- **หน่วยงานมาตรฐาน (`organizations`)**: เพิ่มโครงสร้างหลัก/ย่อยด้วย
  `parent_id` (ใช้ชื่อเดียวกับ `categories.parent_id` เดิม) พร้อม trigger กัน
  cycle แบบเดียวกับ categories ทุกประการ, `organization_code`, `website_url`,
  `merged_into_organization_id`
- **ORCID**: ตรวจรูปแบบ + checksum (ISO 7064 MOD 11-2) ฝั่งแอปพลิเคชันก่อน
  บันทึกเสมอ, กันซ้ำในฐานข้อมูล (ยกเว้นแถวที่ถูกรวมแล้ว), แสดงลิงก์ไป
  orcid.org, เจ้าหน้าที่ยืนยันด้วยตนเองได้ (`orcid_verified_at`) — **ยังไม่ได้
  เชื่อม ORCID API/OAuth จริง** (ดูแนวทางในอนาคตที่ `docs/orcid-integration.md`)
- **ตรวจสอบงานวิจัยซ้ำ**: `find_similar_research_items()` (SQL, ใช้
  `pg_trgm` เทียบชื่อเรื่อง + ISBN/DOI/PDF hash ตรงกัน + ผู้วิจัยหลักคนเดียวกัน)
  คำนวณคะแนน+เหตุผลฝั่งแอปพลิเคชัน บันทึกลง `duplicate_research_reviews` —
  ทำงานอัตโนมัติหลังส่ง/แก้ไขงานวิจัย (เฉพาะตอนชื่อเรื่อง/ปีเปลี่ยน) **ไม่เคย
  บล็อกการบันทึก** เป็นแค่คำเตือนให้เจ้าหน้าที่ตรวจสอบที่
  `/dashboard/duplicate-reviews`
- **`/dashboard/authors`, `/dashboard/authors/[id]`**: ค้นหา/เพิ่ม/แก้ไข/
  ปิดใช้งานผู้วิจัย พร้อมคำเตือนชื่อซ้ำ (rank ≥ 30) และรวมผู้วิจัย (ยืนยันด้วย
  การพิมพ์ชื่อให้ตรง)
- **`/dashboard/organizations`**: ขยายเดิมด้วยโครงสร้างหลัก/ย่อย, คำเตือนชื่อ
  ซ้ำ, และรวมหน่วยงาน
- **`/dashboard/data-quality`**: รายงานงานวิจัยที่ไม่มีผู้วิจัย/ไม่มีหน่วยงาน/
  เผยแพร่แล้วแต่ไม่มีวันที่เผยแพร่ และจำนวนผู้วิจัยที่ยังไม่มี ORCID
- **`/dashboard/duplicate-reviews`, `/dashboard/duplicate-reviews/[id]`**:
  รายการคู่งานวิจัยที่อาจซ้ำ พร้อมเปรียบเทียบสองรายการ ยืนยัน/ปฏิเสธว่าซ้ำ
  (rank ≥ 30) และรวมงานวิจัยจริง (rank ≥ 40 เท่านั้น — พิมพ์ `MERGE` เพื่อ
  ยืนยัน) ย้าย favorites/ประวัติการอ่าน/ดาวน์โหลด/คำขอเข้าถึงเอกสาร/สิทธิ์ที่
  อนุมัติแล้ว/ข้อความ PDF ที่ดึงไว้ทั้งหมดอย่างปลอดภัย — URL เดิมของรายการที่
  ถูกรวม redirect ไปยังรายการหลักอัตโนมัติ

### การตัดสินใจด้านเทคนิคที่สำคัญ (ช่วงที่ 19)

- **Merge ทั้งสามแบบ (ผู้วิจัย/หน่วยงาน/งานวิจัย) เป็น PostgreSQL function
  (`security definer`) ไม่ใช่หลายคำสั่ง TypeScript ต่อกัน** — รับประกัน atomic
  transaction จริงเมื่อต้องย้ายความสัมพันธ์หลายตารางพร้อมกัน (โดยเฉพาะการรวม
  งานวิจัยที่กระทบ 8 ตารางที่เกี่ยวข้อง) แต่ละฟังก์ชันตรวจสอบสิทธิ์ rank ซ้ำใน
  ตัวเองเสมอ (ไม่เชื่อว่า Server Action ตรวจแล้วชั้นเดียว) — รวมงานวิจัยต้อง
  rank ≥ 40 (Admin) ส่วนรวมผู้วิจัย/หน่วยงาน rank ≥ 30 (Librarian) พอ เพราะ
  กระทบความสัมพันธ์แคบกว่ามาก
- **พบและแก้ RLS gap ระหว่างพัฒนา 2 จุด**: (1) ลืม grant `insert` ให้
  `authenticated` บน `duplicate_research_reviews` (grant แค่ select/update) —
  การตรวจจับอัตโนมัติหลังส่งงานวิจัยจึงล้มเหลวเงียบๆ จนกว่าจะทดสอบจริงจึงพบ
  (2) นโยบาย update เดิมสงวนไว้ที่ rank ≥ 30 (เจ้าหน้าที่ตัดสินสถานะ) เท่านั้น
  แต่การ upsert อัตโนมัติจากผู้ส่งงานวิจัยเองรันที่ rank ≥ 20 — ต้องเพิ่ม
  นโยบายแยกสำหรับ "ระบบ refresh คะแนนอัตโนมัติ" ที่จำกัดเฉพาะแถวสถานะ
  `pending` เท่านั้น (กันไม่ให้ rank ต่ำกว่าเจ้าหน้าที่ไปทับผลตัดสินที่ยืนยัน
  แล้วโดยไม่ได้ตั้งใจ)
- **`getResearchById` เดิมกรอง `status = 'published'` ไว้ในฟังก์ชันใช้ร่วม
  (`fetchResearchRowBySlug`) จึงไม่เคยคืนค่ารายการที่ `status = 'merged'`
  เลย** — เพิ่มฟังก์ชันแยกต่างหาก `getMergedRedirectSlug()` ที่เรียกเฉพาะตอน
  หารายการปกติไม่เจอเท่านั้น แทนการแก้ไข query หลักที่ใช้ร่วมกันทั่วทั้งระบบ
  (เสี่ยงกระทบหน้าค้นหา/รายการเกี่ยวข้องโดยไม่ได้ตั้งใจ) — ทดสอบยืนยันแล้วว่า
  ทั้งหน้ารายละเอียดและหน้าอ่าน PDF ของรายการที่ถูกรวม redirect ไปยังรายการ
  หลักถูกต้อง
- **ทดสอบด้วย session จริงของบัญชีหลายระดับผ่าน HTTP จริง**: ORCID รูปแบบผิด/
  checksum ไม่ถูกต้อง/ซ้ำถูกปฏิเสธถูกต้องทั้งสามกรณี, รวมผู้วิจัยที่มีความ
  สัมพันธ์ชนกัน (งานวิจัยเดียวกันมีทั้งคู่) ลบรายการซ้ำถูกต้องและย้ายรายการที่
  ไม่ชนกันถูกต้อง, รวมงานวิจัยย้าย favorites (แก้ conflict ถูกต้อง) และ
  ประวัติการอ่านถูกต้องครบ, Librarian ถูกปฏิเสธเมื่อพยายามรวมงานวิจัย (ต้อง
  Admin), โครงสร้างหน่วยงานหลัก/ย่อยกัน cycle ได้จริงทั้ง self-parent และ
  cycle 2 ระดับ

### ช่วงที่ 20 — Background Jobs และการประมวลผลเป็นชุด

ย้ายงานประมวลผลหนัก 4 อย่างที่เคยรัน synchronous ไปเป็น background job ผ่าน
persistent queue ในฐานข้อมูลเดิม (ไม่เพิ่มบริการภายนอก) — รายละเอียดสถาปัตยกรรม
เต็มดูที่ `docs/background-jobs.md`:

- **Job queue** (`background_jobs`): 4 job type (`pdf_text_extraction`,
  `file_security_rescan`, `access_expiration`, `category_notification`) —
  lock/lease ด้วย `FOR UPDATE SKIP LOCKED`, idempotency key กัน job ซ้ำซ้อน,
  retry แบบ exponential backoff จนครบ `max_attempts`
- **สแกนมัลแวร์ไฟล์ PDF หลัก** ย้ายจาก synchronous (ก่อน insert) เป็น async —
  แถวถูกสร้างทันทีด้วย `scan_status = 'pending'` แล้วสแกนทีหลังผ่าน job
  (ภาพปก/เอกสารแนบยังคง synchronous เหมือนเดิม) — trigger ฐานข้อมูลบล็อกการ
  เผยแพร่/ปิดการเข้าถึงอัตโนมัติหากไม่ปลอดภัย (ดู `docs/background-jobs.md`
  หัวข้อ 3)
- **ดึงข้อความ PDF** ย้ายจาก synchronous เป็น async เช่นกัน —
  `processResearchDocumentExtraction()` ของช่วงที่ 17 ไม่ถูกแก้ไขเลยแม้แต่
  บรรทัดเดียว (ถูกเรียกจาก background job ตามที่ออกแบบไว้แต่แรก)
- **`/superadmin/pdf-processing`**: bulk backfill ข้อความ PDF เป็นชุด พร้อม
  ตัวกรอง, ขนาด batch, progress, ปุ่มลองใหม่
- **`/superadmin/file-security`**: bulk rescan ความปลอดภัยไฟล์เดิมเป็นชุด
- **Worker** (`/api/jobs/process`): ป้องกันด้วย `CRON_SECRET`, มี `vercel.json`
  ตั้งค่า Cron ให้แล้ว (ข้อควรระวัง: Vercel Hobby จำกัด Cron แค่วันละครั้ง —
  ดูทางเลือกฟรีอื่นที่ `docs/background-jobs.md` หัวข้อ 6.2)

### ช่วงที่ 21 — หมดอายุสิทธิ์เข้าถึงตรงเวลา และ Publish Event กลาง

ต่อยอด background job ของช่วงที่ 20 — รายละเอียดสถาปัตยกรรมเต็มดูที่
`docs/background-jobs.md` หัวข้อ 9 และ `docs/document-access-requests.md`:

- **หมดอายุสิทธิ์ตรงเวลา**: job `access_expiration` เดิมขยายให้ปิด
  `document_access_grants` ที่หมดอายุแล้วอย่างชัดเจน (`revoked_at`) ไม่ใช่แค่
  `access_requests` เหมือนเดิม พร้อมแจ้งเตือนล่วงหน้า 3 วันก่อนหมดอายุจริง —
  ทุกอย่าง idempotent (รันซ้ำไม่แจ้งซ้ำ) **การตรวจสิทธิ์จริงตอนสร้าง Signed
  URL ยังคงเข้มงวดเท่าเดิมทุกประการ ไม่ได้พึ่งพา job นี้เลย** (ทดสอบยืนยันแล้ว)
- ปุ่ม Super Admin **"ประมวลผลสิทธิ์ที่หมดอายุทันที"** ที่
  `/superadmin/notifications` พร้อมประวัติ job หมดอายุ/แจ้งเตือนล่าสุดและปุ่ม
  ลองใหม่สำหรับ job ที่ล้มเหลวถาวร
- **Publish Event กลาง**: จุดเดียว (`notifyResearchPublished()`) ที่ทุกเส้น
  ทางที่เผยแพร่งานวิจัยได้ (อนุมัติผ่าน workflow, แก้ไขแล้วเปลี่ยนเป็นเผยแพร่,
  เผยแพร่ซ้ำหลังปิดเผยแพร่, สร้างใหม่พร้อมเผยแพร่ทันที) เรียกร่วมกัน — ปิดช่อง
  โหว่เดิมที่การสร้างงานใหม่พร้อมเผยแพร่ทันทีไม่เคยส่งอีเมลแจ้งผู้ติดตาม
  หมวดหมู่เลย จัดการ audit log/in-app/email/กันแจ้งซ้ำให้ครบในจุดเดียว
  (กันแจ้งซ้ำแบบ atomic ที่ระดับฐานข้อมูล ล้างอัตโนมัติเมื่อปิดเผยแพร่แล้ว
  เผยแพร่ใหม่ภายหลัง)

### ช่วงที่ 22 — คุณภาพข้อมูล (bulk scan + เกณฑ์ปรับได้) และ MFA Overview

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/data-quality.md` และ
`docs/superadmin-guide.md` หัวข้อ 17-19:

- **`/superadmin/data-quality`**: ตรวจสอบงานวิจัยซ้ำย้อนหลังทั้งระบบแบบ
  background job (batch, กรองด้วยปี/หมวดหมู่/สถานะ/แก้ไขล่าสุด) — ใช้ job
  queue เดิมของช่วงที่ 20 (job type ใหม่ `duplicate_scan`) **ไม่มีการรวมข้อมูล
  อัตโนมัติเลย** เป็นแค่การตรวจสอบ+บันทึกคู่ที่น่าสงสัยเหมือนเดิมทุกประการ
- **`/superadmin/data-quality/settings`**: Super Admin ปรับน้ำหนักเกณฑ์ตรวจ
  ซ้ำ 5 อย่าง (ชื่อเรื่อง/ผู้วิจัยหลัก/ปี/DOI-ISBN/hash ไฟล์ — ผลรวมต้องเท่ากับ
  100) และ threshold ต่ำ/กลาง/สูง ได้เอง **แบบ versioned** (แก้ไขแต่ละครั้ง
  สร้างเวอร์ชันใหม่เสมอ ไม่ทับของเดิม ตรวจสอบย้อนหลังได้ว่าผลลัพธ์คู่ใดเกิดจาก
  เกณฑ์เวอร์ชันใด) แทนค่าคงที่ตายตัวเดิม มีปุ่มคืนค่าเริ่มต้น
- **`/superadmin/mfa-status`**: ภาพรวมสถานะ MFA ของ Super Admin ทุกคนในหน้า
  เดียว (ตั้งค่าแล้ว/ยังไม่ตั้งค่า/ถูกรีเซ็ตต้องตั้งค่าใหม่) พร้อมคำเตือนชัดเจน
  หากมีบัญชีที่ยังไม่พร้อม — ไม่แสดง recovery code/secret/QR เลย เข้าถึงได้
  เฉพาะ Super Admin เท่านั้น (ไม่ลดการบังคับ MFA เดิมแม้แต่จุดเดียว)

### ช่วงที่ 23 — ORCID OAuth และ OCR สำหรับ PDF เอกสารสแกน (background job)

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/orcid-integration.md` และ
`docs/ocr-operations.md`:

- **ORCID OAuth จริง** (Public API, free tier, scope `/authenticate`
  เท่านั้น): ปุ่ม "เชื่อม ORCID" ที่ `/account` ให้ผู้วิจัยเชื่อมบัญชีด้วยตนเอง
  ผ่าน Authorization Code flow ฝั่งเซิร์ฟเวอร์ล้วน — มี CSRF state แบบใช้ครั้ง
  เดียว (`orcid_oauth_states`, อายุ 10 นาที), เก็บ token แยกตาราง
  (`orcid_oauth_tokens`, service role เท่านั้น ไม่ grant ให้ authenticated),
  สถานะยืนยันใหม่ `orcid_oauth_verified_at` แยกจาก `orcid_verified_at` เดิม
  (เจ้าหน้าที่ยืนยันด้วยตา) อย่างชัดเจน ไม่ปนกัน — ป้องกัน ORCID เดียวผูกซ้ำ
  ด้วย partial unique index เดิมจากช่วงที่ 19 (ไม่ต้องเพิ่ม constraint ใหม่)
- **เชื่อม `profiles` กับ `authors`**: คอลัมน์ `authors.profile_id` (มีอยู่
  ตั้งแต่ช่วงที่ 3 แต่ไม่เคยมี UI/unique constraint) ตอนนี้ใช้งานได้จริงที่
  `/dashboard/authors/[id]` (เจ้าหน้าที่ rank ≥ 30 ผูกบัญชีให้ด้วยอีเมล) — เป็น
  เงื่อนไขที่ต้องมีก่อนผู้ใช้จะเห็นปุ่มเชื่อม ORCID ของตนเองได้
- **OCR สำหรับ PDF ที่เป็นภาพสแกน**: เมื่อดึงข้อความปกติได้ `no_text_found`
  เจ้าหน้าที่ (rank ≥ 30) สั่ง OCR เป็น background job แยกต่างหากได้ (ไม่รันใน
  คำขออัปโหลด) — สถานะ `not_required`/`pending`/`processing`/`completed`/
  `failed` เก็บแยกคอลัมน์จาก `extracted_text` เดิมทั้งหมด (`ocr_text`,
  `ocr_provider`, `ocr_language`, `ocr_confidence`)
- **Provider abstraction แบบ HTTP delegation เท่านั้น** — ไม่ผูกกับ OCR
  library ใดโดยเฉพาะ (ไม่เพิ่ม native/WASM dependency ใหม่) ชี้ไปยังบริการ
  self-hosted หรือภายนอกก็ได้ตามที่องค์กรเลือก **ไม่มีโหมดจำลอง** — ไม่ตั้งค่า
  provider งาน OCR จะ "ล้มเหลว" เสมอพร้อมเหตุผลชัดเจน ไม่เคยสร้างข้อความปลอม
- **`OCR_ALLOW_EXTERNAL_TRANSFER`**: ต้องตั้งเป็น `"true"` อย่างชัดเจนแยกจาก
  การตั้งค่า provider เสมอ ก่อนระบบจะยอมส่งไฟล์เอกสารออกไปยัง OCR provider ผ่าน
  เครือข่าย (แม้เป็น self-hosted ในเครือข่ายเดียวกันก็ยังนับ) — ป้องกันส่ง
  เอกสาร private ออกโดยไม่ได้รับอนุมัติจากองค์กรก่อน
- **ค้นหาข้อความจาก OCR ได้** ผ่านระบบค้นหาเดิมของช่วงที่ 17 (ตรวจสิทธิ์ผ่าน
  RLS เดียวกันกับ PDF ปกติทุกประการ) พร้อมป้าย "จาก OCR อาจคลาดเคลื่อน" ให้
  ผู้ใช้ทราบเสมอว่าข้อความนี้ไม่ใช่ข้อความที่คัดลอกได้จริง
- **`/superadmin/pdf-processing`** เพิ่มแท็บ "OCR เอกสารสแกน" แยกจากแท็บดึง
  ข้อความ PDF เดิม — bulk enqueue/retry รูปแบบเดียวกับของเดิมทุกประการ

### ช่วงที่ 25 — ความเสถียรของ Background Job Queue

ต่อยอด background job ของช่วงที่ 20 — รายละเอียดสถาปัตยกรรมเต็มดูที่
`docs/background-jobs.md` หัวข้อ 11:

- **Dead-letter Queue** ที่หน้าใหม่ `/superadmin/jobs` — รวมงานที่ล้มเหลวถาวร
  ทุกประเภทงานในที่เดียว (ไม่เพิ่มสถานะใหม่ ใช้ `status='failed'` เดิมที่เป็น
  สถานะถาวรอยู่แล้วโดยธรรมชาติ) ลองใหม่/ยกเลิก/ทำเครื่องหมายว่าแก้ไขแล้วได้
  ทุกการดำเนินการบันทึก Audit Log เสมอ ข้อมูลที่แสดงผ่าน allowlist เท่านั้น
  ไม่มี payload ดิบหลุดออกไปที่ UI
- **แจ้งเตือน Super Admin ทันทีที่ job เข้า DLQ** ทั้ง in-app และอีเมล (ถ้าตั้งค่า
  provider ไว้) กันแจ้งซ้ำด้วยคอลัมน์ `dead_letter_notified_at` แบบเดียวกับ
  กลไกกันแจ้งซ้ำของช่วงที่ 21
- **Progress ละเอียดขึ้น**: เพิ่ม `startedAt`/`updatedAt`/เวลาประมาณที่เหลือ
  (ETA) ให้ "ชุดงานล่าสุด" ที่ 3 หน้า bulk เดิม พร้อม poll สถานะอัตโนมัติทุก 5
  วินาที (ผ่าน endpoint ใหม่ คนละตัวกับ worker endpoint) แทนการรีเฟรชทั้งหน้า
- **ประมวลผลเกิน 500 รายการ**: ปุ่มใหม่ "ประมวลผลทั้งหมดตามตัวกรอง" ที่ทั้ง 3
  หน้า bulk เดิม (pdf-processing ทั้ง 2 แท็บ, file-security, data-quality) —
  ทยอยสร้าง job เป็น chunk ผ่าน background job coordinator เอง (ไม่โหลดรายการ
  ทั้งหมดเข้าหน่วยความจำในคำขอเดียว) resume ได้เองถ้า worker หยุดกลางคัน
- **Concurrency ที่ปรับได้ต่อประเภทงาน** (ตั้งค่าที่หน้า `/superadmin/jobs`) —
  worker ประมวลผลหลาย job พร้อมกันได้แล้ว (เดิมทีละ job เรียงกัน) จำกัดจำนวน
  ต่อประเภทแยกกัน (เช่น OCR ต่ำกว่าดึงข้อความ PDF) การป้องกันประมวลผล entity
  เดียวกันซ้ำซ้อนใช้กลไก idempotency key เดิมของช่วงที่ 20 ที่มีอยู่แล้ว ไม่ต้อง
  เพิ่มกลไกใหม่

### ช่วงที่ 26 — ตั้งค่าการแจ้งเตือนสิทธิ์หมดอายุ + สแกนงานวิจัยซ้ำหลังเปลี่ยนเกณฑ์

ต่อยอดช่วงที่ 20/22/25 — รายละเอียดสถาปัตยกรรมเต็มดูที่
`docs/background-jobs.md` หัวข้อ 9.1 และ `docs/data-quality.md` หัวข้อ 4:

- **ตั้งค่าการแจ้งเตือนก่อนสิทธิ์หมดอายุได้แล้ว** ที่ `/superadmin/notifications`
  — จำนวนวันแจ้งเตือนล่วงหน้า (1-30, ค่าเริ่มต้น 3) และเปิด/ปิด in-app/email
  แยกเฉพาะฟีเจอร์นี้ (ทำงานร่วมกับมาสเตอร์สวิตช์รวมเดิม ไม่ใช่แทนที่) — เดิมเป็น
  ค่าคงที่ในโค้ดและไม่มีช่องทางอีเมลเลย ตอนนี้ job อ่านค่าแบบไดนามิกทุกครั้ง
  fallback เป็น 3 วันเสมอถ้าอ่านค่าไม่ได้ กันแจ้งซ้ำด้วยกลไก `expiry_warned_at`
  เดิมที่ครอบคลุมทั้งสองช่องทางในตัว **ไม่กระทบการตรวจสอบ `expires_at` จริง
  ตอนสร้าง Signed URL แม้แต่บรรทัดเดียว** (คนละกลไกกันโดยสิ้นเชิง)
- **สั่งสแกนงานวิจัยซ้ำใหม่ทั้งระบบได้ทันทีหลังเปลี่ยนเกณฑ์** ที่
  `/superadmin/data-quality/settings` — ปุ่ม "บันทึกและสแกนใหม่ทั้งระบบ" (แยก
  จากปุ่ม "บันทึกอย่างเดียว" เดิม) ใช้โครงสร้าง background job แบบ batch เดิม
  จากช่วงที่ 25 ผูกเวอร์ชันเกณฑ์กับ batch ที่สร้าง แสดงเวอร์ชันเกณฑ์ต่อคู่ที่
  ตรวจพบและป้าย "เกณฑ์เก่ากว่าปัจจุบัน" ที่ `/dashboard/duplicate-reviews`
  (คำนวณสดตอน query ไม่ใช่คอลัมน์เก็บไว้ล่วงหน้า) **ไม่ลบผลตรวจเดิม ไม่มีการ
  รวม/แก้ไขงานวิจัยอัตโนมัติเพิ่มเติมจากเดิมแม้แต่จุดเดียว**
- รายงาน "การสแกนซ้ำล่าสุด" ที่หน้า settings — เวอร์ชันเกณฑ์, จำนวนรายการ,
  สถานะ, เวลาเริ่ม/อัปเดตล่าสุด, ปุ่ม "ดูผลลัพธ์" ที่กรองเฉพาะผลจาก batch นั้น

### ช่วงที่ 27 — ORCID Public API แบบอ่านอย่างเดียว + ควบคุมค่าใช้จ่าย/ขนาด OCR

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/orcid-integration.md` หัวข้อ 6 และ
`docs/ocr-operations.md` หัวข้อ 6:

- **ตรวจสอบ ORCID iD กับ ORCID Public API ได้แล้ว** ที่
  `/dashboard/authors/[id]` — เรียก Client Credentials token +
  `GET /v3.0/{orcid}/person` (ใช้ `ORCID_CLIENT_ID`/`ORCID_CLIENT_SECRET`
  ชุดเดียวกับ OAuth เดิม ไม่มีตัวแปรใหม่) แสดงชื่อสาธารณะเป็น **ข้อมูลแนะนำ
  สำหรับเปรียบเทียบเท่านั้น** — เขียนได้แค่คอลัมน์ cache ใหม่
  `orcid_api_checked_at`/`orcid_api_public_name` **ไม่เคยเขียนทับ**
  `name`/`display_name_en`/`organization_id`/`orcid_verified_at`/
  `orcid_oauth_verified_at` เลยแม้แต่คอลัมน์เดียว (ไม่มี action ใหม่สำหรับ
  "ใช้ข้อมูลนี้" — ใช้ปุ่ม/ฟอร์มเดิมที่มีการยืนยันจากเจ้าหน้าที่อยู่แล้วแทน) ใช้
  cache 24 ชม. + rate limit ต่อเจ้าหน้าที่ (30 ครั้ง/ชม., ใช้
  `check_rate_limit()` เดิม) กันเรียกซ้ำเกินจำเป็น บันทึก Audit Log ทุกครั้ง
  ที่เจ้าหน้าที่นำผลไปใช้
- **ควบคุมขนาด/จำนวนหน้า/โควตา OCR ได้แล้ว** ที่หน้าใหม่ `/superadmin/ocr` —
  ขนาดไฟล์สูงสุด, จำนวนหน้าสูงสุด, โควตาต่อผู้ใช้ต่อวัน, สวิตช์เปิด/ปิด OCR
  ระดับฐานข้อมูล (แยกจาก env var, ปิดได้ทันทีไม่ต้อง deploy ใหม่), และ
  allow-list ระดับการเข้าถึงเอกสารที่อนุญาตส่ง OCR (ค่าเริ่มต้น `public`
  เท่านั้น) — ตรวจสอบผ่าน `checkOcrEligibility()` จุดเดียวที่ทุกทางสร้างงาน
  OCR ทั้ง 3 จุดเรียกร่วมกัน **ก่อน** สร้าง background job เสมอ (เกินขีดจำกัด
  = ไม่มีการสร้างงานเลย ไม่ใช่สร้างแล้วค่อยล้มเหลวทีหลัง) พร้อมข้อความแนะนำให้
  แบ่งไฟล์/ดำเนินการตามนโยบาย และบันทึก Audit Log เหตุผลที่ปฏิเสธทุกครั้ง —
  จำนวนหน้าที่ยังไม่รู้จะคำนวณสดด้วย `pdfjs-dist` ตัวเดิมที่ใช้ดึงข้อความ แล้ว
  cache กลับไปที่ `research_items.page_count` (คอลัมน์เดิมที่ไม่เคยถูกเขียน
  มาก่อน) **ใช้ระบบคิว/concurrency เดิมของช่วงที่ 25 ทั้งหมดไม่มีโค้ดคิวใหม่**

### ช่วงที่ 28 — Filter Parity เต็มรูปแบบ + Master Job Lifecycle (Pause/Resume/Cancel)

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/background-jobs.md` หัวข้อ 11.6:

- **ปุ่ม "ประมวลผลทั้งหมดตามตัวกรอง" รองรับทุก filter แล้วทั้ง 3 หน้า**
  (pdf-processing ทั้ง 2 แท็บ, data-quality, file-security) — เดิมบาง filter
  นับจำนวนรวมแบบแม่นยำไม่ได้ (`"ยังไม่มีข้อความ"`/`"ไฟล์ถูกแทนที่"` ของหน้า
  pdf-processing, ตัวกรองหมวดหมู่ของหน้า data-quality) เพราะ PostgREST query
  builder ฝั่ง JS ทำ join/เทียบคอลัมน์ข้ามตารางไม่ได้ — เปลี่ยนไปนับ/แบ่งหน้า
  ผ่าน SQL function ใหม่ 6 ตัวที่ join ในฐานข้อมูลแทนทั้งหมด พร้อมเพิ่มตัวกรอง
  ใหม่ (สถานะ OCR เอง, ปี/สถานะเผยแพร่, "ไม่เคยตรวจสอบซ้ำเลย", ประเภทไฟล์/
  ช่วงวันที่อัปโหลด) ตรวจสอบทุก filter ด้วย Zod `.strict()` เสมอ (ปฏิเสธ field
  ที่ไม่รู้จัก)
- **Master job (`job_batches`) มีวงจรชีวิตเต็มรูปแบบแล้ว**: สร้างแบบ
  idempotent (กดปุ่มซ้ำสำหรับตัวกรองเดิมไม่สร้างงานซ้ำซ้อน), หยุดชั่วคราว/
  ทำงานต่อ/ยกเลิก (ยกเลิกแตะเฉพาะรายการที่ยัง `pending` เท่านั้น รายการที่
  ทำสำเร็จ/กำลังทำอยู่ไม่ถูกแตะ), ขนาด chunk ปรับได้ต่อคำขอ (ค่าเริ่มต้นตั้งได้
  ที่ `/superadmin/jobs`) — ตัวนับ progress เปลี่ยนจากการดึง `background_jobs`
  สูงสุด 2000 แถวมา group ใน JS ทุกครั้ง เป็นตัวนับ O(1) ที่อัปเดตอัตโนมัติทุก
  ครั้งที่ job ลูกเปลี่ยนสถานะ (ไม่โหลดข้อมูลจำนวนมากเข้าหน่วยความจำอีกต่อไป)
- **แจ้งเตือน Super Admin เมื่อชุดงานเสร็จ/ล้มเหลว/มีรายการเข้า DLQ** —
  รูปแบบเดียวกับการแจ้งเตือน DLQ รายตัวเดิมทุกประการ (dedup ผ่านคอลัมน์
  เฉพาะ, ไม่เพิ่มค่า enum ใหม่ให้ `notifications.type`)
- กล่องยืนยันก่อนสั่งงานจริงเสมอ (แสดงสรุปตัวกรอง/จำนวนโดยประมาณ/ขนาด chunk —
  เดิมกดปุ่มแล้ว submit ทันทีไม่มีการยืนยัน) และแผงรายละเอียด+ควบคุมต่อชุดงาน
  (`JobBatchDetailDrawer`)

### ช่วงที่ 29 — OCR Provider Abstraction 2 รูปแบบ + Progress ระดับหน้า

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/ocr-operations.md` หัวข้อ 3:

- **Provider abstraction รองรับ 2 รูปแบบแล้ว** เลือกผ่าน `OCR_PROVIDER`:
  `"http"` (เดิมจากช่วงที่ 23 — synchronous รอบเดียว ไม่เปลี่ยนสัญญา) และ
  `"external_api"` (ใหม่ — async submit + poll จำลองรูปแบบที่ OCR API เชิง
  พาณิชย์ส่วนใหญ่ใช้จริง) เลือกได้อิสระโดยไม่กระทบโค้ดส่วนอื่นของระบบเลย
- **สถานะ `blocked` ใหม่** (แยกจาก `failed`) — งาน OCR ที่ไม่ได้ลองทำเลยเพราะ
  ปัญหาการตั้งค่า/นโยบาย (ยังไม่ได้ตั้งค่า provider, ยังไม่ได้อนุมัติส่งไฟล์
  ออก, หรือ Super Admin ปิดสวิตช์ไว้) แสดงสถานะนี้แทน `failed` เพื่อความชัดเจน
  ของเจ้าหน้าที่ — **ไม่มีการเชื่อมต่อเครือข่ายเกิดขึ้นเลยเมื่อ `blocked`**
- **Progress ระดับหน้าจริงสำหรับ `"external_api"`** — ถ้า provider รายงาน
  `current_page`/`total_pages` มาระหว่าง poll ระบบบันทึกและแสดงตัวเลขจริง
  ("หน้าที่ 50 จาก 200") ถ้าไม่รายงานมาแสดงข้อความสถานะทั่วไปแทนเสมอ
  **ไม่มีการสร้างตัวเลข/ข้อความ progress ปลอมเด็ดขาด** — หน้า
  `/superadmin/pdf-processing` และ `/superadmin/ocr` แสดงรายการงาน OCR ล่าสุด
  พร้อม progress/เวลาเริ่ม/เวลาที่อัปเดตล่าสุด และ poll อัตโนมัติทุก 5 วินาที
- ก่อนสร้างงาน OCR ยังคงตรวจขนาดไฟล์/จำนวนหน้า/ระดับการเข้าถึง/โควตาเหมือนเดิม
  ทุกประการ (`checkOcrEligibility()` จากช่วงที่ 27 ไม่ได้แก้ไข)
- งาน `ocr_processing` ใช้ `max_attempts = 120` (สูงกว่าค่าเริ่มต้น 5) เพราะ
  การ requeue ระหว่าง poll สถานะของ provider แบบ async นับเป็น attempt ด้วย —
  ดูเหตุผลเดียวกับ `bulk_enqueue` ของช่วงที่ 25/28 ที่ `docs/ocr-operations.md`
  หัวข้อ 3.2

### สิ่งที่ยังไม่ทำในช่วงนี้ (คงเหลือหลังช่วงที่ 29)

- ไม่ได้แถม OCR engine/บริการ OCR มาให้ในตัว — ต้องตั้งค่า provider
  (self-hosted หรือภายนอก) เองก่อนจึงจะ OCR ได้จริง ดู `docs/ocr-operations.md`
  หัวข้อ 4 สำหรับตัวอย่างวิธีตั้ง self-hosted แบบไม่เสียค่าใช้จ่าย
- OCR ไม่มีการแปลง PDF เป็นภาพ/ตัดหน้าใดๆ ในฝั่งแอปเอง (ส่งไฟล์ PDF ทั้งไฟล์ให้
  provider จัดการเอง) — ไฟล์ PDF ที่มีจำนวนหน้ามากอาจใช้เวลานาน ขึ้นกับ
  provider ที่เลือก ไม่ใช่ข้อจำกัดจากฝั่งแอป
- `progress`/`current_page`/`total_pages` มี handler เขียนค่าจริงแล้วเฉพาะ
  `ocr_processing` เท่านั้น (ช่วงที่ 29) — job type อื่น (`pdf_text_extraction`,
  `file_security_rescan` ฯลฯ) ยังคงเป็น 0/100 เหมือนเดิม หน้า Super Admin ของ
  batch เหล่านั้นยังใช้ per-status counts + ETA ของทั้งชุดแทนต่อไป,
  ความถี่การตรวจหมดอายุขึ้นกับรอบ Cron ที่ตั้งค่าไว้จริง (ไม่ real-time 100%)
  — ดู `docs/background-jobs.md` หัวข้อ 8 สำหรับรายการข้อจำกัดฉบับเต็ม
- `"external_api"` ยังไม่ได้ทดสอบกับ provider เชิงพาณิชย์จริงรายใดรายหนึ่ง
  (ทดสอบผ่าน stub เท่านั้น ตามข้อกำหนดห้ามเปิดใช้บริการภายนอกที่มีค่าใช้จ่าย)

### ช่วงที่ 30 — Worker หลาย process/instance อย่างปลอดภัย + Queue Health Dashboard

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/background-jobs.md` หัวข้อ 13:

- **Concurrency ต่อประเภทงานบังคับแบบ global ข้าม worker/instance จริงแล้ว**
  — เดิม (ช่วงที่ 25) ค่า concurrency เป็นแค่เพดาน "ต่อการเรียก worker หนึ่ง
  ครั้ง" เท่านั้น ถ้ามีมากกว่าหนึ่ง invocation ทำงานพร้อมกันจริง (Cron ทับซ้อน
  กัน, ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ระหว่าง Cron กำลังรัน, หรือ worker หลาย
  instance จริงใน production) อาจได้งานประเภทเดียวกัน processing พร้อมกันเกิน
  ค่าที่ตั้งไว้จริง — แก้ด้วย `claim_background_jobs_with_concurrency()`
  (SQL function ใหม่) ที่ใช้ `pg_advisory_xact_lock` ต่อประเภทงาน บังคับให้
  "นับงานที่ processing อยู่จริงแล้วค่อย claim" รันแบบอนุกรมข้าม invocation
  ทั้งหมด — ประเภทงานอื่นยัง claim พร้อมกันได้ตามปกติ (คีย์ lock ต่างกัน)
- **Bounded email fan-out** — การแจ้งเตือนผู้ติดตามหมวดหมู่/สิทธิ์ใกล้หมดอายุ
  ทางอีเมล เปลี่ยนจาก `Promise.all` ไม่จำกัดจำนวนต่อผู้รับทั้งหมด เป็นส่งเป็น
  ชุดละ 5 คน (`sendInBatches()`) กัน burst เกิน rate limit ของ Email Provider
  เมื่อมีผู้รับจำนวนมาก
- **ส่วน "สถานะ Queue โดยรวม" ใหม่ที่ `/superadmin/jobs`** — แสดงจำนวน worker
  ที่ active จริงต่อประเภทงาน, จำนวนงานต่อสถานะ, งานที่ lease หมดอายุค้างอยู่
  (self-heal เองได้ แต่บ่งชี้ worker ที่ตายกลางคันถ้าเกิดซ้ำ), งานที่รอคิวนาน
  ผิดปกติ (เกิน 15 นาที) เทียบกับ concurrency limit ปัจจุบัน — แสดงแค่ตัวเลข
  รวมที่ปลอดภัย ไม่มี payload/worker id ดิบ/รายละเอียด infrastructure ใดๆ
- ไม่มี environment variable ใหม่ — `CRON_SECRET` เดิมครอบคลุมการยืนยันตัวตน
  สำหรับผู้เรียกกี่รายก็ได้อยู่แล้ว ไม่มีการ deploy จริง/เปิด Cron จริงใดๆ ใน
  ช่วงนี้ (เอกสาร/configuration-as-code เท่านั้น เหมือนทุกช่วงก่อนหน้า)

### ช่วงที่ 31 — ตรวจสอบ Cron/Worker แบบอัตโนมัติ + แจ้งเตือนเมื่อผิดปกติ

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/background-jobs.md` หัวข้อ 14:

- **ประวัติการทำงานของ cron/worker ที่สำคัญ (`cron_runs`)** — เดิมไม่มีทางรู้
  เลยว่า Cron ที่เรียก `/api/jobs/process` ยังทำงานตามรอบจริงหรือไม่ ตอนนี้
  บันทึกทุกครั้งที่ `queue_worker`/`access_expiration`/`notification_delivery`/
  `maintenance_cleanup`/`health_monitoring` ทำงาน (เวลาเริ่ม/จบ, สถานะ,
  จำนวนสำเร็จ/ล้มเหลว, สรุปข้อผิดพลาดแบบนับจำนวนเท่านั้น — ไม่มี stack trace/
  PostgreSQL error ดิบ/secret ใดๆ หลุดออกไปเลย)
- **Watchdog แยกต่างหาก — `/api/cron/health-check`** — ต้องเป็น Cron คนละตัว
  จาก `/api/jobs/process` โดยเจตนา (ใช้ `CRON_SECRET` เดียวกัน) เพราะถ้าฝัง
  การตรวจสอบไว้ใน worker เดียวกัน ตอน Cron หลักหยุดทำงานทั้งหมดจะไม่มีอะไร
  ตรวจจับได้เลย — ตรวจ "ไม่เคยทำงานเลย"/"เกินกำหนดเวลา"/"อัตราความล้มเหลวสูง"
  ต่อ cron แต่ละตัว บวกเช็ครวมระดับ queue (งานรอคิวนานผิดปกติ, DLQ backlog
  สะสม — เสริมจากการแจ้งเตือน DLQ ต่อ job เดิมของช่วงที่ 25 ไม่ใช่แทนที่กัน)
- **แจ้งเตือน Super Admin อัตโนมัติ** (in-app + อีเมลถ้าตั้งค่า Email Provider
  ไว้) พร้อม **cooldown 60 นาทีต่อเงื่อนไข** กันแจ้งซ้ำ — ทดสอบยืนยันแล้วว่า
  เรียกซ้ำทันทีไม่แจ้งซ้ำ และแจ้งใหม่ได้อีกครั้งหลังพ้น cooldown
- **`maintenance_cleanup`** — job บำรุงรักษาจริงตัวแรกของระบบ (เดิมไม่มีเลย)
  ลบ `rate_limit_events` ที่เก่ากว่า 7 วันทิ้ง self-seed ทุกครั้งที่ worker
  ทำงานเหมือน `access_expiration`
- **หน้าใหม่ `/superadmin/cron-monitoring`** — สถานะ cron ล่าสุด/heartbeat,
  รายการแจ้งเตือนล่าสุด, ฟอร์มปรับความถี่ที่คาดหวัง/เกณฑ์แจ้งเตือนต่อ cron —
  ระบุชัดเจนว่าไม่ใช่ real-time (snapshot ตอนโหลดหน้า)
- ไม่มี environment variable ใหม่ — ใช้ `CRON_SECRET` เดิมกับทั้งสอง endpoint
  `vercel.json` เพิ่ม entry ที่สองสำหรับ watchdog ไว้แล้ว (configuration-as-code
  เท่านั้น ไม่มีการ deploy จริง/เปิด Cron จริงในช่วงนี้)

### ช่วงที่ 32 — OCR Provider Readiness, Controlled Testing และ Production Validation

รายละเอียดสถาปัตยกรรมเต็มดูที่ `docs/ocr-operations.md` หัวข้อ 13-15 และ
`docs/ocr-provider-validation.md` (คู่มือใหม่ทั้งฉบับ):

- **เปลี่ยนชื่อชุด Environment Variable ของ OCR ทั้งหมด** ให้สื่อความหมายชัดเจน
  ขึ้นและรวมตัวแปรที่ซ้ำซ้อนกันของ 2 provider เดิมเข้าเป็นชุดเดียว —
  `OCR_PROVIDER=none|self_hosted|external_api`, `OCR_PROVIDER_BASE_URL`,
  `OCR_PROVIDER_API_KEY`, `OCR_PROVIDER_TIMEOUT_MS` (ใหม่ — เดิมเป็นค่าคงที่ใน
  โค้ด), `OCR_ENABLED` (เดิมชื่อ `OCR_ALLOW_EXTERNAL_TRANSFER`) — **ยังไม่มีการ
  deploy จริงมาก่อนหน้านี้ จึงทำเป็นการเปลี่ยนชื่อทั้งชุดครั้งเดียวแทนที่จะคง
  ชื่อเดิมไว้คู่กัน** พฤติกรรม/สัญญาการเรียก provider (`self_hosted` แบบคำขอ
  เดียว, `external_api` แบบ submit+poll) ไม่เปลี่ยนแปลงเลย
- **`OCR_ALLOW_PRIVATE_DOCUMENTS`** (ใหม่) — ชั้นควบคุมเพิ่มเติมเฉพาะ
  `external_api`: แม้ `settings.ocrAllowedAccessLevels` (DB) จะอนุญาตระดับที่
  ไม่ใช่ `public` แล้ว การส่งเอกสารนั้นไปยัง**ผู้ให้บริการภายนอก**ยังต้องเปิด
  ตัวแปรนี้เพิ่มอีกชั้นหนึ่งเสมอ (ไม่บังคับกับ `self_hosted`)
- **เพดานจาก Environment Variables คู่กับค่าที่ปรับได้ใน `settings` เดิม** —
  `OCR_MAX_FILE_SIZE_MB`/`OCR_MAX_PAGES`/`OCR_MAX_JOBS_PER_DAY` (ใหม่) เป็น
  เพดานสูงสุดระดับ deploy ที่ Super Admin ปรับผ่านหน้าเว็บไม่ได้ ค่าที่ใช้ตรวจ
  จริงคือ `min(env ceiling, ค่าใน settings)` — **การเพิ่ม env ceiling ไม่เคย
  ทำให้ค่าที่ใช้จริงสูงกว่าที่ Super Admin ตั้งไว้ใน `settings`** มีแต่จะจำกัด
  ให้ต่ำลงเท่านั้น (Phase 27's live-tunability ผ่านหน้าเว็บยังคงอยู่ครบ)
- **OCR Readiness Check** (หน้าใหม่ที่ `/superadmin/ocr`) — สรุปสถานะความพร้อม
  ทั้งหมดในที่เดียว (เปิด/ปิด, provider, ความครบถ้วนของการตั้งค่าแบบไม่โชว์
  secret, timeout, เพดานต่างๆ, นโยบายเอกสาร private, โหมดทดสอบ, งาน/DLQ ล่าสุด)
  พร้อมปุ่ม **"ตรวจสอบการเชื่อมต่อ"** ที่ส่งแค่ `GET` สั้นๆ ไปยัง
  `OCR_PROVIDER_BASE_URL` — **ไม่เคยส่งไฟล์หรือสร้างงาน OCR ระหว่างตรวจสอบเลย**
  บันทึก Audit Log ทุกครั้งที่กด
- **Controlled OCR Test** (ส่วนใหม่ที่ `/superadmin/ocr`, เปิดด้วย
  `OCR_TEST_MODE=true`) — ทดสอบ provider จริงด้วยไฟล์ที่ไม่เป็นความลับโดยการ
  ออกแบบเท่านั้น (`public/ocr-test-fixtures/`: `english-sample`,
  `multipage-sample`, `no-text-scanned-sample` — `thai-sample` เป็น slot ที่
  แอดมินต้องเพิ่มไฟล์เองก่อนใช้งาน) เขียนผลลงตารางใหม่ `ocr_test_runs` ที่**ไม่
  มี foreign key ไปยัง `research_items` เลย** จึงไม่มีทางที่ผลทดสอบจะรั่วไหล
  เข้าไปในห้องสมุดสาธารณะหรือผลค้นหาได้ — ใช้คิว `background_jobs` เดิมทุก
  ประการผ่าน job type ใหม่ `ocr_test_run` (concurrency/retry/backoff ได้มา
  ฟรีจากคิวเดิม) มีปุ่ม "ลองใหม่" ต่อรายการที่ล้มเหลว บันทึก Audit Log ทุกครั้ง
  ที่เริ่ม/ลองใหม่ — **เป็นอิสระจาก `OCR_ENABLED` โดยเจตนา** เพื่อให้ทดสอบ
  provider ได้ก่อนเปิดใช้งานจริงกับผู้ใช้
- **คู่มือใหม่ `docs/ocr-provider-validation.md`** — ขั้นตอนเลือก provider,
  ตั้งค่า self-hosted/external API ทีละขั้นตอน, ตั้งค่า Environment Variables,
  เปิดใช้งานใน Staging ก่อน Production, Test Checklist เต็ม (ไทย/อังกฤษ/หลาย
  หน้า/ล้มเหลว/timeout/retry+DLQ/progress/บล็อกเอกสาร private/ค้นหาได้จริง),
  ตารางบันทึกผลการประเมิน provider สำหรับแอดมิน, และขั้นตอนเปิดใช้งานจริงใน
  Production อย่างปลอดภัย
- **ยังไม่มีการเปิดใช้บริการ OCR เชิงพาณิชย์/ส่งไฟล์จริงออกนอกระบบ/deploy จริง
  ในช่วงนี้** ตามข้อกำหนด — ทดสอบทั้งหมดผ่าน stub `fetch` ในสภาพแวดล้อม local
  เท่านั้น พฤติกรรมเดิมของการอัปโหลด PDF/ตรวจสิทธิ์/Signed URL/PDF text
  extraction/ระบบค้นหา **ไม่ถูกแตะต้องเลยแม้แต่บรรทัดเดียว**
