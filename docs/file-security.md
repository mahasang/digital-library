# ความปลอดภัยของไฟล์ที่อัปโหลด (File Security)

เอกสารนี้สรุปการตรวจสอบไฟล์ที่ระบบทำอยู่จริงในปัจจุบัน ครอบคลุมทั้งการตรวจสอบ
เนื้อไฟล์จริง (magic-byte) และการสแกนมัลแวร์ (Phase 14)

> **อัปเดตช่วงที่ 20**: การสแกนมัลแวร์ของไฟล์ PDF หลัก (`pdf_file`) ย้ายไปเป็น
> background job แบบ async แล้ว (ไม่ใช่ synchronous ก่อน insert อีกต่อไป) —
> ภาพปก/เอกสารแนบยังคงสแกน synchronous เหมือนเดิม ดูรายละเอียดเต็มที่
> [docs/background-jobs.md](./background-jobs.md) หัวข้อ 3 เอกสารนี้ยังคงถูกต้อง
> สำหรับ **สิ่งที่ตรวจสอบ** (magic-byte signature, provider ที่รองรับ) แต่
> **จังหวะเวลาที่สแกน PDF หลักเกิดขึ้น** เปลี่ยนไปตามที่ระบุ
>
> **อัปเดตช่วงที่ 23**: มีการส่งเนื้อไฟล์ PDF ออกไปยังบริการภายนอกอีกจุดหนึ่งที่
> **ไม่ใช่การสแกนมัลแวร์** — OCR สำหรับเอกสารสแกน (สั่งแยกต่างหากโดยเจ้าหน้าที่
> เท่านั้น ไม่รันอัตโนมัติ) มีเงื่อนไขการส่งข้อมูลออกที่เข้มงวดกว่าการสแกน
> มัลแวร์ ดูหัวข้อ 8

## 1. สถาปัตยกรรมการอัปโหลดไฟล์ปัจจุบัน

ไฟล์ทั้งหมด (PDF ฉบับเต็ม, ภาพปก, เอกสารแนบ, โลโก้/favicon) อัปโหลดจาก
**Browser ตรงไปยัง Supabase Storage** ผ่าน Storage RLS Policy โดยไม่ผ่าน
เซิร์ฟเวอร์ของแอปนี้เลย (`lib/storage/upload.client.ts`) — เลือกวิธีนี้เพื่อ
ประสิทธิภาพ (ไฟล์ PDF อาจมีขนาดหลายสิบ MB ไม่ต้องส่งผ่าน Next.js server เป็น
ทอดที่สอง)

เนื่องจากเซิร์ฟเวอร์ไม่เห็นเนื้อไฟล์ระหว่างอัปโหลด การตรวจสอบเนื้อไฟล์จริง
(magic-byte + สแกนมัลแวร์) จึงเกิดขึ้น **หลังอัปโหลดเสร็จ แต่ก่อนบันทึกแถว
`research_items`เสมอ** — Server Action (`submit-research`, `dashboard/research/new`,
`dashboard/research/[id]/edit`, `my-submissions/[id]`) ดาวน์โหลดไฟล์ที่เพิ่ง
อัปโหลดกลับมาตรวจสอบด้วย Service Role (`lib/security/validate-upload.server.ts`)
ก่อน insert/update แถวทุกครั้ง หากไม่ผ่าน **ไฟล์จะถูกลบออกจาก Storage ทันที
และไม่มีแถว `research_items` ถูกสร้าง/แก้ไขเลย** (ผู้ใช้เห็นข้อความผิดพลาดที่
ฟอร์ม เหมือนการตรวจสอบ Zod ทั่วไป)

ฟิลด์ที่ path เปลี่ยนเท่านั้นที่จะถูกดาวน์โหลด/ตรวจสอบซ้ำ — ตอนแก้ไขงานวิจัยที่
ไม่ได้แทนที่ไฟล์ PDF/ภาพปก/เอกสารแนบ จะไม่ดาวน์โหลด/สแกนซ้ำ (ผลตรวจสอบเดิมยัง
ใช้ได้ ไม่ต้องเสียเวลา/แบนด์วิดท์ซ้ำ)

## 2. ทุกชั้นการตรวจสอบที่มีอยู่จริงในปัจจุบัน

| ชั้นการตรวจสอบ | ทำงานที่ไหน | ตรวจอะไร | ข้ามได้หรือไม่ |
| --- | --- | --- | --- |
| ชนิด/ขนาดไฟล์ฝั่ง client | `lib/storage/limits.ts` (`validateFile()`) | `file.type` ตรงกับรายการที่อนุญาต, ขนาดไม่เกิน limit | **ข้ามได้** (เป็นแค่ UX เตือนก่อนอัปโหลด ไม่ใช่ด่านความปลอดภัยจริง) |
| นามสกุลไฟล์ตรงกับ MIME type ฝั่ง client | `lib/storage/limits.ts` (`isExtensionMatchingMimeType()`) | ชื่อไฟล์ลงท้ายด้วยนามสกุลที่สอดคล้องกับ `file.type` ที่ browser ตรวจพบ | **ข้ามได้** (ยังเป็นฝั่ง client) |
| `allowed_mime_types`/`file_size_limit` ของ Storage bucket | Supabase Storage API (server-side จริง) | Content-Type ที่ส่งมาตอนอัปโหลดจริง + ขนาดไฟล์จริง | **ข้ามไม่ได้** — Storage service ปฏิเสธคำขอถ้าไม่ตรง |
| นามสกุลพาธไฟล์ก่อนบันทึกลงฐานข้อมูล | `lib/validation/submission.ts` (Zod `.refine()`) | พาธไฟล์ที่จะบันทึกใน `research_items` ต้องลงท้ายด้วยนามสกุลที่อนุญาต | **ข้ามไม่ได้** |
| **Magic-byte (เนื้อไฟล์จริง)** | `lib/security/file-signature.server.ts` เรียกจาก `validate-upload.server.ts` | ดาวน์โหลดไฟล์กลับมาตรวจ byte แรกจริง เทียบกับ MIME ที่ประกาศและรายการที่อนุญาตของฟิลด์นั้น | **ข้ามไม่ได้** — ทำงานฝั่งเซิร์ฟเวอร์ก่อน insert/update แถวเสมอ |
| **สแกนมัลแวร์** | `lib/security/malware-scanner.server.ts` เรียกจาก `validate-upload.server.ts` | เนื้อไฟล์ทั้งไฟล์ผ่าน ClamAV/บริการภายนอกที่ตั้งค่าไว้ | **ข้ามไม่ได้เมื่อบังคับสแกน** (ดูหัวข้อ 4) |
| Storage RLS (เจ้าของไฟล์/บทบาท) | ฐานข้อมูล (`storage.objects` policies) | ใครมีสิทธิ์อัปโหลด/ลบไฟล์ใน path ไหนบ้าง | **ข้ามไม่ได้** |
| ไฟล์ private ไม่มี public URL | `lib/storage/signed-url.server.ts` | `research-documents`/`submission-attachments` เป็น private bucket เสมอ เข้าถึงผ่าน Signed URL ที่ตรวจสอบสิทธิ์ก่อนออกให้เท่านั้น | **ข้ามไม่ได้** |
| กันเผยแพร่เอกสารที่ไฟล์ตรวจไม่ผ่าน | Database trigger `prevent_publish_unscanned_file()` | `research_items.status` เปลี่ยนเป็น `published` ต้องมี `scan_status` เป็น `clean`/`skipped` เท่านั้น | **ข้ามไม่ได้** — ด่านสำรองระดับฐานข้อมูล (ด่านหลักคือปฏิเสธตั้งแต่ตอนอัปโหลดแล้ว) |

## 3. Magic-byte validation

`lib/security/file-signature.server.ts` ตรวจ byte แรกของเนื้อไฟล์จริงเทียบกับ
signature ที่รู้จัก:

| ชนิดไฟล์ | Signature ที่ตรวจ |
| --- | --- |
| PDF | `%PDF-` |
| PNG | `\x89PNG\r\n\x1a\n` |
| JPEG | `\xFF\xD8\xFF` |
| WebP | `RIFF....WEBP` |
| ICO | `\x00\x00\x01\x00` |
| DOC (เก่า) | OLE2 compound file header |
| DOCX | ZIP header (`PK\x03\x04`) — หมายเหตุ: ไฟล์ตระกูล OOXML (docx/xlsx/pptx) ใช้ signature เดียวกัน แยกจาก magic bytes อย่างเดียวไม่ได้ 100% |
| SVG | ตรวจโครงสร้างข้อความ (ขึ้นต้นด้วย `<?xml`/`<svg`) เนื่องจากเป็นฟอร์แมตข้อความ ไม่มี binary signature ตายตัว |

ไฟล์จะผ่านก็ต่อเมื่อ **ทั้งสามอย่างตรงกัน**: (1) ตรวจพบ signature ที่รู้จัก
(2) signature ที่ตรวจพบอยู่ในรายการที่อนุญาตของฟิลด์นั้น (PDF/ภาพปก/เอกสารแนบ)
(3) signature ที่ตรวจพบตรงกับ MIME type ที่ Storage บันทึกไว้ตอนอัปโหลด — ไม่
ตรงข้อใดข้อหนึ่งถือว่าไม่ผ่าน ปฏิเสธพร้อมข้อความปลอดภัย ("ไฟล์ที่อัปโหลดไม่ผ่าน
การตรวจสอบชนิดไฟล์...") และลบไฟล์ออกจาก Storage ทันที

## 4. การสแกนมัลแวร์

`lib/security/malware-scanner.server.ts` เป็น abstraction ที่เลือก provider
ผ่าน Environment Variable `MALWARE_SCAN_PROVIDER` (ดู `.env.example`):

- **`clamav`**: เชื่อมต่อ ClamAV daemon (clamd) ผ่าน TCP ด้วยโปรโตคอล INSTREAM
  โดยตรง (เขียน client เองด้วย Node `net` module ไม่มี dependency เพิ่ม) —
  ตั้งค่า `CLAMAV_HOST`/`CLAMAV_PORT`
- **`http`**: เรียกบริการสแกนภายนอกของคุณเองผ่าน HTTP — ตั้งค่า
  `MALWARE_SCAN_API_URL`/`MALWARE_SCAN_API_KEY` (ทางเลือก) สัญญา (contract)
  ที่ endpoint ปลายทางต้องรองรับ:
  ```
  POST {MALWARE_SCAN_API_URL}
  Header: Authorization: Bearer {MALWARE_SCAN_API_KEY}   (ถ้าตั้งค่าไว้)
  Body:   multipart/form-data ฟิลด์ "file"
  Response (JSON): { "clean": boolean, "threat"?: string }
  ```
  ใช้เป็น adapter คั่นกลางเชื่อมกับ VirusTotal/Cloudmersive/บริการอื่นได้ตามต้องการ
  (เขียน microservice เล็กๆ แปลง response ของบริการนั้นให้ตรงสัญญานี้)
- **ไม่ตั้งค่า (unset)**: ใช้ "โหมดจำลอง" (mock) — คืนผล `scan_status = 'skipped'`
  พร้อม `console.warn` ชัดเจนทุกครั้ง **อนุญาตเฉพาะนอก production เท่านั้น**

### โหมดบังคับสแกน (`MALWARE_SCAN_REQUIRED`)

- ปล่อยว่าง (แนะนำ): บังคับอัตโนมัติเมื่อ `NODE_ENV=production` เท่านั้น
- `"true"`/`"false"`: บังคับพฤติกรรมเอง (เช่น ทดสอบโหมดบังคับตอน dev)
- **เมื่อบังคับสแกนแล้วแต่ไม่ได้ตั้งค่า provider หรือ provider ใช้งานไม่ได้
  (connection error/timeout/response ผิดรูปแบบ) ระบบจะ "fail closed" — ปฏิเสธ
  การอัปโหลดทุกไฟล์ทันที** (`scan_status` จะเป็น `error`) ไม่ใช่ปล่อยผ่านแบบเงียบๆ

ไฟล์ที่สแกนแล้วพบภัยคุกคาม (`status: infected`) จะถูกปฏิเสธและลบออกจาก Storage
เหมือนไฟล์ที่ตรวจ magic-byte ไม่ผ่านทุกประการ — ไม่มีทางที่ไฟล์ติดมัลแวร์จะมีแถว
`research_items` เกิดขึ้นได้ในการทำงานปกติ

## 5. บันทึกผลการตรวจสอบ (`research_items`)

ทุกแถวมีคอลัมน์ (migration `20260805100000_file_scan_security.sql`):

| คอลัมน์ | ความหมาย |
| --- | --- |
| `scan_status` | `pending` (รอ background job สแกน — ดู [docs/background-jobs.md](./background-jobs.md)) / `clean` (สแกนแล้วปลอดภัย) / `infected` (พบภัยคุกคาม) / `error` (สแกนไม่สำเร็จ) / `skipped` (โหมดจำลอง หรือข้อมูลเก่าก่อนมีฟีเจอร์นี้) |
| `scanned_at` | เวลาที่ตรวจสอบไฟล์ล่าสุด |
| `scan_provider` | เช่น `clamav:host:port`, `http:host`, `mock-dev`, `legacy-pre-scan` |
| `scan_reason` | เหตุผลโดยย่อเมื่อไม่ใช่ `clean` (ไม่มีข้อมูลอ่อนไหว) |

แถวที่มีอยู่ก่อน migration นี้ (อัปโหลดก่อนมีฟีเจอร์นี้) ถูก backfill เป็น
`scan_status = 'skipped', scan_provider = 'legacy-pre-scan'` โดยอัตโนมัติ —
**ไม่กระทบการอ่าน/ดาวน์โหลด/สถานะเผยแพร่เดิม** (ผ่านการตรวจสอบโดยมนุษย์ในขั้นตอน
อนุมัติมาแล้ว)

หน้า `/dashboard/approvals/[id]` และ `/my-submissions/[id]` แสดงผลการตรวจสอบนี้
ให้ผู้ใช้เห็นด้วย (`SubmissionDetailView`)

## 6. Audit Log

การอัปโหลดที่ถูกปฏิเสธ (ไม่ว่าจาก magic-byte หรือมัลแวร์) บันทึก `audit_logs`
เสมอ (`action: "file_upload_rejected"`, `entity_type: "storage_object"`) —
metadata เก็บเฉพาะ field ที่ผิด (pdf/cover/attachment) และเหตุผลโดยย่อ **ไม่มี
เนื้อไฟล์ ชื่อไวรัส หรือข้อมูลอ่อนไหวอื่นใดถูกบันทึก**

## 7. ข้อจำกัดที่ยังเหลืออยู่ (ตรงไปตรงมา — ไม่ปกปิด)

- ไฟล์ SVG (ภาพปก/โลโก้) เป็นฟอร์แมตที่ฝัง `<script>` ได้ในทางทฤษฎี และตรวจสอบ
  ด้วย magic-byte ได้ไม่รัดกุมเท่าไฟล์ไบนารี (ดูหัวข้อ 3) — เบราว์เซอร์สมัยใหม่
  ปกติไม่รัน script ในแท็ก `<img>`/`background-image` แต่ควรหลีกเลี่ยงการแสดง
  SVG ที่อัปโหลดผ่านทางอื่นที่รัน script ได้ (เช่น เปิดตรงในแท็บใหม่)
- ไฟล์ตระกูล OOXML (`.docx`) แยกชนิดจาก magic bytes อย่างเดียวไม่ได้ 100%
  (ใช้ ZIP signature ร่วมกับไฟล์ `.xlsx`/`.pptx`) — ระบบไม่รองรับนามสกุลอื่นใน
  ตระกูลนี้อยู่แล้วจึงไม่กระทบในทางปฏิบัติ แต่ไม่ใช่การตรวจสอบเนื้อไฟล์แบบ
  parse เต็มรูปแบบ
- **(แก้ไขแล้วในช่วงที่ 20)** เดิมการสแกนมัลแวร์ของไฟล์ PDF หลักเกิดขึ้นแบบ
  synchronous ในคำขอเดียวกับการอัปโหลด ทำให้ไฟล์ใหญ่/provider ช้าเสี่ยง
  timeout — ตอนนี้ย้ายไปเป็น background job แล้ว (ภาพปก/เอกสารแนบยังคง
  synchronous เหมือนเดิม) ดู [docs/background-jobs.md](./background-jobs.md)
- **(แก้ไขแล้วในช่วงที่ 20)** เดิมไม่มีหน้า UI สำหรับ Super Admin สั่งสแกนซ้ำ
  แถวเดิมด้วยตนเอง — ตอนนี้มีที่ `/superadmin/file-security` (bulk rescan
  เป็นชุด) ดู [docs/background-jobs.md](./background-jobs.md) หัวข้อ 5
- **(แก้ไขแล้วในช่วงที่ 28)** ปุ่ม "สแกนทั้งหมดตามตัวกรอง" ที่หน้า
  `/superadmin/file-security` ตอนนี้กรองเพิ่มเติมได้ด้วยประเภทไฟล์
  (PDF/ไฟล์แนบ), ช่วงวันที่อัปโหลด, และ "เฉพาะที่ยังไม่เคยสแกนเลย" (แยกจาก
  สถานะ `pending` ซึ่งอาจตั้งไว้แล้วระหว่างรอคิว) พร้อมกล่องยืนยันก่อนสั่งงาน
  จริงเสมอ และ pause/resume/cancel/แจ้งเตือนเมื่อสแกนเสร็จ — ดู
  [docs/background-jobs.md](./background-jobs.md) หัวข้อ 11.6

## 8. OCR และการส่งเอกสารออกนอกระบบ (ช่วงที่ 23)

การสแกนมัลแวร์ (หัวข้อ 4) ก็ส่งเนื้อไฟล์ออกไปยัง provider ภายนอกได้เช่นกัน
(เมื่อตั้งค่า `MALWARE_SCAN_PROVIDER=http`) แต่เป็นขั้นตอนบังคับที่รันกับ
**ทุกไฟล์ที่อัปโหลด** โดยอัตโนมัติ — OCR ต่างออกไปโดยพื้นฐาน:

- OCR **ไม่เคยรันอัตโนมัติ** ต้องให้เจ้าหน้าที่ (rank ≥ 30) สั่งเองเสมอ ทีละ
  รายการหรือเป็นชุดที่ `/superadmin/pdf-processing` แท็บ "OCR เอกสารสแกน"
- แม้ตั้งค่า `OCR_PROVIDER`/`OCR_API_URL` ครบแล้ว ระบบ**ยังปฏิเสธส่งไฟล์**
  จนกว่าจะตั้งค่า `OCR_ALLOW_EXTERNAL_TRANSFER=true` แยกต่างหากอย่างชัดเจน — คน
  ละตัวแปรจากการตั้งค่า provider โดยตั้งใจ เพื่อให้เป็นขั้นตอน "อนุมัติการส่ง
  ข้อมูลออก" ที่แยกจาก "ตั้งค่า provider เสร็จแล้ว" (สองคนละคำถาม สองคนละ
  ผู้อนุมัติในทางปฏิบัติได้)
- เงื่อนไข `OCR_ALLOW_EXTERNAL_TRANSFER` บังคับ**เหมือนกันทุกเอกสารไม่ว่า
  `access_level` ใด** (ไม่แยก public/private) — เป็นการตีความที่เข้มงวดกว่า
  ข้อกำหนดขั้นต่ำโดยตั้งใจ (กันความผิดพลาดจากการลืมตั้งค่าเฉพาะเอกสาร private
  ให้ถูกต้อง) เป็น**ชั้นระดับองค์กร** (env var, ต้อง deploy ใหม่ถึงจะเปลี่ยนได้)
- **เพิ่มชั้นที่สองที่แยกตาม `access_level` จริงแล้ว** (ช่วงที่ 27):
  `settings.ocr_allowed_access_levels` — Super Admin ปรับได้แบบไดนามิกที่
  `/superadmin/ocr` โดยไม่ต้อง deploy ใหม่ ค่าเริ่มต้นอนุญาตเฉพาะ `public`
  เท่านั้น (เข้มงวดสุด) ต้องเพิ่มเองหากต้องการอนุญาตระดับอื่น (`member_only`/
  `staff_only`/`read_only`/`metadata_only`) — ทั้งสองชั้นต้องผ่านพร้อมกันจึงจะ
  สร้างงาน OCR ได้ (`OCR_ALLOW_EXTERNAL_TRANSFER=true` **และ** access_level
  ของเอกสารอยู่ใน allow-list) ดู
  [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 6
- ต่างจากการสแกนมัลแวร์ที่มี "โหมดจำลอง" (mock) ให้ใช้งานได้ตอน dev — OCR
  **ไม่มีโหมดจำลองเลยแม้แต่ตอน dev** เพราะการสแกนมัลแวร์แค่ตรวจ clean/infected
  (ไม่มีเนื้อหาที่ต้องกังวลว่า "ปลอม") แต่ OCR สร้าง**ข้อความ**ที่จะถูกบันทึก
  และแสดงต่อผู้ใช้จริง — ข้อความปลอมเสี่ยงถูกเข้าใจผิดว่าเป็นเนื้อหาเอกสารจริง
  รายละเอียดเต็มดูที่ [docs/ocr-operations.md](./ocr-operations.md)
