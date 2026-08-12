# ระบบขอสิทธิ์เข้าถึงเอกสาร และแจ้งงานวิจัยใหม่ตามหมวดหมู่

ฟีเจอร์นี้เพิ่มเข้ามาในช่วงที่ 18 — ให้ผู้ใช้ที่ไม่มีสิทธิ์อ่าน/ดาวน์โหลดเอกสาร
ส่งคำขอสิทธิ์ไปยังเจ้าหน้าที่ได้ แทนที่จะเข้าถึงไม่ได้เลย และให้ผู้ใช้ติดตาม
หมวดหมู่งานวิจัยเพื่อรับแจ้งเตือนเมื่อมีงานใหม่เผยแพร่ ทั้งสองส่วนต่อยอดจาก
ระบบสิทธิ์ (`access_level`) และการแจ้งเตือน (`notifications`) เดิมโดยไม่แก้ไข
พฤติกรรมเดิมแม้แต่จุดเดียว

> **อัปเดตช่วงที่ 21**: (1) การหมดอายุสิทธิ์ (ทั้ง `access_requests` และ
> `document_access_grants`) ย้ายจาก lazy-expire (หัวข้อ 6 เดิม) ไปเป็น
> scheduled background job พร้อมแจ้งเตือนล่วงหน้าก่อนหมดอายุ (2) การแจ้งเตือน
> ผู้ติดตามหมวดหมู่เมื่อเผยแพร่งานวิจัย (หัวข้อ 7 เดิม) ย้ายจาก DB trigger
> เป็นจุดกลางเดียว (`notifyResearchPublished()`) ที่ทุกเส้นทางเรียกร่วมกัน
> รายละเอียดเต็มดูที่ [docs/background-jobs.md](./background-jobs.md)

## 1. สถาปัตยกรรมโดยรวม — ชั้นสิทธิ์เสริม (Access Grant Override Layer)

**หลักการสำคัญที่สุดของฟีเจอร์นี้**: `document_access_grants` ไม่เคยแทนที่หรือ
เปลี่ยน `access_level` ของเอกสาร มันเป็นชั้นสิทธิ์เสริมที่ตรวจสอบเพิ่มเติมแบบ
"OR" กับกฎเดิมเสมอ:

```
สิทธิ์อ่านจริง    = canReadOnline(access_level)  OR  มี grant "read" ที่ active
สิทธิ์ดาวน์โหลดจริง = canDownload(access_level)    OR  มี grant "download" ที่ active
```

จุดตรวจสอบจริง (`lib/storage/signed-url.server.ts`) รับพารามิเตอร์
`hasReadGrant`/`hasDownloadGrant` เพิ่มจากของเดิม (ค่าเริ่มต้น `false` — ไม่
กระทบพฤติกรรมเดิมถ้าไม่ส่งมา) แล้ว OR เข้ากับเงื่อนไข `canReadOnline`/
`canDownload` เดิมทุกประการ — โค้ดเดิมของ Phase 3 (การสร้าง Signed URL)
**ไม่ถูกลบหรือแก้ไข logic เดิมเลยแม้แต่บรรทัดเดียว** มีแต่การเพิ่มพารามิเตอร์
ใหม่เข้าไป

**ทำไม `member_only`/`staff_only` ไม่เคยแสดงปุ่ม "ขอสิทธิ์"**: RLS ของ
`research_items` (ตั้งแต่ Phase 2) ทำให้แถวที่เป็น `member_only`/`staff_only`
มองไม่เห็นเลยสำหรับผู้ใช้ที่ rank ไม่ถึง (ไม่ใช่แค่เนื้อหาถูกจำกัด — ทั้งแถว
หายไปจากผลลัพธ์ query) ดังนั้นถ้าผู้ใช้เห็นแถวนี้ได้ (rank ผ่านแล้ว) ก็จะมี
สิทธิ์อ่าน/ดาวน์โหลดเต็มอยู่แล้วโดยอัตโนมัติผ่าน `canReadOnline`/`canDownload`
(ทั้งสองฟังก์ชันนี้ไม่เคยเช็ค rank เอง — ไม่มีสถานการณ์ "เห็นแถวได้แต่เนื้อหา
ถูกจำกัดตาม rank" เกิดขึ้นเลยในสถาปัตยกรรมเดิม) **ระบบคำขอสิทธิ์จึงมีผลจริงกับ
เอกสาร `read_only` (ขอสิทธิ์ดาวน์โหลด) และ `metadata_only` (ขอสิทธิ์อ่าน/
ดาวน์โหลด) เป็นหลัก** ซึ่งเป็นระดับที่ทุกคนเห็นแถวได้แต่เนื้อหาถูกจำกัดแบบ
เดียวกันสำหรับทุกคนโดยไม่สนใจ rank — ตรงกับโจทย์การ "ขอสิทธิ์เป็นรายบุคคล"
พอดี **ไม่ได้แก้ไข RLS การมองเห็นแถวของ `research_items` เลยแม้แต่จุดเดียว**
(ถ้าแก้ไขจะเป็นการเปลี่ยนพฤติกรรมเดิมที่ระบบสิทธิ์พึ่งพาอยู่ ซึ่งขัดกับ
ข้อกำหนด "ห้ามทำให้ระบบสิทธิ์เดิมเสีย")

## 2. ตารางฐานข้อมูล

| ตาราง | หน้าที่ |
|---|---|
| `access_requests` | คำขอสิทธิ์แต่ละครั้ง (สถานะ 7 แบบ: pending/under_review/approved/rejected/more_information_required/cancelled/expired) |
| `document_access_grants` | สิทธิ์ที่อนุมัติแล้วจริง — แยกจากคำขอ (คำขอหนึ่งอาจนำไปสู่ grant ได้ครั้งเดียว แต่ grant คงอยู่ต่อได้แม้คำขอจะเป็นแค่ประวัติ) |
| `notification_preferences` | การตั้งค่าแจ้งเตือนรายผู้ใช้ (4 สวิตช์: in-app/email × งานวิจัยใหม่/คำขอเข้าถึง) — ไม่มีแถวหมายถึงใช้ค่าเริ่มต้น |
| `category_subscriptions` | หมวดหมู่ที่ผู้ใช้ติดตาม (user_id + category_id จริงแบบ uuid ไม่ใช่ slug) |

กันคำขอซ้ำด้วย partial unique index บน `access_requests`
(`research_item_id, requester_id, request_type`) เฉพาะแถวที่ `status in
('pending', 'under_review')` — ยื่นคำขอใหม่ได้ตามปกติเมื่อคำขอเดิมจบแล้ว
(approved/rejected/cancelled/expired) เช่นเดียวกัน `document_access_grants`
กันมี grant active ซ้อนกันด้วย partial unique index ที่ `revoked_at is null`

## 3. RLS

- **`access_requests`**: เจ้าของเห็น/สร้างคำขอของตัวเอง, ยกเลิกได้เฉพาะตอน
  `pending`, เปลี่ยนสถานะเป็น `expired` เองได้เฉพาะตอนหมดอายุจริงตามเวลา
  (`access_expires_at < now()` — ดูหัวข้อ 6) Librarian/Admin/Super Admin
  (rank ≥ 30) เห็นและจัดการคำขอทั้งหมดได้
- **`document_access_grants`**: เจ้าของสิทธิ์เห็นของตัวเอง (จุดตรวจสอบก่อนออก
  Signed URL) เขียน/แก้ไขได้เฉพาะ rank ≥ 30 เท่านั้น — ผู้ใช้ทั่วไปไม่มีทาง
  สร้างหรือแก้ไขสิทธิ์ของตัวเองได้เลยแม้แต่ทางอ้อม
- **`notification_preferences`/`category_subscriptions`**: เจ้าของจัดการของ
  ตัวเองเท่านั้น (insert/update/delete) แต่ rank ≥ 30 **อ่านได้ทั้งหมด**
  (เหมือนรูปแบบ `profiles_select_own_or_staff` เดิม) — จำเป็นสำหรับคำนวณ
  รายชื่อผู้รับอีเมลตอนเผยแพร่งานวิจัยใหม่ (หัวข้อ 5) โดยไม่ต้องใช้ Service
  Role

## 4. Workflow คำขอสิทธิ์

1. ผู้ใช้เห็นปุ่ม "ขอสิทธิ์อ่านเอกสาร"/"ขอสิทธิ์ดาวน์โหลด" ที่หน้ารายละเอียด
   งานวิจัย เฉพาะเมื่อยังไม่มีสิทธิ์นั้นจริง (ทั้งจาก access_level เดิมและ
   grant เดิม) — Guest เห็นปุ่ม "เข้าสู่ระบบเพื่อขอสิทธิ์..." แทน
2. กรอกวัตถุประสงค์ (บังคับ ≥ 10 ตัวอักษร) รายละเอียดเพิ่มเติม (ไม่บังคับ)
   ยอมรับเงื่อนไขการใช้งาน — validate ด้วย Zod
   (`lib/validation/access-request.ts`) ทั้งสองฝั่ง
3. จำกัดอัตราด้วย `checkRateLimit()` เดิม (ใช้เกณฑ์เดียวกับการส่งงานวิจัย —
   `rateLimitSubmitMax`/`rateLimitSubmitWindowSec` จาก Settings — ไม่เพิ่ม
   คอลัมน์ตั้งค่าใหม่)
4. บันทึกคำขอ + แจ้งเตือน Librarian/Admin/Super Admin ทุกคนทันที (in-app,
   ผ่าน trigger `notify_staff_new_access_request`)
5. เจ้าหน้าที่ตรวจสอบที่ `/dashboard/access-requests` — เห็นข้อมูลเอกสาร
   ผู้ขอ วัตถุประสงค์ ประวัติคำขอเดิมของผู้ใช้คนนี้กับเอกสารนี้ และสิทธิ์ที่
   เคยออกให้แล้ว
6. อนุมัติ (กำหนดวันหมดอายุหรือเว้นว่าง = ถาวร) / ปฏิเสธ (บังคับระบุเหตุผล) /
   ขอข้อมูลเพิ่ม (บังคับระบุรายละเอียด) — ทุกการกระทำบันทึก Audit Log
   (`access_request_approve`/`access_request_reject`/`access_request_more_info`)
7. ผู้ขอได้รับแจ้งเตือนอัตโนมัติทันทีที่สถานะเปลี่ยน (in-app ผ่าน trigger
   `notify_access_request_status_change`, email ผ่าน
   `lib/notifications/access-request-email.server.ts` — ตรวจสิทธิ์การตั้งค่า
   ทั้งระดับระบบและระดับผู้ใช้ก่อนส่งเสมอ)
8. เจ้าหน้าที่เพิกถอนสิทธิ์ที่เคยอนุมัติได้ทุกเมื่อ (บังคับระบุเหตุผล) —
   ผู้ใช้ได้รับแจ้งเตือนทันที (`notify_access_grant_revoked`) และสูญเสียสิทธิ์
   ทันทีในการตรวจสอบครั้งถัดไป (ไม่มี Signed URL เดิมค้างอยู่นานเกินอายุของ
   ลิงก์เอง — ลิงก์อ่านอายุ 30 นาที ลิงก์ดาวน์โหลดอายุ 1 นาทีอยู่แล้ว)

## 5. กฎสำคัญที่ทดสอบแล้วจริง

- **อนุมัติ "อ่าน" ไม่ให้สิทธิ์ "ดาวน์โหลด" โดยอัตโนมัติ** — `document_access_grants.access_type`
  ผูกกับ `request_type` ของคำขอต้นทางเสมอ (`access_type: row.request_type`
  ใน `approveAccessRequestAction`) ทดสอบแล้วจริง: อนุมัติคำขออ่านเอกสาร
  `metadata_only` แล้วอ่านออนไลน์ได้ แต่ดาวน์โหลดยังถูกปฏิเสธ
- **ไม่เปลี่ยน `access_level` หลักของเอกสารเลย** — การอนุมัติทั้งหมดเขียนแค่
  ตาราง `document_access_grants`/`access_requests` เท่านั้น ไม่มี `update
  research_items` ที่ไหนในโค้ดฝั่งนี้เลย
- **สิทธิ์หมดอายุแล้วสร้าง Signed URL ใหม่ไม่ได้** — `getResearchReadUrl`/
  `getResearchDownloadUrl` เช็ค grant ที่ `hasActiveAccessGrantBySlug`/
  `getMyActiveGrantsBySlug` กรองด้วย `revoked_at is null and (expires_at is
  null or expires_at > now())` เสมอ ทดสอบแล้วจริงด้วยการปรับ `expires_at`
  ย้อนหลังแล้วยืนยันว่าดาวน์โหลดถูกปฏิเสธทันที
- **ห้ามผู้ใช้แก้ไขสถานะการอนุมัติเอง** — RLS ของ `access_requests` อนุญาต
  ให้ requester เองอัปเดตได้แค่ 2 เส้นทางที่แคบมาก (pending→cancelled,
  approved-ที่หมดอายุจริง→expired) เท่านั้น การอนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม
  ทำได้เฉพาะ rank ≥ 30 ผ่าน RLS แยกต่างหาก
- **ทดสอบ RLS จริงด้วยบัญชีหลายระดับผ่าน session จริง** (ไม่ใช่แค่อ่านโค้ด):
  Guest ถูกพาไป login, Member ส่งคำขอได้, สมาชิกคนอื่นมองไม่เห็นคำขอของ
  ผู้อื่น (ยืนยันซ้ำด้วยการจำลอง RLS ผ่าน `psql` โดยตรงด้วย user_id สุ่ม),
  Librarian อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม/เพิกถอนได้จริงพร้อม Audit Log และ
  การแจ้งเตือนครบทุกเส้นทาง

## 6. หมดอายุสิทธิ์เข้าถึง — Scheduled Job (อัปเดตช่วงที่ 21)

**เดิม (ช่วงที่ 18-20)**: ไม่มีโครงสร้าง background job/cron ในโปรเจกต์
การเปลี่ยนคำขอที่ `approved` แต่หมดอายุแล้วให้เป็น `expired` จึงเกิดแบบ "lazy"
เท่านั้น (เรียกฟังก์ชันตอนเปิดหน้ารายการคำขอ) และ `document_access_grants`
ไม่มีกลไกประมวลผลใดๆ เลย (ปล่อยให้ "หมดอายุแบบเงียบๆ" ไม่มีร่องรอย/แจ้งเตือน)

**ตั้งแต่ช่วงที่ 21**: ใช้ background job `access_expiration` เดิมของช่วงที่ 20
(self-seed ทุกครั้งที่ worker/Cron ทำงาน — ดู
[docs/background-jobs.md](./background-jobs.md)) ขยายให้ทำงาน 3 อย่างในรอบ
เดียว ทุกอย่าง **idempotent โดยธรรมชาติ** (รันซ้ำกี่ครั้งก็ไม่แจ้งเตือนซ้ำ):

1. `expire_stale_access_requests()` (เดิม, ไม่แก้ไข) — เปลี่ยนคำขอ `approved`
   ที่หมดอายุแล้วเป็น `expired` แจ้งผู้ขอผ่าน trigger `notify_access_request_status_change` เดิม
2. `expire_stale_access_grants()` (ใหม่) — ปิด `document_access_grants` ที่
   หมดอายุแล้วอย่างชัดเจน (`revoked_at` + `revoke_reason` เป็นข้อความมาตรฐาน
   `"ระบบปิดอัตโนมัติ: สิทธิ์หมดอายุตามกำหนดเวลา"`) แจ้งผู้ใช้ผ่าน trigger
   `notify_access_grant_revoked` เดิม (ปรับให้แยกถ้อยคำ "หมดอายุ" ออกจาก
   "ถูกเพิกถอนโดยเจ้าหน้าที่" โดยตรวจจาก `revoke_reason`)
3. `warn_expiring_access_grants(p_window_days := 3)` (ใหม่) — แจ้งเตือน
   ล่วงหน้า 3 วันก่อนหมดอายุจริง กันแจ้งซ้ำด้วยคอลัมน์ใหม่
   `document_access_grants.expiry_warned_at` (ตั้งครั้งเดียว ไม่ต้องรีเซ็ต
   เพราะ grant ที่ผ่านการแจ้งเตือนแล้วจะหมดอายุจริงในไม่ช้าอยู่แล้ว)

Super Admin กดปุ่ม **"ประมวลผลสิทธิ์ที่หมดอายุทันที"** ที่
`/superadmin/notifications` เพื่อรันทั้ง 3 ฟังก์ชันทันทีได้โดยไม่ต้องรอรอบ
Cron ถัดไป (จำกัดเฉพาะ job ประเภท `access_expiration` เท่านั้น ไม่แตะ job
ประเภทอื่นที่อาจค้างอยู่พร้อมกัน)

**ยังคงหลักการเดิมทุกประการ: การตรวจสอบสิทธิ์จริงตอนสร้าง Signed URL ไม่ได้
พึ่งพา job นี้เลย** — `lib/storage/signed-url.server.ts` และ
`lib/data/access-grants.server.ts` เช็ค `expires_at`/`revoked_at` ของแถวจริง
ตรงๆ เสมอ (ไม่ได้พึ่งสถานะที่ job อัปเดต) **ทดสอบยืนยันแล้วจริง**: สร้าง grant
ที่หมดอายุแล้วโดยยังไม่รัน job เลย → ตรวจสอบ grant ที่ active ด้วย query เดียว
กับที่ signed-url ใช้จริง → พบว่าไม่เจอ (ปฏิเสธถูกต้อง) **ก่อน** job จะรันด้วยซ้ำ
job มีหน้าที่แค่ทำให้สถานะที่แสดงผล/แจ้งเตือนตรงกับความเป็นจริง ไม่ใช่ด่าน
ความปลอดภัยหลัก

`expire_stale_access_requests()` ยังคง **ไม่ใช่ security definer** เหมือนเดิม
(รันภายใต้สิทธิ์ของผู้เรียก — job handler เรียกผ่าน Service Role จึงข้าม RLS
ได้ทุกแถวในคำขอเดียว ต่างจากตอนเรียกแบบ lazy ผ่าน client ของผู้ใช้ที่ RLS
จำกัดเฉพาะแถวตัวเอง) ส่วน `expire_stale_access_grants()`/
`warn_expiring_access_grants()` ใหม่เรียกผ่าน Service Role เท่านั้น (grant
execute ให้ `service_role` เท่านั้น ไม่ใช่ `authenticated`)

## 7. แจ้งเตือนงานวิจัยใหม่ตามหมวดหมู่ (อัปเดตช่วงที่ 21 — รวมจุดเดียว)

**เดิม (ช่วงที่ 18-20)** in-app มาจาก DB trigger, email มาจาก Server Action ที่
เรียกไม่ครบทุกเส้นทาง (ขาดเส้นทาง "สร้างใหม่พร้อมเผยแพร่ทันที") — **ตั้งแต่
ช่วงที่ 21 ทั้งสองอย่างมาจากจุดเดียวกัน**: `notifyResearchPublished()`
(`lib/publishing/publish-event.server.ts`) ที่ทุกเส้นทางที่เปลี่ยนสถานะเป็น
`published` เรียกเหมือนกันหมด (ดูหัวข้อ "Publish Event กลาง" ด้านล่าง)

- **In-app**: `notifyResearchPublished()` เรียก RPC
  `notify_category_subscribers_published(research_item_id)` (SQL function,
  migration `20260811100000...sql`) **ไม่ใช่ DB trigger อีกต่อไป** — ย้ายออก
  จาก trigger โดยเจตนา เพราะ `research_categories` (ตารางเชื่อมหมวดหมู่ของ
  เอกสาร) ถูกเขียนแยกต่างหากใน `replaceResearchRelations()` ซึ่งรัน **หลัง**
  insert/update หลักเสมอ — ถ้า trigger ยิงตอน insert/update หลักโดยตรง
  หมวดหมู่ของเอกสารยังไม่ถูกต้อง/ยังไม่มีเลย (แจ้งผิดคนหรือไม่แจ้งเลย) ย้าย
  มาเป็น RPC ที่เรียกทีหลัง (หลัง `replaceResearchRelations()` เสร็จเสมอ) แก้
  ปัญหานี้ได้ตรงจุด กันแจ้งซ้ำเมื่อเอกสารอยู่หลายหมวดหมู่ด้วย `insert ...
  select distinct` เหมือนเดิมทุกประการ ไม่แจ้งเจ้าของงานวิจัยเอง
- **กันแจ้งซ้ำระดับฐานข้อมูล**: คอลัมน์ใหม่ `research_items.category_notified_at`
  ถูกเช็ค-และ-ตั้งค่าแบบ atomic ภายใน RPC เดียวกัน (`update ... where
  category_notified_at is null returning ...`) — เรียกซ้ำสำหรับเหตุการณ์
  เผยแพร่เดียวกัน (เช่น retry โดยไม่ตั้งใจ) จะไม่แจ้ง/log ซ้ำเลยทั้ง in-app
  และ email (ใช้ guard เดียวกัน) **ล้างอัตโนมัติ**เมื่อสถานะออกจาก
  `published` (เช่น `archived`) ทำให้ "เผยแพร่ซ้ำหลังปิดเผยแพร่" แจ้งเตือน
  ใหม่ได้ถูกต้อง (ทดสอบยืนยันแล้วจริง: publish → duplicate call ไม่แจ้งซ้ำ →
  archive → republish → แจ้งใหม่สำเร็จ)
- **Email**: `notifyResearchPublished()` enqueue background job
  `category_notification` (async — ดู
  [docs/background-jobs.md](./background-jobs.md)) แทนการส่งตรงในคำขอเดิม
  `lib/notifications/category-subscribers.server.ts` (ฟังก์ชันจริงที่ส่ง
  อีเมล) ไม่เปลี่ยนแปลง ยังตรวจการตั้งค่าระบบ + รายผู้ใช้ก่อนส่งเสมอ และ
  dedupe ผู้รับด้วย `Set` เมื่อเอกสารอยู่หลายหมวดหมู่
- **(แก้ไขแล้ว) เผยแพร่ผ่านการสร้างใหม่โดยตรงตอนนี้ถูกครอบคลุมแล้วในหลักการ**
  — `notifyResearchPublished()` ถูกเรียกจาก `adminCreateResearchAction` ด้วย
  (ผ่านจุดกลางเดียวกัน) แต่ **ในทางปฏิบัติปัจจุบันไม่มีทางเกิดขึ้นจริง**
  เพราะไฟล์ PDF ใหม่ถูกลดสถานะจาก `published` เป็น `pending_review` เสมอ (ยัง
  ไม่ผ่านสแกนความปลอดภัยแบบ async ของช่วงที่ 20) — ดูหัวข้อ "Publish Event
  กลาง" สำหรับรายละเอียด

### Publish Event กลาง (ใหม่ในช่วงที่ 21)

`notifyResearchPublished()` เป็นจุดเดียวที่ **ทุกเส้นทาง** ที่ทำให้งานวิจัย
กลายเป็น `published` ต้องเรียกหลังจากเขียนแถวสำเร็จแล้ว:

| เส้นทาง | ไฟล์ | หมายเหตุ |
| --- | --- | --- |
| อนุมัติผ่าน workflow (`publishAction`) | `app/dashboard/approvals/[id]/actions.ts` | เรียกทุกครั้งที่ `newStatus === "published"` |
| แก้ไขแล้วเปลี่ยนเป็นเผยแพร่ (`adminUpdateResearchAction`) | `app/dashboard/research/[id]/edit/actions.ts` | เรียกเฉพาะตอนเพิ่งเปลี่ยนจริง (`existing.status !== "published"`) — ครอบคลุม "เผยแพร่ซ้ำหลังปิดเผยแพร่" (archived→published) ด้วย เพราะฟังก์ชันนี้ไม่จำกัดว่าต้องมาจากสถานะไหน |
| สร้างใหม่พร้อมเผยแพร่ทันที (`adminCreateResearchAction`) | `app/dashboard/research/new/actions.ts` | **ไม่มี branch เรียกจริงในโค้ด** — TypeScript พิสูจน์แล้วว่า unreachable เพราะ status ถูกลดเป็น `pending_review` เสมอก่อนหน้านั้น (ไฟล์ใหม่ยังไม่ผ่านสแกน) มีคอมเมนต์ชี้จุดที่ต้องเพิ่มกลับหากตรรกะการลดสถานะเปลี่ยนในอนาคต |

ทุกจุดเรียก**หลัง** `replaceResearchRelations()` เสมอ (ยกเว้น approval ที่ไม่
เคยแตะหมวดหมู่อยู่แล้ว) เพื่อให้หมวดหมู่ของเอกสารถูกต้องครบถ้วนก่อนแจ้งผู้
ติดตาม — ฟังก์ชันนี้ยังเขียน audit log กลาง (`action: "research_published"`)
เสริมจาก audit log เฉพาะเส้นทางเดิม (`research_create`/`research_status_change`
จาก DB trigger) ให้มี audit trail เดียวที่ query เหตุการณ์ "เผยแพร่" ได้ตรงๆ

## 8. ความปลอดภัยและความเป็นส่วนตัว

- **ไม่เปิดเผยรายชื่อผู้ขอ/เหตุผลการขอต่อผู้ใช้ทั่วไป** — ข้อมูลผู้ขอ
  (`requesterName`/`requesterEmail`) ปรากฏเฉพาะใน `AccessRequestAdminRow`
  (ชนิดข้อมูลแยกจาก `AccessRequestSummary` ที่ใช้ในหน้าของสมาชิกเอง) และดึง
  ผ่าน `lib/data/access-requests-admin.server.ts` เท่านั้น ซึ่ง RLS จำกัดไว้
  ที่ rank ≥ 30 อยู่แล้วเป็นชั้นแรก หน้า `/dashboard/access-requests*` เอง
  ก็ตรวจ rank ซ้ำอีกชั้นก่อน render
- **ไม่มีที่ใดส่งไฟล์ PDF ผ่านอีเมลเลย** — อีเมลแจ้งเตือนทุกฉบับ (อนุมัติ/
  ปฏิเสธ/ขอข้อมูลเพิ่ม/เพิกถอน/งานวิจัยใหม่) เป็นข้อความแจ้งเตือนล้วน ไม่มี
  attachment และไม่มีลิงก์ตรงไปยังไฟล์ — ผู้ใช้ต้องเข้าเว็บไซต์และผ่านการ
  ตรวจสอบสิทธิ์ตามปกติเพื่อรับ Signed URL เสมอ
- **ไม่มี public URL สำหรับไฟล์ private ใดๆ เพิ่มขึ้นเลย** — Signed URL
  ยังคงสร้างผ่าน Service Role ตามรูปแบบเดิมทุกประการ (`createSignedUrlForPath`
  ไม่ถูกแก้ไข logic ภายในเลย มีแต่เงื่อนไขก่อนหน้าที่ตรวจสอบว่าจะเรียกมันหรือ
  ไม่เรียก)
- **Error ที่ผู้ใช้เห็นเป็นข้อความทั่วไปเสมอ** — ใช้ `toSafeErrorMessage()`
  เดิมทุก Server Action ใหม่ ไม่มี raw Postgres error หลุดออกไปที่ UI
- **ไม่ใช้ CAPTCHA กับฟอร์มขอสิทธิ์** — ต้องเข้าสู่ระบบก่อนเสมอ (ตรงกับ
  ธรรมเนียมเดิมที่ CAPTCHA สงวนไว้เฉพาะฟอร์มสาธารณะที่ยังไม่ยืนยันตัวตน เช่น
  สมัครสมาชิก/ส่งงานวิจัยใหม่)

## 9. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/20260808100000_document_access_requests.sql` | ตาราง, RLS, trigger เดิม (ช่วงที่ 18) |
| `supabase/migrations/20260811100000_access_expiration_and_publish_events.sql` | ช่วงที่ 21: expiry_warned_at, category_notified_at, expire_stale_access_grants(), warn_expiring_access_grants(), notify_category_subscribers_published(), ปรับ trigger เดิม 2 ตัว |
| `lib/data/access-grants.server.ts` | ตรวจสอบ grant ที่ active (slug-based) — **ไม่แก้ไข** ยังเช็ค expires_at/revoked_at ตรงเสมอ |
| `lib/data/access-requests.server.ts` | คำขอของสมาชิกเอง |
| `lib/data/access-requests-admin.server.ts` | รายการ/รายละเอียดคำขอฝั่งเจ้าหน้าที่ |
| `app/research/[id]/access-request-actions.ts` | ส่ง/ยกเลิกคำขอ |
| `app/dashboard/access-requests/[id]/actions.ts` | อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม/เพิกถอน |
| `components/research/AccessRequestButton.tsx` | ปุ่ม+ฟอร์มขอสิทธิ์ที่หน้ารายละเอียดงานวิจัย |
| `lib/storage/signed-url.server.ts` | จุดตรวจสอบสิทธิ์จริงก่อนออก Signed URL — **ไม่แก้ไขความเข้มงวดเลย** |
| `lib/data/notification-preferences.server.ts`, `lib/data/category-subscriptions.server.ts` | การตั้งค่าแจ้งเตือน + ติดตามหมวดหมู่ |
| `app/profile/notification-settings/`, `app/notifications/`, `app/access-requests/`, `app/dashboard/access-requests/` | หน้าเว็บทั้งหมดของฟีเจอร์นี้ |
| `lib/notifications/access-request-email.server.ts`, `lib/notifications/category-subscribers.server.ts` | อีเมลแจ้งเตือน (best-effort) — ฟังก์ชันจริงไม่เปลี่ยนแปลง เรียกผ่าน background job แล้ว |
| `lib/publishing/publish-event.server.ts` (ใหม่) | Publish Event กลาง — `notifyResearchPublished()` |
| `lib/jobs/handlers/access-expiration.server.ts` (ปรับปรุง) | เรียก expire_stale_access_requests + expire_stale_access_grants + warn_expiring_access_grants ในรอบเดียว |
| `app/superadmin/notifications/page.tsx`, `actions.ts` (ปรับปรุง) | ปุ่ม "ประมวลผลสิทธิ์ที่หมดอายุทันที" + ประวัติ job หมดอายุ/แจ้งเตือน + retry |
