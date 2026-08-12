# ค้นหาข้อความภายในไฟล์ PDF (PDF Full-Text Search)

ฟีเจอร์นี้เพิ่มเข้ามาในช่วงที่ 17 — ให้ผู้ใช้ค้นหาคำที่อยู่ *ภายในเนื้อหา* ไฟล์
PDF ของงานวิจัย ไม่ใช่แค่ชื่อเรื่อง/ผู้วิจัย/คำสำคัญ/บทคัดย่อเหมือนเดิม โดยไม่
กระทบระบบค้นหาบรรณานุกรมเดิมแต่อย่างใด

> **อัปเดตช่วงที่ 20**: การดึงข้อความ (`processResearchDocumentExtraction`)
> ที่เอกสารนี้อธิบายไว้ด้านล่างว่าเป็น "standalone function ที่ออกแบบไว้ให้
> เรียกจาก background job ในอนาคตได้โดยไม่ต้องแก้โค้ด" — ตอนนี้ถูกเรียกจาก
> background job จริงแล้ว (`lib/jobs/handlers/pdf-text-extraction.server.ts`)
> ตามที่ออกแบบไว้เป๊ะ ไม่มีการแก้ไข logic ภายในฟังก์ชันนี้เลยแม้แต่บรรทัดเดียว
> ดูรายละเอียดสถาปัตยกรรม queue/worker เต็มรูปแบบที่
> [docs/background-jobs.md](./background-jobs.md)

## 1. สถาปัตยกรรมโดยรวม

```
อัปโหลด/แทนที่ PDF (ผ่านการตรวจ magic-byte + สแกนมัลแวร์เดิมแล้ว)
        │
        ▼
processResearchDocumentExtraction(researchItemId, pdfPath)
  1. acquire_extraction_lock() — ล็อกแบบ atomic กัน 2 คำขอประมวลผลไฟล์เดียวกัน
     พร้อมกัน (upsert สถานะเป็น processing แบบมีเงื่อนไข)
  2. ดาวน์โหลดไฟล์จาก Storage ด้วย Service Role
  3. คำนวณ SHA-256 ของไฟล์ (source_file_hash) — ใช้ตรวจสอบเวอร์ชันไฟล์
  4. extractPdfText() — ดึงข้อความด้วย pdfjs-dist (legacy Node build)
  5. บันทึกผลลง research_document_texts (completed / no_text_found / failed)
        │
        ▼
research_document_texts (ตารางแยกจาก research_items)
  - extracted_text / extracted_text_normalized
  - extraction_status, extraction_error_message, extracted_at
  - source_file_path, source_file_hash
  - RLS: มองเห็นได้เฉพาะคนที่มีสิทธิ์อ่าน research_items แถวเดียวกัน
        │
        ▼
searchResearchServer() (lib/data/research-search.server.ts)
  - ค้นบรรณานุกรม (title/researcher/keyword/abstract) ผ่าน research_items
  - ค้นเนื้อหา PDF ผ่าน research_document_texts (RLS บังคับสิทธิ์อัตโนมัติ)
  - ตัด snippet + คำนวณตำแหน่งไฮไลต์ฝั่งเซิร์ฟเวอร์เท่านั้น
        │
        ▼
/research (หน้าค้นหา) + /research/[slug]/read (หน้าอ่าน PDF)
```

ทุกขั้นตอนการดึงข้อความและค้นหาทำงานฝั่งเซิร์ฟเวอร์ทั้งหมด — Client ไม่เคย
เห็น `extracted_text` เต็มก้อนไม่ว่ากรณีใด (ดูหัวข้อ 6)

## 2. เหตุผลที่เลือก `pdfjs-dist` สำหรับดึงข้อความ

โปรเจกต์นี้มี `pdfjs-dist` เป็น dependency อยู่แล้ว (ผ่าน `react-pdf` ที่ใช้ใน
หน้าอ่านออนไลน์แบบ Flipbook ตั้งแต่ช่วงที่ 13) จึงเลือกใช้ตัวเดียวกันแทนการเพิ่ม
library ใหม่โดยไม่จำเป็น:

- ใช้ build แบบ `pdfjs-dist/legacy/build/pdf.mjs` (รองรับ Node.js โดยตรง ไม่ต้อง
  พึ่งพา DOM/Worker ของเบราว์เซอร์)
- ดึงข้อความผ่าน `page.getTextContent()` ของแต่ละหน้า ต่อกันเป็นข้อความเต็ม
- ตั้งค่า `standardFontDataUrl` และ `cMapUrl` (พร้อม `cMapPacked: true`) ชี้ไปที่
  โฟลเดอร์ `node_modules/pdfjs-dist/standard_fonts` และ `cmaps` โดยตรง — จำเป็น
  สำหรับความแม่นยำของฟอนต์ที่ไม่ใช่ Latin (ทดสอบแล้วกับข้อความภาษาลาว/ไทยจริง)
- แปลง path ของ Windows เป็น `file://` URL ด้วย `pathToFileURL()` (Node `url`)
  เนื่องจาก pdfjs-dist คาดหวัง URL ไม่ใช่ Windows path ตรงๆ (`C:\...`)

## 3. เหตุผลที่เลือก `pg_trgm` แทน PostgreSQL Full-Text Search (tsvector)

PostgreSQL FTS มาตรฐาน (`to_tsvector`/`to_tsquery`) **ไม่มี dictionary/tokenizer
สำหรับภาษาไทย** ในตัว — ตัดคำไทยผิดเพี้ยนหรือไม่ตัดคำเลย (ถือทั้งประโยคเป็นคำ
เดียว) ทำให้ค้นหาคำไทยที่อยู่กลางประโยคไม่เจอ

จึงเลือกใช้ **`pg_trgm`** (มี extension เปิดใช้งานอยู่แล้วในโปรเจกต์) แทน:

- ตัดข้อความเป็น trigram (กลุ่มอักขระ 3 ตัวติดกัน) โดยไม่สนใจภาษา/การตัดคำเลย
  จึงใช้ได้ทั้งไทยและอังกฤษด้วยกลไกเดียวกัน
- ค้นหาจริงผ่าน `ILIKE '%คำค้น%'` บนคอลัมน์ `extracted_text_normalized`
  (lowercase + ยุบช่องว่างซ้ำ) โดยมี GIN index (`gin_trgm_ops`) ช่วยเร่งความเร็ว
  แทนการสแกนทั้งตาราง
- **ข้อแลกเปลี่ยน (trade-off)**: นี่คือการค้นหาแบบ "มีคำนี้อยู่ในข้อความหรือไม่"
  (substring match) ไม่ใช่ full-text relevance ranking แบบ `ts_rank` จริง —
  ระบบจึงจัดลำดับผลลัพธ์ด้วยชั้นความสำคัญคงที่แทน (ชื่อเรื่อง > ผู้วิจัย/คำสำคัญ
  > บทคัดย่อ > เนื้อหา PDF) ไม่ใช่คะแนนความเกี่ยวข้องที่คำนวณจากความถี่คำ
- **การจัดลำดับ/ตัดสินเมื่อคะแนนเท่ากัน (แก้ finding M-1)**: `finalizeResults()`
  ใน `lib/data/research-search.server.ts` ผ่านค่าคะแนนทุกตัวด้วย
  `normalizeRank()` (`lib/search/rank.ts`) เสมอก่อนนำไปเทียบ — กันกรณี
  `matchSource` เป็นค่าที่ไม่มีอยู่ใน `MATCH_SOURCE_RELEVANCE` (เช่น เพิ่ม
  `MatchSource` ใหม่ในอนาคตแล้วลืมอัปเดตตาราง) ไม่ให้ได้ `undefined`/`NaN` ออกมา
  ซึ่งจะทำให้ `Array.prototype.sort()` มีพฤติกรรมไม่แน่นอนตามสเปก ECMAScript
  ทุกสาย comparator (ทั้งตอนมีคำค้นหาและตอนเลือก sort option เอง) ปิดท้ายด้วย
  ตัวตัดสินลำดับที่ไม่ซ้ำกันเสมอ (`id` ของงานวิจัย ซึ่งคือ `slug` ที่มี unique
  constraint) ผ่าน `compareByIdAsc()` — ทำให้รายการที่คะแนน/วันที่เผยแพร่เท่ากัน
  เรียงลำดับเหมือนเดิมทุกครั้งไม่ว่า Postgres/RPC จะคืนแถวมาลำดับใดก็ตาม
  (Postgres ไม่การันตีลำดับแถวที่คืนมาโดยไม่มี `ORDER BY`) ทำให้ pagination
  คงที่ข้ามคำขอจริง — ใช้ utility ชุดเดียวกันนี้ทั้งในโหมด Supabase จริงและโหมด
  Mock Data (`lib/search.ts`) ดู `lib/search/rank.test.ts` และ
  `lib/data/research-search.pagination.test.ts` สำหรับ regression test

## 4. ข้อจำกัดด้านภาษาไทย

- การค้นหาเป็นแบบ substring ตรงตัว (หลังแปลงเป็นตัวพิมพ์เล็กและยุบช่องว่าง) —
  **ไม่มีการตัดคำ ไม่มี stemming ไม่รองรับคำพ้องความหมาย** เช่นค้น "วิจัย" จะไม่
  เจอ "การวิจัย" หากคำนั้นถูกเว้นวรรคจน substring ไม่ตรงกันพอดี (ในทางปฏิบัติ
  พบน้อยเพราะภาษาไทยมักไม่เว้นวรรคระหว่างคำในประโยคเดียวกัน)
  - ตัวอย่างที่ทดสอบผ่านจริง: ค้น `เซนเซอร์ไร้สาย` เจอในข้อความ
    `เครือข่ายเซนเซอร์ไร้สาย (Wireless Sensor Network)` ได้ถูกต้อง
- ไม่รองรับการค้นหาแบบไม่สนใจวรรณยุกต์/สระที่พิมพ์ผิด หรือคำที่สะกดต่างกัน
- ความยาวคำค้นต้องอยู่ระหว่าง 2–200 อักขระ (`MIN_QUERY_LENGTH`/
  `MAX_QUERY_LENGTH` ใน `lib/data/research-search.server.ts`) — สั้น/ยาวเกินถือ
  ว่าไม่พบผลลัพธ์แทนการ error ให้ผู้ใช้สับสน

## 5. PDF ที่เป็นภาพสแกน (Scanned PDF) — มี OCR แล้วตั้งแต่ช่วงที่ 23

- ไฟล์ PDF ที่เป็นภาพสแกนล้วน (ไม่มีเลเยอร์ข้อความที่คัดลอกได้) จะดึงข้อความไม่
  ได้เลยด้วยกลไกในเอกสารนี้ ระบบจะตั้งสถานะเป็น `no_text_found` โดยอัตโนมัติ
  (ไม่ถือเป็นความผิดพลาด — เป็นพฤติกรรมที่คาดไว้)
- **ตั้งแต่ช่วงที่ 23**: เอกสารที่ได้ `no_text_found` เจ้าหน้าที่ (rank ≥ 30)
  สั่งให้ระบบ OCR ต่อได้ — เป็น background job แยกต่างหากโดยสิ้นเชิงจากการดึง
  ข้อความในเอกสารนี้ ไม่แก้ไข `extractPdfText()`/`processResearchDocument-
  Extraction()` แม้แต่บรรทัดเดียว เก็บผลลัพธ์แยกคอลัมน์ (`ocr_text` ไม่ปนกับ
  `extracted_text`) และรวมเข้าระบบค้นหาเดิมในหัวข้อนี้ (ดูหัวข้อ 5.1) —
  รายละเอียดสถาปัตยกรรมเต็มดูที่ [docs/ocr-operations.md](./ocr-operations.md)
- การอัปโหลด/เผยแพร่ไฟล์ยังคงทำได้ตามปกติแม้ดึงข้อความไม่สำเร็จ — ฟีเจอร์นี้
  ไม่เคยบล็อกการอัปโหลดไฟล์หลัก (ดูหัวข้อ 7) OCR ก็เช่นกัน (ไม่รันในคำขอ
  อัปโหลดเลย ต้องสั่งแยกต่างหากเสมอ)

### 5.1 ผลการค้นหาที่มาจาก OCR ปนอยู่ในผลลัพธ์เดียวกัน

`collectPdfMatches()` (`lib/data/research-search.server.ts`) ค้นทั้ง
`extracted_text_normalized` (หัวข้อ 2-4 ข้างต้น) และ `ocr_text_normalized`
**คู่ขนานกัน** — ถ้าเอกสารเดียวกันมีผลจากทั้งสองทาง (กรณีพบยาก แต่เป็นไปได้ถ้า
ดึงข้อความปกติได้บางส่วนแล้ว OCR ก็เจอด้วย) **ผลจากข้อความปกติมาก่อนเสมอ**
เพราะแม่นยำกว่า OCR — ผลลัพธ์แต่ละรายการมีฟิลด์ `isOcrMatch: boolean` บอกที่มา
ชัดเจน ฝั่ง UI (`ResearchCard.tsx`) แสดงป้าย "(จาก OCR อาจคลาดเคลื่อน)" กำกับ
ไว้เสมอเมื่อ `isOcrMatch === true` — ผู้ใช้ไม่มีทางเข้าใจผิดว่าเป็นข้อความที่
คัดลอกได้จริงจากไฟล์

## 6. ความปลอดภัยของข้อมูล

- **RLS ของ `research_document_texts` สะท้อนสิทธิ์ของ `research_items` แถว
  เดียวกันทุกประการ** (migration
  `supabase/migrations/20260807100000_pdf_fulltext_search.sql`) — งานที่
  `metadata_only` จะไม่มีใครเห็นข้อความเลย (แม้แต่เจ้าของ นอกจาก
  Librarian/Admin ขึ้นไป), งานที่ `staff_only`/`member_only` เห็นได้เฉพาะบทบาท
  ที่ผ่านเกณฑ์ rank เท่านั้น ตรงกับสิทธิ์เดิมของตัวไฟล์ PDF ทุกประการ
- **Client ไม่เคยได้รับ `extracted_text` เต็มก้อน — และตั้งแต่แก้ finding C-1
  แล้ว ไม่มีทางดึงคอลัมน์เนื้อหาดิบออกไปได้เลยไม่ว่าจะเรียกผ่านแอปหรือ REST
  ตรงก็ตาม** (migration
  `supabase/migrations/20260822100000_restrict_document_text_exposure.sql`)
  — เดิม `research_document_texts` grant `select` ทั้งตารางให้
  `anon`/`authenticated` ทำให้ `extracted_text`/`ocr_text` ดิบถูกดึงออกไปได้
  ตรงๆ ผ่าน REST API ทันทีที่แถวมองเห็นได้ตาม RLS (ไม่ต้องผ่านแอปเลย) ตอนนี้
  ตัดสิทธิ์ `select` คอลัมน์เนื้อหาดิบออกจาก `anon`/`authenticated` โดยสิ้นเชิง
  (เหลือให้ select เฉพาะคอลัมน์ metadata) และเพิ่มฟังก์ชัน `SECURITY DEFINER`
  ใหม่ `search_research_document_excerpts()` ที่ทวนสอบเงื่อนไขการมองเห็นแถว
  เดียวกับ RLS policy ด้วยตนเอง แล้วคืนค่าเฉพาะ **excerpt ที่ตัดจากรัศมี 1000
  อักขระรอบจุดที่ตรงคำค้นหาครั้งแรกเท่านั้น** (ไม่เกิน ~2000 อักขระ ไม่ใช่
  ทั้งไฟล์) — `lib/data/research-search.server.ts` เรียกฟังก์ชันนี้แทนการ
  `select` ตรง แล้วค่อยตัด snippet สั้นๆ (±120 อักขระรอบคำที่ตรง) จาก excerpt
  นั้นอีกชั้นก่อนส่งให้ Client เหมือนเดิมทุกประการ ดูรายละเอียดเต็มที่
  `docs/production-readiness-report.md` หัวข้อ 2 (C-1) และ regression test ที่
  `lib/data/research-search-rls.integration.test.ts`
- **ไม่ใช้ `dangerouslySetInnerHTML`** สำหรับการไฮไลต์คำค้น — ฝั่ง Client ใช้
  ตำแหน่ง `matchStart`/`matchEnd` ตัด string ปกติแล้วห่อด้วย `<mark>` เป็น React
  node ธรรมดา ป้องกัน XSS แม้เนื้อหา PDF จะมีอักขระคล้าย HTML tag ปนอยู่
- **ทุก query ผ่าน Supabase query builder เท่านั้น** ไม่มีการต่อ SQL string ดิบ
  ที่ไหนเลย — คำค้นที่ผ่านเข้า `.ilike()`/`.or()` ถูกกรองอักขระพิเศษของ
  PostgREST filter DSL ออกก่อนเสมอ (`sanitizeForFilter()`) กัน filter injection
  ระดับ syntax (ค่าจริงยังถูก escape โดย PostgREST อยู่แล้วเป็นชั้นพื้นฐาน)
- **Error ที่ผู้ใช้เห็นเป็นข้อความไทยสั้นๆ ที่ปลอดภัยเสมอ** ("ไม่สามารถเปิดไฟล์
  เพื่อดึงข้อความได้ กรุณาลองประมวลผลใหม่อีกครั้ง") — ไม่มี stack trace, ข้อความ
  error ดิบจาก Postgres/Storage, หรือ path ภายในเซิร์ฟเวอร์หลุดออกไปที่ UI หรือ
  ถูกบันทึกลง `extraction_error_message` เลย (ข้อความ error ดิบจริงถูก log ด้วย
  `console.error` ฝั่งเซิร์ฟเวอร์เท่านั้น)
- **กันประมวลผลไฟล์เดียวกันซ้ำซ้อนพร้อมกัน** ด้วยฟังก์ชัน SQL
  `acquire_extraction_lock()` (`SECURITY DEFINER`) — ใช้ `INSERT ... ON CONFLICT
  ... WHERE status != 'processing'` ซึ่งเป็น atomic operation ระดับฐานข้อมูล
  ไม่ใช่การล็อกระดับแอปพลิเคชัน (ทดสอบแล้วว่าคำขอที่สองขณะกำลัง processing จะ
  ได้ `null` กลับมาและหยุดทำงานทันที)

## 7. พฤติกรรมเมื่อดึงข้อความล้มเหลว

`processResearchDocumentExtraction()` **ไม่เคย throw error ออกไปหา caller**
(Server Action ที่อัปโหลด/แก้ไขงานวิจัย) — ครอบทุกขั้นตอนไว้และแปลงข้อผิดพลาด
เป็นสถานะ `failed` ในฐานข้อมูลแทนเสมอ ดังนั้น:

- **การอัปโหลด/เผยแพร่ PDF ไม่เคยล้มเหลวเพราะการดึงข้อความล้มเหลว** — ผู้ใช้
  เห็นว่าอัปโหลดสำเร็จตามปกติ แล้วค่อยเห็นสถานะ "ดึงข้อความไม่สำเร็จ" แยกต่างหาก
  ที่หน้าจัดการ (เฉพาะ Librarian/Admin/Super Admin)
- **ข้อความเดิมจะไม่ถูกลบทิ้งหากประมวลผลรอบใหม่ล้มเหลว** (ทดสอบแล้วจริง) — แถว
  จะอัปเดตแค่ `extraction_status`/`extraction_error_message`/`extracted_at`
  ส่วน `extracted_text` เดิมยังอยู่ครบ จนกว่าจะมีการประมวลผลที่ *สำเร็จ* มา
  แทนที่
- **Librarian/Admin/Super Admin กด "ประมวลผลข้อความใหม่" ได้** ที่หน้า
  `/dashboard/research/[id]/edit` (การ์ด "การค้นหาเนื้อหาภายใน PDF") ไม่ว่าจะ
  อยู่ในสถานะ `failed`, `no_text_found`, หรือแม้แต่ `completed` (เผื่อไฟล์ถูก
  แทนที่แบบไม่ผ่านช่องทางปกติ) — ทุกครั้งที่กดจะถูกบันทึกลง `audit_logs`
  (`action: "research_text_reprocess"`)
- **ทดสอบแล้วจริง**: จำลองไฟล์ที่ดาวน์โหลดจาก Storage ไม่ได้ → ได้สถานะ
  `failed` พร้อมข้อความ error สุภาพ ข้อความเดิมยังอยู่ครบ → กดประมวลผลใหม่ด้วย
  path ไฟล์จริง → สถานะกลับเป็น `completed`, error ถูกล้าง, ข้อความและ
  `source_file_hash`/`source_file_path` อัปเดตเป็นของไฟล์ใหม่ทั้งหมด

## 8. ข้อจำกัดด้าน Serverless / ไฟล์ขนาดใหญ่

- จำกัดความยาวข้อความที่เก็บไว้สูงสุด `MAX_EXTRACTED_TEXT_LENGTH = 2,000,000`
  ตัวอักษร (`lib/pdf/extract-text.server.ts`) — ป้องกันไฟล์ที่มีข้อความมาก
  ผิดปกติทำให้แถวในฐานข้อมูลใหญ่เกินจำเป็น
- ขนาดไฟล์ PDF สูงสุดที่รับได้ยังคงถูกจำกัดโดยการตั้งค่าระบบเดิม
  (`maxPdfSizeMb` ใน System Settings) — ไม่มีการเพิ่มขีดจำกัดใหม่เฉพาะฟีเจอร์นี้
- **(แก้ไขแล้วในช่วงที่ 20)** เดิมการดึงข้อความทำงานแบบ synchronous ในคำขอ
  เดียวกับการอัปโหลด (`await` ก่อน `redirect()`) เหมือนรูปแบบการตรวจ
  magic-byte/สแกนมัลแวร์เดิมในช่วงที่ 14 ทำให้ไฟล์ PDF ขนาดใหญ่มาก/มีจำนวนหน้า
  มากเสี่ยงติด hard timeout ของ Serverless platform (เช่น Vercel) — ตอนนี้ย้าย
  ไปเรียกผ่าน background job queue ในฐานข้อมูลเดิมแล้ว (ไม่ใช่ Edge
  Function + pg_cron หรือ external queue ตามที่เคยคาดการณ์ไว้ — เลือกใช้
  persistent queue table + `FOR UPDATE SKIP LOCKED` แทน เพราะไม่ต้องเพิ่ม
  บริการภายนอกใดๆ) `processResearchDocumentExtraction()` ไม่ถูกแก้ไขเลยแม้แต่
  บรรทัดเดียวตามที่ออกแบบไว้ตั้งแต่ต้น ดู
  [docs/background-jobs.md](./background-jobs.md) สำหรับสถาปัตยกรรมเต็มรูปแบบ

## 9. วิธี Backfill ไฟล์เก่าที่อัปโหลดไว้ก่อนมีฟีเจอร์นี้

งานวิจัยที่อัปโหลดไว้ก่อนช่วงที่ 17 จะไม่มีแถวใน `research_document_texts`
เลย (หน้าค้นหา/หน้าอ่านจะถือว่ายังไม่เคยประมวลผล ไม่ใช่ error) วิธี backfill:

1. **ทีละรายการ**: เข้า `/dashboard/research/[id]/edit` ของงานวิจัยแต่ละรายการ
   (ต้องเป็น Librarian/Admin/Super Admin) กดปุ่ม "เริ่มประมวลผลข้อความ" ที่การ์ด
   "การค้นหาเนื้อหาภายใน PDF" — ระบบจะ enqueue background job ทันที (ไม่รอผล
   ในหน้าเว็บ ดู [docs/background-jobs.md](./background-jobs.md))
2. **เป็นชุด (แนะนำสำหรับ backfill จำนวนมาก, เพิ่มในช่วงที่ 20)**: Super Admin
   เข้า `/superadmin/pdf-processing` กรองตามเงื่อนไข ("ยังไม่มีข้อความ" /
   "ดึงไม่สำเร็จ" / "ไม่พบข้อความ" / "ไฟล์ถูกแทนที่") เลือกหลายรายการพร้อมกัน
   แล้วกด "ประมวลผลที่เลือก" (สูงสุด 500 รายการ) — หรือกด "ประมวลผลทั้งหมดตาม
   ตัวกรอง" (ไม่จำกัดจำนวน, กรองเพิ่มด้วยปี/หมวดหมู่/สถานะเผยแพร่ได้ด้วย ตั้งแต่
   ช่วงที่ 28) ดู [docs/background-jobs.md](./background-jobs.md) หัวข้อ 4
   และ 11.6

## 10. OCR — ดูเอกสารแยกต่างหาก

OCR สำหรับ PDF ที่เป็นภาพสแกน (สถานะ `no_text_found`) ถูกพัฒนาแล้วในช่วงที่ 23
เป็น**ระบบแยกต่างหากโดยสิ้นเชิง** จากการดึงข้อความในเอกสารนี้ (คนละคอลัมน์,
คนละ background job type, คนละ provider abstraction) — ดูสถาปัตยกรรมเต็ม,
วิธีตั้งค่า provider, ข้อจำกัดด้านภาษาไทย, และแนวทาง privacy/transfer-gating
ที่ [docs/ocr-operations.md](./ocr-operations.md)

## 11. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/20260807100000_pdf_fulltext_search.sql` | ตาราง, index, RLS, trigger, ฟังก์ชันล็อก |
| `supabase/migrations/20260822100000_restrict_document_text_exposure.sql` | แก้ C-1: ตัด column grant เนื้อหาดิบ + ฟังก์ชัน `search_research_document_excerpts()` |
| `supabase/migrations/20260823100000_search_excerpt_deterministic_order.sql` | แก้ M-1 (ส่วน RPC): เพิ่ม `ORDER BY` ให้ผลลัพธ์ดิบจากฟังก์ชันข้างต้นคงที่ |
| `lib/pdf/extract-text.server.ts` | ดึงข้อความจาก PDF buffer ด้วย pdfjs-dist |
| `lib/pdf/process-extraction.server.ts` | orchestrator: ล็อก, ดาวน์โหลด, hash, ดึงข้อความ, บันทึกผล |
| `lib/pdf/extraction-status.server.ts` | อ่านสถานะสำหรับหน้าอ่าน PDF (`getExtractionStatusBySlug`) และหน้าจัดการ (`getExtractionStatus`) |
| `lib/data/research-search.server.ts` | ค้นหาบรรณานุกรม + เนื้อหา PDF ฝั่งเซิร์ฟเวอร์ทั้งหมด — เรียก RPC ข้างต้นแทนการ select ตรง |
| `lib/search/rank.ts` | Utility กลาง normalize/เปรียบเทียบค่าคะแนนจัดลำดับ (แก้ M-1) — ใช้ร่วมกับ `lib/search.ts` (โหมด Mock Data) |
| `app/research/page.tsx`, `ResearchExplorer.tsx`, `FilterBar.tsx` | หน้าค้นหา + ตัวเลือกโหมดค้นหา |
| `components/research/ResearchCard.tsx` | แสดง snippet + ไฮไลต์คำที่ตรง (guard ป้องกัน `matchStart`/`matchEnd` ที่ไม่ใช่ตัวเลขจำกัด) |
| `app/research/[id]/read/page.tsx` | ข้อความแจ้งสถานะการค้นหาเนื้อหาที่หน้าอ่าน PDF |
| `components/dashboard/ExtractionStatusCard.tsx` | สถานะ + ปุ่มประมวลผลใหม่ที่หน้าจัดการ |
| `app/dashboard/research/[id]/edit/actions.ts` (`reprocessResearchTextAction`) | Server Action สั่งประมวลผลใหม่ + บันทึก Audit Log |
| `lib/ocr/*`, `docs/ocr-operations.md` | OCR สำหรับเอกสารสแกน (ช่วงที่ 23) — ระบบแยกต่างหาก ดูหัวข้อ 5, 10 |
| `lib/search/rank.test.ts`, `lib/data/research-search.pagination.test.ts` | Regression test สำหรับ M-1 (rank normalization, deterministic tiebreaking, pagination stability) |
