# งานประมวลผลพื้นหลัง (Background Jobs)

ฟีเจอร์นี้เพิ่มเข้ามาในช่วงที่ 20 — ย้ายงานประมวลผลหนัก 4 อย่างที่เดิมรันแบบ
synchronous ในคำขอเดียวกับการอัปโหลด/แก้ไข/เผยแพร่งานวิจัย ไปเป็น background
job ที่ทำงานผ่าน worker แยกต่างหาก:

1. `pdf_text_extraction` — ดึงข้อความจาก PDF (เดิมเป็นช่วงที่ 17)
2. `file_security_rescan` — สแกนมัลแวร์ไฟล์ PDF (เดิมเป็นช่วงที่ 14)
3. `access_expiration` — เปลี่ยนคำขอเข้าถึงที่หมดอายุแล้วเป็น `expired` และปิด
   `document_access_grants` ที่หมดอายุ + แจ้งเตือนล่วงหน้า (เดิมเป็น
   lazy-expire ของช่วงที่ 18 — ขยายให้ครอบคลุม `document_access_grants` และ
   การแจ้งเตือนล่วงหน้าในช่วงที่ 21 ดูหัวข้อ 9)
4. `category_notification` — ส่งอีเมลแจ้งผู้ติดตามหมวดหมู่เมื่อมีงานวิจัยใหม่
   เผยแพร่ (เดิมเป็นช่วงที่ 18 — ตั้งแต่ช่วงที่ 21 enqueue จากจุดกลางเดียว
   `notifyResearchPublished()` ทุกเส้นทาง แทนการเรียกกระจายตามแต่ละ Server
   Action ดู [docs/document-access-requests.md](./document-access-requests.md)
   หัวข้อ "Publish Event กลาง")

**เหตุผล**: ไฟล์ PDF ขนาดใหญ่หรือ malware scan provider ที่ตอบช้าอาจทำให้คำขอ
อัปโหลดติด timeout ของ Serverless platform (เช่น Vercel) — ดู
[docs/file-security.md](./file-security.md) หัวข้อ 7 และ
[docs/pdf-full-text-search.md](./pdf-full-text-search.md) หัวข้อ 8 ที่เคยระบุ
ข้อจำกัดนี้ไว้ตั้งแต่ช่วงที่แล้ว

**ไม่มีการเพิ่มบริการภายนอก/เสียค่าใช้จ่ายใดๆ** — ใช้ persistent queue ในตาราง
PostgreSQL เดิม (Supabase) เท่านั้น ไม่ใช้ Redis/SQS/บริการ queue แยกต่างหาก

## 1. สถาปัตยกรรมโดยรวม

```
อัปโหลดไฟล์ (browser -> Supabase Storage ตรง เหมือนเดิม)
        │
        ▼
Server Action (submit-research / dashboard/research/new / .../edit / my-submissions/[id])
  1. ตรวจ magic-byte เท่านั้น (synchronous, เร็ว, ไม่มีความเสี่ยง timeout)
     — validateSubmissionFiles() ไม่สแกนมัลแวร์ไฟล์ PDF หลักที่นี่อีกต่อไป
  2. บันทึกแถว research_items ทันที: scan_status = 'pending'
  3. enqueueInitialFileProcessingJobs() สร้าง 2 job: file_security_rescan + pdf_text_extraction
        │
        ▼
background_jobs (ตารางเดียว ใช้ร่วมกันทั้ง 4 job type)
  - status: pending -> processing -> completed | failed | cancelled
  - claim_background_jobs() ล็อกแบบ atomic ด้วย `for update skip locked`
  - fail_background_job() รีทราย exponential backoff จนครบ max_attempts
        │
        ▼
Worker (/api/jobs/process, เรียกจาก Cron หรือปุ่ม "ประมวลผลคิวเดี๋ยวนี้")
  - claim job ที่ถึงเวลา -> dispatch ไปยัง handler ตาม job_type -> complete/fail
        │
        ▼
research_items.scan_status อัปเดตเป็น clean/infected/error
research_document_texts อัปเดตผล extraction (ตารางเดิมของช่วงที่ 17 ไม่เปลี่ยน)
        │
        ▼
เผยแพร่ได้ก็ต่อเมื่อ scan_status ไม่ใช่ pending/infected/error (บังคับที่ DB trigger)
Signed URL อ่าน/ดาวน์โหลดเช็ค scan_status ก่อนออกให้เสมอ (defense-in-depth)
```

## 2. Job Queue (`background_jobs`)

ตารางเดียว migration `supabase/migrations/20260810100000_background_jobs.sql`:

| คอลัมน์ | ความหมาย |
| --- | --- |
| `job_type` | `pdf_text_extraction` \| `file_security_rescan` \| `access_expiration` \| `category_notification` \| `duplicate_scan` \| `ocr_processing` \| `bulk_enqueue` (ช่วงที่ 25 — ดูหัวข้อ 11.4) \| `maintenance_cleanup` (ช่วงที่ 31 — งานบำรุงรักษาจริงตัวแรกของระบบ ดูหัวข้อ 14.2) \| `ocr_test_run` (ช่วงที่ 32 — Controlled OCR Test สั่งเป็นชุดแยกจาก `ocr_processing` เขียนผลลงตาราง `ocr_test_runs` แทน ดู [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 14) |
| `payload` | ข้อมูลที่ handler ต้องใช้ (jsonb เช่น `{research_item_id, pdf_path}`) |
| `status` | `pending` → `processing` → `completed` \| `failed` \| `cancelled` |
| `attempts` / `max_attempts` | จำนวนครั้งที่พยายามแล้ว / เพดานสูงสุด (ค่าเริ่มต้น 5 — `bulk_enqueue` และ `ocr_processing` (provider แบบ async, ช่วงที่ 29) ใช้ค่าสูงกว่ามาก เพราะการ requeue ตัวเองนับเป็น attempt ด้วย ดูหัวข้อ 11.4 และ [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 3.2) |
| `progress` | 0–100 (สำรองไว้ตั้งแต่ช่วงที่ 20 — ตั้งแต่ช่วงที่ 29 มี handler จริงตัวแรกที่เขียนค่านี้แล้ว: `ocr_processing` ผ่าน `updateJobPageProgress()` เมื่อ provider รายงานเลขหน้าได้ ดู [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 3.3 — job type อื่นยังไม่มี handler เขียนค่านี้ หน้า Super Admin ใช้ `JobBatchSummary` per-status counts + ETA แทนตั้งแต่ช่วงที่ 25 ดูหัวข้อ 11.3) |
| `current_page` / `total_pages` / `progress_message` (ช่วงที่ 29) | Progress ระดับหน้าของ `ocr_processing` เท่านั้น — `null` ทั้งคู่ถ้า provider ไม่ได้รายงานเลขหน้ามา (ไม่มีการเดา/ประมาณ) ดู [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 3.3 |
| `error_message` | ข้อความปลอดภัยที่ผ่านการตัดข้อมูลอ่อนไหวแล้วเท่านั้น (ดูหัวข้อ 2.3) |
| `idempotency_key` | กัน job ซ้ำซ้อน (ดูหัวข้อ 2.2) |
| `batch_id` | จัดกลุ่ม job ที่สร้างพร้อมกันจากการทำงานเป็นชุด (bulk backfill/rescan) |
| `entity_type` / `entity_id` | อ้างอิงกลับไปยังแถวที่ job นี้เกี่ยวข้อง (ใช้ยกเลิก job เก่าตอนแทนที่ไฟล์) |
| `locked_by` / `locked_at` / `lease_expires_at` | lease กัน worker หลายตัวประมวลผล job เดียวกันซ้ำซ้อน |
| `run_after` | เวลาที่ job นี้พร้อมถูก claim (ใช้ทำ exponential backoff) |
| `resolved_at` / `resolved_by` / `resolution_note` | (ช่วงที่ 25) ทำเครื่องหมายว่า dead-letter entry นี้ถูกจัดการแล้ว (ยกเลิก/แก้ไข) — ดูหัวข้อ 11.1 |
| `dead_letter_notified_at` | (ช่วงที่ 25) กันแจ้งเตือนซ้ำเมื่อ job เข้า dead-letter queue — ดูหัวข้อ 11.2 |

### 2.1 Lock/Lease — `claim_background_jobs()`

```sql
select * from claim_background_jobs('worker-id', 5);
```

ใช้ `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` ซึ่งเป็นรูปแบบ
มาตรฐานสำหรับ job queue บน PostgreSQL — atomic ระดับฐานข้อมูลจริง ไม่ใช่แค่ตรวจ
ในโค้ดแบบ mutex ฝั่งแอป (เทียบเท่าหลักการเดียวกับ `acquire_extraction_lock()`
ของช่วงที่ 17 แต่ทั่วไปกว่าเพราะรองรับหลาย job พร้อมกันในคำขอเดียว) เลือกทั้ง
job ที่ `pending` และถึงเวลาแล้ว **และ** job ที่ `processing` แต่ `lease_expires_at`
หมดอายุไปแล้ว (worker ก่อนหน้าตายกลางคันโดยไม่ได้ complete/fail job — lease
หมดอายุใน 10 นาที ทำให้ job กลับมา claim ใหม่ได้เองโดยไม่ต้องมี process แยกมา
"reap" job ค้าง)

### 2.2 Idempotency

Partial unique index `idx_background_jobs_idempotency_active` บังคับว่า
`idempotency_key` ต้องไม่ซ้ำกัน **เฉพาะตอน `status in ('pending','processing')`**
เท่านั้น (job ที่ completed/failed/cancelled แล้วซ้ำ key เดิมได้ เก็บไว้เป็น
ประวัติ) รูปแบบ key: `{job_type}:{research_item_id}` (เช่น
`pdf_text_extraction:abc-123`) — สองเส้นทางใช้กลไกนี้ต่างกัน:

- **Bulk backfill/rescan** (`enqueueBackgroundJob`): พยายาม insert ตรงๆ ถ้าชน
  unique index (มี job active อยู่แล้ว) จะข้ามรายการนั้นไปเงียบๆ ไม่ error —
  กัน Super Admin กดปุ่ม "ประมวลผลที่เลือก" ซ้ำสร้าง job ซ้ำซ้อน
- **แทนที่ไฟล์ PDF** (`replaceEntityJob`): ยกเลิก job active เดิมของ entity นั้น
  ก่อนเสมอ (`cancel_active_jobs_for_entity`) แล้วค่อย insert ใหม่ — ไฟล์เก่าที่
  job เดิมอ้างถึงไม่มีอยู่แล้ว ประมวลผลไปก็ไม่มีความหมาย ต้องใช้ไฟล์ใหม่เท่านั้น

### 2.3 Retry / Backoff / ข้อความ error

`fail_background_job(job_id, error_message)`:

- `attempts < max_attempts`: กลับเป็น `pending`, `run_after = now() + 2^attempts นาที` (สูงสุด 60 นาที)
- `attempts >= max_attempts`: เปลี่ยนเป็น `failed` ถาวร (ต้องกดปุ่ม "ลองใหม่" ด้วยมือที่หน้า Super Admin เท่านั้น)

`error_message` ที่บันทึกในตารางถูกส่งผ่าน `toSafeJobErrorMessage()`
(`lib/jobs/queue.server.ts`) เสมอ — log ข้อความ error ดิบไว้ฝั่งเซิร์ฟเวอร์
(`console.error`) เท่านั้น คอลัมน์ในฐานข้อมูล (ซึ่งแสดงผลตรงที่หน้า Super Admin)
ได้รับแค่ข้อความไทยทั่วไปเสมอ ไม่มี stack trace/error ดิบจาก Postgres/Storage/
provider ภายนอกหลุดออกไป — ยกเว้น handler ที่ตรวจพบเงื่อนไขเฉพาะเอง (เช่น
"ข้อมูล job ไม่ครบถ้วน") ซึ่งเขียนข้อความปลอดภัยเองอยู่แล้ว

## 3. การเปลี่ยนแปลงระบบอัปโหลด/สแกน/ดึงข้อความ

### 3.1 ขอบเขตของการทำ async (สำคัญ — อ่านก่อนใช้งาน)

- **PDF หลัก (`pdf_file`)**: magic-byte ตรวจแบบ synchronous เหมือนเดิม (เร็ว
  ไม่มีความเสี่ยง timeout) แต่ **การสแกนมัลแวร์ย้ายไปเป็น async ทั้งหมด**
  ผ่าน job `file_security_rescan`
- **ภาพปก/เอกสารแนบ** (`cover`/`attachment`): **ยังคงสแกนมัลแวร์แบบ
  synchronous เหมือนเดิมทุกประการ ไม่เปลี่ยนแปลง** — ไฟล์เหล่านี้มีขนาดเล็ก
  กว่า PDF มาก ความเสี่ยง timeout ต่ำ และ schema เดิม (`research_items`) เก็บ
  `scan_status` ของ PDF หลักเพียงฟิลด์เดียว การขยายไปครอบคลุมทุกไฟล์จะเพิ่ม
  ความซับซ้อนของ schema โดยไม่คุ้มกับความเสี่ยงจริงที่มี

### 3.2 `research_items.scan_status` มีสถานะใหม่ `'pending'`

เดิมมีแค่ `clean` / `infected` / `error` / `skipped` (ดู
[docs/file-security.md](./file-security.md)) — เพิ่ม `pending` หมายถึง "แถว
ถูกสร้างแล้ว รอ background job สแกน" (ไม่มีทางเกิดกับข้อมูลเก่าก่อนช่วงที่ 20
เพราะตอนนั้นสแกนแบบ synchronous ก่อน insert เสมอ):

```sql
check (scan_status in ('pending', 'clean', 'infected', 'error', 'skipped'))
```

### 3.3 Trigger `prevent_publish_unscanned_file()` (ปรับปรุง)

เดิมบล็อกแค่ `infected`/`error` และแค่ตอน **เปลี่ยน** สถานะเป็น `published`
เท่านั้น — ตอนนี้บล็อก `pending` ด้วย และเช็คผลลัพธ์สุดท้ายของแถว (`new.*`)
ตรงๆ ไม่สนว่าเป็น INSERT หรือ UPDATE ครอบคลุม 2 เคสใหม่ที่เกิดขึ้นได้จริงในช่วง
ที่ 20:

1. Librarian/Admin สร้างงานวิจัยพร้อม "เผยแพร่ทันที" (`adminCreateResearchAction`) — ไฟล์ PDF ใหม่ยังไม่ผ่านสแกน INSERT จะถูกปฏิเสธ
2. แทนที่ไฟล์ PDF ของงานวิจัยที่เผยแพร่อยู่แล้ว (`adminUpdateResearchAction`) — ถ้าไม่ลดสถานะลง UPDATE จะถูกปฏิเสธ

ทั้งสอง Server Action ข้างต้น**ลดสถานะเป็น `pending_review` เองล่วงหน้า**
ก่อนบันทึกเมื่อพบว่ากำลังจะเผยแพร่พร้อมไฟล์ที่ยังไม่ผ่านสแกน (ดูโค้ดในไฟล์
เพื่อดูเงื่อนไขที่แน่นอน) เพื่อไม่ให้ผู้ใช้เจอ error ดิบจาก trigger โดยไม่จำเป็น
— trigger ยังคงเป็นด่านสุดท้ายที่บังคับจริงเสมอ (เผื่อกรณีแก้ไขข้อมูลตรงใน
ฐานข้อมูลโดยไม่ผ่านแอป)

### 3.4 Trigger ใหม่ `close_access_on_scan_failure()`

เมื่องานวิจัยที่ **เผยแพร่อยู่แล้ว** ถูกสแกนซ้ำ (bulk rescan หรือช่องทางอื่น)
แล้วพบว่า `scan_status` เปลี่ยนเป็น `infected`/`error` — trigger นี้เปลี่ยน
`status` เป็น `archived` ให้อัตโนมัติทันที (ปิดการเข้าถึง) เป็น DB-level
enforcement เพื่อไม่ให้พึ่งพา application code ฝั่งเดียว ตรงกับข้อกำหนด "หากไฟล์
ไม่ผ่านการสแกนใหม่ ให้ปิดการเข้าถึงทันที" — `lib/jobs/handlers/file-security-rescan.server.ts`
เป็นคนอัปเดต `scan_status` (trigger ทำงานเองเมื่อ UPDATE นั้นเกิดขึ้น) และแจ้ง
เตือน Admin/Super Admin (rank >= 40) ผ่านตาราง `notifications` ที่มีอยู่เดิม
พร้อมบันทึก `audit_logs` (`action: "file_security_rescan_closed_access"`)

### 3.5 Signed URL ตรวจ `scan_status` เพิ่มเติม (defense-in-depth)

`getResearchReadUrl()` / `getResearchDownloadUrl()` (`lib/storage/signed-url.server.ts`)
รับพารามิเตอร์ `scanStatus` เพิ่มเติม (optional) — ปฏิเสธออก Signed URL ถ้า
`scan_status` เป็น `pending`/`infected`/`error` ต่อให้ `access_level`/สิทธิ์
ผ่านหมดแล้วก็ตาม เดินสายไว้ที่ 2 จุดสำคัญที่ผู้อ่านทั่วไปเข้าถึงจริง
(`app/research/[id]/actions.ts`, `app/research/[id]/read/page.tsx`) — **ในทาง
ปฏิบัติ trigger ในหัวข้อ 3.3/3.4 การันตีอยู่แล้วว่าแถวที่ `status = 'published'`
จะมี `scan_status` เป็น `clean`/`skipped` เท่านั้นเสมอ** การตรวจที่นี่จึงเป็น
ชั้นป้องกันสำรอง ไม่ใช่ด่านหลัก — หน้าพรีวิวก่อนเผยแพร่
(`getResearchDocumentPreviewUrl`, ใช้โดย Librarian/Admin/เจ้าของงานที่
`/my-submissions/[id]`) **ไม่ได้ตรวจ scan_status** โดยเจตนา เพราะเป็นเครื่องมือ
รีวิวภายในที่ต้องดูไฟล์ได้ก่อนสแกนเสร็จ (การมองเห็นแถวที่ยังไม่เผยแพร่ถูกจำกัด
ด้วย RLS ของ `research_items` อยู่แล้ว)

## 4. Bulk Backfill PDF Text — `/superadmin/pdf-processing`

Super Admin เท่านั้น (rank >= 50, บังคับทั้งที่ layout และซ้ำในทุก Server
Action ตาม RBAC สองชั้น) กรองงานวิจัยได้ 4 แบบ: ยังไม่มีข้อความ / ดึงไม่สำเร็จ /
ไม่พบข้อความ / ไฟล์ถูกแทนที่ (เทียบ `pdf_file` ปัจจุบันกับ `source_file_path`
ที่บันทึกไว้ตอนดึงข้อความครั้งล่าสุด) เลือกได้หลายรายการพร้อมกัน มีช่อง "ขนาด
batch สูงสุดต่อครั้ง" (1–200, ค่าเริ่มต้น 50) จำกัดจำนวน job ที่สร้างในคำขอ
เดียว — เลือกเกิน batch size จะทำเฉพาะ N รายการแรก แล้วต้องกดอีกครั้งสำหรับ
ส่วนที่เหลือ (กันสร้าง job หลักพัน/หมื่นรายการในคำขอเดียวจนคำขอเองก็ timeout)

แสดง "ชุดงานล่าสุด" (progress bar สรุปสถานะของแต่ละ batch) และ "งานที่ล้มเหลว
ถาวร" (ครบ `max_attempts` แล้ว) พร้อมปุ่ม "ลองใหม่" รายตัว ทุกการสั่งประมวลผล
เป็นชุดบันทึก `audit_logs` (`action: "pdf_processing_bulk_backfill"`) เสมอ

## 5. Bulk Rescan Files — `/superadmin/file-security`

โครงสร้างหน้าเหมือนหัวข้อ 4 ทุกประการ แต่กรองด้วย `scan_status`
(pending/error/infected/clean/skipped) แทน — enqueue job `file_security_rescan`
**ไม่ลบ/ปิดไฟล์ทันทีตอน enqueue** ไฟล์ที่เผยแพร่อยู่ยังใช้งานได้ปกติระหว่างรอ
คิว จะปิดการเข้าถึงก็ต่อเมื่อ job ทำงานจริงแล้วพบว่าไม่ปลอดภัย (ดูหัวข้อ 3.4)
บันทึก `audit_logs` (`action: "file_security_bulk_rescan"`)

## 6. Worker / Cron — `/api/jobs/process`

Route Handler รับทั้ง `GET`/`POST` (Vercel Cron เรียกด้วย `GET`) **ต้องมี
header `Authorization: Bearer $CRON_SECRET` ตรงกับ environment variable
`CRON_SECRET` เสมอ** — ไม่ตั้งค่า `CRON_SECRET` ไว้ endpoint จะปฏิเสธคำขอ
**ทุกกรณี** (fail closed, คืน 503 ไม่ใช่เปิดให้เรียกได้อย่างอิสระ) header ไม่ตรง
คืน 401 — ไม่มีทางเรียกแบบไม่ยืนยันตัวตนได้เลย

รับ query param `batchSize` (1–20, ค่าเริ่มต้น 5) จำกัดจำนวน job ที่ประมวลผล
ต่อการเรียกหนึ่งครั้ง (เพดานความปลอดภัยเดิม ไม่เปลี่ยนตั้งแต่ช่วงที่ 20) แต่ละ
job ถูกครอบด้วย try/catch แยกกัน — job หนึ่งพังไม่กระทบ job อื่นในรอบเดียวกัน
คืน JSON สรุปผล `{ workerId, claimed, results }`

**(อัปเดตช่วงที่ 25)** เดิม worker claim job ทุกประเภทรวมกันแล้ว dispatch
เรียงทีละตัว (sequential loop) — ตอนนี้ claim แยกทีละประเภทงาน จำกัดจำนวนที่
claim ต่อประเภทด้วยค่า concurrency ที่ตั้งได้ (ดูหัวข้อ 11.5) แล้ว dispatch
ทุก job ที่ claim ได้ **พร้อมกัน** ผ่าน `Promise.all` — ผลรวมที่ claim ยังคงไม่
เกิน `batchSize` เดิมเสมอ (แค่แบ่งสัดส่วนต่างจากเดิม) **(ช่วงที่ 30)** endpoint
นี้เรียกได้พร้อมกันจากหลาย invocation จริงอย่างปลอดภัยแล้ว (concurrency ต่อ
ประเภทงานบังคับแบบ global ข้าม invocation ทั้งหมด ไม่ใช่แค่ต่อครั้งอีกต่อไป)
— ดูหัวข้อ 13 สำหรับรายละเอียดเต็มและวิธีเปิดใช้ worker หลายตัวจริงใน production

**ทุกครั้งที่ worker ทำงาน จะ "self-seed" job `access_expiration` และ
`maintenance_cleanup` (ช่วงที่ 31) ให้เองถ้ายังไม่มี job ที่ active ค้างอยู่**
(ไม่มีตัวจัดตารางเวลาแยกในโปรเจกต์นี้ ใช้จังหวะที่ Cron เรียก endpoint นี้เป็น
ตัวกำหนดความถี่แทน)

### 6.1 ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" (ทางเลือกสำหรับ dev/ยังไม่ตั้งค่า Cron)

ทั้งสองหน้า Super Admin มีปุ่มนี้ — เรียก dispatcher ตัวเดียวกับ endpoint ข้างบน
แต่ผ่านเซสชัน Super Admin ที่ยืนยันตัวตนแล้วแทน secret header ใช้ทดสอบ/เร่ง
ประมวลผลได้โดยไม่ต้องรอรอบ Cron ถัดไป

### 6.2 ตั้งค่า Cron สำหรับ Production

เพิ่มไฟล์ `vercel.json` ไว้ในโปรเจกต์แล้ว (schedule ทุก 5 นาที `*/5 * * * *`)
— **Vercel จะไม่เปิดใช้ Cron จริงจนกว่าคุณจะ deploy โปรเจกต์เอง** (ไฟล์นี้เป็น
แค่ configuration-as-code ไม่ใช่การ deploy) **ข้อจำกัดสำคัญที่ต้องรู้ก่อน
ตัดสินใจ**:

- **Vercel Hobby (แผนฟรี)**: Cron Job จำกัดความถี่ขั้นต่ำที่ **1 ครั้ง/วัน**
  เท่านั้น — schedule `*/5 * * * *` ใน `vercel.json` จะ**ใช้งานไม่ได้จริง**
  บนแผนนี้ ต้องปรับ schedule เป็นรายวัน (เช่น `0 3 * * *`) หรืออัปเกรดเป็น
  Vercel Pro ขึ้นไปจึงจะรันได้ถี่กว่านั้น
- **Vercel Pro ขึ้นไป**: รองรับความถี่สูงสุดทุก 1 นาที ตรวจสอบราคา/เงื่อนไข
  ล่าสุดที่เว็บไซต์ Vercel โดยตรงเสมอ (อาจเปลี่ยนแปลงได้)

**ทางเลือกฟรีที่ไม่ผูกกับ Vercel Cron** (เข้ากับข้อกำหนด "ห้ามเพิ่มบริการเสีย
ค่าใช้จ่าย"): ตั้ง cron job ภายนอกให้ยิง HTTP request ไปที่
`https://your-domain/api/jobs/process` พร้อม header `Authorization: Bearer $CRON_SECRET`
เป็นระยะ เช่น

- **cron-job.org** (free tier, ตั้งความถี่ได้เอง เช่นทุก 5 นาที)
- **GitHub Actions scheduled workflow** (free tier ของ public/private repo ตาม
  เงื่อนไขของ GitHub) — `schedule: cron: '*/5 * * * *'` แล้ว `curl` endpoint นี้
- ปุ่ม "ประมวลผลคิวเดี๋ยวนี้" (หัวข้อ 6.1) เป็นทางเลือกสำรองแบบกดเอง

### 6.3 Watchdog แยกต่างหาก — `/api/cron/health-check` (ช่วงที่ 31)

**ต้องตั้ง Cron ที่สองแยกจาก `/api/jobs/process` เสมอ** — ใช้ `CRON_SECRET`
เดียวกัน (header เดียวกันทุกประการ) แต่เป็น endpoint คนละตัว ตรวจสุขภาพของ
cron/worker อื่นๆ ทั้งหมด (ดูหัวข้อ 14 สำหรับรายละเอียดเต็ม) — เหตุผลที่ต้อง
แยก: ถ้าฝังการตรวจสอบไว้ใน worker เดียวกัน ตอน Cron ของ worker หยุดทำงาน
ทั้งหมดจริง การตรวจสอบก็หยุดไปด้วย ไม่มีทางตรวจจับ "worker หยุดทำงานทั้งหมด"
ได้เลย `vercel.json` เพิ่ม entry ที่สองไว้แล้ว (schedule ทุก 10 นาที) — ใช้
ทางเลือกฟรีเดียวกับข้างบนได้ทั้งหมด (cron-job.org/GitHub Actions ตัวที่สอง
แยกต่างหาก) ความถี่แนะนำ: ทุก 5–15 นาที (ดู
[`production-checklist.md`](production-checklist.md) หัวข้อ 18)

## 7. Environment Variables ที่ต้องตั้งค่าเพิ่ม

| ตัวแปร | จำเป็นเมื่อ | รายละเอียด |
| --- | --- | --- |
| `CRON_SECRET` | ต้องการให้คิวประมวลผลอัตโนมัติ (production) | Secret สุ่มยาวๆ (เช่น `openssl rand -hex 32`) — ไม่ตั้งค่า endpoint จะปฏิเสธทุกคำขอเสมอ ดู `.env.example` **ใช้ค่าเดียวกันนี้กับทั้ง `/api/jobs/process` และ `/api/cron/health-check` (ช่วงที่ 31)** ไม่ต้องแยกตัวแปรใหม่ |

ไม่มี environment variable ใหม่อื่นใดที่จำเป็น — ใช้ `SUPABASE_SERVICE_ROLE_KEY`
เดิมที่มีอยู่แล้ว (job ทุกตัวรันผ่าน Service Role เท่านั้น)

## 8. ข้อจำกัดที่ยังเหลืออยู่ (ตรงไปตรงมา — ไม่ปกปิด)

- **(แก้ไขแล้วในช่วงที่ 25)** เดิมไม่มี dead-letter queue แยก ไม่มีการแจ้งเตือน
  อัตโนมัติเมื่อ job ล้มเหลวถาวร — ตอนนี้มีหน้า `/superadmin/jobs` แสดงงานที่
  ล้มเหลวถาวรรวมทุกประเภท พร้อมแจ้งเตือน in-app/email ให้ Super Admin ทันที
  ที่เข้า DLQ ดูหัวข้อ 11.1/11.2
- **(แก้ไขแล้วในช่วงที่ 25)** เดิมจำกัดสูงสุด 500/200 รายการต่อคำขอโดยไม่มี
  ทางเลือกอื่น — ตอนนี้มีปุ่ม "ประมวลผลทั้งหมดตามตัวกรอง" ที่ทยอยสร้าง job
  เป็นชุดผ่าน background job coordinator แทน ไม่จำกัดจำนวน ดูหัวข้อ 11.4
- **(แก้ไขบางส่วนในช่วงที่ 29)** เดิม `progress` เป็นแค่ 0/100 ไม่มี handler
  ใดเขียนค่าจริง และไม่มี progress ระดับ "ภายใน" หนึ่ง job เดียว (เช่น "หน้าที่
  50/200") เลย — ตอนนี้ `ocr_processing` เขียนค่าจริงแล้วเมื่อ provider เป็น
  แบบ async และรายงานเลขหน้าได้ (ดู [docs/ocr-operations.md](./ocr-operations.md)
  หัวข้อ 3.3) **แต่เฉพาะ `ocr_processing` เท่านั้น** — job type อื่น
  (`pdf_text_extraction`, `file_security_rescan` ฯลฯ) ยังคงเป็น 0/100 เหมือน
  เดิมทุกประการ หน้า Super Admin ของ batch เหล่านั้นยังใช้
  `JobBatchSummary` per-status counts + ETA ต่อไป (ดูหัวข้อ 11.3) — งาน
  OCR สั่งทีละรายการ (ไม่มี `batch_id`) จึงแสดงผ่านรายการ `RecentJobsPoller`
  แยกต่างหาก ไม่ใช่ `JobBatchSummary`
- **Vercel Cron บนแผน Hobby ทำงานได้แค่วันละครั้ง** (ดูหัวข้อ 6.2) — สำหรับ
  ห้องสมุดที่มีการอัปโหลดถี่ ควรใช้ทางเลือกฟรีอื่น (cron-job.org/GitHub
  Actions) หรือปุ่ม "ประมวลผลคิวเดี๋ยวนี้" แทนระหว่างยังไม่อัปเกรดแผน
- **ภาพปก/เอกสารแนบยังคงสแกนมัลแวร์แบบ synchronous** (ดูหัวข้อ 3.1) — ไม่ใช่
  "ทุกอย่าง async" 100% ตามเจตนา (ไฟล์เล็ก ความเสี่ยง timeout ต่ำ)
- **(แก้ไขแล้วในช่วงที่ 25/30)** เดิม worker ประมวลผลทีละ job ในลูป ไม่ขนานเลย
  — ตอนนี้ dispatch พร้อมกันผ่าน `Promise.all` จำกัดจำนวนต่อประเภทงานด้วย
  concurrency ที่ตั้งได้ (ดูหัวข้อ 11.5) การขนานภายในหนึ่ง invocation ยังคง
  เป็น concurrent `await` (ไม่ใช่ thread ขนานแบบ OS — ธรรมชาติของ Serverless)
  แต่ตั้งแต่ช่วงที่ 30 **หลาย invocation ทำงานพร้อมกันจริงก็ปลอดภัยแล้วเช่นกัน**
  (concurrency บังคับแบบ global ข้าม invocation ทั้งหมด ไม่ใช่แค่ต่อครั้ง) ดู
  หัวข้อ 13
- **(แก้ไขบางส่วนในช่วงที่ 30)** เดิมไม่มี metrics/dashboard แยกสำหรับ queue
  health เลย — ตอนนี้หน้า `/superadmin/jobs` มีส่วน "สถานะ Queue โดยรวม"
  (จำนวน worker ที่ active จริง, จำนวนงานต่อสถานะ, job ที่ lease หมดอายุ, job
  ที่รอนานผิดปกติ ดูหัวข้อ 13.4) แต่ยังเป็น snapshot ตอนโหลดหน้า ไม่ auto-
  refresh และไม่มีอัตราความสำเร็จ/เวลารอเฉลี่ยแบบกราฟ/แนวโน้มย้อนหลัง — ดูได้
  จากตาราง "ชุดงานล่าสุด" (พร้อม ETA ตั้งแต่ช่วงที่ 25) เพิ่มเติมสำหรับ batch
  ที่สั่งเป็นชุด
- **(แก้ไขแล้วในช่วงที่ 26)** เดิมหน้าต่างแจ้งเตือนล่วงหน้าก่อนสิทธิ์หมดอายุ
  (3 วัน) เป็นค่าคงที่ในโค้ด (`NEAR_EXPIRY_WARNING_WINDOW_DAYS`) ไม่มีช่องทาง
  อีเมลเลย — ตอนนี้ Super Admin ปรับจำนวนวัน (1-30) และเปิด/ปิด in-app/email
  แยกเฉพาะฟีเจอร์นี้ได้ที่ `/superadmin/notifications` (ดูหัวข้อ 9.1)
- **แจ้งเตือนล่วงหน้าเฉพาะ `document_access_grants` เท่านั้น ไม่ครอบคลุม
  `access_requests`** — เพราะ `document_access_grants` เป็นจุดบังคับสิทธิ์
  จริง (`access_requests` เป็นแค่ประวัติคำขอ) เป็นการตัดสินใจตั้งใจ ไม่ใช่ช่อง
  โหว่ (ดู [docs/document-access-requests.md](./document-access-requests.md)
  หัวข้อ 6)
- **(ช่วงที่ 31) Watchdog เองก็ต้องพึ่ง Cron ของตัวเองทำงานอยู่** — ถ้าทั้ง
  Cron ของ `queue_worker` และ `health_monitoring` หยุดทำงานพร้อมกันทั้งคู่
  (เช่น แพลตฟอร์ม scheduler ภายนอกล่มทั้งระบบ, `CRON_SECRET` ถูกเปลี่ยนโดยไม่
  อัปเดต scheduler ทั้งสองตัว) จะไม่มีอะไรตรวจจับ/แจ้งเตือนได้เลย — แนะนำให้
  ตั้ง Cron ทั้งสองตัวผ่าน scheduler ที่เป็นอิสระจากกันจริง (เช่น ตัวหนึ่งผ่าน
  Vercel Cron อีกตัวผ่าน cron-job.org) ไม่ใช่ scheduler เดียวกันทั้งคู่ เพื่อลด
  โอกาสที่ทั้งสองจะล่มพร้อมกันจากสาเหตุเดียว
- **(ช่วงที่ 31) `cron_runs`/`cron_alert_state` ไม่มีการล้างข้อมูลเก่าอัตโนมัติ**
  — สะสมไปเรื่อยๆ เหมือน `audit_logs` เดิม (ยังไม่ใช่ปัญหาที่ scale ของโปรเจกต์
  นี้ แต่ควรพิจารณาถ้าใช้งานมานานหลายปี)

## 9. หมดอายุสิทธิ์เข้าถึงและ Publish Event กลาง (ช่วงที่ 21)

### 9.1 `access_expiration` ครอบคลุม `document_access_grants` แล้ว

Handler ของ job นี้ (`lib/jobs/handlers/access-expiration.server.ts`) เรียก 3
ฟังก์ชัน SQL ในรอบเดียว (migration
`20260811100000_access_expiration_and_publish_events.sql`):

1. `expire_stale_access_requests()` (เดิมช่วงที่ 18/20) — เปลี่ยนคำขอ
   `approved` ที่หมดอายุแล้วเป็น `expired`
2. `expire_stale_access_grants()` (ใหม่) — ปิด `document_access_grants` ที่
   หมดอายุแล้วด้วย `revoked_at` + `revoke_reason` มาตรฐาน แจ้งผู้ใช้ด้วย
   ถ้อยคำ "หมดอายุ" (แยกจาก "ถูกเพิกถอนโดยเจ้าหน้าที่")
3. `warn_expiring_access_grants(p_window_days)` — แจ้งเตือนล่วงหน้าก่อน
   หมดอายุจริง กันแจ้งซ้ำด้วยคอลัมน์ `expiry_warned_at`

**(อัปเดตช่วงที่ 26)** `p_window_days` ไม่ใช่ค่าคงที่ `3` อีกต่อไป — handler
อ่านจาก `settings.access_expiration_warning_days` (ปรับได้ที่
`/superadmin/notifications`, ช่วงที่ 26, ค่าเริ่มต้น/fallback ยังเป็น 3 เหมือนเดิม
ถ้าอ่านค่าไม่ได้) ก่อนเรียก RPC ทุกครั้ง `warn_expiring_access_grants` เปลี่ยน
return type จาก `void` เป็น `TABLE(...)` (คืนรายการสิทธิ์ที่เพิ่งถูกแจ้งเตือนใน
รอบนี้) เพื่อให้ TypeScript ส่งอีเมลต่อได้ทันทีในรอบเดียวกัน (ไม่ query ซ้ำ) —
เดิมฟีเจอร์นี้ไม่มีช่องทางอีเมลเลย ตอนนี้เปิด/ปิดแยกต่างหากได้ที่
`settings.access_expiration_warning_email_enabled` (ต้องเปิดคู่กับมาสเตอร์
สวิตช์ `notifications_email_enabled` เดิมด้วย) ส่งผ่าน
`notifyExpiringAccessGrantsByEmail()` ใน
`lib/notifications/access-request-email.server.ts` (ไฟล์เดิมที่ดูแลอีเมลของ
โดเมนคำขอเข้าถึงเอกสารอยู่แล้ว) **การกันแจ้งซ้ำใช้ guard เดียวกันทั้ง in-app และ
อีเมล** — ทั้งสองช่องทางอ่านจากผลลัพธ์ "due" ชุดเดียวกันของ RPC เรียกครั้งเดียว
(`expiry_warned_at IS NULL` แบบ atomic) จึงไม่มีทางแจ้งซ้ำสำหรับสิทธิ์เดิมไม่ว่า
job จะรันกี่รอบก็ตาม

ทั้งสามฟังก์ชัน idempotent โดยธรรมชาติ (ใช้คอลัมน์สถานะของแถวเองเป็นเงื่อนไข
WHERE ไม่ใช่ flag แยกที่อาจหลุดซิงค์) **การตรวจสิทธิ์จริงตอนสร้าง Signed URL
ไม่พึ่งพา job นี้เลย** เหมือนเดิมทุกประการ (ไฟล์ `lib/data/access-grants.server.ts`/
`lib/storage/signed-url.server.ts` ไม่ถูกแก้ไขแม้แต่บรรทัดเดียวในช่วงที่ 26)
— ทดสอบยืนยันแล้วว่า grant ที่
หมดอายุถูกปฏิเสธถูกต้องตั้งแต่ก่อน job รันด้วยซ้ำ (เช็ค `expires_at` ของแถว
จริงตรงๆ) ดูรายละเอียดที่
[docs/document-access-requests.md](./document-access-requests.md) หัวข้อ 6

Super Admin กดปุ่ม **"ประมวลผลสิทธิ์ที่หมดอายุทันที"** ที่
`/superadmin/notifications` เพื่อรันเฉพาะ job ประเภทนี้ทันที (ผ่าน
`processJobQueue(5, ["access_expiration"])` — พารามิเตอร์ `jobTypes` ใหม่ของ
`processJobQueue()` จำกัดไม่ให้แตะ job ประเภทอื่นที่อาจค้างอยู่พร้อมกัน)

### 9.2 Publish Event กลาง — `notifyResearchPublished()`

ก่อนช่วงที่ 21 การแจ้งเตือนเมื่อเผยแพร่งานวิจัย (in-app ผ่าน DB trigger, email
ผ่าน Server Action) ถูกเรียกกระจายไม่สม่ำเสมอในแต่ละเส้นทาง — เส้นทาง "สร้าง
งานใหม่พร้อมเผยแพร่ทันที" ไม่เคยแจ้งอีเมลเลยเพราะไม่มี Server Action ใดเรียก
ให้ ตั้งแต่ช่วงที่ 21 ทุกเส้นทางเรียก `notifyResearchPublished()`
(`lib/publishing/publish-event.server.ts`) จุดเดียวกันแทน จัดการ:

- Audit log กลาง (`action: "research_published"`)
- In-app แจ้งผู้ติดตามหมวดหมู่ ผ่าน RPC `notify_category_subscribers_published`
  (ย้ายออกจาก DB trigger เพราะต้องรอ `research_categories` ถูกเขียนก่อน)
- Email แจ้งผู้ติดตามหมวดหมู่ — enqueue job `category_notification` เดิม
- กันแจ้งซ้ำด้วยคอลัมน์ `research_items.category_notified_at` (atomic
  check-and-set ในตัว RPC เดียวกัน, ล้างอัตโนมัติเมื่อสถานะออกจาก published
  เพื่อให้ "เผยแพร่ซ้ำหลังปิดเผยแพร่" แจ้งใหม่ได้ถูกต้อง)

รายละเอียดเต็ม (ตารางเส้นทางที่เรียก, เหตุผลการออกแบบ) ดูที่
[docs/document-access-requests.md](./document-access-requests.md) หัวข้อ
"Publish Event กลาง"

## 11. ความเสถียรของ Queue (ช่วงที่ 25)

### 11.1 Dead-letter Queue — `/superadmin/jobs`

**ไม่มีสถานะ `dead_letter` ใหม่** — `status = 'failed'` (เกิดเมื่อ
`attempts >= max_attempts` เท่านั้น ตามหัวข้อ 2.3 เดิม) ทำหน้าที่เป็นสถานะ
ล้มเหลวถาวรอยู่แล้วโดยธรรมชาติ ใช้ต่อได้เลยแทนการเพิ่ม enum ใหม่หรือตารางแยก —
เพิ่มแค่ 4 คอลัมน์ (`resolved_at`/`resolved_by`/`resolution_note`/
`dead_letter_notified_at`, migration
`20260814100000_background_jobs_reliability.sql`) และ index บางส่วน
(`idx_background_jobs_dead_letter`) สำหรับ "รายการที่ยัง active"

หน้า `/superadmin/jobs` (Super Admin เท่านั้น) แสดง 2 มุมมอง:

- **ยังต้องดำเนินการ** — `status = 'failed' AND resolved_at IS NULL` รวม
  **ทุกประเภทงาน** ในหน้าเดียว (ต่างจาก `FailedJobList` เดิมที่หน้า
  pdf-processing/file-security/data-quality ซึ่งกรองแค่ job_type เดียวของหน้า
  นั้นๆ — สองอย่างนี้อยู่ร่วมกันได้ ไม่ได้แทนที่กัน)
- **ประวัติที่จัดการแล้ว** — `resolved_at IS NOT NULL` (ครอบคลุมทั้งที่ถูก
  "ยกเลิก" และ "ทำเครื่องหมายว่าแก้ไขแล้ว")

สามการดำเนินการ (`app/superadmin/jobs/actions.ts`, ทุกตัว `requireMinRank(50)`
+ `logAudit()` เสมอ):

| การดำเนินการ | ผลกับ `status` | ผลกับ `resolved_*` |
| --- | --- | --- |
| **ลองใหม่** (`retryFailedJob`) | กลับเป็น `pending`, `attempts` รีเซ็ตเป็น 0 | ล้างทั้งหมดกลับเป็น `null` (รอบล้มเหลวถัดไปแจ้งเตือนใหม่ได้) |
| **ยกเลิกงานนี้** (`cancelDeadLetterJob`) | เปลี่ยนเป็น `cancelled` ถาวร | ตั้ง `resolved_at`/`resolved_by`/`resolution_note` |
| **ทำเครื่องหมายว่าแก้ไขแล้ว** (`resolveDeadLetterJob`) | **ไม่เปลี่ยน** (ยังคง `failed` เพื่อเก็บประวัติ) | ตั้ง `resolved_at`/`resolved_by`/`resolution_note` (บังคับกรอกหมายเหตุ) |

**ข้อมูลที่แสดงผ่านการ allowlist เสมอ** (`lib/jobs/dlq.server.ts`,
`describeJobForDisplay()`/`describeJobsForDisplay()`) — ไม่มีจุดใดส่ง
`job.payload` ดิบไปแสดงที่ UI เลย เลือกแสดงแค่ป้ายชื่อประเภทงาน (ภาษาไทย) +
ชื่องานวิจัยที่เกี่ยวข้อง (ถ้ามี, resolve จาก `research_items.title_th` ผ่าน
`entity_id` แบบ batch query เดียวกันเดียวกันสำหรับทั้งหน้า กัน N+1) —
`error_message` ที่แสดงอยู่แล้วเป็นข้อความปลอดภัยจาก `toSafeJobErrorMessage()`
ตามเดิม (หัวข้อ 2.3) ไม่มีการเปลี่ยนแปลง — **retry history ใช้ `audit_logs`
เดิมเป็นแหล่งข้อมูล** ไม่มีตาราง history แยกใหม่ (ทุกการดำเนินการทั้ง 3 แบบ
ข้างต้น log ด้วย `action: "background_job_retry"` / `"background_job_cancel"`
/ `"background_job_resolve"`, `entity_type: "background_jobs"`)

### 11.2 แจ้งเตือน Super Admin เมื่อ job เข้า DLQ

**สร้าง notification ฝั่ง SQL โดยตรง** ภายใน `fail_background_job()` (ไม่ใช่
กระจายไปเรียกจาก handler ทั้ง 6-7 ตัว) — เมื่อ `attempts >= max_attempts`
เป็นครั้งแรก (`dead_letter_notified_at IS NULL`) จะ insert แถว `notifications`
ให้ผู้ใช้ทุกคนที่มี role rank ≥ 50 (Super Admin เท่านั้น — ไม่ใช่ ≥ 40 เหมือน
precedent ของ `file_security_rescan_closed_access` เดิม เพราะหน้า
`/superadmin/jobs` เองก็จำกัดสิทธิ์แค่ Super Admin อยู่แล้ว) พร้อม
`audit_logs` (`action: "background_job_dead_letter"`, `actor_id: null` เพราะ
เป็นเหตุการณ์ที่ระบบสร้างเอง ไม่ใช่การกระทำของผู้ใช้) ในธุรกรรมเดียวกัน —
`fail_background_job()` เปลี่ยน return type จาก `void` เป็น `boolean` (บอกว่า
รอบนี้เป็นรอบที่เพิ่งเข้า DLQ จริงหรือไม่)

**ใช้ `notifications.type = 'warning'` เดิม ไม่เพิ่มค่า enum ใหม่** — เหตุผล
เดียวกับ tradeoff ที่เคยพิจารณาไว้: การเพิ่มค่า `'error'` ใหม่ต้องแก้ 3 จุด
พร้อมกัน (CHECK constraint + `AppNotification` TS union + `NotificationBell.tsx`)
ไม่คุ้มกับสถานะที่สื่อความหมายใกล้กับ `warning` อยู่แล้ว

**อีเมล** (`lib/jobs/dlq-notify.server.ts::sendDeadLetterEmailAlerts()`) แยก
ออกจาก in-app notification — เรียกจาก TS wrapper `failBackgroundJob()`
(`lib/jobs/queue.server.ts`) เฉพาะตอนที่ RPC คืนค่า `true` เท่านั้น ใช้รูปแบบ
เดียวกับ `notifyCategorySubscribersByEmail` เดิมทุกประการ (gate ด้วย
`settings.notificationsEmailEnabled` + `isEmailProviderConfigured()`,
`Promise.all` ต่อผู้รับกันคนเดียวส่งไม่สำเร็จบล็อกคนอื่น, ไม่ throw ออกไปให้
`failBackgroundJob` ล้มเหลวตาม)

**กันแจ้งซ้ำ**: `dead_letter_notified_at IS NULL` เป็น guard เดียวกันทั้ง
in-app และอีเมล (เช็คครั้งเดียวในธุรกรรม SQL, ถูก `select ... for update` ที่
ต้นฟังก์ชันเดิม serialize การเรียกซ้อนกันของ job เดียวกันไว้ให้แล้ว) — ถูกล้าง
กลับเป็น `null` เมื่อสั่ง "ลองใหม่" เท่านั้น (เหมือน `category_notified_at`
ของช่วงที่ 21 ที่ล้างอัตโนมัติเมื่อออกจากสถานะ published — รูปแบบเดียวกัน คือ
"ล้าง guard เมื่อออกจากสถานะที่เพิ่งแจ้งไป" เพื่อให้รอบถัดไปแจ้งใหม่ได้)

### 11.3 Progress ที่ละเอียดขึ้น + Polling

**เปลี่ยนวิธีคำนวณทั้งหมดในช่วงที่ 28** — เดิม `getRecentJobBatches()` ดึง
`background_jobs` สูงสุด 2000 แถวมา group ใน JS ทุกครั้งที่เรียก (ไม่แม่นยำถ้า
batch ใหญ่กว่า 2000 แถวรวมกัน และขัดกับหลักการ "ห้ามโหลดรายการทั้งหมดเข้า
หน่วยความจำเพื่อคำนวณจำนวนรวม") ตอนนี้ `job_batches` มีตัวนับของตัวเองแล้ว
(`completed_items`/`failed_items`/`cancelled_items`/`skipped_items`) อัปเดต
แบบ O(1) ทุกครั้งที่ job ลูกเปลี่ยนสถานะ — `getRecentJobBatches()` จึงเป็นแค่
`SELECT * FROM job_batches WHERE job_type=... ORDER BY created_at DESC LIMIT N`
ธรรมดา ไม่แตะ `background_jobs` เลย ดูหัวข้อ 11.6 สำหรับกลไกเต็ม

`JobBatchSummary` เปลี่ยนชื่อฟิลด์ (ไม่ backward-compatible กับก่อนช่วงที่ 28):
`enqueuedItems`/`totalItems`/`batchSize`/`completed`/`failed`/`cancelled`/
`skipped`/`inProgress` (รวม pending+processing เป็นค่าเดียว — แยกละเอียดได้
เฉพาะตอนเปิด `JobBatchDetailDrawer` ผ่าน `getJobBatchDetail()` ซึ่งเรียก
`get_job_batch_progress()` RPC, `GROUP BY` จริงใน Postgres, ไม่ใช่การนับใน JS)
ETA ยังคำนวณจากเวลาเฉลี่ยต่อรายการเหมือนเดิม แต่อิงจาก `startedAt` +
`completedItems` แทน (ต้องมี `completed ≥ 5` ก่อนถึงจะแสดง — ฐานประมาณจากงาน
น้อยเกินไปไม่น่าเชื่อถือ)

**Polling**: หน้า pdf-processing/file-security/data-quality ทั้ง 3
เปลี่ยนจาก `<JobBatchList>` แบบ static (แสดงเฉพาะตอนโหลดหน้า) เป็น
`<JobProgressPoller jobType initialBatches>` (`components/superadmin/`) —
ดึงข้อมูลใหม่ทุก 5 วินาทีผ่าน route ใหม่ `GET /api/superadmin/jobs/batches?jobType=...`
(auth ผ่าน session ปกติ rank ≥ 50, **คนละ endpoint กับ `/api/jobs/process`
ที่ป้องกันด้วย `CRON_SECRET`โดยสิ้นเชิง — ไม่ใช่ worker endpoint**) เลือกใช้
route JSON แยกแทน `router.refresh()` เพราะ `router.refresh()` จะรัน query
รายการผู้สมัคร 500 แถวของหน้านั้นซ้ำทุก 5 วินาทีโดยไม่จำเป็น หยุด poll เมื่อ
แท็บไม่ได้อยู่ในโฟกัส (`document.visibilityState`) เมื่อ fetch ไม่สำเร็จแสดง
คำเตือนเล็กๆ แต่ยังคงข้อมูลล่าสุดที่มีไว้ (fail-open)

### 11.4 ประมวลผลเกิน 500 รายการ — "ประมวลผลทั้งหมดตามตัวกรอง"

ขีดจำกัด 500 รายการต่อการโหลดหน้า (`MAX_CANDIDATES`) และ 200 รายการต่อการกด
"ประมวลผลที่เลือก" ยังคงเดิมทุกประการ (กันโหลดข้อมูลหนักเกินไปในคำขอเดียว) —
เพิ่มปุ่มใหม่แยกต่างหาก **"ประมวลผลทั้งหมดตามตัวกรอง (ไม่จำกัด 500 รายการ)"**
ที่ทั้ง 3 หน้า (pdf-processing ทั้ง 2 แท็บ, file-security, data-quality) ทำงาน
ผ่านกลไกใหม่แทนการรับรายการ id ที่เลือกไว้:

```
Server Action (bulkEnqueueAllMatchingFilterAction)
  1. นับจำนวนรวมที่ตรง filter แม่นยำ (getXxxCandidatesCount)
  2. insert แถว job_batches หนึ่งแถว (เก็บ job_type/filter_snapshot/total_items)
  3. enqueue job `bulk_enqueue` หนึ่งงาน (payload = {job_batches_id})
        │
        ▼
handleBulkEnqueueJob (coordinator, ทำงานเป็นรอบๆ ด้วยตัวเอง)
  แต่ละรอบ worker:
  1. ดึง candidate chunk ถัดไป (ขนาดตาม job_batches.batch_size — ปรับได้ต่อ
     คำขอ ค่าเริ่มต้นจาก job_type_settings.default_batch_size, ช่วงที่ 28)
     ผ่าน keyset cursor (getXxxCandidatesPage — ORDER BY updated_at DESC,
     id DESC — ตั้งแต่ช่วงที่ 28 กรอง/join ทั้งหมดทำในฐานข้อมูลผ่าน SQL
     function แล้ว ไม่มี JS-side join เหลืออยู่เลย ดูหัวข้อ 11.6)
  2. enqueueBackgroundJob ให้ทุกรายการใน chunk (idempotency key เดียวกับ
     bulk action เดิมทุกประการ — "{job_type}:{research_item_id}")
  3. commit cursor ใหม่ลง job_batches (enqueued_items/cursor_after_*)
  4. ถ้ายังไม่หมด: requeueJob ตัวเอง (run_after = +2 วินาที) ให้รอบถัดไปทำต่อ
     ถ้าหมดแล้ว: job_batches.status = 'ready', complete job
```

**ทำไมออกแบบเป็น coordinator job ที่ requeue ตัวเอง แทนที่จะ loop สร้างทั้งหมด
ในคำขอเดียว**: (1) ไม่โหลดรายการที่ตรงเงื่อนไขทั้งหมดเข้าหน่วยความจำครั้งเดียว
— แต่ละรอบดึงแค่ 100 แถว (2) **resume ได้เองถ้า worker ตายกลางคัน** (เช่น
serverless function timeout) — lease 10 นาทีเดิมของ `claim_background_jobs`
หมดอายุแล้วมี worker รอบถัดไปหยิบ job นี้กลับมาทำต่อจาก cursor ที่ commit ไว้
ล่าสุดโดยอัตโนมัติ ไม่ต้องมี logic reclaim ใหม่เลย (ทดสอบยืนยันแล้วว่า resume
ต่อจาก cursor เดิมจริง ไม่เริ่มนับจาก 0 ใหม่) (3) job หนึ่งพังไม่กระทบรายการ
อื่น — error ระหว่างทางเข้ากลไก retry/backoff/DLQ เดิมทุกประการ (หัวข้อ 11.1)
ไม่ใช่ error แบบไม่มีที่ทาง

**`max_attempts` ของ `bulk_enqueue` job ตั้งสูงกว่าปกติมาก** (ขั้นต่ำ 50,
คำนวณจากจำนวน chunk ที่คาดว่าต้องใช้ + buffer 20) — เพราะการ requeue ตัวเอง
นับเป็น 1 attempt ตามกลไก `claim_background_jobs` เดิม (ไม่ใช่แค่ความล้มเหลว
จริง) งานที่มีหลาย chunk มากจะโดนตัดเข้า DLQ ก่อนเวลาอันควรถ้าไม่เผื่อไว้

**อัปเดต (ช่วงที่ 28)**: ข้อจำกัดข้างต้นเดิม (`"no_text"`/`"replaced"`
นับไม่ได้, `categoryId` ใช้กับปุ่มนี้ไม่ได้) **หมดไปแล้ว** — ดูหัวข้อ 11.6

### 11.5 Concurrency ที่ปรับได้ต่อประเภทงาน (บังคับแบบ global ข้าม worker/instance ตั้งแต่ช่วงที่ 30 — ดูหัวข้อ 13)

ตารางใหม่ `job_type_settings` (คีย์ด้วย `job_type`, คอลัมน์ `concurrency`
1-20) ปรับได้ที่หน้า `/superadmin/jobs` (`requireMinRank(50)` → validate →
update → `logAudit` รูปแบบเดียวกับ `updateSystemSettingsAction` เดิม) —
ค่าเริ่มต้นตอน migrate:

| ประเภทงาน | Concurrency เริ่มต้น | เหตุผล |
| --- | --- | --- |
| `ocr_processing` | 1 | พึ่งพา provider ภายนอกที่มักจำกัด rate limit มากที่สุด |
| `pdf_text_extraction` | 4 | ใช้แค่ CPU/IO ไม่มี provider ภายนอก |
| `file_security_rescan` | 3 | เรียก malware scan provider ภายนอก |
| `duplicate_scan` | 3 | เทียบข้อมูลในฐานข้อมูลเอง ไม่มี provider ภายนอก |
| `category_notification` | 5 | แค่ query + enqueue อีเมล ต้นทุนต่ำ |
| `access_expiration` | 1 | self-seed ทีละ job เดียวอยู่แล้วผ่าน idempotency key |
| `bulk_enqueue` | 1 | coordinator งานเดียวต่อ batch ไม่ได้ประโยชน์จากการรันพร้อมกันหลายตัว |

**กลไก (ช่วงที่ 25, บังคับแบบ global จริงตั้งแต่ช่วงที่ 30)**:
`processJobQueue()` (`lib/jobs/dispatch.server.ts`) claim แยกทีละประเภทงาน
จำกัดด้วย `min(concurrency ที่ตั้งไว้, งบที่เหลือ)` ต่อประเภท (ผลรวมทั้งหมดยัง
ไม่เกิน `batchSize` เดิมเสมอ) แล้ว dispatch ทุก job ที่ claim ได้พร้อมกันผ่าน
`Promise.all` — บน Vercel Serverless นี่คือ concurrent `await` ภายใน function
invocation เดียว (ใช้ได้จริงกับงานที่รอ I/O เช่น เรียก OCR provider/ดาวน์โหลด
จาก Storage) ไม่ใช่ thread ขนานแบบ OS **ตั้งแต่ช่วงที่ 30 การ claim เรียก
`claim_background_jobs_with_concurrency()` (RPC ใหม่) แทน `claim_background_jobs()`
เดิม — ดูหัวข้อ 13 สำหรับรายละเอียดเต็มว่าทำไมค่า concurrency เดิมเป็นแค่เพดาน
ต่อการเรียกหนึ่งครั้งเท่านั้น ไม่ใช่เพดานรวมจริงข้าม worker/instance**

**ป้องกันประมวลผล entity เดียวกันซ้ำซ้อน — ไม่ต้องมีกลไกใหม่เลย**:
partial unique index `idx_background_jobs_idempotency_active` เดิม (ช่วงที่
20) ทำให้ claim ไม่มีทางได้ job ที่ active ซ้ำกันของ entity+job_type เดียวกัน
อยู่แล้วในระดับฐานข้อมูล ไม่ว่า concurrency จะตั้งเท่าไหร่ก็ตาม (กลไกนี้คุ้มครอง
อยู่แล้วตั้งแต่ก่อน worker จะ dispatch พร้อมกัน ไม่ใช่สิ่งที่เพิ่งเพิ่มมาช่วยช่วง
นี้) — `acquire_extraction_lock()`/`acquire_ocr_lock()` (ช่วงที่ 17/23) ยังคง
เป็นด่านป้องกันชั้นที่สอง เฉพาะเจาะจงสำหรับ `pdf_text_extraction`/
`ocr_processing` ที่ระดับแถว `research_document_texts` (ครอบคลุมกรณี lease
หมดอายุ/แทนที่ไฟล์ที่ idempotency key เพียงอย่างเดียวไม่ครอบคลุม)

### 11.6 Filter Parity เต็มรูปแบบ + Master Job Lifecycle (ช่วงที่ 28)

ปิดช่องว่างทั้งหมดของหัวข้อ 11.4 เดิม — ทุก filter ของทั้ง 3 หน้า (รวม OCR)
ใช้ปุ่ม "ประมวลผลทั้งหมดตามตัวกรอง" ได้แล้ว พร้อม pause/resume/cancel,
ตัวนับ progress แบบ O(1), การสร้าง master job แบบ idempotent, และแจ้งเตือน
Super Admin เมื่อ batch เสร็จ/ล้มเหลว/มี DLQ

**นับ/แบ่งหน้าผ่าน SQL function แทน PostgREST query builder** (migration
`20260817110000_bulk_candidate_functions.sql`) — เหตุผล: บาง filter ต้องใช้
LEFT JOIN ตรวจการไม่มีแถว (`never_attempted` — ไม่เคยดึงข้อความเลย) หรือเทียบ
คอลัมน์ข้ามตาราง (`replaced` — `source_file_path != research_items.pdf_file`)
ซึ่ง Supabase-js query builder แสดงออกไม่ได้เลย (`.neq()` เทียบกับค่าคงที่
เท่านั้น ไม่ใช่อีกคอลัมน์) — ฟังก์ชันใหม่ 6 ตัว (`count_*`/`page_*` ×
pdf-processing/duplicate-scan/file-security) รันผ่าน Service Role client
เดิมทุกประการ (`security invoker`, grant ให้ `service_role` เท่านั้น):

| โดเมน | ตัวกรองใหม่ที่เพิ่ม | หมายเหตุ |
| --- | --- | --- |
| pdf-processing/OCR | `extractionState` (รวม `never_attempted`/`replaced` ที่เดิมนับไม่ได้), `ocrStatus` (มิติใหม่ — กรอง `ocr_status` เองได้ตรงๆ ครั้งแรก แยกจาก `extractionState`), `year`, `categoryId`, `publishStatus` | `extractionState`/`ocrStatus` เป็นสองมิติอิสระที่ AND กัน (สเปกเดิมใช้ `no_text_found` ปนกันทั้งสองความหมาย) |
| duplicate-scan | `categoryId` (เดิมนับไม่ได้เพราะต้อง join `research_categories`), `neverScannedOnly` (ไม่เคยเป็นคู่ใน `duplicate_research_reviews` เลย ไม่ว่าฝั่งใดของคู่ — ตารางนี้เก็บคู่แบบ canonical `research_item_id < candidate_research_item_id` ต้องเช็คทั้งสองคอลัมน์) | `recentlyEditedOnly` เดิม (fixed 30 วัน) กลายเป็นกรณีพิเศษของ `editedAfter` ทั่วไป |
| file-security | `fileKind` (`pdf`/`attachment`/`either` — อนุมานจากการมี `pdf_file`/`attachment_file` เพราะไม่มีคอลัมน์ประเภทไฟล์จริง), `createdAfter`/`createdBefore` (ช่วงวันที่อัปโหลด), `neverScannedOnly` (`scanned_at IS NULL` — คนละความหมายกับ `scan_status='pending'` ที่อาจตั้งไว้แล้วระหว่างรอคิว) | |

**"ประเภทผลงาน"** ที่ระบุในสเปกทั้งหน้า pdf-processing และ data-quality
**คือหมวดหมู่ (`categoryId`) ตัวเดียวกัน** — ยืนยันกับผู้ใช้แล้วว่าไม่ต้องเพิ่ม
คอลัมน์ประเภทผลงานแยกต่างหาก (schema ปัจจุบันมีแค่มิติการจัดหมวดหมู่เดียว)

**Zod validation** (`lib/validation/bulk-filters.ts`, ใหม่) — `.strict()`
ทุก schema ปฏิเสธ field ที่ไม่รู้จัก, ไม่มี schema ใดรับ `sort`/`orderBy`
(ลำดับคงที่ `updated_at DESC, id DESC` ควบคุมฝั่งเซิร์ฟเวอร์เสมอ) — ตรวจก่อน
ส่งต่อไปยัง RPC ทุกครั้งใน `bulkEnqueueAllMatchingFilterAction` ของทั้ง 3 หน้า

**Master job (`job_batches`) เพิ่มคอลัมน์ใหม่** (migration
`20260817100000_job_batches_lifecycle_schema.sql`):

| คอลัมน์ | ความหมาย |
| --- | --- |
| `status` | เพิ่ม `'paused'`/`'completed'`/`'failed'` (เดิมมีแค่ `enqueueing`/`ready`/`cancelled`) — `completed`/`failed` ตั้งโดย `finalize_job_batch_if_drained()` เท่านั้นเมื่อ job ลูกทุกตัวถึงสถานะสุดท้ายแล้ว |
| `batch_size` | ขนาด chunk ต่อรอบ (แทน `CHUNK_SIZE=100` เดิมที่ hardcode ในโค้ด) ปรับได้ต่อคำขอผ่านกล่องยืนยัน ค่าเริ่มต้นจาก `job_type_settings.default_batch_size` |
| `filter_hash` | `md5(filter_snapshot::text)` คำนวณฝั่ง SQL (jsonb normalize ลำดับ key เองอยู่แล้ว จึง stable) ใช้คู่กับ unique index กันสร้างซ้ำ |
| `completed_items`/`failed_items`/`cancelled_items`/`skipped_items` | ตัวนับ O(1) — ดูด้านล่าง |
| `started_at`/`paused_at`/`cancelled_at`/`completed_at` | เวลาช่วงต่างๆ ของวงจรชีวิต |
| `completed_notified_at`/`failed_notified_at`/`dlq_notified_at` | dedup การแจ้งเตือน (รูปแบบเดียวกับ `dead_letter_notified_at` เดิมทุกประการ) |

**สร้างแบบ idempotent** — `create_job_batch_if_not_exists()` (SQL, security
definer, ตรวจ `user_max_role_rank() >= 50` ภายใน) `INSERT ... ON CONFLICT
(job_type, filter_hash) WHERE status IN ('enqueueing','ready','paused') DO
NOTHING` — กดปุ่มซ้ำสำหรับ filter เดิมขณะที่ยังมีงาน active อยู่จะได้ batch
เดิมกลับมา (`isNew: false`) ไม่สร้าง coordinator job ที่สองซ้อนกัน

**Pause/Resume/Cancel** — `set_job_batch_status()` (SQL, security definer +
`user_max_role_rank() >= 50` ภายใน — "RBAC สองชั้น" เดียวกับ `requireMinRank(50)`
ฝั่ง TS ใน `lib/jobs/batch-control.server.ts`) เปลี่ยนสถานะแบบ atomic
state-guarded UPDATE เดียว:

- **Pause**: coordinator (`handleBulkEnqueueJob`) ตรวจ `status === 'paused'`
  ที่ต้นทุกรอบเหมือนกับ `cancelled` เดิม — ถ้าถูก pause จะ `requeueJob` ตัวเอง
  อีกครั้งหลัง 30 วินาที (ยาวกว่ารอบปกติ 2 วินาที เพราะไม่มีอะไรต้องทำ) โดยไม่
  แตะ cursor/ไม่ enqueue อะไรเลย — **resume แค่เปลี่ยนสถานะกลับ ไม่ต้องสร้าง
  coordinator job ใหม่**
- **Cancel**: `UPDATE background_jobs SET status='cancelled' WHERE
  batch_id=... AND status='pending'` — แตะเฉพาะที่ยัง `pending` เท่านั้น
  (`processing`/`completed`/`failed` ไม่ถูกแตะ — งานที่ทำสำเร็จ/กำลังทำอยู่
  ไม่ถูกทำลาย ตรงตามข้อกำหนด)

**ตัวนับ O(1) แทนการ query `background_jobs` ทุกครั้ง** — ไม่ใช้ Database
Trigger (โปรเจกต์นี้ไม่มี precedent ของ trigger ขับเคลื่อน business logic
มาก่อน ทุก state transition ผ่าน RPC ที่เรียกจากโค้ดเสมอ) แต่ต่อยอด
`complete_background_job()`/`fail_background_job()` เดิมโดยตรง (คงทุกบรรทัด
เดิมไว้ครบ เพิ่มแค่ท้ายฟังก์ชัน): เมื่อ job ที่เพิ่ง complete/fail (fail
เฉพาะตอนเข้า DLQ ถาวรจริง ไม่ใช่ทุกครั้งที่ retry) มี `batch_id`, เพิ่มตัวนับ
ที่เกี่ยวข้องของ `job_batches` แถวนั้นทีละ 1 แล้วเรียก
`finalize_job_batch_if_drained()` — ฟังก์ชันนี้ตรวจว่า
`completed+failed+cancelled+skipped >= enqueued_items` หรือยัง ถ้าใช่ตั้ง
`status` เป็น `completed`/`failed` (ทั้งหมดที่รันแล้วล้มเหลวหมด → `failed`,
นอกนั้น → `completed`) แล้วเรียก `notify_job_batch_finished()`

**Retry เฉพาะที่ล้มเหลวระดับทั้งชุด** — `retry_failed_jobs_in_batch()` (SQL)
รีเซ็ตทุกแถวที่ `status='failed'` ของ batch กลับเป็น `pending`/`attempts=0`
(ฟิลด์เดียวกับ `retryFailedJob()` รายตัวเดิมทุกประการ) ลด `failed_items` และ
**ล้าง `completed_notified_at`/`failed_notified_at` ของ batch ด้วย** — ถ้าไม่
ล้าง รอบเสร็จใหม่หลัง retry จะไม่แจ้งเตือนซ้ำเพราะ guard เดิมยังติดค้างจาก
รอบก่อน (ทดสอบยืนยันแล้วว่าแจ้งเตือนใหม่ได้จริงหลัง retry)

**แจ้งเตือน Super Admin เมื่อ batch เสร็จ/ล้มเหลว/มี DLQ** —
`notify_job_batch_finished()` (SQL) รูปแบบเดียวกับการแจ้งเตือน DLQ รายตัว
ทุกประการ (หัวข้อ 11.2): dedup ผ่านคอลัมน์ `*_notified_at`, หาผู้รับผ่าน
`user_roles JOIN roles WHERE rank >= 50` (**ไม่มีคอลัมน์ `profiles.rank`** —
ต้อง join แบบนี้เท่านั้น), ใช้ `notifications.type` เดิม (`'success'` สำหรับ
เสร็จสมบูรณ์, `'warning'` สำหรับล้มเหลว/DLQ — CHECK constraint มีแค่
`info`/`success`/`warning` ไม่เพิ่มค่าใหม่) พร้อม `audit_logs`
(`bulk_batch_completed`/`bulk_batch_failed`/`bulk_batch_dlq`,
`entity_type: "job_batches"`) — **ทดสอบยืนยันแล้วที่ระดับ SQL โดยตรง**
(ผ่าน `docker exec ... psql` จำลอง job ลูก 3 แถว: complete 2, fail 1 แบบ
ถาวร → นับถูกต้อง, แจ้งเตือนทั้ง "เสร็จสมบูรณ์" และ "มี DLQ" พร้อมกัน,
retry แล้ว complete รอบสอง → แจ้งเตือน "เสร็จสมบูรณ์" ใหม่อีกครั้งไม่ถูก
guard เดิมกัน — cancel batch ที่มี pending 2/processing 1/completed 1 →
เฉพาะ 2 แถว pending ถูกยกเลิก อีก 2 แถวไม่ถูกแตะ)

**UI**: `BulkAllMatchingFilterDialog` (แทนปุ่ม submit ตรงเดิม) แสดงประเภทงาน/
สรุปตัวกรอง/จำนวนโดยประมาณ (คำนวณฝั่งเซิร์ฟเวอร์ล่วงหน้า)/ขนาด chunk ที่ปรับ
ได้/คำเตือนใช้เวลานาน ก่อนกดยืนยันเสมอ (เดิมกดแล้ว submit ทันทีไม่มีการยืนยัน)
— `JobBatchDetailDrawer` (เปิดจากแถวใน `JobBatchList`) แสดงตัวนับละเอียด
(แยก pending/processing ผ่าน `get_job_batch_progress()` — เรียกเฉพาะตอนเปิด
แผงนี้ ไม่ใช่ตอน poll รายการทั้งหมดทุก 5 วินาที) พร้อมปุ่ม
หยุดชั่วคราว/ทำงานต่อ/ยกเลิก (มีกล่องยืนยันก่อนยกเลิก)/ลองใหม่เฉพาะที่ล้มเหลว

**`job_type_settings` เพิ่ม `default_batch_size`** (คนละมิติกับ `concurrency`
เดิม — นี่คือขนาด chunk ที่ coordinator ดึง/สร้าง job ลูกต่อรอบ ไม่ใช่จำนวนที่
worker รันพร้อมกัน) ปรับได้ที่หน้า `/superadmin/jobs` ฟอร์มเดียวกับ
concurrency

## 12. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `supabase/migrations/20260810100000_background_jobs.sql` | ตาราง `background_jobs`, ฟังก์ชันคิว, ปรับ `scan_status`/trigger, grants ให้ service_role |
| `supabase/migrations/20260811100000_access_expiration_and_publish_events.sql` | ช่วงที่ 21: expire_stale_access_grants, warn_expiring_access_grants, notify_category_subscribers_published, ปรับ trigger หมดอายุ/เผยแพร่เดิม |
| `lib/publishing/publish-event.server.ts` | Publish Event กลาง — `notifyResearchPublished()` |
| `lib/jobs/queue.server.ts` | enqueue/claim/complete/fail/cancel/retry — ชั้นเรียกใช้งานคิวจาก TypeScript |
| `lib/jobs/dispatch.server.ts` | dispatcher หลัก ประมวลผลคิวหนึ่งรอบ (ใช้ทั้ง Cron และปุ่มกดเอง) |
| `lib/jobs/enqueue-research-jobs.server.ts` | ตัวช่วย enqueue เฉพาะบริบทงานวิจัย (initial/replace/notification) |
| `lib/jobs/handlers/*.server.ts` | handler ของแต่ละ job type |
| `app/api/jobs/process/route.ts` | Worker endpoint ที่ Cron เรียก |
| `vercel.json` | ตั้งค่า Vercel Cron (ดูหัวข้อ 6.2 เรื่องข้อจำกัดแผน Hobby) |
| `lib/security/validate-upload.server.ts` | ปรับให้ PDF หลักข้ามการสแกนมัลแวร์ตรงนี้ (ไป async แทน) |
| `lib/storage/signed-url.server.ts` | เพิ่มพารามิเตอร์ `scanStatus` ให้ gate การออก Signed URL |
| `app/superadmin/pdf-processing/` | หน้า + Server Action bulk backfill ข้อความ PDF |
| `app/superadmin/file-security/` | หน้า + Server Action bulk rescan ความปลอดภัยไฟล์ |
| `components/superadmin/BulkJobSelector.tsx`, `JobBatchList.tsx`, `RetryJobButton.tsx`, `ProcessQueueNowButton.tsx` | UI ประกอบหน้า bulk action ทั้งสองหน้า |
| `supabase/migrations/20260814100000_background_jobs_reliability.sql` | (ช่วงที่ 25) คอลัมน์ DLQ ใหม่บน `background_jobs`, `fail_background_job()` แจ้งเตือน+คืน boolean, ตาราง `job_batches`/`job_type_settings`, job_type `bulk_enqueue` |
| `supabase/migrations/20260815100000_access_expiration_warning_settings.sql` | (ช่วงที่ 26) คอลัมน์ `access_expiration_warning_*` บน `settings`, `warn_expiring_access_grants()` คืนรายการที่แจ้งเตือน (void→TABLE) |
| `lib/notifications/access-request-email.server.ts` (`notifyExpiringAccessGrantsByEmail`) | (ช่วงที่ 26) ส่งอีเมลแจ้งใกล้หมดอายุ — ไฟล์เดิมของโดเมนคำขอเข้าถึงเอกสาร ไม่ใช่ไฟล์ใหม่ |
| `app/superadmin/jobs/` | (ช่วงที่ 25) หน้า Dead-letter Queue + ตั้งค่า concurrency + Server Actions (retry/cancel/resolve/update concurrency) |
| `app/api/superadmin/jobs/batches/route.ts` | (ช่วงที่ 25) endpoint JSON สำหรับ polling ความคืบหน้า (คนละตัวกับ worker endpoint) |
| `components/superadmin/DeadLetterJobList.tsx`, `ConcurrencySettingsForm.tsx`, `JobProgressPoller.tsx` | (ช่วงที่ 25) UI ใหม่ของหน้า Dead-letter Queue |
| `lib/jobs/dlq.server.ts`, `lib/jobs/dlq-notify.server.ts` | (ช่วงที่ 25) allowlist ข้อมูลแสดงผล DLQ + ส่งอีเมลแจ้งเตือน |
| `lib/jobs/bulk-batch.server.ts`, `lib/jobs/handlers/bulk-enqueue.server.ts` | สร้าง/coordinator ของคำขอ "ประมวลผลทั้งหมดตามตัวกรอง" (ช่วงที่ 25, ปรับใหญ่ในช่วงที่ 28 — idempotent creation, batch_size, pause) |
| `lib/data/job-type-settings.server.ts` | อ่าน/เขียนค่า concurrency + `default_batch_size` (ช่วงที่ 25, เพิ่ม `default_batch_size` ช่วงที่ 28) ต่อประเภทงาน |
| `supabase/migrations/20260817100000_job_batches_lifecycle_schema.sql` | (ช่วงที่ 28) คอลัมน์ใหม่บน `job_batches` (pause/counters/timestamps/notify-dedup), `job_type_settings.default_batch_size`, FK `background_jobs.batch_id → job_batches.id` |
| `supabase/migrations/20260817110000_bulk_candidate_functions.sql` | (ช่วงที่ 28) `count_*`/`page_*` × pdf-processing/duplicate-scan/file-security — 6 ฟังก์ชันนับ/แบ่งหน้าผ่าน SQL แทน PostgREST query builder |
| `supabase/migrations/20260817120000_job_batch_lifecycle_functions.sql` | (ช่วงที่ 28) `create_job_batch_if_not_exists`/`set_job_batch_status`/`retry_failed_jobs_in_batch`/`get_job_batch_progress`/`notify_job_batch_finished`/`finalize_job_batch_if_drained`, ต่อยอด `complete_background_job`/`fail_background_job` เดิม |
| `lib/validation/bulk-filters.ts` | (ช่วงที่ 28) Zod `.strict()` schema ของตัวกรองแต่ละโดเมน + `jobBatchControlSchema` |
| `lib/jobs/batch-control.server.ts` | (ช่วงที่ 28) `pauseJobBatch`/`resumeJobBatch`/`cancelJobBatch`/`retryFailedInBatch` — เรียกผ่าน session client เสมอ (ไม่ใช่ Service Role) เพราะฟังก์ชัน SQL ตรวจสิทธิ์จาก `auth.uid()` |
| `lib/data/pdf-processing.server.ts`, `file-security-candidates.server.ts`, `duplicate-scan-candidates.server.ts` (ฟังก์ชัน `*CandidatesPage`/`*CandidatesCount`) | เวอร์ชัน cursor-paginated + นับจำนวนแม่นยำ สำหรับ coordinator (ช่วงที่ 25, เปลี่ยนไปเรียก SQL function แทน query builder ในช่วงที่ 28 — รองรับทุกตัวกรองแล้ว) |
| `components/superadmin/BulkAllMatchingFilterDialog.tsx` | (ช่วงที่ 28) กล่องยืนยันก่อนสั่งประมวลผลทั้งหมด (แทน `BulkAllMatchingFilterButton.tsx` เดิมที่ submit ทันทีไม่มีการยืนยัน) |
| `components/superadmin/JobBatchDetailDrawer.tsx` | (ช่วงที่ 28) แผงรายละเอียด+ควบคุม batch เดียว (pause/resume/cancel/retry-failed) |
| `app/api/superadmin/jobs/batches/route.ts` | endpoint JSON polling (ช่วงที่ 25) — เพิ่ม `?batchId=` สำหรับรายละเอียด batch เดียว (ช่วงที่ 28) |
| `supabase/migrations/20260819100000_worker_concurrency.sql` | (ช่วงที่ 30) `claim_background_jobs_with_concurrency()` — บังคับ concurrency แบบ global ข้าม worker/instance ด้วย `pg_advisory_xact_lock`, index `idx_background_jobs_processing_by_type` |
| `supabase/migrations/20260819110000_queue_health.sql` | (ช่วงที่ 30) `get_queue_health()`/`get_background_job_status_counts()`, index `idx_background_jobs_status` |
| `lib/notifications/send-in-batches.server.ts` | (ช่วงที่ 30) `sendInBatches()`/`EMAIL_BATCH_CONCURRENCY` — กัน email fan-out burst เกิน rate limit ของ provider |
| `lib/data/queue-health.server.ts` | (ช่วงที่ 30) `getQueueHealth()` — เรียก 2 SQL function ข้างต้น สำหรับหน้า `/superadmin/jobs` |
| `components/superadmin/QueueHealthPanel.tsx` | (ช่วงที่ 30) UI ส่วน "สถานะ Queue โดยรวม" ที่หน้า `/superadmin/jobs` |
| `supabase/migrations/20260820100000_cron_monitoring.sql` | (ช่วงที่ 31) ตาราง `cron_runs`/`cron_monitoring_settings`/`cron_alert_state`, job_type `maintenance_cleanup`, `expire_stale_access_requests()`/`expire_stale_access_grants()` เปลี่ยนเป็น `returns int`, `cleanup_old_rate_limit_events()` |
| `lib/cron/cron-runs.server.ts` | (ช่วงที่ 31) `startCronRun()`/`finishCronRun()` — เขียนประวัติ `cron_runs` |
| `lib/cron/monitor.server.ts` | (ช่วงที่ 31) `runCronHealthChecks()` — ตรวจ overdue/never-run/high-failure ต่อ `job_name` + เช็ครวมระดับ queue, จัดการ cooldown/แจ้งเตือน |
| `lib/jobs/handlers/maintenance-cleanup.server.ts` | (ช่วงที่ 31) handler ของ `maintenance_cleanup` — ลบ `rate_limit_events` เก่ากว่า 7 วัน |
| `lib/data/super-admins.server.ts` | (ช่วงที่ 31) `getSuperAdminRecipients()` — สกัดจาก `dlq-notify.server.ts` เดิมมาใช้ร่วมกัน |
| `lib/data/cron-monitoring.server.ts` | (ช่วงที่ 31) `getCronMonitoringOverview()`/`getRecentCronAlerts()` สำหรับหน้า `/superadmin/cron-monitoring` |
| `app/api/cron/health-check/route.ts` | (ช่วงที่ 31) Watchdog endpoint แยกจาก `/api/jobs/process` — ป้องกันด้วย `CRON_SECRET` เดียวกัน |
| `app/superadmin/cron-monitoring/` | (ช่วงที่ 31) หน้า + Server Action ตรวจสอบ Cron/Worker |
| `components/superadmin/CronMonitoringOverview.tsx`, `CronMonitoringSettingsForm.tsx` | (ช่วงที่ 31) UI ของหน้า `/superadmin/cron-monitoring` |
| `vercel.json` | เพิ่ม entry ที่สองสำหรับ `/api/cron/health-check` (ช่วงที่ 31) |

## 13. Worker หลาย process/instance อย่างปลอดภัย (ช่วงที่ 30)

### 13.1 ปัญหาเดิม — concurrency เป็นแค่เพดานต่อการเรียกหนึ่งครั้ง

`claim_background_jobs()` เดิม (ช่วงที่ 20, ดูหัวข้อ 2.1) claim ได้สูงสุด
`p_limit` แถวต่อการเรียกหนึ่งครั้ง — **ไม่ได้ตรวจว่ามีงานประเภทเดียวกันกำลัง
`processing` อยู่แล้วกี่งานจาก invocation อื่นที่ทำงานพร้อมกันจริง** ทำให้ค่า
`job_type_settings.concurrency` (หัวข้อ 11.5) เป็นแค่เพดาน "ต่อการเรียกหนึ่ง
ครั้ง" เท่านั้น ไม่ใช่เพดานรวมจริงข้าม process/instance — ถ้า worker สองตัว
เรียกพร้อมกัน (Cron ทับซ้อนกัน, กดปุ่ม "ประมวลผลคิวเดี๋ยวนี้" ระหว่างที่ Cron
กำลังรันอยู่พอดี, หรือรัน worker หลาย instance จริงใน production ตามที่หัวข้อ
นี้ต้องรองรับ) แต่ละ invocation จะ claim ได้สูงสุด `concurrency` งานอย่าง
อิสระต่อกัน รวมกันจึงอาจได้งานประเภทเดียวกัน `processing` พร้อมกันเกินค่าที่
ตั้งไว้จริง (เช่น `ocr_processing` concurrency=1 อาจกลายเป็น 2 งานพร้อมกันจริง
เกิน rate limit ของ OCR provider ที่ตั้งใจจะป้องกันไว้)

### 13.2 แก้ด้วย `claim_background_jobs_with_concurrency()` — advisory lock ต่อประเภทงาน

ฟังก์ชันใหม่ (migration `20260819100000_worker_concurrency.sql`) ใช้
`pg_advisory_xact_lock(hashtext('bg_claim:' || p_job_type))` ก่อนนับ+claim
ทุกครั้ง — บังคับให้ขั้นตอน "นับงานที่กำลัง `processing` อยู่จริง (lease ยังไม่
หมดอายุ) แล้วค่อย claim" รันแบบ**อนุกรม (serial) ต่อประเภทงานเดียวกันข้าม
transaction/worker/instance ทั้งหมด** (lock ปลดอัตโนมัติเมื่อจบ transaction
— ไม่ต้องมี logic ปลด lock เอง) ประเภทงานอื่นที่ใช้คีย์ lock ต่างกันยัง claim
พร้อมกันได้ตามปกติ ไม่ถูกบล็อกไปด้วย:

```sql
perform pg_advisory_xact_lock(hashtext('bg_claim:' || p_job_type));
select count(*) into v_active_count from background_jobs
  where job_type = p_job_type and status = 'processing' and lease_expires_at >= now();
v_remaining := greatest(0, p_concurrency - v_active_count);
-- claim ต่อจากนี้ (UPDATE ... FOR UPDATE SKIP LOCKED เดิมทุกประการ) ถูกจำกัด
-- ด้วย v_remaining แทนแค่ p_limit เฉยๆ
```

**ทำไมต้องใช้ advisory lock ไม่ใช่แค่ "นับแล้ว claim" เฉยๆ**: ที่ระดับ
`READ COMMITTED` (isolation level เดิมของทั้งระบบ) การ "นับแล้ว claim" แบบ
ไม่มี lock จะมี race condition จริง (TOCTOU) — สอง transaction พร้อมกันอาจ
เห็นค่านับเดิม (เก่า) พร้อมกันแล้วต่างฝ่ายต่าง claim ไปจนเกินเพดานได้จริง
`pg_advisory_xact_lock` แก้ปัญหานี้โดยไม่ต้องล็อกทั้งตารางหรือเปลี่ยน
isolation level ของทั้งระบบ และไม่มีต้นทุนเพิ่มเลยเมื่อ claim คนละประเภทงาน
พร้อมกัน (คีย์ lock ต่างกัน)

`claimBackgroundJobsForType()` (`lib/jobs/queue.server.ts`) เป็น TS wrapper
ของ RPC นี้ — `processJobQueue()` (`lib/jobs/dispatch.server.ts`) เรียกแทน
`claimBackgroundJobs()` เดิมที่จุดเดียวที่มันเคยถูกเรียก (ยืนยันแล้วว่าเป็น
runtime call site เดียว) ทำให้ **ทุกช่องทางที่เข้าคิว** (Cron tick, ปุ่ม
"ประมวลผลคิวเดี๋ยวนี้", ปุ่ม "ประมวลผลสิทธิ์ที่หมดอายุทันที" ที่จำกัด
`jobTypes=["access_expiration"]`) ได้รับการแก้ไขนี้อัตโนมัติโดยไม่ต้องแก้โค้ด
เพิ่มที่จุดเรียกแต่ละจุด — `claim_background_jobs()`/`claimBackgroundJobs()`
เดิมยังอยู่ในโค้ด (ไม่ได้ลบ) แต่ไม่มีจุดใดเรียกใช้แล้วหลังช่วงนี้

Index ใหม่ `idx_background_jobs_processing_by_type` (`job_type WHERE
status='processing'`) ช่วยให้การนับ `v_active_count` เร็วแม้ตารางมีข้อมูล
จำนวนมาก

### 13.3 Bounded email fan-out — กัน burst เกิน rate limit ของ Email Provider

`notifyCategorySubscribersByEmail`/`notifyExpiringAccessGrantsByEmail`
(`lib/notifications/category-subscribers.server.ts`,
`access-request-email.server.ts`) เดิมยิง `Promise.all` ไม่จำกัดจำนวนต่อ
ผู้รับทั้งหมดในคราวเดียว — หมวดหมู่ที่มีผู้ติดตามจำนวนมากอาจ burst คำขอไปยัง
Email Provider (Resend) เกิน rate limit ของ provider ในจังหวะเดียว
เปลี่ยนมาใช้ `sendInBatches()` (`lib/notifications/send-in-batches.server.ts`,
ใหม่) ส่งเป็น chunk ละ `EMAIL_BATCH_CONCURRENCY` (5, ค่าคงที่ในโค้ด — ไม่ใช่
Setting ที่ Super Admin ปรับได้ เหมือน `OCR_POLL_DELAY_MS` ของช่วงที่ 29)
แทนการยิงทั้งหมดพร้อมกัน — แต่ละรายการยัง best-effort เหมือนเดิมทุกประการ
(รายการหนึ่งส่งไม่สำเร็จไม่กระทบรายการอื่น)

**ORCID ไม่ผ่าน job queue เลย** (`lib/orcid/orcid-oauth.server.ts`,
`orcid-public-api.server.ts`) — เรียกแบบ synchronous ต่อคำขอผู้ใช้หนึ่งคน
ในแต่ละครั้ง (ปุ่ม "เชื่อม ORCID"/"ตรวจสอบ ORCID") ไม่มีแนวคิด concurrency
ระดับคิวที่เกี่ยวข้องเลย — เป็นการตัดสินใจเชิงขอบเขตของช่วงนี้ที่จะไม่แปลง
ORCID ให้เป็น background job (ไม่มีความจำเป็น — เป็นคำขอเดี่ยวต่อผู้ใช้อยู่
แล้วโดยธรรมชาติ ไม่มีทาง burst หลายคำขอพร้อมกันจากจุดเดียว)

### 13.4 Queue Health — `/superadmin/jobs`

ส่วน "สถานะ Queue โดยรวม" (`components/superadmin/QueueHealthPanel.tsx`) ที่
หน้า `/superadmin/jobs` — snapshot สดตอนโหลดหน้า (ไม่ auto-refresh เหมือน
`/superadmin/system-health`) ดึงจาก 2 SQL function ใหม่
(`lib/data/queue-health.server.ts`, migration `20260819110000_queue_health.sql`):

- `get_queue_health()` — ต่อประเภทงาน: concurrency limit ปัจจุบัน, จำนวนที่
  `processing` จริง (lease ยังไม่หมดอายุ, รวมทุก worker/instance จริง), จำนวน
  worker ที่แตกต่างกันที่กำลังถืองานอยู่ (`count(distinct locked_by)`), จำนวน
  ที่ lease หมดอายุแล้วแต่ยังค้างสถานะ `processing` (self-heal เองรอบ claim
  ถัดไปเสมอ — แสดงไว้เป็นข้อมูล ถ้าไม่เป็นศูนย์บ่อยๆ บ่งชี้ worker ที่ตายกลาง
  คันซ้ำๆ ควรตรวจสอบ), จำนวนที่ `pending` และจำนวนที่ `pending` นานผิดปกติ
  (เกิน 15 นาที — ค่าคงที่ในโค้ด ไม่ใช่ Setting)
- `get_background_job_status_counts()` — จำนวนงานรวมทุกประเภทต่อสถานะ
  (`pending`/`processing`/`completed`/`failed`/`cancelled`)

**แสดงแค่ตัวเลขรวมที่ปลอดภัยเท่านั้น** — ไม่มี `payload`, ไม่มี `locked_by`
ดิบ (แสดงแค่จำนวนนับ), ไม่มีรายละเอียด infrastructure ใดๆ หลุดออกไปที่ UI
(เข้ากับหลักการเดียวกับ `describeJobsForDisplay()` ของหัวข้อ 11.1)

### 13.5 เปิดใช้ worker มากกว่า 1 ตัวพร้อมกันจริงใน production

เนื่องจาก worker ของโปรเจกต์นี้เป็น serverless function ไร้สถานะ (stateless)
เสมอ "worker หลายตัว/หลาย instance" ในบริบทนี้หมายถึง **"หลาย invocation ของ
endpoint เดียวกันที่ทำงานพร้อมกันจริง"** ไม่ใช่ process ที่รันค้างตลอดเวลา
(long-running worker process) — ด้วยกลไกหัวข้อ 13.1-13.2 ข้างต้น การมีหลาย
invocation ทำงานพร้อมกันจริงตอนนี้**ปลอดภัยแล้ว** (concurrency ต่อประเภทงาน
เป็นเพดานจริงข้าม invocation ทั้งหมด ไม่ใช่แค่ต่อครั้ง) ไม่ต้องเพิ่ม
environment variable ใหม่ใดๆ (`CRON_SECRET` เดิมครอบคลุมการยืนยันตัวตนสำหรับ
จำนวนผู้เรียกเท่าไหร่ก็ได้อยู่แล้ว) วิธีสร้างสถานการณ์ "หลาย worker พร้อมกัน
จริง" ใน production ทำได้หลายทาง เลือกอย่างใดอย่างหนึ่งหรือหลายอย่างพร้อมกัน:

1. **ตั้ง external scheduler มากกว่าหนึ่งตัวให้เรียก `/api/jobs/process`
   พร้อมกัน** (เช่น cron-job.org ตัวหนึ่ง + GitHub Actions scheduled workflow
   อีกตัวหนึ่ง ตั้งความถี่ใกล้เคียงกัน) — ทั้งสองจะยิง header
   `Authorization: Bearer $CRON_SECRET` เดียวกัน เข้า endpoint เดียวกัน อาจ
   ทับซ้อนเวลากันได้เป็นปกติ ไม่ต้องประสานงานกันเอง (ระบบจัดการความปลอดภัย
   ให้แล้วที่ระดับฐานข้อมูล)
2. **Vercel Cron + ปุ่ม "ประมวลผลคิวเดี๋ยวนี้"** ที่กดพร้อมกันในจังหวะที่ Cron
   กำลังรันพอดี (ทดสอบ/เร่งประมวลผลระหว่างที่ Cron ทำงานอยู่)
3. **Vercel Pro ขึ้นไป** ที่ตั้ง Cron ความถี่สูง (เช่น ทุก 1 นาที) เอง
   Serverless platform อาจ spin instance ใหม่ขนานกับ instance เดิมที่ยังไม่
   จบการทำงานได้อยู่แล้วตามธรรมชาติของ Serverless (ไม่ต้องตั้งค่าอะไรเพิ่ม)

**ไม่มีขั้นตอนพิเศษอื่นที่ต้องทำ** — ไม่ต้องปรับ `CRON_SECRET`, ไม่ต้องเพิ่ม
environment variable, ไม่ต้องเปลี่ยนโค้ดใดๆ เพิ่มเติม กลไก
`claim_background_jobs_with_concurrency()` จัดการความถูกต้องให้อัตโนมัติ
ทุกครั้งที่มีมากกว่าหนึ่ง invocation ทำงานพร้อมกัน — ดูรายการตรวจสอบ
(checklist) ก่อนขึ้นใช้งานจริงที่ [`production-checklist.md`](production-checklist.md)
หัวข้อ 17

## 14. ตรวจสอบ Cron/Worker แบบอัตโนมัติ + แจ้งเตือน (ช่วงที่ 31)

หัวข้อ 13 แก้ปัญหา "concurrency ไม่ถูกบังคับข้าม invocation" แต่ยังไม่มีอะไร
ตอบคำถาม "Cron ที่เรียก `/api/jobs/process` ยังทำงานตามรอบจริงหรือไม่" —
ช่วงนี้เพิ่มประวัติการทำงานของ cron/worker ที่สำคัญ (`cron_runs`), ตัวตรวจจับ
ความผิดปกติ, และการแจ้งเตือน Super Admin อัตโนมัติ **ไม่มีการสร้างข้อมูล
สถานะปลอมใดๆ ทั้งสิ้น** — ทุกตัวเลขที่แสดงมาจาก `cron_runs`/`background_jobs`
จริงที่บันทึกไว้ตอนงานทำงานจริงเท่านั้น

### 14.1 `cron_runs` — ประวัติการทำงานแต่ละครั้ง

ตารางใหม่ (migration `20260820100000_cron_monitoring.sql`) เก็บ
`job_name`/`started_at`/`completed_at`/`status`/`processed_count`/
`failed_count`/`error_summary`/`next_expected_run_at` ต่อการทำงานหนึ่งครั้ง
— เขียนผ่าน `startCronRun()`/`finishCronRun()`
(`lib/cron/cron-runs.server.ts`) เรียกคู่กันเสมอ **ไม่เคย throw ออกไปให้
cron/worker ตัวจริงล้มเหลวตาม** (การบันทึกประวัติพังต้องไม่ทำให้งานจริงหยุด)
`next_expected_run_at` คำนวณจาก `completed_at + cron_monitoring_settings
.expected_frequency_minutes` ของ `job_name` นั้นเสมอ

`job_name` ไม่ได้ map ตรงกับ `background_jobs.job_type` ทุกตัว —
`queue_worker`/`health_monitoring` คือชื่อของ **invocation เอง**
(`/api/jobs/process`, `/api/cron/health-check`) ไม่ใช่ job type ในคิว:

| job_name | บันทึกจากที่ไหน |
| --- | --- |
| `queue_worker` | ครอบทั้งฟังก์ชัน `processJobQueue()` (`lib/jobs/dispatch.server.ts`) — `processed_count` = จำนวนงานที่ claim ได้ในรอบนั้น, `failed_count` = จำนวนที่ dispatch แล้วไม่สำเร็จ, `error_summary` = สรุปนับจำนวนต่อประเภทงานเท่านั้น (เช่น `"3 งานล้มเหลว: OCR เอกสารสแกน x2, ดึงข้อความ PDF x1"`) **ไม่มี error message ดิบของ job แต่ละตัวปนอยู่เลย** |
| `access_expiration` | ครอบ `handleAccessExpirationJob()` — `processed_count` = ผลรวมแถวที่กระทบจาก 3 RPC เดิม (`expire_stale_access_requests`/`expire_stale_access_grants` เปลี่ยนจาก `returns void` เป็น `returns int` ในช่วงนี้ + จำนวนที่ `warn_expiring_access_grants` แจ้งเตือน) |
| `notification_delivery` | ครอบ `handleCategoryNotificationJob()` — `processed_count`/`failed_count` มาจาก `notifyCategorySubscribersByEmail()` ที่เปลี่ยนจาก `returns void` เป็น `{attempted, sent}` ในช่วงนี้ (ผู้เรียกเดียวคือ handler นี้) |
| `maintenance_cleanup` | ครอบ handler ใหม่ทั้งตัว (หัวข้อ 14.2) |
| `health_monitoring` | ครอบ `runCronHealthChecks()` (หัวข้อ 14.3) — ตรวจสุขภาพตัวเองด้วยกลไกเดียวกัน |

### 14.2 `maintenance_cleanup` — job บำรุงรักษาจริงตัวแรกของระบบ

เดิมไม่มี job ประเภท "บำรุงรักษา/ล้างข้อมูลเก่า" เลยในระบบ (ตรวจสอบโค้ดแล้ว
ไม่พบ) — เพิ่ม job type ใหม่ (`lib/jobs/handlers/maintenance-cleanup.server.ts`)
ลบแถว `rate_limit_events` ที่เก่ากว่า 7 วันทิ้ง (ค่าคงที่ในโค้ด ไม่ใช่
Setting — ตารางนี้เก็บ event จำกัดอัตราที่ไม่มีประโยชน์แล้วหลังพ้นหน้าต่างเวลา
จำกัดอัตราจริง นานสุดคือโควตา OCR ต่อวัน 86400 วินาที เผื่อไว้กว้างกว่ามาก)
self-seed ทุกครั้งที่ worker ทำงานเหมือน `access_expiration` ทุกประการ

`rate_limit_events` ไม่มี grant ให้ `service_role` เข้าถึงตรงๆ เลย (เขียน/
อ่านผ่าน `check_rate_limit()` ซึ่งเป็น `security definer` เท่านั้นมาตั้งแต่
ช่วงที่ 9) — ฟังก์ชันลบก็ทำตามรูปแบบเดียวกัน: `cleanup_old_rate_limit_events()`
เป็น `security definer` เฉพาะงานนี้ แทนการ grant `DELETE` ตรงบนตาราง
(least privilege)

### 14.3 Watchdog แยกต่างหาก — `/api/cron/health-check`

**ต้องเป็น Cron คนละตัวจาก `/api/jobs/process` โดยเจตนา** — ถ้าฝังการตรวจสอบ
ไว้ในตัว worker เดียวกัน ตอน Cron ของ worker หยุดทำงานทั้งหมด (ตั้งค่าผิด,
secret หมดอายุ, แพลตฟอร์มมีปัญหา) การตรวจสอบก็จะหยุดไปด้วยพร้อมกัน ไม่มีทาง
ตรวจจับ "worker หยุดทำงานทั้งหมด" ได้เลย — ป้องกันด้วย `CRON_SECRET`
**ตัวเดียวกัน** กับ `/api/jobs/process` ทุกประการ (fail closed เหมือนกัน)

`runCronHealthChecks()` (`lib/cron/monitor.server.ts`) ตรวจ 3 เงื่อนไขต่อ
`job_name` ใน `queue_worker`/`access_expiration`/`notification_delivery`/
`maintenance_cleanup`:

- **ไม่เคยทำงานเลย** (`{job_name}_never_run`) — ไม่มีแถว `cron_runs` เลยสัก
  แถว **และ** เวลาผ่านไปนานกว่า `expected_frequency_minutes` นับจากตอนตั้งค่า
  ไว้ (`cron_monitoring_settings.updated_at` เป็นตัวแทนเวลา "ตั้งค่าระบบไว้")
  — กันแจ้งเตือนทันทีหลัง deploy ใหม่ทั้งที่ยังไม่ถึงเวลาที่ควรรันครั้งแรก
- **เกินกำหนดเวลา** (`{job_name}_overdue`) — แถวล่าสุดมี `next_expected_run_at`
  ในอดีตเกิน 5 นาที (grace period กันแจ้งเตือนจากความคลาดเคลื่อนเล็กน้อยของ
  รอบ Cron เอง)
- **อัตราความล้มเหลวสูง** (`{job_name}_high_failure`) — แถวล่าสุด
  `status='failed'` หรือ `failed_count >= cron_monitoring_settings
  .failure_threshold`

บวก 2 เช็คระดับ queue โดยรวม (ไม่ผูกกับ `job_name` เดียว, threshold คงที่ใน
โค้ด ไม่ใช่ Setting):

- `queue_stuck_jobs` — มีงานประเภทใดก็ได้ที่ `stuckPendingCount > 0` จาก
  `get_queue_health()` (ช่วงที่ 30)
- `queue_dlq_backlog` — จำนวนงานเข้า DLQ ที่ยังไม่ได้จัดการ (`status='failed'
  AND resolved_at IS NULL`) ตั้งแต่ 5 รายการขึ้นไป — **เสริมจาก** การแจ้งเตือน
  DLQ ต่อ job เดิมของช่วงที่ 25 (`dead_letter_notified_at`, แจ้งครั้งเดียวต่อ
  job หนึ่งตัวตอนเข้า DLQ) ไม่ได้แทนที่กัน — ตัวนี้ส่งสัญญาณ "backlog สะสม
  เยอะขึ้นเรื่อยๆ" ซึ่งเป็นคนละเรื่องกับ "job หนึ่งตัวเพิ่งเข้า DLQ"

### 14.4 Cooldown + การแจ้งเตือน

`cron_alert_state` (คีย์ `check_name`, ไม่มี CHECK enum ตายตัว — โค้ด TS
ควบคุมชุดค่าที่ถูกต้องเอง เหมือน `rate_limit_events.rate_key`) เก็บ
`last_alerted_at` ล่าสุดของแต่ละเงื่อนไข — **cooldown คงที่ 60 นาทีต่อเงื่อนไข**
เงื่อนไขเดียวกันจะไม่แจ้งซ้ำจนกว่าจะพ้น cooldown แม้ตรวจพบซ้ำทุกรอบก็ตาม
(ทดสอบยืนยันแล้ว: เรียก `/api/cron/health-check` ซ้ำทันทีไม่สร้างการแจ้งเตือน
ซ้ำ, ปรับ `last_alerted_at` ย้อนหลังเกิน 60 นาทีแล้วเรียกใหม่จึงแจ้งอีกครั้ง)

เมื่อเงื่อนไขใดผ่าน cooldown จริง:

1. `notifications` insert ให้ Super Admin ทุกคน (`type: 'warning'`) — ใช้
   `getSuperAdminRecipients()` (`lib/data/super-admins.server.ts`, ใหม่ —
   สกัดออกจาก `lib/jobs/dlq-notify.server.ts` เดิมเพื่อใช้ร่วมกัน)
2. อีเมล (ถ้าเปิด `settings.notificationsEmailEnabled` +
   `isEmailProviderConfigured()`) ส่งเป็นชุดผ่าน `sendInBatches()`/
   `EMAIL_BATCH_CONCURRENCY` (ช่วงที่ 30) — best-effort เหมือนทุกช่องทางอีเมล
   อื่นในระบบ
3. `audit_logs` insert (`actor_id: null`, `action: 'cron_alert_triggered'`,
   `entity_type: 'cron_runs'`, `metadata: {check_name, title, message}`) —
   **ใช้เป็นแหล่งข้อมูลของ "การแจ้งเตือนล่าสุด" ที่หน้า
   `/superadmin/cron-monitoring` โดยตรง ไม่มีตาราง alert history แยกใหม่**
   (รูปแบบเดียวกับ retry history ของ DLQ เดิมที่ใช้ `audit_logs` เป็นแหล่ง
   ข้อมูลเดียวกันมาตั้งแต่ช่วงที่ 25) — อ่านผ่าน session client
   (`createClient()`) ไม่ใช่ Service Role เพราะ `audit_logs` ไม่มี grant
   `SELECT` ให้ `service_role` เลย (อ่านผ่าน RLS policy `rank >= 40` เดิม
   เท่านั้น — ดู `lib/data/audit-logs.server.ts` ที่ใช้รูปแบบเดียวกันนี้อยู่แล้ว)

**ข้อความ alert ทุกข้อความเป็นข้อความไทยสั้นๆ ที่เตรียมไว้ล่วงหน้าเท่านั้น** —
ไม่มี stack trace/PostgreSQL error ดิบ/secret ใดๆ หลุดออกไปเลย (เข้ากับ
`toSafeJobErrorMessage()`/`error_summary` ของหัวข้อ 2.3 ทุกประการ)

### 14.5 หน้า `/superadmin/cron-monitoring`

Super Admin เท่านั้น (rank ≥ 50, การ์ดเดียวกับทุกหน้า `/superadmin/*`) แสดง:

- ตารางสถานะ cron ล่าสุดต่อ `job_name` (heartbeat: ปกติ/เกินกำหนด/ยังไม่เคย
  ทำงาน, เวลารันล่าสุด, สถานะ, จำนวนสำเร็จ/ล้มเหลว, รอบถัดไปที่คาดว่าจะทำงาน)
  — `getCronMonitoringOverview()` (`lib/data/cron-monitoring.server.ts`)
- รายการแจ้งเตือนล่าสุด (จาก `audit_logs`, หัวข้อ 14.4)
- ฟอร์มปรับ `expected_frequency_minutes`/`failure_threshold` ต่อ `job_name`
  (`updateCronMonitoringSettingsAction`, รูปแบบเดียวกับ
  `ConcurrencySettingsForm.tsx` ทุกประการ)
- แบนเนอร์ชัดเจนว่า **"ข้อมูลนี้ไม่ใช่แบบ Real-time"** — snapshot ตอนโหลดหน้า
  เหมือน `/superadmin/system-health` (ไม่มี auto-refresh/polling ตามที่ขอ)
- ลิงก์ไปหน้า `/superadmin/jobs` สำหรับดู DLQ/concurrency/queue health

**`access_expiration`/`notification_delivery` ไม่มี Cron แยกของตัวเอง** —
ทำงานตามจังหวะที่ `queue_worker` (`/api/jobs/process`) ถูกเรียกจริงเท่านั้น
ค่า `expected_frequency_minutes` ของสองรายการนี้จึงควรตั้งให้ **เท่ากับหรือ
มากกว่า** ความถี่ Cron ของ `queue_worker` เสมอ ไม่งั้นจะเห็น "เกินกำหนด" ปลอม
ทั้งที่ `queue_worker` เองทำงานปกติทุกประการ (แสดงคำอธิบายนี้ตรงในหน้าเว็บด้วย)
