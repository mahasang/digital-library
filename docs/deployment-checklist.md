# Deployment Checklist

รายการตรวจสอบก่อน/ระหว่าง/หลัง deploy ระบบขึ้นใช้งานจริง อ้างอิงจาก
[`README.md`](../README.md) (ขั้นตอนละเอียด) และ [`project-spec.md`](project-spec.md)
(ขอบเขตโครงการ) ใช้เป็น checklist ให้ทำเครื่องหมายทีละข้อก่อนเปิดใช้งานจริง —
เอกสารนี้เน้นขั้นตอน deploy (env vars, migration, Storage, Vercel) สำหรับ
checklist เชิงฟังก์ชัน/ความปลอดภัยแยกตามบทบาทและ Super Admin โดยเฉพาะ ดูที่
[`production-checklist.md`](production-checklist.md) แทน

## 1. ก่อน Deploy — โค้ดและคุณภาพ

- [ ] `npm run lint` ผ่านโดยไม่มี error
- [ ] `npx tsc --noEmit` ผ่านโดยไม่มี error
- [ ] `npm run build` (production build) สำเร็จโดยไม่มี error
- [ ] ไม่มี `console.log`/โค้ดทดสอบค้างอยู่ใน `app/`, `components/`, `lib/`
      (`console.error` สำหรับบันทึกข้อผิดพลาดฝั่งเซิร์ฟเวอร์ที่ไม่กระทบผู้ใช้ ยอมรับได้)
- [ ] ไม่มี secret ใดๆ (API key, service role key, connection string) ฝังอยู่ใน
      source code หรือถูก commit เข้า Git — ตรวจสอบด้วย `git status`/`git log`
      ก่อน push ทุกครั้ง โดยเฉพาะ `.env.local` และ `supabase/.temp/`
      (ทั้งสองอยู่ใน `.gitignore` แล้ว แต่ควรตรวจซ้ำหากย้าย/คัดลอกโปรเจกต์)

## 2. เตรียม Supabase Project (Production)

- [ ] สร้าง Supabase project แยกสำหรับ production (แนะนำ — อย่าใช้ project
      เดียวกับที่ใช้พัฒนา/ทดสอบ เพื่อไม่ให้ข้อมูลทดสอบปนกับข้อมูลจริง)
- [ ] รัน migrations ทั้ง 19 ไฟล์ใน `supabase/migrations/` ตามลำดับ
      (`npx supabase link` แล้ว `npx supabase db push` หรือรันผ่าน SQL Editor
      ตามขั้นตอนในหัวข้อ "การเชื่อมต่อ Supabase" ใน README) — ไฟล์ล่าสุดที่
      ควรตรวจสอบว่ารันครบคือ `20260810100000_background_jobs.sql`
      (background job queue), `20260811100000_access_expiration_and_publish_events.sql`
      (หมดอายุสิทธิ์ตรงเวลา + publish event กลาง),
      `20260812100000_data_quality_admin_and_mfa_overview.sql` (เกณฑ์ตรวจซ้ำ
      แบบปรับได้ + MFA overview) และ
      `20260813100000_orcid_oauth_and_ocr.sql` (ORCID OAuth จริง + OCR
      เอกสารสแกน — ดู [`orcid-integration.md`](orcid-integration.md) และ
      [`ocr-operations.md`](ocr-operations.md)) — `npx supabase migration list`
      เทียบจำนวนไฟล์ในเครื่องกับที่ apply แล้วบน production ก่อนเสมอ
- [ ] **ตั้งค่า MFA สำหรับ Super Admin (บังคับ ไม่ใช่ทางเลือก)**: เปิด
      **Authentication > Providers > Multi-Factor Authentication (TOTP)** ใน
      Supabase Dashboard **ก่อน**ให้ Super Admin คนใดเข้า `/superadmin`
      — ตั้งแต่ช่วงที่ 16 บัญชี Super Admin ที่ยังไม่มี MFA ที่ verified แล้ว
      จะเข้า `/superadmin` ไม่ได้เลย (ถูกบังคับตั้งค่าที่ `/setup-mfa` ก่อนเสมอ
      ไม่ใช่แค่คำแนะนำ) หากลืมเปิดค่านี้ก่อน deploy Super Admin ทุกคนจะเข้า
      ระบบไม่ได้ — **ไม่เปิดอัตโนมัติ** ต่างจาก local dev ที่เปิดไว้แล้วใน
      `supabase/config.toml` (ดู [`superadmin-guide.md`](superadmin-guide.md)
      หัวข้อ 14 สำหรับลำดับขั้นตอนที่ปลอดภัย)
- [ ] หากต้องการให้ระบบดึงข้อความจาก PDF เพื่อค้นหาเนื้อหาได้ ไม่ต้องตั้งค่า
      เพิ่มเติมใดๆ (ใช้ `pdfjs-dist` ที่มีอยู่แล้วในโปรเจกต์ ไม่มี API key
      ภายนอก) — งานวิจัยที่อัปโหลดก่อน migration
      `20260807100000_pdf_fulltext_search.sql` จะยังไม่มีข้อความให้ค้นหาจนกว่า
      เจ้าหน้าที่จะกด "ประมวลผลข้อความใหม่" ที่หน้าแก้ไขงานวิจัยแต่ละรายการ
      (ดู [`pdf-full-text-search.md`](pdf-full-text-search.md) หัวข้อ 9)
- [ ] ตรวจสอบว่า Storage Buckets ทั้ง 4 อัน (`research-documents`,
      `research-covers`, `submission-attachments`, `site-assets`) ถูกสร้างขึ้นจริง
      (สร้างอัตโนมัติจาก migration `20260801100100_storage_buckets.sql` และ
      `20260803100000_superadmin_phase2.sql`) พร้อมตรวจสอบ
      `public`/`file_size_limit`/`allowed_mime_types` ตรงตามที่ระบุใน README
- [ ] ตัดสินใจว่าจะนำเข้า `supabase/seed.sql` (ข้อมูลตัวอย่างสำหรับสาธิต/ทดสอบ)
      หรือไม่ — **ไม่แนะนำให้นำเข้าในฐานข้อมูล production จริง** เนื่องจากเป็น
      ข้อมูลตัวอย่างที่ไม่มีไฟล์ PDF จริงแนบมาด้วย
- [ ] ตั้งค่า **Authentication > Email provider**: เปิดใช้งาน
- [ ] ตั้งค่า **Authentication > URL Configuration**: Site URL และ Redirect URLs
      ชี้ไปที่โดเมนจริง (`https://your-domain.com/auth/callback`) — **ต้องทำ
      หลังทราบโดเมนจาก Vercel แล้ว** (ดูข้อ 4)
- [ ] ตัดสินใจเปิด/ปิด **Confirm email** ตามนโยบายองค์กร (โค้ดรองรับทั้งสองกรณี)
- [ ] คัดลอกค่า `Project URL`, `anon public` key, `service_role` key จาก
      **Project Settings > API** ไว้สำหรับตั้งค่าใน Vercel (ข้อ 3)
- [ ] สร้างบัญชี Super Admin คนแรก (สมัครสมาชิกปกติแล้วมอบบทบาทผ่าน SQL Editor
      ตามขั้นตอนใน README หัวข้อ "สร้างบัญชี Super Admin คนแรก") — ทำหลังรัน
      migrations เสร็จ ไม่ต้องรอจน deploy เสร็จก็ทำได้ทันที

## 3. Environment Variables

- [ ] ตรวจสอบว่า `.env.example` มีตัวแปรครบตรงกับที่โค้ดใช้จริง (`grep -r
      "process.env\." app lib` แล้วเทียบกับ `.env.example`)
- [ ] เตรียมค่าจริงของ 3 ตัวแปรที่จำเป็นสำหรับใส่ใน Vercel:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only — ห้ามมี prefix `NEXT_PUBLIC_`)
- [ ] ทางเลือก (ไม่ตั้งค่าก็ใช้งานได้ปกติ เพียงบางฟีเจอร์ใน Super Admin จะแสดง
      สถานะ "ยังไม่ได้ตั้งค่า"):
  - [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (CAPTCHA —
        ต้องตั้งค่าคู่กันและเปิดสวิตช์ที่ `/superadmin/security` จึงจะบังคับจริง)
  - [ ] `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (อีเมลแจ้งเตือนเมื่อสถานะงานวิจัยเปลี่ยน)
  - [ ] `LOG_PROVIDER` (`sentry` หรือ `betterstack`) พร้อม `SENTRY_DSN` หรือ
        `LOGGING_BETTERSTACK_SOURCE_TOKEN` ที่คู่กัน (centralized logging —
        ไม่ตั้งค่าก็ยัง log ผ่าน Vercel Runtime Logs ได้ปกติ)
  - [ ] `CRON_SECRET` — **จำเป็นถ้าต้องการให้คิว background job (ดึงข้อความ
        PDF/OCR/สแกนไฟล์/หมดอายุสิทธิ์ ฯลฯ) ประมวลผลอัตโนมัติ** ไม่ตั้งค่า
        `/api/jobs/process` จะปฏิเสธทุกคำขอเสมอ ดู
        [`background-jobs.md`](background-jobs.md) หัวข้อ 6
  - [ ] `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET`, `ORCID_OAUTH_ENV=production`
        (ปุ่ม "เชื่อม ORCID" ที่ `/account` — ต้องลงทะเบียน redirect URI
        `https://<โดเมนจริง>/api/orcid/callback` กับ ORCID Developer Tools
        ด้วย) ดู [`orcid-integration.md`](orcid-integration.md)
  - [ ] `OCR_PROVIDER`, `OCR_API_URL`, `OCR_API_KEY`, `OCR_ALLOW_EXTERNAL_TRANSFER`
        (OCR สำหรับ PDF เอกสารสแกน — **ต้องได้รับอนุมัติจากองค์กรก่อน**ตั้งค่า
        `OCR_ALLOW_EXTERNAL_TRANSFER=true`) ดู [`ocr-operations.md`](ocr-operations.md)
  - ดูวิธีตั้งค่าทั้งหมดใน [`superadmin-guide.md`](superadmin-guide.md)

## 4. Deploy บน Vercel

- [ ] Push โค้ดขึ้น Git repository (GitHub/GitLab/Bitbucket)
- [ ] Import โปรเจกต์เข้า Vercel ([vercel.com/new](https://vercel.com/new))
- [ ] ตั้งค่า Environment Variables ทั้ง 3 ตัวใน Vercel Project Settings
      (Production เป็นอย่างน้อย — ตั้งใน Preview/Development ด้วยหากต้องการ
      ทดสอบผ่าน Preview Deployment)
- [ ] กด Deploy และรอ build สำเร็จ
- [ ] จดโดเมนที่ Vercel ให้มา (เช่น `your-project.vercel.app` หรือโดเมนที่
      ผูก custom domain ไว้)
- [ ] ย้อนกลับไปทำข้อ "ตั้งค่า Authentication > URL Configuration" ในข้อ 2
      ให้ชี้มาที่โดเมนนี้จริง

## 5. ทดสอบ Golden Path หลัง Deploy

- [ ] **Guest**: ค้นหาและดูรายละเอียดงานวิจัยที่เป็น public ได้โดยไม่ต้องล็อกอิน
- [ ] **สมัครสมาชิกใหม่**: กรอกฟอร์ม → ได้รับอีเมลยืนยัน (หากเปิด Confirm email)
      → ลิงก์ในอีเมลพาไปที่โดเมนจริง (ไม่ใช่ localhost) → ล็อกอินสำเร็จ
- [ ] **Member**: อ่านงานวิจัยออนไลน์ได้ (หน้าอ่านแบบ flipbook โหลดไฟล์ผ่าน
      Signed URL จริง พลิกหน้าได้), ดาวน์โหลดได้ (ถ้า access level อนุญาต),
      เพิ่ม/ลบรายการโปรดได้
- [ ] **Staff**: ส่งงานวิจัยใหม่ได้ (อัปโหลด PDF/ภาพปก/เอกสารแนบสำเร็จ), ดูสถานะ
      ที่ `/my-submissions` ได้
- [ ] **Librarian**: เห็นงานที่ส่งเข้ามาที่ `/dashboard/approvals`, อนุมัติ/
      ขอแก้ไข/ปฏิเสธ/เผยแพร่ได้ และเห็นการเปลี่ยนสถานะบันทึกใน audit log,
      เห็นคำขอเข้าถึงเอกสารใหม่ที่ `/dashboard/access-requests` และอนุมัติ/
      ปฏิเสธได้, เห็นคำเตือนงานวิจัยซ้ำที่ `/dashboard/duplicate-reviews`
      (ถ้ามี), เพิ่ม/แก้ไขผู้วิจัยที่ `/dashboard/authors` ได้
- [ ] **ค้นหาเนื้อหา PDF**: ที่ `/research` เลือกโหมด "เนื้อหา PDF" แล้วค้นหา
      คำที่อยู่ในเอกสารตัวอย่าง (ต้องเคยผ่านการดึงข้อความสำเร็จแล้ว) → ต้องเจอ
      ผลลัพธ์พร้อม snippet ไฮไลต์คำที่ตรง
- [ ] **ขอสิทธิ์เข้าถึงเอกสาร**: ล็อกอินด้วยบัญชี Member เปิดเอกสารที่ตั้งค่า
      "อ่านออนไลน์เท่านั้น" แล้วกด "ขอสิทธิ์ดาวน์โหลด" → ส่งคำขอสำเร็จ →
      Librarian อนุมัติที่ `/dashboard/access-requests` → กลับไปที่บัญชี
      Member ต้องดาวน์โหลดได้จริงแล้ว และมีการแจ้งเตือนขึ้นที่กระดิ่ง
- [ ] **Admin**: เข้า `/dashboard/users` เปลี่ยนบทบาทผู้ใช้ได้, ระงับ/เปิดใช้งาน
      บัญชีได้จริง (ทดสอบว่าบัญชีที่ถูกระงับล็อกอินไม่ได้จริง), เข้า
      `/dashboard/settings` และ `/dashboard/audit-logs` ได้, กดรวมงานวิจัยที่
      `/dashboard/duplicate-reviews/[id]` ได้ (Librarian ทำไม่ได้) **แต่เข้า
      `/superadmin` ไม่ได้ (ต้องถูกพาไปหน้า `/403`)**
- [ ] **Super Admin**: เข้า `/superadmin/overview` เห็นกราฟและสถิติจริง,
      ทดสอบมอบหลายบทบาทให้ผู้ใช้ที่ `/superadmin/users`, อัปโหลดโลโก้ที่
      `/superadmin/system-settings` สำเร็จ, ดู `/superadmin/system-health`
      แสดงสถานะ "ใช้งานได้ปกติ" ทั้ง 3 บริการ (Database/Auth/Storage),
      ทดสอบลากวางจัดลำดับที่ `/superadmin/categories`/`/superadmin/organizations`
      แล้วลำดับเปลี่ยนจริงในหน้าแรก — รายละเอียดเพิ่มเติมดูที่
      [`production-checklist.md`](production-checklist.md)
- [ ] **ทดสอบการปฏิเสธสิทธิ์**: ล็อกอินด้วยบัญชี Member แล้วพยายามเข้า
      `/dashboard` โดยตรง → ต้องถูกพาไปหน้า `/403`
- [ ] **ทดสอบไฟล์ private**: คัดลอก URL ไฟล์ PDF จากหน้าอ่านแบบ flipbook แล้วลองเปิดใน
      หน้าต่างไม่ระบุตัวตน (incognito) หลัง URL หมดอายุ (30 นาทีสำหรับอ่าน,
      1 นาทีสำหรับดาวน์โหลด) → ต้องเปิดไม่ได้
- [ ] **ทดสอบ `/api/health`**: เปิด `https://<โดเมนจริง>/api/health` ต้องได้
      HTTP 200 พร้อม `"status":"ok"` และ `checks.database`/`checks.storage`
      เป็น `"ok"` ทั้งคู่
- [ ] **หากตั้งค่า CAPTCHA ไว้**: ทดสอบสมัครสมาชิก/ส่งงานวิจัยเมื่อเปิด CAPTCHA
      (ต้องยืนยัน widget ก่อนจึงส่งได้จริง)
- [ ] **MFA ของ Super Admin (บังคับ)**: ล็อกอินด้วยบัญชี Super Admin ที่ยังไม่
      เคยตั้งค่า MFA แล้วพยายามเข้า `/superadmin` ตรงๆ → ต้องถูกเด้งไป
      `/setup-mfa` ทันที (ไม่ใช่แค่คำเตือน) ตั้งค่าสำเร็จแล้วเข้าได้จริง →
      ล็อกเอาต์แล้วล็อกอินใหม่ (เซสชันใหม่) → ต้องถูกเด้งไป `/mfa-challenge`
      ก่อนเข้า `/superadmin/*` ได้ทุกครั้ง (บทบาทอื่นที่ต่ำกว่า Super Admin ไม่
      ถูกบังคับ MFA — ตั้งค่าที่ `/account` ได้ตามสมัครใจเท่านั้น)

## 6. หลัง Deploy สำเร็จ

- [ ] ตั้งค่าแผนสำรองข้อมูล — ดู [`backup-and-recovery.md`](backup-and-recovery.md)
- [ ] เชื่อมต่อบริการ Uptime Monitoring ภายนอกเข้ากับ `/api/health` — ดู
      [`uptime-monitoring.md`](uptime-monitoring.md)
- [ ] แจกจ่าย [`user-guide.md`](user-guide.md) ให้ผู้ใช้งานแต่ละกลุ่ม
      (Staff/Librarian/Admin) และ [`superadmin-guide.md`](superadmin-guide.md)
      ให้ผู้ถือบทบาท Super Admin
- [ ] ทำ checklist เชิงฟังก์ชัน/ความปลอดภัยแบบละเอียดใน
      [`production-checklist.md`](production-checklist.md) ให้ครบก่อนประกาศ
      เปิดใช้งานจริงกับผู้ใช้จริง
- [ ] พิจารณาตั้งค่า custom domain ใน Vercel (ถ้ายังไม่ได้ทำ)
- [ ] แจ้งผู้ดูแลระบบว่าตัวแปร `SUPABASE_SERVICE_ROLE_KEY` มีสิทธิ์ข้าม RLS
      ทั้งหมด ต้องเก็บเป็นความลับระดับสูงสุด ไม่แชร์ผ่านช่องทางที่ไม่ปลอดภัย
