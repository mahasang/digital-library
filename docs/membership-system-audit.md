# รายงาน Audit ระบบสมาชิก/บัญชีผู้ใช้ — ความพร้อมสู่ Production

**ขอบเขต**: Audit only — ไม่มีการแก้ไขโค้ด/schema/RLS/migration/auth flow/UI ใดๆ ในงานนี้ทั้งสิ้น เป็นการตรวจสอบและบันทึกหลักฐานเท่านั้น
**วันที่ตรวจสอบ**: 2026-08-12
**วิธีตรวจสอบ**: อ่านโค้ดจริงในรีโปทั้งหมด (migrations, RLS policies, Server Actions, หน้าเว็บ, การตั้งค่า Supabase local, ไฟล์ทดสอบ) — ทุกข้อค้นพบอ้างอิง `ไฟล์:บรรทัด` ที่ตรวจสอบจริง ข้อใดที่ไม่สามารถยืนยันได้จากโค้ด (เช่น การตั้งค่า Supabase Dashboard บน production จริง ซึ่งไม่ได้อยู่ในรีโป) จะระบุไว้ชัดเจนว่า **"ต้องตรวจสอบด้วยตนเอง"** แยกจากสิ่งที่ยืนยันได้จากโค้ด

---

# 1. Executive Summary

## ความพร้อมโดยรวม: **Ready with conditions (พร้อมใช้งานแบบมีเงื่อนไข)**

สถาปัตยกรรมด้านความปลอดภัยหลัก (RLS, การป้องกันการยกระดับสิทธิ์, audit log, RBAC สองชั้น middleware+layout) แข็งแรงและออกแบบมาอย่างรอบคอบ **แต่มีช่องว่างเชิงกฎหมาย/ความเป็นส่วนตัว และฟีเจอร์พื้นฐานบางอย่างที่ขาดหายไป ซึ่งควรแก้ไขก่อนเปิดใช้งานจริงกับผู้ใช้ทั่วไป** โดยเฉพาะประเด็นเรื่องความยินยอม (consent) ที่อ้างถึงนโยบายที่ไม่มีอยู่จริง

## ความเสี่ยงหลัก เรียงตามระดับ

### Critical (ต้องแก้ก่อนเปิดใช้งานจริง)

1. **ช่องกาเครื่องหมายยินยอมตอนสมัครสมาชิกอ้างถึงนโยบายที่ไม่มีอยู่จริง** — `components/auth/RegisterForm.tsx:127-130` มีข้อความ "ฉันยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว" เป็น checkbox บังคับ (`required`) แต่เป็น**ข้อความธรรมดา ไม่มีลิงก์**ไปยังหน้านโยบายใดๆ เลย และค้นทั้งรีโปแล้ว**ไม่มีหน้านโยบายความเป็นส่วนตัว/ข้อกำหนดการใช้งานอยู่จริง** (ไม่มี route `/privacy`, `/terms`, `/legal` ใดๆ) — ความยินยอมนี้ไม่มีผลทางกฎหมายเพราะผู้ใช้ไม่สามารถอ่านสิ่งที่ตนกำลังยอมรับได้ เป็นความเสี่ยงตรงต่อ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
2. **ไม่มีช่องทางกู้คืนบัญชีหาก Super Admin เพียงคนเดียวทำอุปกรณ์ MFA หาย** — MFA reset ทำได้เฉพาะโดย Super Admin คนอื่น (`app/superadmin/users/actions.ts:395-500`) และห้ามรีเซ็ตของตัวเอง (บรรทัด 408-413) ระบบมี trigger กันลบ Super Admin คนสุดท้ายออกจากบทบาท (`prevent_last_super_admin_removal`) แต่**ไม่มีอะไรป้องกันกรณี Super Admin คนเดียวที่เหลืออยู่ทำอุปกรณ์ TOTP หาย** — จะไม่มีทางเข้า `/superadmin` ได้อีกเลยผ่านช่องทางปกติของแอป ต้องเข้าไปแก้ผ่าน Supabase Dashboard/Service Role โดยตรงเท่านั้น ควรมีนโยบายบังคับว่าต้องมี Super Admin อย่างน้อย 2 คนเสมอในสภาพแวดล้อม production
3. **ไม่มี rate limiting หรือ CAPTCHA ระดับแอปสำหรับหน้าเข้าสู่ระบบ (login) และลืมรหัสผ่าน (forgot-password)** — `app/login/actions.ts` และ `app/auth/forgot-password/actions.ts` ไม่เรียก `checkRateLimit()`/`verifyCaptchaIfEnabled()` เลย (ต่างจาก register/submit-research/access-request ที่เรียกทั้งคู่) พึ่งพา rate limit เริ่มต้นของ Supabase GoTrue เท่านั้น (`sign_in_sign_ups = 30` ครั้ง/5 นาที/IP ตาม `supabase/config.toml:207` — เป็นค่า local dev, **ต้องตรวจสอบค่าจริงบน production Supabase Dashboard**) หน้า login คือเป้าหมายการโจมตีแบบ brute-force/credential-stuffing ที่มีมูลค่าสูงสุดของระบบ

### High

4. **ไม่มีนโยบายเก็บรักษา/ลบข้อมูลอัตโนมัติ (retention policy) สำหรับ `audit_logs`, `download_logs`, `reading_history`** — มี cron cleanup จริงเพียงจุดเดียวคือ `cleanup_old_rate_limit_events` (เก็บ 7 วัน, `lib/jobs/handlers/maintenance-cleanup.server.ts:20`) ตารางอื่นเก็บถาวรไม่มีกำหนด ไม่สอดคล้องกับหลัก storage limitation ของ PDPA
5. **ไม่มีฟีเจอร์ "ขอข้อมูลของฉัน" (export) หรือ "ลบบัญชี/ข้อมูลของฉัน" (self-service delete)** — ค้นทั้งรีโปแล้วไม่พบทั้งสองฟีเจอร์ มีเพียงการระงับบัญชีโดยแอดมิน (`setUserStatusAction`) ซึ่งเป็นคนละเรื่องกับสิทธิ์เจ้าของข้อมูลในการขอลบ/ขอสำเนาข้อมูลตนเอง
6. **`reading_history` ไม่มี RLS policy สำหรับ DELETE เลย** — ผู้ใช้ไม่สามารถลบประวัติการอ่านของตัวเองได้แม้จะมี UI (ซึ่งก็ไม่มีเช่นกัน) เพราะฐานข้อมูลเองก็ปฏิเสธ ต้องแก้ทั้ง RLS และเพิ่ม UI
7. **Session cookie ไม่ได้ตั้งค่า `secure`/`sameSite` อย่างชัดเจนในโค้ด** — ใช้ค่าเริ่มต้นของ `@supabase/ssr` (`httpOnly:false, sameSite:"lax"`, ไม่มี `secure` เลย) ต้องพึ่งพาชั้น hosting (เช่น Vercel) บังคับ HTTPS/HSTS เอง — **ต้องตรวจสอบการตั้งค่าจริงของสภาพแวดล้อม production**

### Medium

8. สิทธิ์ระดับ **admin (rank 40)** สามารถระงับบัญชี/กำหนดบทบาท (ยกเว้น super_admin)/อ่าน audit log ทั้งหมดได้ โดย**ไม่ต้องมี MFA เลย** (MFA บังคับเฉพาะ `/superadmin` เท่านั้น) — เป็นการออกแบบที่สมเหตุสมผลแต่ควรพิจารณาบังคับ MFA สำหรับ action ที่มีผลกระทบสูง (ระงับบัญชี, เปลี่ยนบทบาท) แม้ไม่ต้องบังคับทั้งหน้า dashboard
9. ไม่มีเครื่องมือ **"บังคับรีเซ็ตรหัสผ่าน" โดยแอดมิน** — มีแค่ MFA reset ไม่มี force-password-reset สำหรับกรณีบัญชีถูกบุกรุก
10. `markNotificationReadAction`/`markAllNotificationsReadAction` (`components/layout/notification-actions.ts:8-28`) ไม่มีการกรองด้วย `user_id` ของผู้ใช้ที่ล็อกอินในโค้ดแอปเอง พึ่ง RLS (`notifications_update_own`) เพียงชั้นเดียว — ปลอดภัยในปัจจุบันแต่ไม่มี defense-in-depth
11. ไม่มี **pagination** ในรายชื่อผู้ใช้ทั้งของ `/dashboard/users` และ `/superadmin/users` — ดึงทุกแถวมาเสมอ เป็นความเสี่ยงด้าน performance เมื่อจำนวนผู้ใช้เพิ่มขึ้น
12. ไม่มี automated test ครอบคลุม flow สำคัญของ Area G โดยตรง (grant/revoke super_admin, MFA reset, trigger กัน super_admin คนสุดท้าย, RLS ของ audit_logs)
13. ไม่มีฟีเจอร์ **ออกจากระบบทุกอุปกรณ์ (logout ทุก session)** และไม่มีหน้า **ประวัติการเข้าสู่ระบบ/อุปกรณ์ที่ใช้งาน** ให้ผู้ใช้ตรวจสอบ

### Low

14. ไม่มีระบบสลับภาษา (UI เป็นภาษาไทยแบบ hardcode ทั้งหมด, ไม่มี i18n library)
15. คอลัมน์ `profiles.avatar_url` มีอยู่ในฐานข้อมูลแต่ไม่มี UI อัปโหลดจริงเลย (คอลัมน์ตาย)
16. อีเมลแจ้งเตือนที่แอปส่งเอง (ผ่าน Resend, `lib/notifications/email.server.ts`) เป็น plain text ล้วน ไม่มี HTML/branding และ template อีเมลของ Supabase Auth เอง (ยืนยันสมัคร/รีเซ็ตรหัสผ่าน) ยังไม่ถูกปรับแต่งในไฟล์ config (`[auth.email.template.*]` ถูก comment ไว้ใน `supabase/config.toml`) — **ต้องตรวจสอบว่ามีการตั้งค่าแยกบน Supabase Dashboard ของ production หรือไม่**
17. หน้า `/access-requests` ไม่มี `loading.tsx`/`error.tsx` ต่างจากหน้าอื่นในกลุ่มเดียวกัน (favorites, reading-history, notifications)
18. ไม่มีฟีเจอร์ "ติดตามนักวิจัย/ผู้เขียน" (มีแค่ "ติดตามหมวดหมู่")

## สิ่งที่ทำได้ดีอยู่แล้ว (จุดแข็ง)

- **ป้องกันการยกระดับสิทธิ์ (privilege escalation) แน่นหนามาก**: การมอบ/ถอดถอนบทบาท `super_admin` ถูกบังคับทั้งที่แอป (`requireMinRank(50)` + พิมพ์ยืนยัน "CONFIRM"/อีเมลเป้าหมาย) **และ**ที่ระดับ RLS ของฐานข้อมูล (`supabase/migrations/20260802100100_super_admin_role.sql:54-76` — บังคับ rank≥50 เฉพาะแถวที่ role_id ชี้ไป super_admin) ตรวจสอบแล้วว่า admin (rank 40) **ไม่มีทาง**มอบสิทธิ์ super_admin ให้ตัวเองหรือใครได้เลย แม้จะเรียก Supabase API ตรงๆ ข้ามหน้าเว็บทั้งหมดก็ตาม — เป็นการควบคุมสองชั้นที่ทำถูกต้องตามหลักการ "อย่าเชื่อ UI อย่างเดียว"
- **มี trigger ระดับฐานข้อมูลกันถอดถอน Super Admin คนสุดท้าย** ทำงานทุกเส้นทาง (ผ่านแอป/SQL ตรง/cascade delete) ไม่ใช่แค่ตรวจที่แอป
- **MFA reset workflow ออกแบบดีมาก**: บังคับพิมพ์ยืนยัน "RESET MFA" + เหตุผลบังคับ, ห้ามรีเซ็ตของตัวเอง, log ทั้งกรณีสำเร็จและล้มเหลว, แจ้งเตือนเจ้าของบัญชีทั้งในแอปและอีเมลเสมอ (ไม่ใช่การลบเงียบๆ)
- **Audit log เขียนได้ทางเดียว (insert-only)**: ไม่มี GRANT หรือ RLS policy ใดอนุญาตให้ `authenticated` role แก้ไข/ลบแถวใน `audit_logs` เลย ตรวจสอบทั้ง GRANT statement และ RLS policy แล้วยืนยัน
- **ไม่พบการเก็บข้อมูลส่วนบุคคลที่ไม่จำเป็น**: ไม่มีเลขบัตรประชาชน วันเกิด ที่อยู่ เบอร์โทร เพศ หรือข้อมูลสุขภาพใดๆ ในสคีมาหรือฟอร์มใดเลย — เก็บแค่ชื่อ-นามสกุล, อีเมล, รหัสผ่าน (ผ่าน Supabase Auth), หน่วยงาน/สังกัด (free text ไม่บังคับ) เท่านั้น
- **RLS/IDOR ของ Server Action ที่ตรวจแบบสุ่มทั้งหมดปลอดภัย**: `toggleFavoriteAction`, `requestDownloadUrlAction`, `updateProfileAction` กรองด้วย `auth.getUser()` ของผู้ใช้จริงเสมอ ไม่เชื่อ id จาก client
- **ไม่พบ raw Postgres error หลุดไปที่ UI**: มี helper กลาง `toSafeErrorMessage()` ใช้แพร่หลาย และมีการแก้ไขจุดที่เคยหลุดไปแล้วในอดีต (บันทึกไว้ใน `lib/errors/safe-message.server.test.ts`)
- **การระงับบัญชี (suspend) ใช้ Supabase Auth Admin `ban_duration` จริง** ไม่ใช่แค่ flag สวยงาม — ตัดการเข้าถึงจริง รองรับทั้งถาวรและชั่วคราว ป้องกันการระงับบัญชีตัวเอง
- **ORCID integration ขอบเขตแคบและปลอดภัย**: ขอ scope แค่ `/authenticate`, ต้อง staff เชื่อมโยงบัญชีนักวิจัยไว้ก่อน, token จริงเก็บแยกในตารางที่ล็อกด้วย RLS ให้ `service_role` เท่านั้น
- **มีชุดทดสอบอัตโนมัติที่ครอบคลุมสิทธิ์ตามบทบาทจริง**: `lib/data/research-search-rls.integration.test.ts` (28 เคส), `e2e/auth-verification.spec.ts`, `e2e/header-roles.spec.ts` ทดสอบครบ guest ถึง super_admin

---

# 2. Feature Inventory

สถานะ: **Implemented** (ทำงานสมบูรณ์) / **Partial** (ทำงานบางส่วน/มีข้อจำกัด) / **Missing** (ไม่มี) / **Not verified** (ต้องตรวจสอบด้วยตนเอง เช่น การตั้งค่า production ที่ไม่ได้อยู่ในโค้ด)

## A. บัญชีและการยืนยันตัวตน

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| สมัครสมาชิก | Implemented | `app/register/actions.ts` | มี rate limit (`checkRateLimit`, บรรทัด 36-46), CAPTCHA แบบมีเงื่อนไข (`verifyCaptchaIfEnabled`, บรรทัด 48-54), validate ด้วย Zod (`lib/validation/auth.ts`) | CAPTCHA เปิด/ปิดได้ผ่าน `settings.captchaEnabled` — ต้องยืนยันว่าเปิดจริงบน production |
| เข้าสู่ระบบ | Implemented | `app/login/actions.ts` | ใช้ `supabase.auth.signInWithPassword` มาตรฐาน, validate redirect target ป้องกัน open-redirect (บรรทัด 43-46) | **ไม่มี rate limit/CAPTCHA ระดับแอป** — ดู Critical #3 |
| ออกจากระบบ | Implemented | `components/auth/LogoutButton.tsx` | เรียก `supabase.auth.signOut()` ตามมาตรฐาน | ไม่มีตัวเลือก "ออกจากทุกอุปกรณ์" (scope: "global") |
| ยืนยันอีเมล (email verification) | Implemented แต่ **ปิดอยู่ใน local config** | `supabase/config.toml:226` (`enable_confirmations = false`), คอมเมนต์ยืนยันใน `app/register/actions.ts:94` | โค้ดแอปรองรับทั้งสองกรณี (มี/ไม่มี `data.session` หลังสมัคร) | **Not verified**: ค่านี้เป็น local dev config เท่านั้น ต้องตรวจสอบว่า production Supabase project เปิด email confirmation หรือไม่ — ถ้ายังปิดอยู่จริง ถือเป็นความเสี่ยงสูง (ใครก็สมัครด้วยอีเมลปลอม/ของคนอื่นได้) |
| ลืม/รีเซ็ตรหัสผ่าน | Implemented | `app/auth/forgot-password/actions.ts`, `app/auth/reset-password/actions.ts` | ป้องกัน user enumeration (ไม่บอกว่ามีอีเมลนี้ในระบบหรือไม่ เว้นแต่โดน rate limit, บรรทัด 47-51), ตรวจ session จาก recovery link ก่อน update (`reset-password/actions.ts:37-47`) | ไม่มี rate limit/CAPTCHA ระดับแอป (พึ่ง GoTrue) |
| เปลี่ยนรหัสผ่าน (ขณะล็อกอินอยู่) | **Missing** | ค้นทั้ง `app/account/**` แล้วไม่พบ | มีแค่ `updateProfileAction` (ชื่อ/หน่วยงานเท่านั้น) | ผู้ใช้ต้องใช้ flow "ลืมรหัสผ่าน" เพื่อเปลี่ยนรหัสผ่านเสมอ แม้จำรหัสเดิมได้ — UX gap |
| เปลี่ยนอีเมล + ยืนยันอีเมลใหม่ | **Missing** | ค้นทั้งรีโปแล้วไม่พบ `updateEmail`/`changeEmail` ใดๆ | `supabase/config.toml:224` มี `double_confirm_changes = true` (พร้อมใช้งานฝั่ง Supabase) แต่แอปไม่มี UI/action เรียกใช้เลย | ฟีเจอร์พื้นฐานที่คาดหวังแต่ยังไม่มี |
| ล็อกบัญชี/rate limiting/CAPTCHA (ภาพรวม) | Partial | `lib/rate-limit.server.ts`, `lib/captcha.server.ts`, `components/auth/TurnstileWidget.tsx` | มีเฉพาะ register/submit-research (rate limit+CAPTCHA) และ access-request (rate limit อย่างเดียว) — login/forgot-password **ไม่มีทั้งคู่** ทั้ง rate-limit และ captcha helper ออกแบบ "fail-open" เมื่อระบบตรวจสอบเองล้มเหลว | ดู Critical #3 |
| Session refresh / expired-session handling | Implemented, ทดสอบแล้ว | `lib/supabase/middleware.ts`, `lib/supabase/session.ts` (ห่อด้วย React `cache()`) | ตรวจสอบและทดสอบละเอียดแล้วใน audit แยกก่อนหน้า — ดู `docs/auth-verification-audit.md` และ `e2e/auth-verification.spec.ts` (กรณี token เสียหาย/ปลอมแปลงถูกปฏิบัติเหมือน guest ไม่ crash ไม่ bypass) | จัดการกรณีนาฬิกาคลาดเคลื่อน (clock skew) ไว้แล้วเช่นกัน |
| ออกจากระบบทุกอุปกรณ์ | **Missing** | ค้นทั้งรีโปแล้วไม่พบการเรียก `signOut({scope:"global"})` หรือเทียบเท่า | — | มีแค่การระงับบัญชีโดยแอดมิน (`ban_duration`) ซึ่งตัดการเข้าถึงจริงแต่เป็น admin-initiated ไม่ใช่ self-service |
| ประวัติการเข้าสู่ระบบ/อุปกรณ์ที่ใช้งาน | **Missing** | ค้นทั้งรีโปแล้วไม่พบ | — | ผู้ใช้ไม่มีทางเห็นว่าบัญชีตัวเอง login จากที่ไหนบ้าง |
| ปิดใช้งาน/ลบ/กู้คืนบัญชี (self-service) | **Missing** | ค้นทั้ง `app/account/**` แล้วไม่พบ | มีแค่การระงับ (suspend) โดยแอดมินเท่านั้น (`app/superadmin/users/actions.ts:129-196`, `app/dashboard/users/actions.ts` ส่วน `toggleUserActiveAction`) ซึ่งเป็นฝั่งแอดมิน ไม่ใช่ self-service | ดู High #5 |

## B. โปรไฟล์ส่วนตัว

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| ชื่อ-นามสกุล / ชื่อที่แสดง | Implemented | `components/auth/ProfileForm.tsx:37-62`, `app/account/actions.ts` | บังคับกรอก, 2-120 ตัวอักษร (`lib/validation/profile.ts:4-7`) | — |
| อีเมล | Implemented (แสดงผลอย่างเดียว) | `app/account/page.tsx:70-72` | แสดงจาก `profiles.email`/`user.email` | แก้ไขไม่ได้ (ดู A — เปลี่ยนอีเมล) |
| รูปโปรไฟล์ (avatar) | **Missing** (คอลัมน์มีแต่ UI ไม่มี) | schema: `supabase/migrations/20260731100000_schema.sql:64` (`avatar_url text`) | ค้น `avatar` ทั่วรีโปแล้วไม่พบ UI อัปโหลดใดๆ ไม่มี storage bucket สำหรับ avatar โดยเฉพาะ (`storage_buckets.sql` มีแค่ research-documents/covers/submission-attachments) | คอลัมน์ตาย ควรตัดออกหรือทำฟีเจอร์จริง |
| หน่วยงาน/แผนก/ตำแหน่ง | Partial | `components/auth/ProfileForm.tsx:64-77` | มีแค่ช่อง "หน่วยงาน/สังกัด" เดียว เป็น free text ไม่บังคับ ไม่ผูกกับตาราง `organizations` จริง (ต่างจาก `organization_id` ที่มีในสคีมาแต่ฟอร์มไม่ได้ใช้) | ไม่มีแผนก/ตำแหน่งงานแยกเป็นฟิลด์ — เหมาะสมกับหลัก data minimization อยู่แล้ว ไม่แนะนำให้เพิ่มเว้นแต่มีความจำเป็นทางธุรกิจชัดเจน |
| เบอร์โทรศัพท์ | **Missing** | ไม่มีคอลัมน์นี้ในตาราง `profiles` เลย | — | สอดคล้องหลัก data minimization — **ไม่แนะนำให้เพิ่ม** เว้นแต่มีเหตุผลทางธุรกิจชัดเจน |
| ข้อมูลนักวิจัย/ORCID | Implemented, ขอบเขตแคบ | `lib/orcid/orcid-oauth.server.ts`, `app/account/orcid-actions.ts` | ขอ scope แค่ `/authenticate` (บรรทัด 37), ต้อง staff เชื่อมบัญชีนักวิจัยไว้ก่อนจึงเชื่อม ORCID เองได้ (`orcid-actions.ts:38-49`), token จริงเก็บแยกใน `orcid_oauth_tokens` ที่ RLS ล็อกให้ `service_role` เท่านั้น | ออกแบบดี ความเสี่ยงต่ำ |
| แก้ไขโปรไฟล์ + validation | Implemented | เช่นเดียวกับข้างต้น | Zod validation ทั้ง client/server | — |
| ฟิลด์บังคับ vs ไม่บังคับ | Implemented | `lib/validation/profile.ts` (app layer), `supabase/migrations/20260731100000_schema.sql:58-67` (DB layer) | App บังคับ `fullName` แต่ DB เองอนุญาต NULL ได้ (มีแค่ `id` เป็น NOT NULL) | ช่องว่างเล็กน้อยระหว่างชั้น validation — ความเสี่ยงต่ำ (ไม่มีทาง insert ตรงได้นอกจาก trigger `handle_new_user`) |
| Data minimization | **ตรวจสอบแล้ว — ไม่พบข้อมูลเกินความจำเป็น** | ค้นทั่วรีโปหา วันเกิด/เลขบัตรประชาชน/ที่อยู่/เพศ/ศาสนา/ข้อมูลสุขภาพ | ไม่พบเลยแม้แต่รายการเดียว มีแค่ `download_logs.ip_address` ซึ่งเป็น log ป้องกันการละเมิด ไม่ใช่ฟิลด์โปรไฟล์ | จุดแข็งที่ควรรักษาไว้ |

## C. บทบาทและสิทธิ์

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| สิทธิ์ตามบทบาท (guest→super_admin) | Implemented | `middleware.ts` (`LOGIN_REQUIRED_PREFIXES`/`ROLE_REQUIRED_PREFIXES`), RLS ทุกตารางหลัก | guest: เห็นเฉพาะ public/read_only/metadata_only; member(10): +favorites/access-requests/member_only; staff(20): +submit-research/my-submissions/staff_only; librarian(30): +/dashboard; admin(40): +จัดการผู้ใช้/บทบาท(ยกเว้น super_admin)/audit log; super_admin(50): +/superadmin ทั้งหมด (ต้อง MFA) | RLS ใช้ `rank >= N` ไม่ใช่ `= N` — บทบาทสูงกว่าได้สิทธิ์บทบาทต่ำกว่าอัตโนมัติเสมอ |
| ผู้ใช้หนึ่งคนมีได้หลายบทบาท | Implemented (ระดับ schema) | `supabase/migrations/20260731100000_schema.sql:74-80` (`user_roles`, unique(user_id, role_id)) | ออกแบบเป็น many-to-many ตั้งแต่ต้น — `addUserRoleAction`/`removeUserRoleAction` เป็นแบบเพิ่ม/ลบ ไม่ใช่แทนที่ | — |
| ใครกำหนด/ถอดถอนบทบาทได้ | Implemented | `app/dashboard/users/actions.ts` (rank≥40, บทบาททั่วไป), `app/superadmin/users/actions.ts` (rank≥50, ทุกบทบาทรวม super_admin) | `ASSIGNABLE_ROLES`/`GENERIC_ASSIGNABLE_ROLES` กันไม่ให้ admin ทั่วไปแตะ super_admin ได้เลยแม้ผ่าน action ทั่วไป | ออกแบบถูกต้อง |
| UI ปลอดภัย/อนุมัติ/audit trail สำหรับ Super Admin | Implemented | `app/superadmin/users/actions.ts:243-384` | ต้องพิมพ์ "CONFIRM" หรืออีเมลผู้ใช้เป้าหมาย, บันทึก audit พร้อม `previous_roles`/`new_roles`/`reason` | ครบทั้งสามอย่างที่ audit spec ถามถึง (safe UI + approval + audit trail) |
| ป้องกันการยกระดับสิทธิ์ | **ตรวจสอบแล้ว — ผ่าน** | RLS `user_roles_admin_insert`/`_delete` (`20260802100100_super_admin_role.sql:54-76`) | บังคับ rank≥50 เฉพาะแถวที่พาดพิง super_admin **ที่ระดับฐานข้อมูล** ไม่ใช่แค่ที่แอป — ทดสอบแนวคิดโดยไล่อ่าน migration ล่าสุดที่ override ของเดิมแล้ว ยืนยันว่าไม่มี migration ใดในภายหลังผ่อนคลายกฎนี้อีก | จุดแข็งสำคัญที่สุดของระบบสิทธิ์ |
| RLS จริง vs UI-only | Implemented ถูกต้อง (ตรวจสุ่มแล้ว) | ดูตาราง H ด้านล่าง | `toggleFavoriteAction`/`updateProfileAction` กรองด้วย `auth.getUser()` จริงเสมอ, RLS เป็นด่านสุดท้ายที่ยืนยันอิสระจากแอป | — |
| Action ที่ต้องยืนยันตัวตนล่าสุด/MFA | Partial | มีเฉพาะ `/superadmin` (`middleware.ts` เช็ค `aal2`, `requireMinRank(50)` เช็ค `aal2` ซ้ำใน `lib/data/admin-guard.server.ts`) | Action ระดับ admin (ระงับบัญชี, เปลี่ยนบทบาททั่วไป, อ่าน audit log) **ไม่บังคับ MFA เลย** | ดู Medium #8 — ควรพิจารณาเพิ่มสำหรับ action ที่กระทบผู้ใช้อื่นโดยตรง |

## D. MFA และการกู้คืนบัญชี

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| ลงทะเบียน/ยืนยัน MFA (TOTP) | Implemented | `components/account/MfaSettings.tsx` | ใช้ `supabase.auth.mfa.enroll/challengeAndVerify` มาตรฐานของ Supabase, แสดง QR code + secret สำรอง | — |
| MFA สมัครใจสำหรับบทบาทอื่นที่ไม่ใช่ super_admin | Implemented | `MfaSettings.tsx:126-138` | ทุกบทบาทเปิดใช้ MFA ได้ด้วยตัวเอง แม้ไม่บังคับ | — |
| MFA กู้คืน/อุปกรณ์หาย (self-service) | **Missing — ไม่มี recovery/backup code เลย** | ค้นทั้งรีโปหา "recovery"/"backup code" แล้วไม่พบ | ผู้ใช้ทั่วไปที่ทำอุปกรณ์หายและมีแค่ factor เดียวจะ**ล็อกตัวเองออกจากขั้น MFA ของ session นั้นถาวร**จนกว่าจะมีคนช่วย (สำหรับ super_admin คือให้ super_admin คนอื่นรีเซ็ตให้) | ดู Critical #2 สำหรับกรณี super_admin คนเดียว |
| Super Admin รีเซ็ต MFA ให้ผู้อื่น | Implemented, ออกแบบดี | `app/superadmin/users/actions.ts:395-500`, `lib/security/mfa-admin.server.ts` | บังคับพิมพ์ "RESET MFA" + เหตุผล, ห้ามรีเซ็ตตัวเอง, audit log ทั้งสำเร็จ/ล้มเหลว, แจ้งเตือนเจ้าของบัญชีทั้งในแอปและอีเมลเสมอ | จุดแข็ง |
| บังคับ MFA สำหรับบทบาทสิทธิ์สูง | Partial | `middleware.ts` (เฉพาะ `/superadmin`, rank≥50) | admin (rank 40) ไม่ถูกบังคับ MFA เลยทั้งที่มีสิทธิ์ระงับบัญชี/จัดการบทบาท | ดู Medium #8 |
| Audit log/แจ้งเตือนสำหรับเหตุการณ์ MFA/ความปลอดภัย | Implemented | `resetUserMfaAction` (ดูข้างต้น) | ครบทั้ง audit log และแจ้งเตือนสองช่องทาง | — |

## E. ประสบการณ์ผู้ใช้ (สมาชิก)

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| หน้าโปรไฟล์ | Implemented | `app/account/page.tsx` | ครบ: โปรไฟล์, MFA, ORCID, ลิงก์ด่วน | — |
| รายการโปรด (Favorites) | Implemented ครบ CRUD + empty/loading/error state | `app/favorites/**`, `lib/data/favorites.server.ts:8-34` | มี `loading.tsx`/`error.tsx`/empty state ครบ, RLS 3 policy (select/insert/delete own) | — |
| ประวัติการอ่าน/ดาวน์โหลด | Partial | `app/reading-history/page.tsx`, tracking ผ่าน RPC `log_reading_history` | เก็บอัตโนมัติ**ไม่มีทางเลือกปิด** และ**ลบไม่ได้เลย** (ไม่มี RLS DELETE policy) | ดู High #6 |
| ประวัติคำขอเข้าถึงเอกสาร | Implemented (ขาด loading/error boundary) | `app/access-requests/page.tsx`, `lib/data/access-requests.server.ts` | มี filter สถานะ + ยกเลิกคำขอที่ pending ได้ | ไม่มี `loading.tsx`/`error.tsx` ต่างจากหน้าอื่น |
| ตั้งค่าการแจ้งเตือน | Implemented | `app/profile/notification-settings/**` | toggle แยก 2 หมวด × ช่องทาง (ในแอป/อีเมล) | ไม่มีการแยก marketing/essential เพราะทั้งหมดเป็น functional notification อยู่แล้ว (ไม่มี marketing) |
| ติดตามหมวดหมู่/นักวิจัย | Partial | `lib/data/category-subscriptions.server.ts` | มีติดตามหมวดหมู่ ไม่มีติดตามนักวิจัย/ผู้เขียนเลย | Feature gap ไม่ใช่ความเสี่ยง |
| ธีมสี (light/dark) | Implemented | `components/layout/ThemeProvider.tsx` | ใช้ `next-themes` เต็มรูปแบบ | — |
| ภาษา | **Missing** | ค้นทั้งรีโปหา i18n library/language switcher แล้วไม่พบ | UI เป็นไทย hardcode ทั้งหมด | ไม่ใช่ความเสี่ยง เป็นข้อจำกัดที่ควรทราบ |
| Empty/loading/error/expired-session state | Partial | favorites/reading-history/notifications มีครบ, access-requests ขาด loading/error | ดูรายละเอียดแต่ละแถวข้างต้น | — |

## F. ความเป็นส่วนตัวและการควบคุมข้อมูลส่วนบุคคล

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| หน้านโยบายความเป็นส่วนตัว/ข้อกำหนดการใช้งาน | **Missing** | ค้นทั่วรีโป (routes, footer, full-text search) แล้วไม่พบ | ดู Critical #1 | ต้องทำก่อน production เพราะมี checkbox อ้างถึงอยู่แล้ว |
| Consent ตอนสมัครสมาชิก | Partial (มี checkbox แต่ไม่มีนโยบายให้เชื่อมโยง) | `components/auth/RegisterForm.tsx:127-130` | บังคับกาก่อนสมัครได้ แต่ข้อความเป็น plain text ไม่มีลิงก์ | ดู Critical #1 |
| Cookie consent banner | **Missing** | ค้นทั่วรีโปแล้วไม่พบ | — | ควรประเมินว่าจำเป็นตามกฎหมายที่บังคับใช้หรือไม่ |
| อธิบายว่าเก็บข้อมูลอะไร/ทำไม | **Missing** (ผูกกับการไม่มีหน้านโยบาย) | — | — | รวมอยู่ในงานทำหน้านโยบาย |
| Consent การแจ้งเตือนเชิงการตลาด | ไม่เกี่ยวข้อง (ไม่มี marketing notification ในระบบ) | `lib/data/notification-preferences.server.ts` | ทั้งสองหมวดที่มีเป็น functional/transactional ล้วน | — |
| ขอสำเนาข้อมูลของฉัน (data export) | **Missing** | ค้นทั่วรีโปแล้วไม่พบ | — | ดู High #5 |
| ลบบัญชี/ข้อมูลของฉัน (self-service) | **Missing** | ค้นทั่วรีโปแล้วไม่พบ | มีแค่ระงับบัญชีโดยแอดมิน | ดู High #5 |
| นโยบายเก็บรักษาข้อมูล (audit log/บัญชี/ประวัติดาวน์โหลด) | **Missing** เกือบทั้งหมด | `lib/jobs/handlers/maintenance-cleanup.server.ts` (มีแค่ `rate_limit_events`, เก็บ 7 วัน) | `audit_logs`/`download_logs`/`reading_history` ไม่มี purge job ใดๆ | ดู High #4 |
| หลีกเลี่ยงการเก็บข้อมูลอ่อนไหวโดยไม่จำเป็น | **ตรวจสอบแล้ว — ผ่าน** | เช่นเดียวกับ Area B | ไม่พบข้อมูลอ่อนไหวใดๆ ในระบบ | จุดแข็ง |

## G. การบริหารจัดการโดยแอดมิน

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| ค้นหา/กรองรายชื่อผู้ใช้ | Implemented (เฉพาะ superadmin), Partial (dashboard) | `lib/data/superadmin-users.server.ts:26-87` (ค้นหา+กรองสถานะ+บทบาท), `lib/data/admin-users.server.ts:17-56` (ดึงทั้งหมด ไม่มีตัวกรอง) | — | ควรเพิ่มตัวกรองใน `/dashboard/users` ให้เท่ากับ `/superadmin/users` |
| Pagination รายชื่อผู้ใช้ | **Missing** | ทั้งสองไฟล์ข้างต้น | ไม่มี `.range()`/`.limit()` เลย ดึงทุกแถวเสมอ | ความเสี่ยงด้าน performance เมื่อ scale |
| ดูโปรไฟล์/บทบาทของผู้ใช้อย่างปลอดภัย | Implemented | `app/superadmin/users/[id]/page.tsx` | แสดงชื่อ/อีเมล/หน่วยงาน/วันที่สมัคร/บทบาท/สถานะ MFA/ประวัติกิจกรรม (จำกัด 20 แถวล่าสุด) | ไม่พบการเปิดเผยข้อมูลอ่อนไหวเกินจำเป็น (ไม่มีเบอร์โทรในสคีมาอยู่แล้ว) |
| ระงับ/เปิดใช้งานบัญชี | Implemented | `app/superadmin/users/actions.ts:129-196` (ถาวร+ชั่วคราว), `app/dashboard/users/actions.ts` (ถาวรเท่านั้น) | ใช้ Supabase Auth Admin `ban_duration` จริง ไม่ใช่ flag ผิวเผิน, กันระงับบัญชีตัวเอง | — |
| บังคับรีเซ็ตรหัสผ่านโดยแอดมิน | **Missing** | ค้นทั่ว `app/superadmin/**`/`app/dashboard/**` แล้วไม่พบ | มีแค่ MFA reset | ดู Medium #9 |
| รีเซ็ต MFA โดยแอดมิน | Implemented, ออกแบบดี | ดู Area D | — | — |
| Audit log สำหรับการเปลี่ยนแปลงผู้ใช้/โปรไฟล์/บทบาท/ความปลอดภัย | Implemented | `lib/data/audit.server.ts`, เรียกใช้ทั่ว `app/dashboard/**/actions.ts`/`app/superadmin/**/actions.ts` | ครอบคลุม user_role_add/remove, user_enable/suspend, super_admin_grant/revoke, mfa_reset และอื่นๆ | ไม่ครอบคลุม 100% ของทุก action ในระบบ (เช่น การแก้ไขโปรไฟล์ตัวเองไม่ได้ log) แต่ครอบคลุม action ที่มีผลต่อสิทธิ์/ความปลอดภัยครบ |
| ใครอ่าน audit log ได้ | Implemented, RLS-enforced | RLS `audit_logs_select_admin`: `rank >= 40` | ทั้ง admin และ super_admin อ่านได้ทั้งระบบ (ไม่แยกตามหน่วยงาน) | สมเหตุสมผลตามขอบเขตสิทธิ์ที่ admin มีอยู่แล้ว |
| ไม่มี raw Postgres error หลุดไปที่ UI | **ตรวจสอบแล้ว — ผ่าน** | `lib/errors/safe-message.server.ts` + การใช้งานแพร่หลาย | มีบันทึกกรณีที่เคยหลุดและถูกแก้แล้วในอดีต (`lib/errors/safe-message.server.test.ts`) | จุดแข็ง แต่ควรมี lint rule/code review checklist กันไม่ให้เกิดซ้ำในอนาคต |
| ไม่เปิดเผยข้อมูลอ่อนไหวเกินจำเป็นแก่เจ้าหน้าที่ | **ตรวจสอบแล้ว — ผ่าน** (เพราะไม่มีข้อมูลอ่อนไหวในสคีมาอยู่แล้ว) | — | librarian ขึ้นไป (rank≥30) เห็นโปรไฟล์ทุกคนได้ (`profiles_select_own_or_staff`) แต่ข้อมูลที่เห็นมีแค่ชื่อ/อีเมล/หน่วยงาน | เหมาะสมกับความจำเป็นในการระบุตัวตนผู้ขอเอกสาร |

## H. การตรวจสอบความปลอดภัย

| Feature | Status | Where | Evidence | Risk/Notes |
|---|---|---|---|---|
| Authorization test ทุกบทบาท | Implemented | `e2e/auth-verification.spec.ts`, `e2e/header-roles.spec.ts` | ทดสอบ guest+5 บทบาท: login/logout, role gate matrix (หน้าที่เข้าได้/ถูกเด้ง 403), token เสียหาย, สิทธิ์ดาวน์โหลดจริง | ครอบคลุมดี แต่ไม่ครอบคลุม flow ของ Area G (grant/revoke super_admin, MFA reset) — ดู Medium #12 |
| RLS test | Implemented | `lib/data/research-search-rls.integration.test.ts` (28 เคส) | ทดสอบการมองเห็นเอกสารตาม access_level×role จริงกับฐานข้อมูลจริง | เป็นชุดทดสอบ RLS ที่ครอบคลุมที่สุดในระบบ แต่จำกัดอยู่ที่ตาราง `research_items`/`research_document_texts` เท่านั้น ไม่ครอบคลุม `user_roles`/`audit_logs`/`profiles` โดยตรง |
| Server Action/API authorization | Implemented (สุ่มตรวจแล้วปลอดภัย) | ดูแถว IDOR ด้านล่าง | — | — |
| IDOR — สมาชิกเข้าถึงข้อมูลสมาชิกอื่นไม่ได้ | Implemented ส่วนใหญ่, มีจุดอ่อนหนึ่งจุด | `toggleFavoriteAction`/`updateProfileAction` ปลอดภัย (กรอง `user_id` เอง); `markNotificationReadAction`/`markAllNotificationsReadAction` (`components/layout/notification-actions.ts:8-28`) พึ่ง RLS อย่างเดียว ไม่กรอง `user_id` ในโค้ดแอป | ปัจจุบันปลอดภัยเพราะ RLS `notifications_update_own` ถูกต้อง แต่ไม่มี defense-in-depth | ดู Medium #10 |
| Session cookie security | Partial / Not verified | `lib/supabase/server.ts`, `lib/supabase/middleware.ts` | ไม่มีการ override `httpOnly`/`secure`/`sameSite` เลย ใช้ค่าเริ่มต้นของ `@supabase/ssr` (`httpOnly:false, sameSite:"lax"`, ไม่มี `secure`) | ดู High #7 — ต้องตรวจสอบว่า hosting บังคับ HTTPS/Secure cookie หรือไม่ |
| ข้อมูลอ่อนไหวหลุดใน log/error/HTML/browser storage/API response | **ตรวจสอบแล้ว — ไม่พบ** | ค้นทั่วรีโปหา `console.log` ของ token/session/user object และตรวจ `app/api/**/route.ts` ทั้ง 6 ไฟล์ | ไม่พบการ log ข้อมูลอ่อนไหว, API routes คืน error message ทั่วไปเสมอ | จุดแข็ง |
| Rate limiting/CAPTCHA ที่มีอยู่ | Partial | ดูตาราง Area A | register+submit-research มีครบ, access-request มีแค่ rate limit, login+forgot-password **ไม่มีเลย** | ดู Critical #3 |
| Audit log integrity/สิทธิ์เข้าถึง | **ตรวจสอบแล้ว — ผ่าน** | GRANT + RLS บน `audit_logs` | ไม่มี GRANT/RLS policy ใดอนุญาต UPDATE/DELETE ให้ `authenticated` role, การเขียนทุกจุดในโค้ดเป็น insert-only แม้ผ่าน `service_role` | จุดแข็ง |

---

# 3. Personal-Data Map

| ฟิลด์ข้อมูล | วัตถุประสงค์ | บังคับ? | ใครดูได้ | ที่เก็บข้อมูล | พฤติกรรมการเก็บรักษา/ลบ | คำแนะนำ |
|---|---|---|---|---|---|---|
| อีเมล | ระบุตัวตน/เข้าสู่ระบบ/ติดต่อกลับ | บังคับ (สมัครสมาชิก) | เจ้าของ, librarian ขึ้นไป (rank≥30) | `auth.users` (Supabase Auth), `public.profiles.email` | ไม่มี purge policy; ลบเมื่อบัญชีถูกลบจริงเท่านั้น (cascade) แต่ไม่มีทางลบบัญชีเองได้ | เพิ่มฟีเจอร์ลบบัญชี self-service (ดู High #5) |
| รหัสผ่าน (hash) | ยืนยันตัวตน | บังคับ | ไม่มีใครเห็นได้ (Supabase Auth จัดการ hash เอง) | `auth.users` (จัดการโดย Supabase Auth ทั้งหมด) | ตามนโยบาย Supabase Auth | — |
| ชื่อ-นามสกุล | แสดงตัวตนเมื่อส่งงานวิจัย/ขอเข้าถึงเอกสาร | บังคับ (แอปเรียก, DB ไม่บังคับ) | เจ้าของ, librarian ขึ้นไป | `public.profiles.full_name` | ไม่มี purge policy | — |
| หน่วยงาน/สังกัด (free text) | ช่วยเจ้าหน้าที่ระบุตัวตนผู้ขอเอกสาร | ไม่บังคับ | เจ้าของ, librarian ขึ้นไป | `public.profiles.organization_name` | ไม่มี purge policy | พิจารณาผูกกับตาราง `organizations` แทน free text เพื่อความสม่ำเสมอของข้อมูล |
| รูปโปรไฟล์ (avatar_url) | — (ยังไม่มีฟีเจอร์ใช้งานจริง) | ไม่บังคับ | — | `public.profiles.avatar_url` (คอลัมน์ว่างเปล่าในทางปฏิบัติ) | — | ตัดคอลัมน์ทิ้งหรือทำฟีเจอร์จริงพร้อม validation ขนาด/ประเภทไฟล์ |
| ORCID iD + ชื่อจาก ORCID | ยืนยันตัวตนนักวิจัย | ไม่บังคับ (ต้อง staff เชื่อมบัญชีนักวิจัยก่อน) | เจ้าของ, staff ขึ้นไปที่จัดการข้อมูลนักวิจัย | `public.authors.orcid`, `public.authors.orcid_oauth_verified_at` | ไม่มี purge policy | — |
| ORCID OAuth token (access/refresh) | เชื่อมต่อ ORCID API | ไม่บังคับ | ไม่มีใครผ่านแอป (RLS จำกัด `service_role` เท่านั้น) | `public.orcid_oauth_tokens` | ไม่ verified — ควรตรวจสอบว่ามี expiry/revocation flow ครบหรือไม่ | ตรวจสอบเพิ่มเติมนอกขอบเขต audit นี้ |
| ประวัติการอ่านออนไลน์ (reading_history) | สถิติ/ประวัติการใช้งาน | เก็บอัตโนมัติ ไม่มีทางเลือกปิด | เจ้าของ, librarian ขึ้นไป | `public.reading_history` | **ไม่มี purge, ไม่มีทาง DELETE เลยแม้จะเป็น RLS** | เพิ่ม RLS DELETE + UI ลบประวัติของตัวเอง, พิจารณา retention period |
| ประวัติการดาวน์โหลด (download_logs) รวม IP address | ป้องกันการละเมิด/สถิติ | เก็บอัตโนมัติ | admin ขึ้นไป (สันนิษฐาน — ไม่ได้ตรวจ RLS ตารางนี้โดยตรงในรอบนี้) | `public.download_logs` (มี `ip_address inet`) | ไม่มี purge policy | กำหนด retention period ชัดเจน (เช่น 6-12 เดือน) โดยเฉพาะ IP address ซึ่งเป็นข้อมูลส่วนบุคคลตาม PDPA |
| คำขอเข้าถึงเอกสาร (access_requests) รวมเหตุผล/หมายเหตุ | ขออนุมัติสิทธิ์เข้าถึงเอกสารจำกัด | บังคับกรอกเหตุผล | เจ้าของ, ผู้อนุมัติ (staff ขึ้นไป) | `public.access_requests` | มี auto-expire (เปลี่ยนสถานะ) แต่ไม่ลบแถวจริง | พิจารณา retention period สำหรับคำขอที่ปิดแล้ว |
| Audit log (actor, action, entity, metadata) | ตรวจสอบย้อนหลัง/ความรับผิดชอบ | ระบบสร้างอัตโนมัติ | admin ขึ้นไป (rank≥40) | `public.audit_logs` | **ไม่มี purge เลย เก็บถาวร** | กำหนด retention period ตามข้อกำหนดกฎหมาย/องค์กร (เช่น 1-2 ปี) แล้วเก็บถาวรแบบ archive แยกหากต้องการเก็บนานกว่านั้น |
| ตั้งค่าการแจ้งเตือน (notification_preferences) | ควบคุมช่องทางแจ้งเตือน | ไม่บังคับ (มีค่า default) | เจ้าของเท่านั้น | `public.notification_preferences` | ไม่มี purge policy | ต่ำ ไม่ใช่ประเด็นเร่งด่วน |
| หมวดหมู่ที่ติดตาม (category_subscriptions) | แจ้งเตือนงานวิจัยใหม่ตามหมวดหมู่ | ไม่บังคับ | เจ้าของเท่านั้น | `public.category_subscriptions` | ไม่มี purge policy | ต่ำ |

**หมายเหตุสำคัญ**: ไม่พบการเก็บ เลขบัตรประชาชน, วันเกิดเต็ม, ที่อยู่บ้าน, ข้อมูลสุขภาพ หรือข้อมูลอ่อนไหวอื่นใดในระบบเลย — **ไม่มีคำแนะนำให้เพิ่มข้อมูลประเภทนี้** ในแผนงานข้างล่าง สอดคล้องกับข้อกำหนดของ audit นี้

---

# 4. Recommended Work Plan

## 4.1 Required before production (ต้องทำก่อนเปิดใช้งานจริง)

| # | รายการ | Priority | ไฟล์/ตาราง/route ที่เกี่ยวข้อง | เหตุผล | Acceptance Criteria | ขนาดงาน |
|---|---|---|---|---|---|---|
| 1 | สร้างหน้านโยบายความเป็นส่วนตัว + ข้อกำหนดการใช้งาน แล้วเชื่อมลิงก์จาก checkbox สมัครสมาชิก | Critical | `app/register/**` (หน้าใหม่ เช่น `app/privacy/page.tsx`, `app/terms/page.tsx`), `components/auth/RegisterForm.tsx:127-130`, `components/layout/Footer.tsx` | Checkbox ยินยอมปัจจุบันอ้างถึงเอกสารที่ไม่มีอยู่จริง — ไม่มีผลทางกฎหมาย เสี่ยงผิด PDPA | มีหน้านโยบายจริงอธิบายข้อมูลที่เก็บ/วัตถุประสงค์/สิทธิ์เจ้าของข้อมูล, checkbox มีลิงก์ไปหน้านั้นจริง, ลิงก์ปรากฏใน footer ด้วย | Medium |
| 2 | เพิ่ม rate limiting + CAPTCHA ระดับแอปให้หน้า login และ forgot-password | Critical | `app/login/actions.ts`, `app/auth/forgot-password/actions.ts`, ใช้ `lib/rate-limit.server.ts`/`lib/captcha.server.ts` ที่มีอยู่แล้ว | หน้า login คือเป้าหมาย brute-force/credential-stuffing สูงสุด ปัจจุบันพึ่งพา Supabase GoTrue default เท่านั้น | login/forgot-password เรียก `checkRateLimit()` ด้วย key ต่อ IP เหมือน register, CAPTCHA เปิดใช้ได้ตาม setting เดียวกับ register, มีข้อความแจ้งผู้ใช้ที่เหมาะสมเมื่อโดนจำกัด | Small |
| 3 | กำหนดนโยบายบังคับ "ต้องมี Super Admin อย่างน้อย 2 คนเสมอ" + เอกสาร runbook กรณี MFA หาย | Critical | `docs/superadmin-guide.md` (เอกสาร), อาจเพิ่ม banner เตือนใน `/superadmin/mfa-status` เมื่อเหลือ Super Admin ที่มี MFA ใช้งานได้เพียงคนเดียว | ป้องกันการล็อกตัวเองออกจากระบบถาวรหากมี Super Admin คนเดียวและอุปกรณ์หาย | มีเอกสาร runbook ชัดเจน, มี UI เตือนเมื่อจำนวน super_admin ที่มี MFA verified เหลือ ≤1 คน | Small–Medium |
| 4 | ยืนยันการตั้งค่า production Supabase Auth: `enable_confirmations` (ยืนยันอีเมล), rate limit ของ GoTrue, secure cookie/HTTPS ที่ hosting | Critical | Supabase Dashboard (นอกรีโป), `lib/supabase/server.ts`/`middleware.ts` (ถ้าต้องเพิ่ม cookie option) | ค่าที่ตรวจได้ในโค้ดเป็นเพียงค่า local dev เท่านั้น — production อาจตั้งค่าต่างไป | มีเอกสารยืนยันค่าจริงบน production ทุกค่าที่เกี่ยวข้องกับความปลอดภัยบัญชี พร้อมวันที่ตรวจสอบ | Small (ตรวจสอบ) |
| 5 | เพิ่ม RLS DELETE policy + UI ลบประวัติการอ่าน (`reading_history`) ของตัวเอง | High | migration ใหม่ (RLS), `app/reading-history/page.tsx` | ปัจจุบันผู้ใช้ลบประวัติตัวเองไม่ได้เลยแม้ที่ระดับฐานข้อมูล | มี RLS policy `reading_history_delete_own`, มีปุ่ม/action ลบทีละรายการหรือทั้งหมดในหน้า UI | Small–Medium |
| 6 | ทำฟีเจอร์ "ขอสำเนาข้อมูลของฉัน" (export) ขั้นต่ำ | High | หน้าใหม่ใน `app/account/**`, Server Action ใหม่ | สิทธิ์พื้นฐานของเจ้าของข้อมูลตาม PDPA | ผู้ใช้กดปุ่มแล้วได้ไฟล์ (JSON/CSV) สรุปข้อมูลส่วนตัว, favorites, ประวัติการอ่าน, คำขอเข้าถึงเอกสารของตนเอง | Medium |
| 7 | ทำฟีเจอร์ "ขอลบบัญชี/ข้อมูลของฉัน" (self-service, ผ่านกระบวนการอนุมัติหรือ delayed-delete ก็ได้) | High | หน้าใหม่ใน `app/account/**`, Server Action ใหม่, อาจมีตาราง `account_deletion_requests` | สิทธิ์พื้นฐานของเจ้าของข้อมูลตาม PDPA | ผู้ใช้ส่งคำขอลบบัญชีได้, มีกระบวนการยืนยัน (เช่น อีเมลยืนยัน หรือแอดมินอนุมัติ), มี audit log บันทึกการลบ | Medium–Large |
| 8 | กำหนด retention policy + cron purge สำหรับ `audit_logs`, `download_logs`, `reading_history` | High | migration ใหม่ (cron function คล้าย `cleanup_old_rate_limit_events`), `lib/jobs/handlers/maintenance-cleanup.server.ts` | ปัจจุบันเก็บถาวรไม่มีกำหนด ไม่สอดคล้องหลัก storage limitation | มีค่า retention ที่ตกลงกับผู้มีอำนาจตัดสินใจ (เช่น audit log 2 ปี, download log 1 ปี), มี cron job ทำงานจริงและมี monitoring เหมือน job อื่น | Medium |
| 9 | ตรวจสอบและตั้งค่า `Secure`/`SameSite` cookie flag อย่างชัดเจนสำหรับ production (ไม่พึ่ง default เงียบๆ) | High | `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/supabase/client.ts` | ป้องกันการส่ง cookie ผ่าน HTTP ธรรมดาโดยไม่ตั้งใจ | cookie option ระบุ `secure: true` เมื่อรันบน production (ตรวจสอบ `NODE_ENV`/domain), ทดสอบว่า login ยังทำงานปกติหลังเปลี่ยน | Small |

## 4.2 Recommended soon after launch (แนะนำให้ทำหลังเปิดใช้งานไม่นาน)

| # | รายการ | Priority | ไฟล์/ตาราง/route | เหตุผล | Acceptance Criteria | ขนาดงาน |
|---|---|---|---|---|---|---|
| 10 | เพิ่มฟีเจอร์เปลี่ยนรหัสผ่านขณะล็อกอินอยู่ (ไม่ต้องผ่าน forgot-password) | Medium | `app/account/actions.ts` (action ใหม่), `components/account/**` (UI ใหม่) | ฟีเจอร์พื้นฐานที่ผู้ใช้คาดหวัง | ผู้ใช้กรอกรหัสผ่านเดิม+ใหม่แล้วเปลี่ยนได้โดยไม่ต้องออกจากระบบ, มีการแจ้งเตือนทางอีเมลเมื่อเปลี่ยนสำเร็จ | Small |
| 11 | เพิ่มฟีเจอร์เปลี่ยนอีเมล + ยืนยันอีเมลใหม่ | Medium | `app/account/actions.ts`, ใช้ `supabase.auth.updateUser({email})` ที่รองรับ `double_confirm_changes` อยู่แล้ว | ฟีเจอร์พื้นฐานที่ยังขาด | ผู้ใช้ขอเปลี่ยนอีเมลได้, ต้องยืนยันทั้งอีเมลเก่า/ใหม่ตามค่า config, มี audit log | Medium |
| 12 | เพิ่มปุ่ม "ออกจากระบบทุกอุปกรณ์" | Medium | `app/account/**`, ใช้ `supabase.auth.signOut({scope:"global"})` | ช่วยผู้ใช้ที่สงสัยว่าบัญชีถูกบุกรุก | มีปุ่มในหน้าบัญชี, กดแล้ว session อื่นทั้งหมดถูกตัดจริง | Small |
| 13 | เพิ่มเครื่องมือ "บังคับรีเซ็ตรหัสผ่าน" โดยแอดมิน | Medium | `app/superadmin/users/actions.ts` (action ใหม่ คล้าย `resetUserMfaAction`) | จำเป็นเมื่อพบบัญชีถูกบุกรุกแต่ MFA ยังไม่ได้ตั้งค่า | ต้องพิมพ์ยืนยัน+เหตุผลเหมือน MFA reset, audit log, แจ้งเตือนเจ้าของบัญชี | Small–Medium |
| 14 | เพิ่มการกรอง `.eq("user_id", user.id)` ในโค้ดแอปสำหรับ `markNotificationReadAction`/`markAllNotificationsReadAction` (defense-in-depth) | Medium | `components/layout/notification-actions.ts:8-50` | ลดการพึ่งพา RLS เป็นด่านเดียว | โค้ดกรอง user_id เองก่อนเรียก DB เสมอ แม้ RLS จะป้องกันอยู่แล้วก็ตาม | Small |
| 15 | เพิ่ม pagination ให้รายชื่อผู้ใช้ทั้ง `/dashboard/users` และ `/superadmin/users` | Medium | `lib/data/admin-users.server.ts`, `lib/data/superadmin-users.server.ts` | ป้องกันปัญหา performance เมื่อจำนวนผู้ใช้เพิ่มขึ้น | ใช้ `.range()`/keyset pagination, UI มีปุ่มเปลี่ยนหน้า | Medium |
| 16 | เพิ่ม automated test สำหรับ flow สำคัญของ Area G (grant/revoke super_admin, MFA reset, trigger กัน super_admin คนสุดท้าย) | Medium | ไฟล์ทดสอบใหม่ เช่น `e2e/superadmin-user-management.spec.ts` | ปัจจุบันไม่มี regression test สำหรับ control ที่สำคัญที่สุดของระบบสิทธิ์เลย | ครอบคลุมกรณี: grant/revoke สำเร็จ, ยืนยันผิดถูกปฏิเสธ, ลบ super_admin คนสุดท้ายถูกปฏิเสธ, MFA reset ครบ flow | Medium |
| 17 | เพิ่ม `loading.tsx`/`error.tsx` ให้หน้า `/access-requests` ให้สอดคล้องกับหน้าอื่น | Low–Medium | `app/access-requests/loading.tsx`, `app/access-requests/error.tsx` (ไฟล์ใหม่) | ความสม่ำเสมอของ UX | มี skeleton ระหว่างโหลด, มีหน้า error พร้อมปุ่ม retry เหมือน favorites/reading-history | Small |
| 18 | พิจารณาบังคับ MFA (หรืออย่างน้อย re-auth) สำหรับ action ที่มีผลกระทบสูงของ admin (ระงับบัญชี, เปลี่ยนบทบาท) | Medium | `app/dashboard/users/actions.ts`, `lib/data/admin-guard.server.ts` | ลดความเสี่ยงหากบัญชี admin ถูกบุกรุกแต่ไม่มี MFA | อย่างน้อยแจ้งเตือน/บันทึกเพิ่มเติมเมื่อ action เหล่านี้ทำโดยบัญชีไม่มี MFA, พิจารณาบังคับในระยะยาว | Medium |

## 4.3 Optional future improvements (ปรับปรุงเพิ่มเติมในอนาคต — ไม่เร่งด่วน)

| # | รายการ | Priority | ไฟล์/ตาราง/route | เหตุผล | Acceptance Criteria | ขนาดงาน |
|---|---|---|---|---|---|---|
| 19 | ทำฟีเจอร์รูปโปรไฟล์ (avatar) จริง หรือลบคอลัมน์ `avatar_url` ทิ้ง | Low | `components/auth/ProfileForm.tsx`, storage bucket ใหม่, migration | คอลัมน์ตายควรมีสถานะชัดเจน | ตัดสินใจแล้วดำเนินการทางใดทางหนึ่ง พร้อม validation ขนาด/ประเภทไฟล์หากทำจริง | Medium |
| 20 | เพิ่มหน้า "ประวัติการเข้าสู่ระบบ/อุปกรณ์ที่ใช้งาน" | Low | หน้าใหม่ใน `app/account/**`, อาจต้องเก็บ session metadata เพิ่ม | เพิ่มความมั่นใจด้านความปลอดภัยให้ผู้ใช้ | ผู้ใช้เห็นรายการ IP/เวลา/อุปกรณ์ที่ login ล่าสุด | Large |
| 21 | เพิ่มฟีเจอร์ "ติดตามนักวิจัย/ผู้เขียน" คู่กับติดตามหมวดหมู่ที่มีอยู่แล้ว | Low | ตารางใหม่คล้าย `category_subscriptions`, `lib/data/**` | ส่วนขยายฟีเจอร์ที่มีอยู่แล้วให้ครบ | ผู้ใช้กดติดตามนักวิจัยได้, ได้รับแจ้งเตือนเมื่อมีงานใหม่ | Medium |
| 22 | ทำ HTML/branded email template ทั้งของแอปเอง (Resend) และของ Supabase Auth | Low | `lib/notifications/email.server.ts`, Supabase Dashboard/`supabase/config.toml` | เพิ่มความเป็นมืออาชีพ | อีเมลทุกฉบับมี branding สอดคล้องกัน ไม่ใช่ plain text/default ของ Supabase | Medium |
| 23 | เพิ่มระบบสลับภาษา (i18n) หากมีแผนขยายฐานผู้ใช้ต่างชาติ | Low | ทั้งแอป (ใหญ่) | ปัจจุบันจำกัดเฉพาะผู้ใช้ภาษาไทย | มี language switcher, ข้อความ UI แยกตามภาษา | Large |
| 24 | ผูกฟิลด์ "หน่วยงาน/สังกัด" กับตาราง `organizations` แทน free text | Low | `components/auth/ProfileForm.tsx`, `app/account/actions.ts` | ลดข้อมูลไม่สอดคล้องกัน | ใช้ dropdown/autocomplete จากตาราง organizations จริง พร้อม fallback free text หากไม่พบ | Medium |

---

# 5. Regression Test Plan

รายการทดสอบที่เป็นรูปธรรม แยกตามบทบาท — ระบุว่าเป็นการทดสอบใหม่ที่ต้องเขียนเพิ่ม หรือมีอยู่แล้ว (อ้างอิงไฟล์)

## Guest (ไม่ล็อกอิน)

1. เข้าหน้าที่ต้อง login (`/account`, `/favorites`, `/dashboard`, `/superadmin`) ต้องถูกเด้งไป `/login` — **มีอยู่แล้ว** (`e2e/auth-verification.spec.ts`)
2. เห็นเฉพาะงานวิจัยระดับ public/read_only/metadata_only ในการค้นหา — **มีอยู่แล้ว** (`lib/data/research-search-rls.integration.test.ts`)
3. ดาวน์โหลดเอกสาร public ได้โดยไม่ต้อง login — **มีอยู่แล้ว** (`e2e/auth-verification.spec.ts`)
4. เข้าดูเอกสาร member_only ตรงๆ ต้องได้ 404 ไม่ใช่หน้า login — **มีอยู่แล้ว**
5. สมัครสมาชิกโดยไม่ติ๊ก checkbox ยินยอม ต้องถูกปฏิเสธ (ทดสอบใหม่หลังทำ #1 ใน 4.1) — **ต้องเขียนใหม่**
6. **ใหม่**: ยืนยันว่า checkbox ยินยอมมีลิงก์ไปหน้านโยบายจริง และหน้านั้นโหลดได้ (หลังทำ work item #1)

## Member (rank 10)

7. เข้าสู่ระบบ/ออกจากระบบสำเร็จ — **มีอยู่แล้ว**
8. เห็น favorites/access-requests ในเมนู ไม่เห็น submit-research/dashboard — **มีอยู่แล้ว** (`e2e/header-roles.spec.ts`)
9. เข้า `/submit-research`, `/dashboard`, `/superadmin` ต้องถูกเด้ง 403 — **มีอยู่แล้ว**
10. เพิ่ม/ลบ favorites ของตัวเองได้ — **ต้องเขียนใหม่** (ยังไม่พบไฟล์ทดสอบเฉพาะ)
11. เห็นงานวิจัยระดับ member_only เพิ่มจาก guest — **มีอยู่แล้ว**
12. **ใหม่**: พยายามเรียก `markNotificationReadAction`/`markAllNotificationsReadAction` ด้วย notification id ของผู้ใช้อื่น ต้องล้มเหลว (ทดสอบ IDOR โดยตรงระดับ integration ไม่ใช่แค่ผ่าน UI)
13. **ใหม่**: พยายามลบประวัติการอ่านของตัวเอง (หลังทำ work item #5 ใน 4.1) ต้องทำได้จริง

## Staff (rank 20)

14. เข้า `/submit-research`, `/my-submissions` ได้ — **มีอยู่แล้ว**
15. เข้า `/dashboard` ยังต้องถูกเด้ง 403 (staff ยังไม่ถึง librarian) — **มีอยู่แล้ว**
16. เห็นงานวิจัยระดับ staff_only เพิ่มจาก member — **มีอยู่แล้ว**
17. ส่งงานวิจัยใหม่ผ่าน rate limit/CAPTCHA ตามที่ตั้งค่า — **ควรเพิ่ม** ทดสอบกรณีเกิน rate limit จริง

## Librarian (rank 30)

18. เข้า `/dashboard` ได้ แต่ `/dashboard/users`, `/dashboard/settings` ยังถูกเด้ง 403 — **มีอยู่แล้ว**
19. เห็นโปรไฟล์ผู้ใช้ทุกคนได้ (ผ่าน `profiles_select_own_or_staff`) — **ต้องเขียนใหม่** (ทดสอบระดับ RLS integration โดยตรง)
20. อนุมัติ/ปฏิเสธคำขอเข้าถึงเอกสารได้ — ตรวจสอบว่ามี test อยู่แล้วหรือไม่ (ไม่ยืนยันในรอบ audit นี้ — **Not verified**)

## Admin (rank 40)

21. เข้า `/dashboard/users`, `/dashboard/audit-logs`, `/dashboard/settings` ได้ — **มีอยู่แล้ว**
22. เข้า `/superadmin` ยังถูกเด้ง 403 — **มีอยู่แล้ว**
23. กำหนด/ถอดถอนบทบาท member/staff/librarian/admin ให้ผู้ใช้อื่นได้ — **ต้องเขียนใหม่**
24. **สำคัญ**: พยายามกำหนดบทบาท super_admin ให้ตัวเองหรือผู้อื่น ผ่านทั้ง UI และเรียก Supabase REST API ตรง (จำลอง bypass แอป) — ต้องถูกปฏิเสธทั้งสองทาง — **ต้องเขียนใหม่ (ทดสอบสำคัญที่สุดของ audit นี้ ยังไม่มี regression test คุ้มครองอยู่)**
25. ระงับบัญชีผู้ใช้อื่นได้ (ถาวร), ระงับบัญชีตัวเองไม่ได้ — **ต้องเขียนใหม่**
26. อ่าน audit log ได้ครบทุกเหตุการณ์ที่เกี่ยวกับสิทธิ์/ความปลอดภัย — **ต้องเขียนใหม่**
27. **ใหม่**: พยายาม UPDATE/DELETE แถวใน `audit_logs` ตรงผ่าน Supabase client (จำลอง bypass) ต้องถูก RLS/GRANT ปฏิเสธ

## Super Admin (rank 50)

28. ต้องตั้งค่า MFA ก่อนเข้า `/superadmin` เสมอ (ถูกเด้งไป `/setup-mfa`/`/mfa-challenge` ตามสถานะ) — **มีอยู่แล้ว** (`e2e/accessibility.spec.ts` ครอบคลุม mfa-challenge บางส่วน, ควรมี test เฉพาะ flow บังคับนี้)
29. มอบสิทธิ์ super_admin ให้ผู้ใช้อื่นได้ ต้องพิมพ์ยืนยันถูกต้องก่อนเท่านั้น (พิมพ์ผิดต้องถูกปฏิเสธ) — **ต้องเขียนใหม่**
30. ถอดถอนสิทธิ์ super_admin ของผู้ใช้อื่นได้ — **ต้องเขียนใหม่**
31. **สำคัญ**: ถอดถอนสิทธิ์ super_admin ของ "คนสุดท้าย" ในระบบ ต้องถูก trigger ปฏิเสธเสมอ (ทดสอบทั้งผ่านแอปและผ่าน SQL ตรงถ้าทำได้ในสภาพแวดล้อมทดสอบ) — **ต้องเขียนใหม่ (ยังไม่มี regression test คุ้มครอง trigger นี้เลย)**
32. รีเซ็ต MFA ของผู้ใช้อื่นได้ (ต้องพิมพ์ "RESET MFA" + เหตุผลถูกต้อง), รีเซ็ต MFA ของตัวเองไม่ได้ — **ต้องเขียนใหม่**
33. หลังรีเซ็ต MFA ผู้ใช้เป้าหมายต้องได้รับแจ้งเตือนทั้งในแอปและอีเมล (ถ้าตั้งค่าไว้) — **ต้องเขียนใหม่**
34. เข้าถึงทุกหน้า/action ที่ role ต่ำกว่าเข้าถึงได้ (rank≥N เสมอ) — **มีอยู่แล้วบางส่วน** (`e2e/auth-verification.spec.ts` role gate matrix)

## ทดสอบข้ามบทบาท (Cross-role / IDOR)

35. **ใหม่**: สมาชิก A พยายามแก้ไข/ลบ favorites, notification preferences, category subscriptions ของสมาชิก B โดยส่ง id ของ B ตรงๆ ผ่าน Server Action — ต้องล้มเหลวทุกกรณี
36. **ใหม่**: สมาชิก A พยายามดูคำขอเข้าถึงเอกสารของสมาชิก B ผ่าน URL ตรง — ต้องล้มเหลว/ไม่เห็นข้อมูล
37. **ใหม่**: ทดสอบ token ที่หมดอายุจริง (ไม่ใช่แค่ token เสียหาย) ว่า refresh อัตโนมัติทำงานถูกต้องและไม่ค้าง session เก่า — ส่วนหนึ่งมีอยู่แล้วใน `docs/auth-verification-audit.md` แต่เป็นกรณี token เสียหาย ไม่ใช่หมดอายุตามเวลาจริง

---

**เอกสารที่เกี่ยวข้อง**: `docs/auth-verification-audit.md` (การตรวจสอบการยืนยันตัวตนแยกก่อนหน้านี้), `docs/caching.md`, `docs/accessibility-audit.md`, `docs/deployment-checklist.md`, `docs/production-checklist.md`, `docs/superadmin-guide.md`
