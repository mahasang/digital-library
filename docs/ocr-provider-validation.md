# คู่มือทดสอบและเปิดใช้งาน OCR Provider จริง (ช่วงที่ 32)

เอกสารนี้เป็นขั้นตอนปฏิบัติ (runbook) สำหรับผู้ดูแลระบบที่จะเชื่อมต่อ OCR
provider จริงเข้ากับระบบเป็นครั้งแรก — เสริมจาก
[docs/ocr-operations.md](./ocr-operations.md) ที่อธิบายสถาปัตยกรรม/สัญญา
(contract) ของแต่ละ provider แบบเต็ม เอกสารนี้เน้นเฉพาะ **ลำดับขั้นตอนที่ควร
ทำก่อนเปิดใช้งานจริงกับผู้ใช้** เท่านั้น

> **สำคัญ**: ห้ามเปิดใช้งาน OCR provider เชิงพาณิชย์ที่มีค่าใช้จ่าย หรือส่งไฟล์
> จริงออกไปภายนอก โดยไม่ได้รับอนุมัติจากองค์กรก่อนเสมอ — ทุกขั้นตอนในเอกสารนี้
> ออกแบบให้ทดสอบได้อย่างปลอดภัยด้วยไฟล์ fixture ที่ไม่เป็นความลับก่อนเปิดใช้งาน
> จริง

## 1. ขั้นตอนเลือก Provider

ระบบรองรับ 2 รูปแบบผ่าน `OCR_PROVIDER` (ดูรายละเอียด contract เต็มที่
[docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 3):

| เลือกแบบนี้ถ้า... | ตั้งค่า |
| --- | --- |
| มีบริการ OCR ที่ตอบผลลัพธ์ในคำขอเดียว (synchronous) — เช่น บริการที่องค์กรตั้งเอง | `OCR_PROVIDER=self_hosted` |
| มีบริการ OCR แบบ submit งานแล้ว poll สถานะ (async) — รูปแบบทั่วไปของ OCR API เชิงพาณิชย์ | `OCR_PROVIDER=external_api` |
| ยังไม่มี provider หรือยังไม่พร้อมเปิดใช้ | ปล่อยว่างหรือ `OCR_PROVIDER=none` (ค่าเริ่มต้น) |

ถ้ายังไม่แน่ใจว่า provider ที่จะใช้ตอบกลับแบบ synchronous หรือ async ให้ดู
เอกสาร API ของ provider นั้นๆ — ถ้าคำขอเดียวรอผลลัพธ์สุดท้ายได้เลยคือ
`self_hosted` ถ้าต้อง poll สถานะแยกคือ `external_api`

## 2. ขั้นตอนตั้งค่า self-hosted provider

ตัวอย่างการตั้งบริการ Tesseract OCR ของตัวเองแบบไม่เสียค่าใช้จ่าย ดูใน
[docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 4 — เมื่อมีบริการพร้อม
ใช้งานแล้ว ตั้งค่า:

```
OCR_PROVIDER=self_hosted
OCR_PROVIDER_BASE_URL=https://ocr.internal.your-org.example/ocr
OCR_PROVIDER_API_KEY=<secret ที่ endpoint ตรวจสอบ — ถ้ามี>
```

Endpoint ต้องรับ `POST` แบบ `multipart/form-data` ฟิลด์ `file` + `languages`
แล้วตอบ JSON `{ "text": string, "confidence"?: number, "language"?: string }`
ภายในเวลา `OCR_PROVIDER_TIMEOUT_MS` ที่ตั้งไว้ (ค่าเริ่มต้น 120 วินาที)

## 3. ขั้นตอนตั้งค่า external API provider

```
OCR_PROVIDER=external_api
OCR_PROVIDER_BASE_URL=https://api.your-ocr-provider.example
OCR_PROVIDER_API_KEY=<API key จาก provider>
```

Endpoint ต้องรองรับ `POST {URL}/jobs` (คืน `202 { job_id, total_pages? }`)
และ `GET {URL}/jobs/{id}` (คืน `{ status, current_page?, total_pages?, text?,
confidence?, language?, error? }`) — ดูสัญญาเต็มที่
[docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 3.2 หากผู้ให้บริการที่
เลือกใช้ shape คำตอบไม่ตรงกับสัญญานี้เป๊ะๆ อาจต้องเขียน adapter/proxy ตัวเล็ก
คั่นกลางเพื่อแปลง shape ให้ตรงก่อน

## 4. วิธีใส่ Environment Variables ทั้งหมด

| ตัวแปร | ค่าที่แนะนำ (dev) | ค่าที่แนะนำ (staging) | ค่าที่แนะนำ (production) |
| --- | --- | --- | --- |
| `OCR_PROVIDER` | ว่าง/`none` | `self_hosted` หรือ `external_api` | เหมือน staging |
| `OCR_PROVIDER_BASE_URL` | ว่าง | endpoint ทดสอบ/staging ของ provider | endpoint จริง |
| `OCR_PROVIDER_API_KEY` | ว่าง | key ของ staging (ถ้ามีแยกจาก production) | key ของ production |
| `OCR_PROVIDER_TIMEOUT_MS` | ว่าง (ค่าเริ่มต้น 120000) | ตั้งตามจริงถ้า provider ช้ากว่านั้น | เหมือน staging |
| `OCR_ENABLED` | `false` | `false` ก่อน แล้วเปลี่ยนเป็น `true` หลังผ่าน checklist หัวข้อ 6 | `true` เฉพาะหลังผ่านทุกขั้นตอนแล้ว |
| `OCR_TEST_MODE` | `true` (ถ้าจะทดสอบ) | `true` | `false` (ปิดหลังยืนยันว่าใช้งานจริงได้แล้ว — ลดพื้นผิวการใช้งานที่ไม่จำเป็นใน production) |
| `OCR_ALLOW_PRIVATE_DOCUMENTS` | `false` | `false` เว้นแต่จะทดสอบเอกสาร private จริงๆ | ตามนโยบายองค์กร (ค่าเริ่มต้น `false` ปลอดภัยที่สุด) |
| `OCR_MAX_FILE_SIZE_MB`/`OCR_MAX_PAGES`/`OCR_MAX_JOBS_PER_DAY` | ว่าง (ไม่มีเพดานจาก env) | ตั้งเพดานกว้างๆ กันไว้ | ตั้งตามงบประมาณ/ข้อจำกัดของ provider จริง |

**อย่าลืม**: ค่าที่ Super Admin ตั้งที่ `/superadmin/ocr` (ขนาดไฟล์/จำนวนหน้า/
โควตา/allow-list ระดับการเข้าถึง) ยังคงมีผลควบคู่กับตารางข้างบนเสมอ — ค่าจริง
ที่ใช้บังคับคือ `min(เพดาน env, ค่าใน Settings)` เสมอ (ดู
[docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 6)

## 5. วิธีเปิด OCR ใน Staging ก่อน Production

1. ตั้งค่า `OCR_PROVIDER`/`OCR_PROVIDER_BASE_URL`/`OCR_PROVIDER_API_KEY` ตาม
   provider ที่เลือก (หัวข้อ 2-3)
2. ตั้ง `OCR_ENABLED=false` และ `OCR_TEST_MODE=true` — **ยังไม่เปิดให้ผู้ใช้
   ทั่วไปสั่ง OCR ได้ แต่ Super Admin ทดสอบ provider ได้แล้ว**
3. เข้า `/superadmin/ocr` → ส่วน "OCR Readiness Check" → กด "ตรวจสอบการ
   เชื่อมต่อ" → ต้องเห็น "เชื่อมต่อ endpoint ได้" (ไม่ส่งไฟล์ ไม่สร้างงาน OCR
   ในขั้นตอนนี้)
4. ส่วน "Controlled OCR Test" → เลือกไฟล์ fixture ที่มี (ดูหัวข้อ 6 สำหรับ
   checklist แบบเต็ม) → กด "เริ่มทดสอบ" → ดูผลลัพธ์ (สถานะ, จำนวนหน้า, เวลาที่
   ใช้, จำนวนตัวอักษรที่ดึงได้)
5. เมื่อผ่าน checklist ครบทุกข้อในหัวข้อ 6 แล้วเท่านั้น → เปลี่ยน
   `OCR_ENABLED=true` เพื่อเปิดให้เจ้าหน้าที่ (rank ≥ 30) สั่ง OCR เอกสารจริง
   ได้ที่หน้าจัดการงานวิจัย

## 6. Test Checklist

ทำทุกข้อผ่าน "Controlled OCR Test" ที่ `/superadmin/ocr` (ต้องตั้ง
`OCR_TEST_MODE=true`) ก่อนเปลี่ยน `OCR_ENABLED=true` เสมอ:

- [ ] **ทดสอบ PDF ไทย** — ต้องนำไฟล์ PDF ภาษาไทยที่ไม่เป็นความลับมาวางที่
      `public/ocr-test-fixtures/thai-sample.pdf` เองก่อน (ยังไม่มีไฟล์นี้มาให้
      ในระบบ — ดูหัวข้อ 7 คอลัมน์ "ความแม่นยำภาษาไทย" สำหรับสิ่งที่ต้องบันทึก)
- [ ] **ทดสอบ PDF อังกฤษ** — เลือก fixture "PDF ภาษาอังกฤษ" (มีให้แล้ว)
- [ ] **ทดสอบ PDF หลายหน้า** — เลือก fixture "PDF หลายหน้า" (3 หน้า, มีให้แล้ว)
      ตรวจว่าจำนวนหน้าที่แสดงตรงกับไฟล์จริง
- [ ] **ทดสอบ OCR ล้มเหลว** — ปิด/เปลี่ยน `OCR_PROVIDER_BASE_URL` ให้ชี้ไปที่
      endpoint ที่ไม่มีจริงชั่วคราว แล้วเริ่มทดสอบ → ต้องเห็นสถานะ "ล้มเหลว"
      พร้อมข้อความสั้นๆ ที่เข้าใจได้ (ไม่ใช่ stack trace/error ดิบ) แล้วตั้งค่า
      `OCR_PROVIDER_BASE_URL` กลับคืนก่อนทดสอบข้อถัดไป
- [ ] **ทดสอบ timeout** — ถ้า provider ทดสอบรองรับการหน่วงเวลาตอบกลับได้
      ลองตั้ง `OCR_PROVIDER_TIMEOUT_MS` ให้สั้นกว่าเวลาที่ provider ใช้จริง →
      ต้องเห็นสถานะ "ล้มเหลว" หลังครบเวลาที่ตั้งไว้ ไม่ค้างรอตลอดไป
- [ ] **ทดสอบ retry และ DLQ** — จากงานที่ล้มเหลวในข้อก่อนหน้า กด "ลองใหม่" ที่
      แถวนั้น → ต้องสร้างงานทดสอบใหม่ (แถวเดิมไม่ถูกแก้ไข ยังเห็นประวัติเดิม
      อยู่) — สำหรับ OCR เอกสารจริง (ไม่ใช่ Controlled Test) ทดสอบเพิ่มว่างานที่
      ล้มเหลวซ้ำจนครบจำนวนครั้งเข้า Dead-letter Queue ที่ `/superadmin/jobs`
      จริง พร้อมแจ้งเตือน Super Admin (ดู
      [docs/background-jobs.md](./background-jobs.md) หัวข้อ 11.1/11.2)
- [ ] **ทดสอบ progress** — ถ้าใช้ `external_api` และ provider รายงาน
      `current_page`/`total_pages` ระหว่าง poll ได้จริง → ต้องเห็นตัวเลขหน้า
      จริงระหว่างทดสอบ (ไม่ใช่แค่ข้อความทั่วไป) ถ้า provider ไม่รายงาน ต้องเห็น
      ข้อความสถานะทั่วไปเท่านั้น **ไม่มีตัวเลขปลอม**
- [ ] **ทดสอบการห้ามส่งเอกสาร private** — ถ้าใช้ `external_api`: ที่หน้าจัดการ
      งานวิจัยจริง (ไม่ใช่ Controlled Test) ลองสั่ง OCR เอกสารที่ไม่ใช่ระดับ
      `public` ขณะที่ `OCR_ALLOW_PRIVATE_DOCUMENTS` ยังเป็น `false` → ต้องถูก
      ปฏิเสธก่อนสร้างงานเสมอ (ไม่มีการเชื่อมต่อเครือข่ายเกิดขึ้น) ดู
      [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 6 สำหรับรายละเอียด
      allow-list ระดับการเข้าถึงที่ต้องผ่านก่อนด้วย
- [ ] **ทดสอบ OCR text search** — หลัง OCR เอกสารจริง (ไม่ใช่ fixture) สำเร็จ
      แล้ว ลองค้นหาคำที่อยู่ในข้อความที่ OCR ได้ที่ `/research` (โหมด "เนื้อหา
      PDF") → ต้องเจอผลลัพธ์พร้อมป้าย "จาก OCR อาจคลาดเคลื่อน" กำกับ — **ผล
      ทดสอบจาก Controlled Test ต้องไม่ปรากฏในผลค้นหานี้เลย** (คนละตารางกับ
      เอกสารจริงโดยสิ้นเชิง)

## 7. ตารางบันทึกผลการทดสอบ Provider

กรอกทุกครั้งที่ทดสอบ provider ใหม่หรือเปลี่ยนแผนราคา — ใช้ประกอบการตัดสินใจ
เปิดใช้งานจริงและทบทวนย้อนหลังได้:

| หัวข้อ | รายละเอียดที่ต้องบันทึก |
| --- | --- |
| Provider | ชื่อ/เวอร์ชัน/แผนราคาที่ทดสอบ |
| ความแม่นยำภาษาไทย | ประเมินจากไฟล์ `thai-sample.pdf` ที่นำมาเอง — ระบุเปอร์เซ็นต์โดยประมาณหรือคำอธิบายเชิงคุณภาพ (เช่น "อ่านได้เกือบทั้งหมด ผิดเฉพาะคำทับศัพท์") |
| ความแม่นยำภาษาอังกฤษ | ประเมินจาก fixture ภาษาอังกฤษที่มีให้ |
| เวลาประมวลผล | เวลาเฉลี่ยต่อหน้า/ต่อไฟล์ จากผลใน Controlled OCR Test |
| ข้อจำกัดจำนวนหน้า/ไฟล์ | ข้อจำกัดจริงของ provider (อาจเข้มกว่า `OCR_MAX_PAGES`/`OCR_MAX_FILE_SIZE_MB` ที่ตั้งไว้ก็ได้) |
| ค่าใช้จ่ายโดยประมาณ | ราคาต่อหน้า/ต่อเดือน/ต่อ tier ตามแผนที่เลือก (ถ้ามี) |
| ข้อสังเกตด้านความเป็นส่วนตัว | provider เก็บ/ใช้เนื้อหาเอกสารต่อหรือไม่ ตั้งอยู่ในเขตอำนาจศาลใด มีข้อตกลงคุ้มครองข้อมูล (DPA) หรือไม่ |

## 8. ขั้นตอนเปิดใช้ OCR ใน Production อย่างปลอดภัย

1. ผ่าน Test Checklist (หัวข้อ 6) ครบทุกข้อใน staging แล้วเท่านั้น
2. กรอกตารางบันทึกผล (หัวข้อ 7) และให้ผู้มีอำนาจตัดสินใจ (ไม่ใช่ผู้พัฒนา)
   ทบทวนเรื่องค่าใช้จ่าย/ความเป็นส่วนตัวก่อนอนุมัติ
3. ตรวจสอบเอกสาร privacy/copyright ขององค์กรว่าระบุชัดเจนแล้วว่ามีการส่งเอกสาร
   บางส่วนไปยัง OCR provider ภายนอก (ถ้าเลือกใช้ `external_api` ที่ไม่ใช่
   self-hosted) — ดู [docs/ocr-operations.md](./ocr-operations.md) หัวข้อ 5
4. ตั้งค่า production environment variables ตามตารางในหัวข้อ 4 (คอลัมน์
   production) — **ตรวจสอบว่า `OCR_PROVIDER_API_KEY` เป็น key ของ production
   จริง ไม่ใช่ key ทดสอบที่ใช้ใน staging**
5. ตั้ง `OCR_ALLOW_PRIVATE_DOCUMENTS` ตามนโยบายที่อนุมัติจริงเท่านั้น (ค่า
   เริ่มต้น `false` ปลอดภัยที่สุด — เปิดเฉพาะเมื่อมีการอนุมัติชัดเจน)
6. เปลี่ยน `OCR_ENABLED=true` เป็นขั้นตอนสุดท้าย — ตรวจสอบที่หน้า OCR
   Readiness Check ว่าทุกรายการแสดง "พร้อมใช้งาน" แล้วจริง
7. พิจารณาปิด `OCR_TEST_MODE=false` ใน production หลังยืนยันว่าใช้งานจริงได้
   แล้ว (ลดพื้นผิวการใช้งานที่ไม่จำเป็น — เปิดกลับได้ทุกเมื่อถ้าต้องทดสอบเพิ่ม)
8. เปิดใช้งานกับกลุ่มผู้ใช้เล็กๆ ก่อน (เช่น เอกสาร `public` เท่านั้นในสัปดาห์
   แรก) แล้วค่อยขยาย `settings.ocrAllowedAccessLevels` ที่ `/superadmin/ocr`
   ทีละระดับหลังมั่นใจว่าเสถียร — ไม่ต้อง redeploy ระหว่างขั้นตอนนี้ (ปรับผ่าน
   UI ได้ทันที)
9. ตรวจสอบ `/superadmin/cron-monitoring` (ช่วงที่ 31) และ
   `/superadmin/jobs` เป็นระยะในสัปดาห์แรกหลังเปิดใช้งานจริง เพื่อจับความ
   ผิดปกติ (อัตราความล้มเหลวสูง, งานค้างใน DLQ) ได้เร็ว
