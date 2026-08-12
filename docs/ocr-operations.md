# OCR สำหรับ PDF ที่เป็นเอกสารสแกน (OCR Operations)

ฟีเจอร์นี้เพิ่มเข้ามาในช่วงที่ 23 — เมื่อการดึงข้อความ PDF ปกติ (ดู
[docs/pdf-full-text-search.md](./pdf-full-text-search.md)) ได้ผล
`no_text_found` (ไฟล์เป็นภาพสแกนล้วน ไม่มีเลเยอร์ข้อความที่คัดลอกได้)
เจ้าหน้าที่สั่งให้ระบบทำ OCR (Optical Character Recognition) ต่อได้ — เป็น
**background job แยกต่างหากโดยสิ้นเชิง** ไม่รันในคำขออัปโหลดหรือคำขอดึง
ข้อความปกติเลย

> **สำคัญ**: ระบบนี้**ไม่มีโหมดจำลอง/mock ใดๆ ทั้งใน dev และ production** —
> ถ้ายังไม่ได้ตั้งค่า provider (หรือยังไม่ได้รับอนุมัติส่งไฟล์ออก หรือ Super
> Admin ปิดสวิตช์ไว้) งาน OCR จะจบด้วยสถานะ `blocked` พร้อมเหตุผลชัดเจนเสมอ —
> ถ้าตั้งค่าครบแล้วแต่ provider ตอบกลับผิดพลาดจริงจะจบด้วย `failed` แทน (ดู
> หัวข้อ 2) **ไม่ว่ากรณีใดก็ไม่เคยสร้างข้อความหรือตัวเลข progress ปลอมมาแสดง
> แทน** (ต่างจากการสแกนมัลแวร์ที่มีโหมดจำลองให้ใช้ตอน dev — ดูเหตุผลที่
> [docs/file-security.md](./file-security.md) หัวข้อ 8)

## 1. สถาปัตยกรรมโดยรวม

```
research_document_texts.extraction_status = 'no_text_found'
        │  (เจ้าหน้าที่ rank >= 30 กดปุ่ม "เริ่ม OCR" ที่หน้าจัดการ
        │   หรือ Super Admin สั่งเป็นชุดที่ /superadmin/pdf-processing)
        ▼
enqueueBackgroundJob({ jobType: "ocr_processing", ... })
  idempotencyKey: "ocr_processing:{research_item_id}" — กันสร้างงานซ้ำซ้อน
        │
        ▼  (worker ผ่าน /api/jobs/process — คิวเดิมของช่วงที่ 20 ทุกประการ)
handleOcrProcessingJob(job) — ตั้งแต่ช่วงที่ 29 อาจทำงานหลายรอบถ้า provider
เป็นแบบ async (submit + poll — ดูหัวข้อ 3):

  job.payload ยังไม่มี external_job_id (รอบแรกเสมอ)
    → processResearchDocumentOcr(researchItemId, pdfPath)
       1. acquire_ocr_lock() — ล็อกแบบ atomic กัน 2 งานประมวลผลไฟล์เดียวกัน
          พร้อมกัน (conditional UPDATE ... WHERE ocr_status != 'processing'
          RETURNING id)
       2. ดาวน์โหลดไฟล์จาก Storage ด้วย Service Role (ไฟล์เดียวกับที่ดึง
          ข้อความปกติใช้ — ไม่ได้อัปโหลดไฟล์แยกสำหรับ OCR)
       3. submitOcr(buffer, filename) — เรียก provider ที่ตั้งค่าไว้ (ดูหัวข้อ 3)

  job.payload มี external_job_id แล้ว (รอบที่ 2 เป็นต้นไป — เฉพาะ provider
  แบบ async)
    → pollResearchDocumentOcr(researchItemId, externalJobId)
       ตรวจสถานะงานที่ submit ไปแล้ว **ไม่เรียก acquire_ocr_lock() ซ้ำ**
       (ล็อกถืออยู่แล้วตั้งแต่รอบแรก)

  ผลลัพธ์ "processing" (เฉพาะ provider แบบ async, ยังไม่รู้ผลสุดท้าย):
    → บันทึก current_page/total_pages/progress/progress_message ลง
      background_jobs (ดูหัวข้อ 3.2) แล้ว requeueJob() กลับไปเป็น pending
      รออีก OCR_POLL_DELAY_MS (10 วินาที) ก่อน poll รอบถัดไป — **ไม่นับเป็น
      ความล้มเหลว**

  ผลลัพธ์ "completed" / "failed" / "blocked" (จบงานจริง):
    → บันทึกผลลง research_document_texts (คอลัมน์ ocr_* แยกจาก
      extracted_text เดิมทั้งหมด) แล้ว completeBackgroundJob()/
      failBackgroundJob() ตามผลลัพธ์
        │
        ▼
research_document_texts
  - ocr_status, ocr_text, ocr_text_normalized, ocr_error_message
  - ocr_provider, ocr_language, ocr_confidence (0-1), ocr_processed_at
  - RLS: ใช้ policy เดียวกับ extracted_text ทุกประการ (แถวเดียวกัน คอลัมน์
    เดียวกัน ไม่ต้องเพิ่ม policy ใหม่)
        │
        ▼
searchResearchServer() ค้นทั้ง extracted_text_normalized และ
ocr_text_normalized คู่ขนานกัน — ผลจาก OCR มีป้าย isOcrMatch: true กำกับเสมอ
(ดู docs/pdf-full-text-search.md หัวข้อ 5.1)
```

`processResearchDocumentOcr()`/`pollResearchDocumentOcr()` **ไม่เคย throw
ออกไปหา caller** เลย ครอบทุกขั้นตอนไว้และแปลงข้อผิดพลาดเป็นสถานะ `failed` ใน
ฐานข้อมูลแทนเสมอ — รูปแบบเดียวกับ `processResearchDocumentExtraction()` ของ
ช่วงที่ 17 ทุกประการ

## 2. สถานะ OCR (`ocr_status`)

| สถานะ | ความหมาย |
| --- | --- |
| `not_required` | ค่าเริ่มต้น — ยังไม่เคยสั่ง OCR หรือดึงข้อความปกติได้ผลอยู่แล้ว (ไม่จำเป็นต้อง OCR) |
| `pending` | อยู่ในคิว รอ worker หยิบไปทำ |
| `processing` | กำลังประมวลผล (ถูกล็อกด้วย `acquire_ocr_lock()` อยู่ — อาจอยู่ในสถานะนี้ได้หลายรอบ poll ถ้า provider เป็นแบบ async) |
| `completed` | สำเร็จ — มี `ocr_text` ให้ค้นหา/แสดงผลได้ |
| `failed` | **ลองทำ OCR แล้วจริงแต่ provider ตอบกลับผิดพลาด** — ดู `ocr_error_message`, กดปุ่ม "ลองใหม่" ได้ |
| `blocked` (ช่วงที่ 29) | **ไม่ได้ลอง OCR เลย** เพราะปัญหาการตั้งค่า/นโยบาย (ยังไม่ได้ตั้งค่า provider, ยังไม่ได้อนุมัติส่งไฟล์ออก, หรือ Super Admin ปิดสวิตช์ไว้) — แยกจาก `failed` โดยตั้งใจเพื่อความชัดเจนของเจ้าหน้าที่ (ปัญหาฝั่งองค์กร ไม่ใช่ปัญหาของเอกสาร) กดปุ่ม "ลองใหม่" ได้เหมือนกันหลังแก้ปัญหาการตั้งค่าแล้ว |

`blocked` และ `failed` ทั้งคู่ยังผ่านกลไก `background_jobs.status`/
`attempts`/backoff/dead-letter queue เดิมทุกประการ (ระดับ job queue มองว่า
"ไม่สำเร็จ" เหมือนกัน) — ความแตกต่างเป็นแค่ label ระดับ
`research_document_texts.ocr_status` สำหรับความชัดเจนของเจ้าหน้าที่เท่านั้น
ไม่ใช่ state เพิ่มเติมของคิวงาน

## 3. Provider Abstraction — 2 รูปแบบ (ช่วงที่ 29)

**ตัดสินใจไม่ผูกกับ OCR library ใดโดยเฉพาะ** (เช่น Tesseract.js/`@napi-rs/
canvas` สำหรับ rasterize PDF ในตัวแอปเอง) — เหตุผล:

- หลีกเลี่ยงการเพิ่ม native/WASM dependency ใหม่ที่มีความเสี่ยงด้าน
  compatibility กับ Vercel Serverless (cold start ช้าลง, ขนาด bundle ใหญ่ขึ้น,
  บาง native binary ไม่รองรับ Serverless runtime)
- แยก concern ของแอปเว็บ (จัดการสิทธิ์, คิวงาน, UI) ออกจากงาน OCR ที่ใช้
  ทรัพยากร CPU/หน่วยความจำสูงและใช้เวลานาน — เหมาะกับรันบน service แยกที่
  ปรับขนาด (scale) ได้อิสระจากแอปเว็บหลักมากกว่า

แทนที่ด้วย abstraction (`lib/ocr/ocr-provider.server.ts`) ที่รองรับ **2
รูปแบบ provider** เลือกผ่าน `OCR_PROVIDER` — โครงสร้างเดียวกับ
`lib/security/malware-scanner.server.ts` (เลือก provider ผ่าน Environment
Variable, ไม่ตัดสินใจเชิงธุรกิจใดๆ ในตัว adapter เอง แค่คืนผลลัพธ์ดิบให้
`process-ocr.server.ts`/job handler ตัดสินใจต่อ):

**ผู้ให้บริการปลายทางเป็นผู้รับผิดชอบแปลง PDF เป็นภาพและรัน OCR เองทั้งหมดใน
ทั้งสองรูปแบบ** — แอปนี้แค่ส่งไฟล์ดิบไปแล้วรับข้อความกลับมา ไม่มีขั้นตอน
rasterize/OCR ใดๆ ในฝั่ง Next.js เลย

### 3.1 `"self_hosted"` (เดิมชื่อ `"http"` ก่อนช่วงที่ 32, ไม่เปลี่ยนสัญญา) — synchronous รอบเดียว

```
POST {OCR_PROVIDER_BASE_URL}
Header: Authorization: Bearer {OCR_PROVIDER_API_KEY}   (ถ้าตั้งค่าไว้)
Body: multipart/form-data
  - file: ไฟล์ PDF ต้นฉบับทั้งไฟล์ (ไม่ได้ตัด/แปลงเป็นภาพในฝั่งแอปเลย)
  - languages: เช่น "tha+eng" (จาก OCR_LANGUAGES, ค่าเริ่มต้น "tha+eng")
Response (JSON):
  { "text": string, "confidence"?: number (0-1), "language"?: string }
timeout: OCR_PROVIDER_TIMEOUT_MS (ค่าเริ่มต้น 120000 = 120 วินาที ถ้าไม่ได้
ตั้งค่า, จำกัดช่วง 5000-300000, ก่อนช่วงที่ 32 เป็นค่าคงที่ในโค้ด)
```

เหมาะกับ**บริการ OCR ที่ประมวลผลเร็วพอจะรอในคำขอเดียวได้** (เช่น self-hosted
ขนาดเล็ก, เอกสารไม่กี่สิบหน้า) — **ไม่รองรับ progress ระดับหน้าโดยธรรมชาติ**
เพราะเป็น blocking call เดียว ไม่มีจังหวะให้รายงานสถานะระหว่างทางเลย (ดู
หัวข้อ 3.3)

ตั้งค่า: `OCR_PROVIDER=self_hosted` + `OCR_PROVIDER_BASE_URL` (+
`OCR_PROVIDER_API_KEY` ถ้าต้องการ) — ดูขั้นตอนทดสอบ/เปิดใช้งานจริงแบบเต็มที่
[docs/ocr-provider-validation.md](./ocr-provider-validation.md)

- **Self-hosted** — บริการ OCR เล็กๆ ที่องค์กรตั้งเอง (ดูตัวอย่างหัวข้อ 4)
- **External แบบ synchronous** — บริการ OCR เชิงพาณิชย์ที่ตอบผลในคำขอเดียว
  (ต้องผ่านการอนุมัติส่งข้อมูลออกก่อนเสมอ ดูหัวข้อ 5)

### 3.2 `"external_api"` (ช่วงที่ 29) — async submit + poll

จำลองรูปแบบที่ OCR API เชิงพาณิชย์ส่วนใหญ่ใช้จริง (ส่งงานเข้าคิว → ได้ job id
กลับมาทันที → poll สถานะเป็นระยะจนกว่าจะเสร็จ) — **เป็น contract ทั่วไปที่
เขียนขึ้นเพื่อทดสอบ/นำไปปรับใช้กับ provider จริงได้ ไม่ใช่ SDK ของผู้ให้
บริการรายใดรายหนึ่งโดยเฉพาะ**:

```
POST {OCR_PROVIDER_BASE_URL}/jobs
Header: Authorization: Bearer {OCR_PROVIDER_API_KEY}   (ถ้าตั้งค่าไว้)
Body: multipart/form-data (file, languages — เหมือน "self_hosted")
Response 202 (JSON): { "job_id": string, "total_pages"?: number }

GET {OCR_PROVIDER_BASE_URL}/jobs/{job_id}
Header: Authorization: Bearer {OCR_PROVIDER_API_KEY}
Response (JSON): {
  "status": "processing" | "completed" | "failed",
  "current_page"?: number, "total_pages"?: number,
  "text"?: string, "confidence"?: number, "language"?: string,
  "error"?: string
}
```

คำขอ submit และแต่ละรอบ poll ใช้ timeout เดียวกัน (`OCR_PROVIDER_TIMEOUT_MS`)
`background_jobs` แถวของงานนี้จะถูก requeue ตัวเองทุก `OCR_POLL_DELAY_MS`
(10 วินาที คงที่ในโค้ด) จนกว่า poll จะได้สถานะ `"completed"`/`"failed"` —
ระหว่างนั้น `background_jobs.status` สลับ `pending ⇄ processing` ตามรอบ
claim/requeue ปกติของคิว (ไม่ใช่ค้างที่ `processing` ตลอด)

**สำคัญ**: การ requeue แต่ละรอบนับเป็น `attempts` หนึ่งครั้งผ่าน
`claim_background_jobs()` เหมือนกลไก self-requeue ของ `bulk_enqueue` (ดู
[docs/background-jobs.md](./background-jobs.md) หัวข้อ 11.4) — งาน
`ocr_processing` ทุกงาน (ไม่ว่าจะใช้ provider แบบไหน) จึงถูกสร้างด้วย
`max_attempts = OCR_JOB_MAX_ATTEMPTS` (120, ≈20 นาทีที่ poll ทุก 10 วินาที —
เป็นค่ากันชนแบบกว้างๆ ไม่ใช่ตัวเลขที่ประเมินแม่นยำ) แทนค่าเริ่มต้น 5 ของคิวปกติ
เพื่อไม่ให้เอกสารที่ใช้เวลานานถูกตัดเข้า dead-letter queue กลางทางทั้งที่ยัง
ทำงานปกติอยู่ — provider แบบ `"self_hosted"` ไม่เคย requeue เลยจึงไม่ได้ใช้
ค่านี้จริง แต่ใช้ค่าเดียวกันทุกงาน `ocr_processing` เพื่อความเรียบง่าย
(`ocr_test_run` ของ Controlled OCR Test ก็ใช้ค่าเดียวกันนี้เช่นกัน ดูหัวข้อ 10)

ตั้งค่า: `OCR_PROVIDER=external_api` + `OCR_PROVIDER_BASE_URL` (+
`OCR_PROVIDER_API_KEY` ถ้าต้องการ)

### 3.3 Progress ระดับหน้า — ไม่มีการสร้างตัวเลข/ข้อความปลอมเด็ดขาด

`background_jobs` มีคอลัมน์ `current_page`, `total_pages`, `progress`
(0-100, มีอยู่แล้วตั้งแต่ช่วงที่ 20 แต่ไม่เคยถูกเขียนค่าจริงก่อนช่วงนี้),
`progress_message` — เขียนโดย `updateJobPageProgress()`
(`lib/jobs/queue.server.ts`) ทุกครั้งที่ handler ได้ผลลัพธ์ `"processing"`
กลับมาจาก provider:

- **ถ้า provider ส่ง `current_page`/`total_pages` มาจริง** (เฉพาะ
  `"external_api"` และเฉพาะถ้า provider จริงรองรับ) → บันทึกตัวเลขจริง คำนวณ
  `progress = round(current_page / total_pages * 100)` จากตัวเลขที่ได้รับมา
  เท่านั้น (ไม่เคยประมาณ/เดา) และ UI แสดง "หน้าที่ X จาก Y (Z%)"
- **ถ้า provider ไม่ส่งเลขหน้ามา** (รอบ submit แรกของ `"external_api"` ที่
  ยังไม่เริ่มนับหน้า, หรือ provider จริงไม่รองรับ progress ระดับหน้าเลย) →
  `current_page`/`total_pages` เป็น `null`, `progress_message` เป็นข้อความ
  คงที่ที่ตรงความจริงเสมอ (`"กำลังประมวลผลโดย OCR provider"`) **ไม่มีการเดา
  เปอร์เซ็นต์ใดๆ ทั้งสิ้น**
- provider แบบ `"http"` ไม่เคยคืน `"processing"` เลย (ดูหัวข้อ 3.1) จึงไม่มี
  progress ระดับหน้าให้แสดงโดยธรรมชาติ — เห็นแค่ `pending` →
  `completed`/`failed`/`blocked` ทันที เหมือนก่อนช่วงนี้ทุกประการ

**หมายเหตุการออกแบบ**: `current_page`/`total_pages` ที่บันทึกไว้คือค่าจาก
การ poll **ล่าสุดเท่านั้น** ไม่ได้จำค่า `total_pages` ที่เคยรู้จากรอบ submit
ไว้ข้ามรอบถ้ารอบ poll ถัดไปไม่ได้ส่งค่านี้มาซ้ำ (เช่น provider ส่ง
`total_pages` มาแค่ตอน submit ครั้งเดียว) — เป็นผลข้างเคียงที่ยอมรับได้ของ
กฎ "ห้ามแสดงตัวเลขที่ provider ไม่ได้รายงานในรอบนั้นจริง" ถ้า provider จริงมี
พฤติกรรมนี้ ควรให้ endpoint poll ส่ง `total_pages` กลับมาทุกรอบเพื่อ UX ที่ดี
กว่า (อยู่นอกเหนือการควบคุมของแอปนี้)

หน้า `/superadmin/pdf-processing?mode=ocr` และ `/superadmin/ocr` แสดงรายการ
งาน OCR ล่าสุด (ไม่จัดกลุ่มเป็น batch เพราะสั่งทีละรายการไม่มี `batch_id`)
พร้อมสถานะ, progress ระดับหน้าเมื่อมี, เวลาเริ่ม, เวลาที่อัปเดตล่าสุดเสมอ —
ผ่าน `getRecentJobs()`/`RecentJobsPoller` component ที่ poll
`/api/superadmin/jobs/batches?jobType=ocr_processing&mode=recent` ทุก 5
วินาที (หยุด poll เมื่อแท็บไม่ visible, fail-open ถ้า poll พลาด — รูปแบบ
เดียวกับ `JobProgressPoller.tsx` เดิมของช่วงที่ 25 ทุกประการ)

ถ้าต้องการรองรับ provider แบบอื่นเพิ่มเติม (เช่น SDK เฉพาะของผู้ให้บริการราย
ใดรายหนึ่ง) เพิ่ม `OcrProviderKind` ใหม่ใน `ocr-provider.server.ts` ได้โดยไม่
กระทบโค้ดส่วนอื่น — โครงสร้างนี้ออกแบบให้เปลี่ยน/เพิ่ม provider ได้โดยไม่ต้อง
แก้ `process-ocr.server.ts`/job handler/UI เลย

## 4. ตัวอย่าง Self-hosted Provider ฟรี (ไม่บังคับใช้ — เป็นแนวทางเท่านั้น)

องค์กรที่ไม่ต้องการพึ่งบริการ OCR เชิงพาณิชย์ ตั้งบริการ HTTP เล็กๆ ห่อ
[Tesseract OCR](https://github.com/tesseract-ocr/tesseract) (โอเพนซอร์ส ฟรี
รองรับภาษาไทย+อังกฤษผ่าน `tesseract-ocr-tha`) ได้เอง แล้วรัน**แยกเครื่อง/
แยก container จากแอปเว็บนี้โดยสิ้นเชิง** (ไม่ deploy รวมกับ Next.js บน
Vercel เพราะ Tesseract ต้องการ native binary ที่ Vercel Serverless ไม่รองรับ
ตรงๆ) เช่นตั้งเป็น Docker container บน VM ขององค์กรเอง หรือใช้ Container
service ที่รองรับ native binary (Fly.io, Railway, self-hosted VM ฯลฯ) —
ตัวอย่าง endpoint (Python + Flask + `pytesseract`, เพื่อความเข้าใจเท่านั้น
ไม่ใช่โค้ดที่พร้อม production):

```python
# ตัวอย่างแนวคิดเท่านั้น — ต้องเพิ่ม auth (ตรวจ Bearer token ให้ตรงกับ
# OCR_PROVIDER_API_KEY), validation, rate limit, resource limit เองก่อนใช้งานจริง
@app.route("/ocr", methods=["POST"])
def ocr():
    file = request.files["file"]
    languages = request.form.get("languages", "tha+eng")
    images = convert_pdf_to_images(file)  # เช่น pdf2image (ต้องมี poppler)
    text = "\n".join(pytesseract.image_to_string(img, lang=languages) for img in images)
    return jsonify({"text": text, "language": languages})
```

จากนั้นตั้งค่าในแอปนี้:

```
OCR_PROVIDER=self_hosted
OCR_PROVIDER_BASE_URL=https://ocr.internal.your-org.example/ocr
OCR_PROVIDER_API_KEY=<secret ที่ endpoint ข้างต้นตรวจสอบ>
OCR_PROVIDER_TIMEOUT_MS=120000     # ไม่บังคับ ค่าเริ่มต้น 120000
OCR_ENABLED=true   # ต้องได้รับอนุมัติจากองค์กรก่อนเสมอ (หัวข้อ 5) และผ่าน
                    # ขั้นตอนทดสอบใน docs/ocr-provider-validation.md ก่อนเสมอ
```

ถ้าบริการ (self-hosted หรือเชิงพาณิชย์) รองรับรูปแบบ submit+poll แทนแบบรอ
ผลในคำขอเดียว (เอกสารใหญ่/ใช้เวลานาน) ให้ตั้งค่าเป็น `"external_api"` แทน
(ดูสัญญาเต็มที่หัวข้อ 3.2):

```
OCR_PROVIDER=external_api
OCR_PROVIDER_BASE_URL=https://ocr.internal.your-org.example
OCR_PROVIDER_API_KEY=<secret ที่ endpoint ข้างต้นตรวจสอบ>
OCR_PROVIDER_TIMEOUT_MS=30000
OCR_ENABLED=true
OCR_ALLOW_PRIVATE_DOCUMENTS=false  # ตั้ง true เฉพาะถ้าตรวจสอบนโยบายผู้ให้บริการ
                                    # ภายนอกแล้วว่ายอมรับเอกสารที่ไม่ใช่ public ได้ (หัวข้อ 5.1)
```

## 5. การส่งข้อมูลออกนอกระบบ — `OCR_ENABLED`

**ทุกครั้งที่เรียก OCR provider = ส่งเนื้อไฟล์ PDF เต็มไฟล์ออกไปนอก process
ของแอปนี้ผ่านเครือข่าย** — แม้ provider จะเป็น self-hosted ในเครือข่ายเดียวกัน
ก็ยังถือเป็น "ส่งออก" ตามข้อกำหนด (คนละ process, คนละ trust boundary)

`isOcrEnabled()` (เดิมชื่อ `isExternalOcrTransferAllowed()` ก่อนช่วงที่ 32)
ตรวจว่า `OCR_ENABLED === "true"` **แยกต่างหากจากการตั้งค่า provider โดยเจตนา
และใช้ร่วมกันทั้งสอง adapter** — `submitOcr()` ตรวจทั้งสามเงื่อนไขก่อนจะยอม
เรียก provider จริงเสมอ (เรียงตามลำดับ, เจอเงื่อนไขแรกที่ไม่ผ่านคือหยุดทันที):

1. `isOcrConfigured()` (มี `OCR_PROVIDER` เป็น `self_hosted`/`external_api` +
   `OCR_PROVIDER_BASE_URL`) — ไม่ผ่าน → `blocked`, `provider: "none"`, ไม่มีการ
   เชื่อมต่อเครือข่ายใดๆ เกิดขึ้น
2. `isOcrEnabled()` — ไม่ผ่าน → `blocked` พร้อมข้อความ "องค์กร
   ยังไม่ได้อนุมัติให้ส่งเอกสาร..." **ไม่มีการเชื่อมต่อเครือข่ายเกิดขึ้นเช่นกัน**
   (fail closed สนิท ไม่ได้แค่เตือนแล้วส่งต่อ)
3. `settings.ocrProviderEnabled` (สวิตช์ Super Admin ที่ `/superadmin/ocr` —
   ดูหัวข้อ 6) — ไม่ผ่าน → `blocked` เช่นกัน ไม่มีการเชื่อมต่อเครือข่าย

เงื่อนไขนี้บังคับ**เหมือนกันทุกเอกสารไม่ว่า `access_level` จะเป็น public หรือ
private** — ไม่ได้แยกตรวจเฉพาะเอกสารที่ทำเครื่องหมายเป็น private เท่านั้น
เป็นการตีความที่เข้มงวดกว่าขั้นต่ำโดยตั้งใจ (กันความผิดพลาดจากการลืมตั้งค่า
เฉพาะบางเอกสารให้ถูกต้อง — นโยบายเดียวกันทั้งระบบเข้าใจง่ายกว่าและตรวจสอบง่าย
กว่า) — ถ้าองค์กรอนุมัติแล้ว แปลว่าเอกสารทุกฉบับที่ถูกสั่ง OCR (ไม่ว่า access
level ใด) จะถูกส่งออกได้ ต้องพิจารณานโยบายนี้ในระดับองค์กร ไม่ใช่ระดับเอกสาร

### 5.1 เอกสารที่ไม่ใช่ public กับ provider ภายนอก — `OCR_ALLOW_PRIVATE_DOCUMENTS` (ช่วงที่ 32)

ชั้นควบคุมเพิ่มเติมเฉพาะ `OCR_PROVIDER=external_api` (ไม่บังคับกับ
`self_hosted` เพราะถือว่ารันบนโครงสร้างพื้นฐานที่องค์กรควบคุมเอง): แม้
`settings.ocrAllowedAccessLevels` (DB, หัวข้อ 6) จะอนุญาตระดับที่ไม่ใช่
`public` แล้วก็ตาม การส่งเอกสารระดับนั้นไปให้ **ผู้ให้บริการภายนอก** ต้องเปิด
`OCR_ALLOW_PRIVATE_DOCUMENTS=true` เพิ่มอีกชั้นหนึ่งเสมอ — ไม่ผ่านจะได้ผลลัพธ์
`blocked` ด้วยรหัส `private_document_not_allowed` ทั้งตอน pre-flight
(`checkOcrEligibility()`) และตอน `submitOcr()` จริง **ไม่มีการเชื่อมต่อ
เครือข่ายเกิดขึ้น**ถ้าไม่ผ่าน — ตรวจเฉพาะใน `checkOcrEligibility()`/
`submitOcr()` เท่านั้น (ไม่ซ้ำใน handler ของ `ocr_test_run` เพราะ fixture
ของ Controlled Test เป็นไฟล์ที่ไม่เป็นความลับโดยการออกแบบอยู่แล้ว ดูหัวข้อ 14)

**ก่อนตั้งค่าเป็น `true` ต้อง**:

- ตรวจสอบสัญญา/นโยบายกับผู้ให้บริการ OCR ว่าไม่เก็บ/นำเนื้อหาเอกสารไปใช้ต่อ
  (โดยเฉพาะถ้าใช้บริการเชิงพาณิชย์ภายนอก)
- อัปเดตเอกสาร privacy/copyright ขององค์กรให้ระบุชัดเจนว่ามีการส่งเอกสารบาง
  ส่วนไปยัง OCR provider ภายนอก (ถ้าเลือกใช้บริการภายนอกจริง ไม่ใช่ self-
  hosted) — เอกสารนี้ (`docs/ocr-operations.md`) และ
  [docs/file-security.md](./file-security.md) หัวข้อ 8 เป็นจุดอ้างอิงทางเทคนิค
  แต่**นโยบายที่บังคับใช้จริงกับผู้ใช้ต้องอยู่ในเอกสาร privacy policy ของ
  องค์กรเอง** ซึ่งอยู่นอกขอบเขตโค้ดของโปรเจกต์นี้

## 6. ขีดจำกัดขนาด/จำนวนหน้า และการควบคุมค่าใช้จ่าย (ช่วงที่ 27)

เนื่องจาก OCR เรียก provider ภายนอกที่อาจมีค่าใช้จ่ายตามขนาด/จำนวนหน้าเอกสาร
และ/หรือมี rate limit ของตัวเอง ระบบจึงมีชั้นควบคุมเพิ่มเติมจาก
`OCR_ENABLED` (หัวข้อ 5) โดยตั้งใจให้ Super Admin ปรับได้แบบ
**ไดนามิกผ่าน `/superadmin/ocr`** (ไม่ต้อง deploy ใหม่) ต่างจากค่าที่ตั้งผ่าน
Environment Variables:

| ค่าตั้งค่า (คอลัมน์ `settings`) | ความหมาย | ค่าเริ่มต้น |
| --- | --- | --- |
| `ocr_max_file_size_mb` | ขนาดไฟล์ PDF สูงสุดที่สร้างงาน OCR ได้ | 20 MB |
| `ocr_max_pages` | จำนวนหน้าสูงสุดที่สร้างงาน OCR ได้ | 50 หน้า |
| `ocr_daily_quota_enabled` + `ocr_max_jobs_per_user_per_day` | เปิด/ปิด + ค่าจำกัดจำนวนงาน OCR ต่อผู้ใช้ต่อวัน | เปิด, 20 งาน/วัน |
| `ocr_provider_enabled` | สวิตช์เปิด/ปิด OCR ระดับฐานข้อมูล — ปิดได้ทันทีโดยไม่ต้องแก้ Environment Variables | เปิด |
| `ocr_allowed_access_levels` | ระดับการเข้าถึงเอกสาร (`research_items.access_level`) ที่อนุญาตให้ส่ง OCR | `{public}` เท่านั้น |

### 6.0 เพดานจาก Environment Variables (ช่วงที่ 32) — `min(env ceiling, ค่าใน settings)`

`OCR_MAX_FILE_SIZE_MB` / `OCR_MAX_PAGES` / `OCR_MAX_JOBS_PER_DAY` (ไม่บังคับ
ตั้งค่า) เป็น **เพดานสูงสุดระดับ deploy** — ต่างจากค่าใน `settings` ข้างบน
ตรงที่แก้ได้เฉพาะตอน deploy ใหม่เท่านั้น (Super Admin ปรับผ่านหน้าเว็บไม่ได้)
เจตนาไว้เป็นเพดานกันชนระดับองค์กรที่ Super Admin แต่ละคนไม่ควรขยับข้ามได้เอง
โดยไม่ผ่านทีม infra (เช่น จำกัดค่าใช้จ่ายสูงสุดที่เป็นไปได้ของบัญชี provider)
— ค่าที่ใช้ตรวจจริงใน `checkOcrEligibility()` ทุกครั้งคือ:

```
effectiveMaxFileSizeMb = env ceiling ตั้งไว้ ? min(env ceiling, settings.ocr_max_file_size_mb) : settings.ocr_max_file_size_mb
effectiveMaxPages      = env ceiling ตั้งไว้ ? min(env ceiling, settings.ocr_max_pages)         : settings.ocr_max_pages
effectiveMaxJobsPerDay = env ceiling ตั้งไว้ ? min(env ceiling, settings.ocr_max_jobs_per_user_per_day) : settings.ocr_max_jobs_per_user_per_day
```

ถ้าไม่ตั้งค่า env ceiling เลย (ค่าว่าง) ระบบใช้ค่าใน `settings` เพียงอย่างเดียว
เหมือนก่อนช่วงที่ 32 ทุกประการ — **การเพิ่ม env ceiling ไม่เคยทำให้ค่าที่ใช้จริง
สูงกว่าที่ Super Admin ตั้งไว้ใน `settings`** มีแต่จะจำกัดให้ต่ำลงเท่านั้น
(ทดสอบยืนยันแล้วทั้งสองทิศทาง — ดูหัวข้อ 10)

### 6.1 ตรวจสอบก่อนสร้างงานเสมอ — ไม่มีทางสร้างงาน OCR ที่เกินขีดจำกัดได้

`lib/ocr/ocr-limits.server.ts` (`checkOcrEligibility()`) เป็นจุดตรวจสอบ**เดียว**
ที่ทั้งสามจุดที่สร้างงาน OCR เรียกใช้ร่วมกัน **ก่อน** `enqueueBackgroundJob()`
เสมอ — ถ้าไม่ผ่านเงื่อนไขใดเงื่อนไขหนึ่ง **จะไม่มีการสร้างแถว `background_jobs`
เลย** (ไม่ใช่สร้างแล้วค่อยไปล้มเหลวทีหลังในคิว):

1. `triggerOcrAction` (`app/dashboard/research/[id]/edit/actions.ts`) — สั่งทีละรายการ
2. `bulkEnqueueOcrAction` (`app/superadmin/pdf-processing/actions.ts`) — เลือกหลายรายการ (สูงสุด 200)
3. `handleBulkEnqueueJob` (`lib/jobs/handlers/bulk-enqueue.server.ts`) — coordinator ของ "ประมวลผลทั้งหมดตามตัวกรอง"

ลำดับการตรวจ (คำนวณสิ่งที่ถูกที่สุดก่อนเสมอ): การตั้งค่า/สวิตช์เปิดปิด →
ระดับการเข้าถึงที่อนุญาต → ขนาดไฟล์ (`storage.list()` อ่านแค่ metadata ไม่
ดาวน์โหลดไฟล์) → จำนวนหน้า (ถ้ายังไม่รู้ค่า ดาวน์โหลดมาคำนวณด้วย `pdfjs-dist`
ตัวเดียวกับที่ใช้ดึงข้อความปกติ แล้ว cache กลับไปที่ `research_items.page_count`
เพื่อไม่ต้องคำนวณซ้ำ — คอลัมน์นี้มีอยู่แล้วในสคีมาแต่ไม่เคยถูกเขียนมาก่อนช่วงนี้)
→ โควตาต่อผู้ใช้ต่อวัน (ใช้ `check_rate_limit()`/`rate_limit_events` เดิมจาก
ช่วงที่ 9 คีย์แบบ `ocr_job:{userId}`, หน้าต่าง 86400 วินาที — ตรวจไว้ท้ายสุด
โดยตั้งใจเพื่อไม่ให้รายการที่ถูกปฏิเสธจากเหตุผลอื่นไปกินโควตาของผู้ใช้)

ถ้าไฟล์เกินขนาดหรือจำนวนหน้า ข้อความที่แสดงแนะนำให้ **แบ่งไฟล์หรือให้
เจ้าหน้าที่ดำเนินการตามนโยบาย** เสมอ (ไม่ใช่แค่บอกว่า "ทำไม่ได้" เฉยๆ) และ
บันทึก audit log ทุกครั้งที่ถูกปฏิเสธ (`ocr_rejected_by_limits` — ทีละรายการ,
`ocr_bulk_rejected_by_limits` — สรุปเป็นชุด) พร้อมเหตุผล (`code`) กำกับ

### 6.2 ทำไมไม่ใช้ `job_type_settings` (ระบบ concurrency เดิม)

`job_type_settings`/`processJobQueue()` (ช่วงที่ 25) ควบคุม **concurrency**
(กี่งานพร้อมกัน) ของ `ocr_processing` อยู่แล้วโดยไม่ต้องเพิ่มโค้ดใหม่เลย —
ขีดจำกัดในหัวข้อนี้เป็นคนละมิติ (**จะสร้างงานได้หรือไม่**, ไม่ใช่ **จะรันพร้อม
กันได้กี่งาน**) จึงเก็บเป็นคอลัมน์ใหม่บน `public.settings` (ตารางตั้งค่า
Super Admin เดิม) แทน — สอดคล้องกับรูปแบบเดิมของโปรเจกต์ (ค่าที่ Super Admin
ปรับได้แบบไดนามิก → `settings`, ค่า concurrency ต่อประเภทงาน →
`job_type_settings`)

### 6.3 หน้า `/superadmin/ocr`

แสดงสถานะ 3 ชั้น (ตั้งค่า provider ผ่าน Environment Variables แล้วหรือยัง /
ได้รับอนุมัติส่งออกแล้วหรือยัง / เปิดใช้งานในฐานข้อมูลหรือยัง — ต้องผ่านครบ
ทั้ง 3 จึงจะสร้างงาน OCR ได้จริง), ฟอร์มตั้งค่าขีดจำกัดทั้งหมดข้างต้น, และลิงก์
ไปหน้าติดตามงาน `/superadmin/pdf-processing` — **ไม่แสดง API key, URL ของ
provider, หรือข้อมูลค่าใช้จ่ายใดๆ** ในหน้านี้เลย (แสดงแค่สถานะ true/false และ
ตัวเลขขีดจำกัดที่ Super Admin ตั้งเอง)

## 7. ภาษาไทยและอังกฤษ

- `OCR_LANGUAGES` (ค่าเริ่มต้นถ้าปล่อยว่าง: `"tha+eng"`) — ส่งให้ provider
  เป็น hint ว่าควรรัน OCR ด้วยโมเดล/dictionary ภาษาใด รูปแบบค่าขึ้นกับ
  provider ที่เลือก (ตัวอย่างในเอกสารนี้ใช้รูปแบบของ Tesseract `lang1+lang2`)
- **ความแม่นยำของ OCR ภาษาไทยโดยทั่วไปต่ำกว่าภาษาอังกฤษ** ไม่ว่าจะใช้
  provider ใด (ลักษณะเฉพาะของอักษรไทยที่ไม่มีช่องว่างระหว่างคำ, สระ/วรรณยุกต์
  ซ้อนกันหลายชั้น) — ผู้ใช้เห็นคำเตือน "ข้อความจาก OCR อาจมีความคลาดเคลื่อน
  โดยเฉพาะภาษาไทย" กำกับไว้ทุกจุดที่แสดงข้อความ/ผลค้นหาที่มาจาก OCR (ไม่มี
  จุดใดแสดงข้อความ OCR โดยไม่มีคำเตือนกำกับ)
- `ocr_confidence` (ถ้า provider ส่งกลับมา) แสดงเป็นเปอร์เซ็นต์ที่หน้าจัดการ
  งานวิจัย — เป็นค่าที่ provider รายงานเอง ไม่ใช่การคำนวณของแอปนี้ ไม่ใช่ทุก
  provider ที่ส่งค่านี้กลับมา (เป็น optional field)

## 8. Retry และการประมวลผลเป็นชุด

ใช้ระบบ background job เดิมของช่วงที่ 20 ทุกประการ (ดู
[docs/background-jobs.md](./background-jobs.md)) — `job_type: "ocr_processing"`
เป็น job type ที่ 5 ในคิวเดียวกัน:

- **Retry อัตโนมัติ**: ล้มเหลวแล้วรีทราย exponential backoff จนครบ
  `max_attempts` ก่อนเปลี่ยนเป็น `failed` ถาวร — งาน `ocr_processing` ใช้
  `max_attempts = OCR_JOB_MAX_ATTEMPTS` (120) แทนค่าเริ่มต้น 5 ของคิวทั่วไป
  โดยตั้งใจ (ดูเหตุผลที่หัวข้อ 3.2 — การ requeue ระหว่าง poll สถานะของ
  provider แบบ `"external_api"` ก็นับเป็น attempt เหมือนกัน ต้องมีที่ว่างพอ
  ให้ poll จนกว่างานจะเสร็จจริง ไม่ใช่แค่สำหรับนับ retry ตอนล้มเหลว)
- **Retry ด้วยมือ**: เจ้าหน้าที่กด "ลองใหม่" ที่หน้าจัดการงานวิจัย
  (`ExtractionStatusCard`) หรือ Super Admin กดที่รายการ "งานที่ล้มเหลวถาวร"
  ของ `/superadmin/pdf-processing` แท็บ OCR
- **เป็นชุด**: `/superadmin/pdf-processing?mode=ocr` — กรองเฉพาะเอกสารที่
  `extraction_status = 'no_text_found'` และยังไม่ `ocr_status = 'completed'`
  เลือกหลายรายการพร้อมกันแล้วกด "เริ่ม OCR ที่เลือก" (จำกัดสูงสุด 200 รายการ
  ต่อครั้ง เหมือน bulk action อื่นในระบบ) — ทุกครั้งบันทึก `audit_logs`
  (`action: "ocr_bulk_process"` / `"ocr_retry"` / `"research_ocr_trigger"`
  สำหรับสั่งทีละรายการ)
- **Idempotency**: `idempotencyKey: "ocr_processing:{research_item_id}"` —
  สั่ง OCR ซ้ำขณะมีงานค้างอยู่แล้วจะถูกข้ามเงียบๆ ไม่สร้างงานซ้ำซ้อน
- **(ช่วงที่ 28)** ปุ่ม "OCR ทั้งหมดที่ตรงตัวกรอง (ไม่จำกัด 500 รายการ)" ที่
  `/superadmin/pdf-processing?mode=ocr` ตอนนี้กรองด้วย `ocrStatus`
  (`not_required`/`pending`/`failed`) ได้โดยตรงแล้ว — เป็นมิติแยกจากเงื่อนไข
  `extraction_status = 'no_text_found'` เดิม (ยังคงบังคับใช้เสมอสำหรับโหมด
  OCR) เช่น กรอง "เฉพาะที่ OCR ล้มเหลว" เพื่อสั่งลองใหม่ทั้งหมดพร้อมกันได้โดย
  ไม่ต้องเลือกทีละรายการ — พร้อม pause/resume/cancel และแจ้งเตือนเมื่อชุดงาน
  เสร็จ/ล้มเหลว ดู [docs/background-jobs.md](./background-jobs.md) หัวข้อ
  11.6 (ขีดจำกัดขนาด/จำนวนหน้า/โควตาจาก `checkOcrEligibility()` ยังคงตรวจ
  ก่อนสร้างงานทุกครั้งเหมือนเดิมทุกประการ ไม่เปลี่ยนแปลง ดูหัวข้อ 6)

## 9. สิทธิ์และ UI

- **เจ้าหน้าที่ (rank ≥ 30 — Librarian ขึ้นไป)** สั่ง OCR ได้ที่หน้าจัดการ
  งานวิจัย `/dashboard/research/[id]/edit` (การ์ด "การค้นหาเนื้อหาภายใน PDF"
  ส่วน OCR) — แสดงเมื่อ `extraction_status = 'no_text_found'` หรือมี
  `ocr_status` ที่ไม่ใช่ `not_required` อยู่แล้ว
- **Super Admin** สั่งเป็นชุดที่ `/superadmin/pdf-processing` แท็บ "OCR
  เอกสารสแกน" — เหมือนสิทธิ์ bulk action อื่นของ Super Admin
- การตรวจสิทธิ์ใช้รูปแบบเดียวกับ `reprocessResearchTextAction` เดิมของช่วงที่
  17 ทุกประการ (rank ≥ 30 + RLS row-visibility ปกติ — ไม่มีการตรวจสิทธิ์รายไฟล์
  เพิ่มเติมนอกเหนือจากนี้ เพราะ RLS ของ `research_items`/
  `research_document_texts` บังคับสิทธิ์การมองเห็นแถวอยู่แล้ว ถ้ามองไม่เห็นแถว
  action ก็ดึงข้อมูลไม่ได้และล้มเหลวอย่างปลอดภัย)
- **Progress (ช่วงที่ 29)**: `/superadmin/pdf-processing?mode=ocr` และ
  `/superadmin/ocr` แสดงรายการงาน OCR ล่าสุดพร้อมสถานะ, progress ระดับหน้า
  เมื่อ provider รายงานได้ (ดูหัวข้อ 3.3), เวลาเริ่ม, เวลาที่อัปเดตล่าสุด —
  poll อัตโนมัติทุก 5 วินาที ไม่ต้อง refresh หน้าเอง (หยุด poll เมื่อแท็บไม่
  visible) provider แบบ `"self_hosted"` ยังคงเห็นแค่ `pending` →
  `completed`/`failed`/`blocked` ทันทีเหมือนก่อนช่วงนี้ (ไม่มี progress
  ระหว่างทางให้แสดงโดยธรรมชาติ)
- **Error ที่แสดงต่อผู้ใช้ผ่านการ sanitize เสมอ** — ข้อความ error ดิบจาก
  provider (เช่น HTTP body, stack trace) log ด้วย `console.error` ฝั่ง
  เซิร์ฟเวอร์เท่านั้น ไม่เคยหลุดไปที่ UI หรือถูกบันทึกลง
  `ocr_error_message` ตรงๆ

## 10. ทดสอบแล้วจริง (สภาพแวดล้อม local — ยังไม่ได้ตั้งค่า provider จริง)

ทดสอบผ่าน temporary test route + `docker exec ... psql` (แนวทางเดียวกับ
ทุกช่วงก่อนหน้า) แล้วลบทิ้งหลังทดสอบเสร็จ — ยืนยันแล้วว่า:

- OCR ที่ยังไม่ได้ตั้งค่า provider จบด้วย `ocr_status = 'failed'` เสมอ **ไม่มี
  `ocr_text` ถูกเขียนเลยแม้แต่ตัวอักษรเดียว** (ไม่มีข้อมูลปลอม)
- ตั้งค่า provider แล้วแต่ยังไม่ได้ตั้ง `OCR_ENABLED=true` ก็
  ยังปฏิเสธการส่งไฟล์ (ไม่มีการเชื่อมต่อเครือข่ายเกิดขึ้น)
- `acquire_ocr_lock()` กันสองงานประมวลผลไฟล์เดียวกันพร้อมกันได้จริง (งานที่
  สองได้ `null` กลับมาและหยุดทำงานทันที ขณะที่งานแรกยัง `processing` อยู่)
- ข้อความจาก OCR ที่ทำเครื่องหมาย `completed` แล้วถูกค้นเจอผ่าน
  `searchResearchServer()` จริง พร้อม `isOcrMatch: true`
- เอกสาร `staff_only` ที่มีข้อความ OCR ไม่รั่วไหลออกมาในผลค้นหาของผู้ใช้ที่ไม่
  มีสิทธิ์ (RLS บังคับเหมือน PDF ปกติทุกประการ)
- **พบและแก้ไขแล้ว**: migration เดิมไม่ได้ grant `select, update` บนตาราง
  `authors` ให้ `service_role` — ORCID callback (ต้องเขียน `authors` แทนผู้ใช้
  ที่อาจไม่ผ่าน RLS ปกติ) จะล้มเหลวด้วย "permission denied" ในสภาพแวดล้อมจริง
  ถ้าไม่แก้ไข ได้เพิ่ม grant นี้ใน migration แล้ว (ไม่เกี่ยวกับ OCR โดยตรง แต่
  พบระหว่างการทดสอบ Phase 23 ร่วมกัน)
- ยังไม่ได้ทดสอบกับ OCR provider จริง (Tesseract/บริการเชิงพาณิชย์) เนื่องจาก
  ยังไม่ได้รับอนุญาตให้เปิดใช้บริการภายนอกในสภาพแวดล้อมนี้ตามข้อกำหนด — ต้อง
  ทดสอบเพิ่มเติมกับ provider จริงก่อนใช้งานจริงกับเอกสารจริง โดยเฉพาะความแม่นยำ
  ภาษาไทย (ดูหัวข้อ 7)

**ทดสอบขีดจำกัด/การควบคุมค่าใช้จ่าย (ช่วงที่ 27, ผ่าน temporary test route
เดียวกัน)**:

- ไฟล์เกินขนาดที่ตั้งไว้ → `checkOcrEligibility()` ปฏิเสธด้วย `file_too_large`
  ก่อนดาวน์โหลดไฟล์เต็ม — ยืนยันว่า `.storage.list()` อ่านแค่ metadata ขนาดจริง
- จำนวนหน้าเกินที่ตั้งไว้ (คำนวณสดจากไฟล์ 5 หน้าจริง) →
  ปฏิเสธด้วย `too_many_pages` **และ** `research_items.page_count` ยังถูก
  cache ไว้ถูกต้องแม้จะถูกปฏิเสธ (5) — ยืนยันว่าค่านี้นำไปใช้ตรวจครั้งถัดไปได้
  โดยไม่ต้องดาวน์โหลด/คำนวณซ้ำ
- ระดับการเข้าถึงที่ไม่อยู่ใน allow-list (ค่าเริ่มต้น `{public}`) → ปฏิเสธด้วย
  `access_level_not_allowed` แล้วผ่านได้ทันทีเมื่อ Super Admin เพิ่มระดับนั้น
  เข้า allow-list
- โควตาต่อผู้ใช้ต่อวัน (ตั้งทดสอบที่ 1 งาน/วัน) → งานแรกผ่าน งานที่สองถูก
  ปฏิเสธด้วย `quota_exceeded` ทันที (ใช้ `check_rate_limit()` เดิม)
- สวิตช์ `ocr_provider_enabled` ปิด → ปฏิเสธด้วย `provider_disabled` แม้ว่า
  Environment Variables จะตั้งค่าครบแล้วก็ตาม (ยืนยันว่าเป็นชั้นควบคุมอิสระจาก
  env var จริง)
- ทุกกรณีที่ถูกปฏิเสธข้างต้น **ไม่มีแถว `background_jobs` ถูกสร้างขึ้นเลย**
  (ตรวจสอบจำนวนแถวก่อน/หลังการเรียก `checkOcrEligibility()` ตรงๆ ไม่ผ่าน
  Server Action เนื่องจากต้องมี session ผู้ใช้จริง — ตรรกะการเขียน/ปฏิเสธ
  เป็นฟังก์ชันเดียวกับที่ Server Action เรียกจริงทุกประการ)

**ทดสอบ provider adapter 2 รูปแบบ + progress ระดับหน้า (ช่วงที่ 29, ผ่าน
temporary test route + stub `global.fetch` เดียวกับที่ Phase 27 ทดสอบ
ORCID/OCR โดยไม่มี credential จริง — เพราะยังไม่ได้รับอนุญาตให้เปิดใช้บริการ
ภายนอก)**:

- Provider ยังไม่ได้ตั้งค่า (`OCR_PROVIDER` ว่าง/`none`) → `submitOcr()` คืน
  `blocked` ทันที **ไม่มีการเรียก `fetch` เกิดขึ้นเลย** (ยืนยันด้วยตัวนับ
  จำนวนครั้งที่เรียก) — ตั้งค่าครบแต่ยังไม่ได้ `OCR_ENABLED=true`
  ก็ `blocked` เช่นกันโดยไม่มีการเชื่อมต่อเครือข่าย
- Super Admin ปิดสวิตช์ `ocr_provider_enabled` (ตั้งค่า provider/env ครบแล้ว)
  → `submitOcr()` คืน `blocked` ก่อนเรียก provider จริงเช่นกัน (ยืนยันว่าเป็น
  ชั้นควบคุมอิสระ ตรวจหลัง `isOcrConfigured()`/`isOcrEnabled()`
  เสมอ)
- provider `"self_hosted"`: สำเร็จในคำขอเดียว (regression, พฤติกรรมเดิมทุกประการ) —
  ทดสอบทั้งกรณีสำเร็จ (คืน `text`/`confidence`/`language` ตรงกับที่ provider
  ปลอมส่งมา) และ provider ตอบ HTTP error (คืน `failed` พร้อมข้อความปลอดภัย)
- provider `"external_api"`: วงจรเต็มผ่าน `handleOcrProcessingJob()` จริง
  (enqueue → submit ได้ `processing` + `total_pages` → poll ที่ยังไม่มีเลข
  หน้า → poll ที่มีเลขหน้าจริง (50/200) → poll เสร็จสมบูรณ์) ยืนยันว่า
  `background_jobs.current_page`/`total_pages`/`progress`/`progress_message`
  อัปเดตถูกต้องทุกรอบ ตรงกับสิ่งที่ provider ปลอมส่งมาเป๊ะๆ **ไม่มีตัวเลข/
  ข้อความ progress ที่ไม่ได้มาจาก provider จริงปรากฏขึ้นเลยสักครั้ง** —
  หลังจบวงจร `research_document_texts.ocr_status = 'completed'` และ
  `ocr_text` ตรงกับข้อความที่ provider ปลอมส่งกลับมาทุกตัวอักษร
- provider `"external_api"`: วงจร submit ล้มเหลว (provider ตอบ HTTP 500) →
  `research_document_texts.ocr_status = 'failed'`, `background_jobs.error_message`
  เป็นข้อความปลอดภัย (ไม่ใช่ raw error), attempts/backoff ทำงานตามปกติ
- วงจรครบผ่าน handler จริงเมื่อ provider ไม่ได้ตั้งค่า →
  `research_document_texts.ocr_status = 'blocked'` (ไม่ใช่ `'failed'`)
  **ไม่มีการเรียก `fetch` เกิดขึ้นแม้แต่ครั้งเดียวตลอดทั้งวงจร**
- `pollResearchDocumentOcr()` ไม่พยายาม `acquire_ocr_lock()` ซ้ำระหว่าง poll
  (ยืนยันว่าไม่ error แม้ `ocr_status` ยังเป็น `'processing'` ค้างอยู่ตั้งแต่
  รอบ submit)
- `checkOcrEligibility()` (Phase 27, ไม่ได้แก้โค้ดในช่วงนี้) ยังทำงานถูกต้อง
  เหมือนเดิมทุกประการหลังเปลี่ยนโครงสร้าง provider — ทดสอบ regression ทั้ง
  กรณีเกินจำนวนหน้าและกรณีผ่านเกณฑ์
- ตรวจสอบโค้ดยืนยันว่า audit log (`research_ocr_trigger`/`ocr_retry`/
  dead-letter ของ SQL trigger) ยังคงบันทึกเฉพาะ action จริงของผู้ใช้/การจบงาน
  ถาวรเท่านั้น — รอบ requeue/poll ระหว่างทางของ provider แบบ async **ไม่เรียก
  `logAudit` เลย** (ไม่มีการบันทึก audit log ถี่เกินจำเป็นจากการ poll)

## 11. ข้อจำกัด

- ไม่มี OCR engine/บริการแถมมาให้ในตัวโปรเจกต์ — ต้องตั้งค่า provider เอง
  ก่อนจึงจะ OCR ได้จริง (ดูหัวข้อ 3-4)
- ไม่มีการแปลง PDF เป็นภาพ/ตัดหน้าใดๆ ในฝั่งแอปเลย — ไฟล์ PDF ทั้งไฟล์ถูกส่งไป
  ให้ provider จัดการเอง เวลาที่ใช้ขึ้นกับ provider ทั้งหมด ไม่ใช่ข้อจำกัดจาก
  ฝั่งแอป (timeout ต่อคำขอกำหนดด้วย `OCR_PROVIDER_TIMEOUT_MS` — ค่าเริ่มต้น
  120000ms = 120 วินาทีถ้าไม่ได้ตั้งค่า, จำกัดช่วง 5000-300000ms, ใช้ค่าเดียว
  กันทั้งคำขอ submit และแต่ละรอบ poll — ก่อนช่วงที่ 32 เป็นค่าคงที่ในโค้ด
  แยกกันคนละค่าต่อ adapter ไม่ใช่เวลารวมที่ provider ใช้ประมวลผลทั้งเอกสาร)
- **provider `"self_hosted"` ไม่รองรับ progress ระดับหน้าโดยธรรมชาติ** — เป็น
  blocking call เดียว ไม่มีจังหวะให้รายงานสถานะระหว่างทาง ไม่ว่า provider
  จริงจะรองรับ progress หรือไม่ก็ตาม (ข้อจำกัดของรูปแบบ contract เอง ไม่ใช่
  ของ provider) ถ้าต้องการ progress ระดับหน้าต้องใช้ `"external_api"` กับ
  provider ที่รายงาน `current_page`/`total_pages` ในการ poll จริง
- **`"external_api"`'s รายละเอียด progress ขึ้นกับสิ่งที่ provider จริงส่งมา
  ทั้งหมด** — ถ้า provider ไม่ส่ง `current_page`/`total_pages` มา (หรือส่งมา
  ไม่ครบทุกรอบ poll) ระบบจะไม่เดา/คำนวณแทนเด็ดขาด แสดงแค่ข้อความสถานะทั่วไป
  แทน (ดูหัวข้อ 3.3) — และไม่จำค่า `total_pages` ข้ามรอบถ้ารอบถัดไปไม่ได้ส่ง
  มาซ้ำ (ดูหมายเหตุท้ายหัวข้อ 3.3)
- `ocr_confidence` เป็น optional field ที่ provider ต้องรายงานเอง — ไม่ใช่
  provider ทุกตัวที่ส่งค่านี้กลับมา แสดงเป็น `-` ในหน้าจัดการถ้าไม่มีค่า
- Bulk OCR จำกัดสูงสุด 200 รายการต่อการเลือกครั้งเดียว (เหมือน bulk action
  อื่นในระบบ) — ห้องสมุดที่มีเอกสารสแกนจำนวนมากต้องกรองให้แคบลงก่อนหรือกด
  หลายรอบ
- ไม่มี dead-letter queue/แจ้งเตือนอัตโนมัติเมื่อ OCR ล้มเหลวถาวร (เหมือนคิว
  background job อื่นทั้งหมด) — ต้องเข้าไปดูหน้า Super Admin เอง
- ยังไม่ได้ทดสอบกับ provider เชิงพาณิชย์จริงรายใดรายหนึ่ง (ทั้งสอง adapter
  ทดสอบผ่าน stub เท่านั้น ตามข้อกำหนดห้ามเปิดใช้บริการภายนอกที่มีค่าใช้จ่าย
  ในสภาพแวดล้อมนี้) — สัญญา (`current_page`/`total_pages` ในการ poll) เป็น
  contract ทั่วไปที่ provider จริงต้องรองรับให้ตรงหรือปรับ adapter เพิ่มเติม
  ก่อนใช้งานจริง

## 12. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `supabase/migrations/20260813100000_orcid_oauth_and_ocr.sql` | คอลัมน์ `ocr_*` บน `research_document_texts`, `ocr_processing` job type, `acquire_ocr_lock()` |
| `supabase/migrations/20260816100000_orcid_public_api_and_ocr_limits.sql` (ช่วงที่ 27) | คอลัมน์ `ocr_*` บน `settings` (ขีดจำกัด/สวิตช์/allow-list) |
| `supabase/migrations/20260818100000_ocr_progress_and_blocked_status.sql` (ช่วงที่ 29) | คอลัมน์ `current_page`/`total_pages`/`progress_message` บน `background_jobs`, เพิ่ม `'blocked'` เข้า `research_document_texts.ocr_status` CHECK |
| `lib/ocr/ocr-limits.server.ts` (ช่วงที่ 27) | `checkOcrEligibility()` — จุดตรวจสอบขีดจำกัดก่อนสร้างงาน OCR ทุกจุด |
| `lib/pdf/extract-text.server.ts` (`getPdfPageCount`, ช่วงที่ 27) | นับจำนวนหน้า PDF ด้วย `pdfjs-dist` เดียวกับที่ใช้ดึงข้อความ |
| `app/superadmin/ocr/{page.tsx,actions.ts}`, `components/superadmin/OcrSettingsForm.tsx` (ช่วงที่ 27) | หน้าตั้งค่าขีดจำกัด/สถานะ provider สำหรับ Super Admin |
| `lib/ocr/ocr-provider.server.ts` (ปรับปรุงช่วงที่ 29, เปลี่ยนชื่อ env var + เพิ่ม connectivity check/config summary ช่วงที่ 32) | Provider abstraction 2 รูปแบบ (`self_hosted`/`external_api`) — ตรวจการตั้งค่า, `isOcrEnabled()`, `isPrivateDocumentTransferAllowed()`, `isOcrTestModeEnabled()`, `getOcrEnvLimits()`, `submitOcr()`/`submitOcrTest()`/`pollOcrStatus()`, `checkOcrProviderConnectivity()`, `getOcrConfigSummary()`, `OCR_JOB_MAX_ATTEMPTS` |
| `lib/ocr/process-ocr.server.ts` (ปรับปรุงช่วงที่ 29) | orchestrator: `processResearchDocumentOcr()` (submit ใหม่)/`pollResearchDocumentOcr()` (poll ต่อ) — ล็อก, ดาวน์โหลด, เรียก provider, บันทึกผล |
| `lib/jobs/handlers/ocr-processing.server.ts` (ปรับปรุงช่วงที่ 29) | Background job handler แบบ stateful (submit/poll ตาม `payload.external_job_id`, requeue เมื่อ `"processing"`) |
| `lib/jobs/queue.server.ts` (`updateJobPageProgress`, ช่วงที่ 29) | บันทึก progress ระดับหน้าของ job หนึ่งงาน |
| `lib/data/job-batches.server.ts` (`getRecentJobs`/`RecentJobRow`, ขยายช่วงที่ 29) | รายการ job ไม่จัดกลุ่มพร้อม progress ระดับหน้า — ใช้กับ `ocr_processing` |
| `app/api/superadmin/jobs/batches/route.ts` (`?mode=recent`, ช่วงที่ 29) | JSON endpoint สำหรับ poll รายการ job OCR ล่าสุด |
| `components/superadmin/RecentJobsPoller.tsx`, `JobBatchList.tsx` (`RecentJobsList`, ช่วงที่ 29) | UI poll+แสดงรายการงาน OCR พร้อม progress |
| `lib/pdf/extraction-status.server.ts` | อ่านสถานะ OCR ร่วมกับสถานะดึงข้อความปกติ |
| `lib/data/research-search.server.ts` (`collectPdfMatches`) | รวมผลค้นหาจาก OCR เข้ากับผลค้นหาข้อความปกติ |
| `lib/labels.ts` (`ocrStatusLabels`, เพิ่ม `blocked` ช่วงที่ 29) | ป้ายภาษาไทยของแต่ละสถานะ |
| `components/dashboard/ExtractionStatusCard.tsx` (เพิ่ม `blocked` ช่วงที่ 29) | UI สถานะ + ปุ่มสั่ง/ลองใหม่ที่หน้าจัดการงานวิจัย |
| `app/dashboard/research/[id]/edit/actions.ts` (`triggerOcrAction`) | Server Action สั่ง OCR ทีละรายการ |
| `app/superadmin/pdf-processing/page.tsx`, `actions.ts` | แท็บ OCR แบบ bulk ที่หน้า Super Admin |
| `app/research/[id]/read/page.tsx` | ข้อความแจ้งสถานะที่หน้าอ่าน PDF เมื่อมีข้อความจาก OCR |
| `components/research/ResearchCard.tsx` | ป้าย "จาก OCR อาจคลาดเคลื่อน" ที่ผลค้นหา |
| `supabase/migrations/20260821100000_ocr_provider_validation.sql` (ช่วงที่ 32) | ตาราง `ocr_test_runs`, เพิ่ม `ocr_test_run` เข้า `background_jobs.job_type`/`job_type_settings` CHECK |
| `lib/ocr/ocr-limits.server.ts` (ปรับปรุงช่วงที่ 32) | เพิ่ม `min(env ceiling, settings)` clamping และรหัส `private_document_not_allowed` |
| `lib/ocr/test-fixtures.server.ts` (ช่วงที่ 32) | ทะเบียนไฟล์ทดสอบ OCR แบบ non-confidential — `listOcrTestFixtures()`, `getOcrTestFixture()`, `readOcrTestFixtureBuffer()` |
| `public/ocr-test-fixtures/*.pdf` (ช่วงที่ 32) | ไฟล์ PDF ทดสอบจริง (`english-sample`, `multipage-sample`, `no-text-scanned-sample`) — ดูหัวข้อ 14 |
| `lib/ocr/process-ocr-test.server.ts` (ช่วงที่ 32) | orchestrator ของ Controlled Test — เหมือน `process-ocr.server.ts` แต่เขียนผลลง `ocr_test_runs` แทน |
| `lib/jobs/handlers/ocr-test-run.server.ts` (ช่วงที่ 32) | Background job handler ของ `ocr_test_run` (โครงสร้างเดียวกับ `ocr-processing.server.ts`) |
| `lib/data/ocr-test-runs.server.ts` (ช่วงที่ 32) | `getRecentOcrTestRuns()` — อ่านประวัติ Controlled Test |
| `app/api/superadmin/ocr/test-runs/route.ts` (ช่วงที่ 32) | JSON endpoint สำหรับ poll ประวัติ Controlled Test |
| `components/superadmin/OcrConnectivityCheckButton.tsx`, `OcrTestRunsPanel.tsx` (ช่วงที่ 32) | UI ปุ่มตรวจการเชื่อมต่อ + แผงควบคุม/รายการ Controlled Test |
| `app/superadmin/ocr/page.tsx`, `actions.ts` (เขียนใหม่ช่วงที่ 32) | หน้า OCR Readiness Check + Controlled OCR Test + ฟอร์มตั้งค่าเดิม |
| `docs/ocr-provider-validation.md` (ช่วงที่ 32) | คู่มือเลือก provider, ตั้งค่า, ทดสอบใน Staging, และเปิดใช้งานจริงใน Production ทีละขั้นตอน |

## 13. OCR Readiness Check (ช่วงที่ 32)

หน้า `/superadmin/ocr` มีส่วน **"OCR Readiness Check"** ให้ Super Admin ตรวจ
สถานะความพร้อมของ OCR ทั้งหมดในที่เดียว **โดยไม่แตะเอกสารจริงหรือสร้างงาน OCR
เลยแม้แต่งานเดียว**:

- สถานะเปิด/ปิด (`OCR_ENABLED`), provider ที่เลือก (`OCR_PROVIDER`)
- ความครบถ้วนของการตั้งค่า — แสดงแค่ **true/false ว่าตั้งค่าไว้หรือไม่**
  (`baseUrlSet`, `apiKeySet`) **ไม่เคยแสดงค่า URL/API key จริง** (มาจาก
  `getOcrConfigSummary()` ซึ่งอ่าน `process.env` ครั้งเดียวรวมศูนย์และคืนแค่
  boolean/number เท่านั้น — ยืนยันด้วยการทดสอบอัตโนมัติแล้วว่า secret string
  ไม่มีทางหลุดออกมาใน JSON ที่ฟังก์ชันนี้คืน)
- timeout (`OCR_PROVIDER_TIMEOUT_MS`), เพดานขนาดไฟล์/จำนวนหน้า/จำนวนงานต่อวัน
  (env ceiling เทียบข้างค่าจริงใน `settings` — ดูหัวข้อ 6.0), นโยบายเอกสาร
  private (`OCR_ALLOW_PRIVATE_DOCUMENTS`), โหมดทดสอบ/ใช้งานจริง
  (`OCR_TEST_MODE`)
- สถานะงาน `ocr_processing` ล่าสุด และรายการ dead-letter queue ที่เกี่ยวกับ
  OCR ล่าสุด (ใช้ `getRecentJobs("ocr_processing")`/DLQ query เดิมของช่วงที่
  29/31 ไม่มี query ใหม่)
- ปุ่ม **"ตรวจสอบการเชื่อมต่อ"** — เรียก `checkOcrProviderConnectivity()`
  (`lib/ocr/ocr-provider.server.ts`): ส่ง `GET` ไปที่ `OCR_PROVIDER_BASE_URL`
  ด้วย timeout สั้น (5 วินาที) เท่านั้น — **ถือว่า "เชื่อมต่อได้" ถ้าได้รับ
  HTTP response กลับมาไม่ว่า status code ใด (2xx-5xx แปลว่า server ตอบจริง,
  port/TLS ใช้ได้)** มีแค่ network error/timeout เท่านั้นที่ถือว่า
  "เชื่อมต่อไม่ได้" — **ไม่เคยส่งไฟล์ ไม่เคยเรียก endpoint `/jobs`/`/jobs/{id}`
  จริง ไม่เคยสร้างงาน OCR ใดๆ ทั้งสิ้น** เป็นการตรวจ connectivity ล้วนๆ
  ข้อความ error ที่แสดงผ่านการ sanitize เสมอ (ไม่โชว์ raw error/stack trace)
  และบันทึก `audit_logs` (`action: "ocr_readiness_check"`) ทุกครั้งที่กด

## 14. Controlled OCR Test (ช่วงที่ 32)

เมื่อ `OCR_TEST_MODE=true` หน้า `/superadmin/ocr` จะมีส่วน **"Controlled OCR
Test"** ให้ Super Admin ทดสอบ provider จริงก่อนเปิดใช้งานกับผู้ใช้จริง — ตั้งใจ
ให้**เป็นอิสระจาก `OCR_ENABLED`** (ทดสอบ provider ได้ตั้งแต่ก่อนเปิดสวิตช์ใช้
งานจริงเลย) เพราะ `submitOcrTest()` (`lib/ocr/ocr-provider.server.ts`) ตรวจ
แค่ provider ตั้งค่าครบ + `OCR_TEST_MODE === "true"` **ไม่ตรวจ `OCR_ENABLED`,
`settings.ocrProviderEnabled`, หรือ `OCR_ALLOW_PRIVATE_DOCUMENTS` เลย** —
ปลอดภัยเพราะไฟล์ทดสอบทุกไฟล์ไม่เป็นความลับโดยการออกแบบอยู่แล้ว (ดูด้านล่าง)

**ไฟล์ทดสอบ** (`public/ocr-test-fixtures/`, ทะเบียนอยู่ที่
`lib/ocr/test-fixtures.server.ts`) — Super Admin **เลือกจากไฟล์ที่ระบบ
กำหนดไว้ล่วงหน้าเท่านั้น ไม่มีการอัปโหลดไฟล์ใหม่ผ่าน UI** และ**ไม่มีทางเลือก
เอกสารงานวิจัยจริงมาทดสอบได้เลย** (แยกทะเบียนคนละชุดกับ
`research_items`/Storage bucket ของเอกสารจริงโดยสิ้นเชิง):

| fixture | สถานะ | คำอธิบาย |
| --- | --- | --- |
| `english-sample` | มีไฟล์จริง | ใช้ไฟล์เดียวกับ `public/mock-pdfs/sample.pdf` ข้อความอังกฤษจริง มีเลเยอร์ข้อความ |
| `multipage-sample` | มีไฟล์จริง | PDF 3 หน้า สร้างขึ้นเฉพาะสำหรับทดสอบ ทดสอบ progress ระดับหน้าข้ามหลายหน้า |
| `no-text-scanned-sample` | มีไฟล์จริง | PDF 1 หน้าไม่มีเลเยอร์ข้อความเลย (content stream ว่าง) จำลองเอกสารสแกนที่ดึงข้อความปกติไม่ได้ (`no_text_found`) |
| `thai-sample` | **ยังไม่มีไฟล์ — ต้องเพิ่มเอง** | ตั้งใจไม่สร้างไฟล์นี้อัตโนมัติ (ไม่มี PDF library ในโปรเจกต์ที่ฝัง CID/Unicode font ภาษาไทยได้อย่างถูกต้อง — เสี่ยงส่งมอบไฟล์ที่ผิดรูปแบบแอบแฝงมากกว่าจะไม่ส่งมอบเลย) ดูขั้นตอนเพิ่มไฟล์จริงที่ [docs/ocr-provider-validation.md](./ocr-provider-validation.md) หัวข้อ Test Checklist |

`listOcrTestFixtures()` คำนวณ `available: boolean` ของแต่ละไฟล์แบบสด (ตรวจ
ไฟล์มีอยู่จริงทุกครั้งที่เรียก ไม่ hardcode/สมมติว่ามี) — UI แสดงเฉพาะไฟล์ที่
`available === true` ให้เลือกได้ ไฟล์ที่ยังไม่มี (เช่น `thai-sample` ก่อนแอดมิน
เพิ่มไฟล์จริง) จะแสดง "ต้องเพิ่มไฟล์นี้ก่อน" และกดเลือกไม่ได้ — **ไม่มีการ
fallback ไปใช้ fixture อื่นแทนเงียบๆ**

**กลไก**: ใช้คิว background job เดิมทุกประการ (`job_type: "ocr_test_run"`
— เพิ่ม CHECK constraint แบบเดียวกับที่ `maintenance_cleanup` ใช้ในช่วงที่ 31)
ผ่าน `lib/jobs/handlers/ocr-test-run.server.ts` → `submitOcrTestRun()`/
`pollOcrTestRun()` (`lib/ocr/process-ocr-test.server.ts`) — โครงสร้างเดียวกับ
`processResearchDocumentOcr()`/`pollResearchDocumentOcr()` ทุกประการ (ไม่เคย
throw, แปลง error เป็นสถานะ `failed` เสมอ) แต่**บันทึกผลลงตาราง
`ocr_test_runs` ซึ่งแยกต่างหากจาก `research_document_texts` โดยสิ้นเชิง — ไม่มี
foreign key ไปยัง `research_items` เลย** จึงไม่มีทางที่ผลทดสอบจะรั่วไหลเข้าไป
ในห้องสมุดสาธารณะ, `searchResearchServer()`, หรือหน้าค้นหาใดๆ ได้

**หน้าจอแสดง**: สถานะ OCR, จำนวนหน้า, เวลาเริ่ม/จบ, ระยะเวลาที่ใช้, จำนวน
ตัวอักษรที่ดึงได้, progress ที่ provider รายงาน (ระหว่างประมวลผล), ข้อความ
error แบบ sanitize แล้วเมื่อล้มเหลว — poll อัตโนมัติทุก 5 วินาที (หยุดเมื่อแท็บ
ไม่ visible) ผ่าน `OcrTestRunsPanel.tsx`/`/api/superadmin/ocr/test-runs`
รูปแบบเดียวกับ `RecentJobsPoller.tsx` ปุ่ม **"ลองใหม่"** ต่อแถวที่ `failed`
จะสร้างแถว `ocr_test_runs` + job ใหม่ (ไม่ทับแถวเดิม — เก็บประวัติไว้ครบ) ทุก
การเริ่ม/ลองใหม่บันทึก `audit_logs` (`action: "ocr_test_run_triggered"` /
`"ocr_test_run_retry"`)

## 15. สรุป Environment Variables ทั้งหมดของ OCR (ช่วงที่ 32)

| ตัวแปร | ค่าที่รับ | บังคับ? | หน้าที่ |
| --- | --- | --- | --- |
| `OCR_PROVIDER` | `none` \| `self_hosted` \| `external_api` | ไม่ (ค่าเริ่มต้น `none`) | เลือกรูปแบบ adapter — `none` แปลว่า OCR ไม่ถูกตั้งค่าเลย |
| `OCR_PROVIDER_BASE_URL` | URL | บังคับถ้า `OCR_PROVIDER !== "none"` | endpoint ของ provider (ดูหัวข้อ 3) |
| `OCR_PROVIDER_API_KEY` | secret string | ไม่ (ขึ้นกับ provider) | ส่งเป็น `Authorization: Bearer` — **ไม่เคยส่งไปฝั่ง client, ไม่เคยแสดงใน UI/log** |
| `OCR_PROVIDER_TIMEOUT_MS` | ตัวเลข (ms) | ไม่ (ค่าเริ่มต้น 120000, จำกัดช่วง 5000-300000) | timeout ต่อคำขอ HTTP หนึ่งครั้งไปยัง provider |
| `OCR_ENABLED` | `true` \| `false` | ไม่ (ค่าเริ่มต้น `false`) | สวิตช์หลักระดับ deploy — ต้อง `true` เท่านั้นจึงจะสร้างงาน OCR จริงได้ (ยังต้องผ่าน `settings.ocrProviderEnabled` ในหัวข้อ 6 ด้วย) |
| `OCR_ALLOW_PRIVATE_DOCUMENTS` | `true` \| `false` | ไม่ (ค่าเริ่มต้น `false`) | อนุญาตส่งเอกสารที่ไม่ใช่ `public` ให้ provider แบบ `external_api` (หัวข้อ 5.1) |
| `OCR_TEST_MODE` | `true` \| `false` | ไม่ (ค่าเริ่มต้น `false`) | เปิดใช้งาน Controlled OCR Test (หัวข้อ 14) — อิสระจาก `OCR_ENABLED` |
| `OCR_MAX_FILE_SIZE_MB` | ตัวเลข | ไม่ | เพดานขนาดไฟล์ระดับ deploy (หัวข้อ 6.0) |
| `OCR_MAX_PAGES` | ตัวเลข | ไม่ | เพดานจำนวนหน้าระดับ deploy (หัวข้อ 6.0) |
| `OCR_MAX_JOBS_PER_DAY` | ตัวเลข | ไม่ | เพดานจำนวนงาน OCR ต่อผู้ใช้ต่อวันระดับ deploy (หัวข้อ 6.0) |
| `OCR_LANGUAGES` | เช่น `tha+eng` | ไม่ (ค่าเริ่มต้น `tha+eng`) | hint ภาษาให้ provider (หัวข้อ 7, ไม่เปลี่ยนชื่อในช่วงนี้) |

ดูขั้นตอนเลือก provider, ตั้งค่าทีละตัว, ทดสอบใน Staging, และ Checklist ก่อน
เปิดใช้งานจริงใน Production แบบละเอียดที่
[docs/ocr-provider-validation.md](./ocr-provider-validation.md)
