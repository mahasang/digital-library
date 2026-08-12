# แผนทดสอบ (QA Test Plan)

เอกสารนี้ครอบคลุม test case สำหรับตรวจสอบก่อนขึ้น production ครอบคลุม 11 หมวดตามฟีเจอร์หลักของระบบ
ระดับความสำคัญ: **Blocker** (ต้องผ่านก่อน launch เสมอ), **High**, **Medium**, **Low**

สถานะการทดสอบอัตโนมัติปัจจุบัน: มี unit test ครอบคลุม pure function ที่มีผลต่อความปลอดภัย/ความถูกต้องของข้อมูล 6 ไฟล์ (67 test) + integration test ที่ต่อ local Supabase จริง 1 ไฟล์ (28 test) รวม **95 test** (`npm run test`, ดูหัวข้อ "Automated Unit Tests" ท้ายเอกสาร) — **ยังไม่มี E2E test ผ่านเบราว์เซอร์จริง (Playwright)** เนื่องจากโปรเจกต์นี้ไม่เคยมีโครงสร้าง E2E framework มาก่อน และการเพิ่ม browser automation เต็มรูปแบบมีความเสี่ยงสูงกว่าค่าที่ได้ในเวลาที่มีจำกัด แต่ **การค้นหา (หมวด 3) มี integration test อัตโนมัติที่ทดสอบชั้น RLS/สิทธิ์จริงแล้ว** (ต่อ Postgres/Auth จริง ไม่ mock) — ดูรายละเอียดในหัวข้อ SEARCH-03/SEARCH-11 ด้านล่าง ส่วนที่เหลือยังเป็น **manual test plan** ที่ทีม QA รันเองก่อน launch แต่ละครั้ง

> **Final Regression QA (2026-08-08)**: ยืนยันซ้ำครั้งสุดท้ายก่อนตัดสินใจขึ้น production ว่า C-1 (SEARCH-03) และ M-1/M-4 (SEARCH-11) ยังแก้ไขสมบูรณ์ ไม่ regress — รัน `lib/data/research-search-rls.integration.test.ts` (28), `lib/data/research-search.pagination.test.ts` (32), `lib/search/rank.test.ts` (20) ซ้ำแบบ verbose ทีละไฟล์ **ผ่านทั้งหมด 67/67** เพิ่มเติมด้วยการทดสอบเชิงประจักษ์ใหม่สำหรับ access grant ที่หมดอายุ (ดู `docs/production-readiness-report.md` หัวข้อ 0) — รายละเอียดผลลัพธ์เต็มอยู่ในหัวข้อ 0 ของรายงานนั้น

---

## 1. Authentication (สมัครสมาชิก/เข้าสู่ระบบ/MFA)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| AUTH-01 | สมัครสมาชิกสำเร็จ | กรอกฟอร์ม `/register` ด้วยอีเมล/รหัสผ่านที่ถูกต้อง + ผ่าน CAPTCHA (ถ้าเปิด) | ได้บทบาท `member` อัตโนมัติ, ได้รับอีเมลยืนยัน (เช็คที่ Mailpit ใน local) | Blocker |
| AUTH-02 | สมัครซ้ำด้วยอีเมลเดิม | สมัครด้วยอีเมลที่มีอยู่แล้ว | แสดงข้อความ error ที่เป็นมิตร ไม่ใช่ raw Postgres error | High |
| AUTH-03 | เข้าสู่ระบบสำเร็จ/ผิดรหัสผ่าน | ทดสอบทั้งสองกรณีที่ `/login` | สำเร็จ → เข้า dashboard ตามสิทธิ์; ผิด → ข้อความ error ทั่วไป ไม่บอกว่าอีเมลมีอยู่จริงหรือไม่ | Blocker |
| AUTH-04 | ลืมรหัสผ่าน | ขอลิงก์ที่ `/auth/forgot-password` → เปิดลิงก์ในอีเมล → ตั้งรหัสใหม่ | ตั้งรหัสสำเร็จ, ลิงก์เก่าใช้ซ้ำไม่ได้ | High |
| AUTH-05 | Idle logout | ล็อกอินแล้วไม่มีกิจกรรม > 10 นาที | ถูกออกจากระบบอัตโนมัติ | Medium |
| AUTH-06 | บังคับตั้งค่า MFA สำหรับ Super Admin ใหม่ | ล็อกอินด้วยบัญชี super_admin ที่ยังไม่มี MFA แล้วพยายามเข้า `/superadmin` | ถูกเด้งไป `/setup-mfa` บังคับตั้งค่าก่อนเข้าได้ | Blocker |
| AUTH-07 | MFA step-up ต่อเซสชันใหม่ | Super Admin ที่ตั้งค่า MFA แล้ว ล็อกอินเซสชันใหม่แล้วเข้า `/superadmin` | ถูกเด้งไป `/mfa-challenge` ต้องกรอกรหัส 6 หลักก่อน | Blocker |
| AUTH-08 | Rate limit การเข้าสู่ระบบ/สมัครสมาชิก | ยิง request ผิดซ้ำๆ เกิน threshold | ถูกบล็อกชั่วคราวตามที่ตั้งค่าใน `/superadmin/security` | Medium |
| AUTH-09 | บัญชีที่ถูกระงับเข้าสู่ระบบไม่ได้ | Admin ระงับบัญชีที่ `/dashboard/users` แล้วให้บัญชีนั้นลองล็อกอิน | ล็อกอินไม่สำเร็จ | Blocker |

## 2. งานวิจัย (Research Items — ส่ง/อนุมัติ/จัดการ)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| RES-01 | ส่งงานวิจัยครบฟิลด์ | Staff กรอก `/submit-research` ครบทุกฟิลด์บังคับ + อัปโหลดไฟล์ + ผ่าน CAPTCHA | สร้างสถานะ `draft`/`pending_review` สำเร็จ | Blocker |
| RES-02 | ส่งงานวิจัยฟิลด์ไม่ครบ | เว้นฟิลด์บังคับว่าง | แสดง validation error รายฟิลด์ ไม่ submit | High |
| RES-03 | Workflow อนุมัติครบ 4 เส้นทาง | Librarian ที่ `/dashboard/approvals` ทดสอบ อนุมัติ/ไม่อนุมัติ/ขอแก้ไข/เผยแพร่ | สถานะเปลี่ยนถูกต้องตาม workflow, บันทึก `approval_logs`/`audit_logs` ทุกครั้ง | Blocker |
| RES-04 | แก้ไขงานวิจัยของตัวเองตอน `draft` | เจ้าของแก้ไขที่ `/my-submissions/[id]` | บันทึกสำเร็จ | High |
| RES-05 | แก้ไขงานวิจัยของผู้อื่น (ไม่ใช่เจ้าของ, ไม่ใช่ staff) | ผู้ใช้อื่นพยายามเปิด `/my-submissions/[id]` ของคนอื่นตรงๆ ผ่าน URL | ถูกปฏิเสธ (403 หรือ redirect) — **ตรวจ ownership check ที่ `updateSubmissionAction`** | Blocker |
| RES-06 | เก็บถาวร/ลบ | Librarian เก็บถาวรงานวิจัยจากทุกสถานะ | เปลี่ยนเป็น `archived` ไม่มี hard delete | High |
| RES-07 | รวมงานวิจัยที่ซ้ำ (merge) | Admin ไปที่ `/dashboard/duplicate-reviews/[id]` กด "รวมงานวิจัย" **โดยไม่พิมพ์ MERGE** | ปุ่มถูก disable ที่ client, และหากยิง POST ตรงไปที่ action โดยไม่ส่ง `confirmText=MERGE` ต้องถูกปฏิเสธที่ฝั่งเซิร์ฟเวอร์ (ทดสอบ H-2 fix) | Blocker |
| RES-08 | รวมงานวิจัย — เส้นทางที่ถูกต้อง | พิมพ์ MERGE ถูกต้อง แล้วกดยืนยัน | รายการต้นทางเปลี่ยนสถานะ `merged`, favorites/ประวัติ/สิทธิ์ที่อนุมัติย้ายไปยังรายการหลัก, URL เดิม redirect ไปรายการหลัก | High |
| RES-09 | ตรวจจับงานวิจัยซ้ำอัตโนมัติ | ส่งงานวิจัยที่ชื่อเรื่อง/ผู้วิจัยคล้ายกับรายการเดิมมาก | ปรากฏใน `/dashboard/duplicate-reviews` พร้อมคะแนนความคล้าย ไม่บล็อกการบันทึก | Medium |

## 3. ค้นหา (Search)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| SEARCH-01 | ค้นหาบรรณานุกรม (ชื่อ/ผู้วิจัย/คำสำคัญ/บทคัดย่อ) | ค้นคำที่ตรงชื่อเรื่องที่ `/research` | เจอผลลัพธ์ถูกต้อง เรียงตามลำดับ: ชื่อเรื่อง > ผู้วิจัย/คำสำคัญ > บทคัดย่อ | Blocker |
| SEARCH-02 | ค้นหาเนื้อหา PDF (โหมด "เนื้อหา PDF") | ค้นคำที่อยู่เฉพาะในเนื้อหาไฟล์ PDF (ไม่อยู่ในชื่อ/บทคัดย่อ) | เจอผลลัพธ์พร้อม snippet ไฮไลต์คำที่ตรง | Blocker |
| SEARCH-03 | **ค้นหาเนื้อหา PDF ต้องไม่คืนเนื้อหาเต็ม** — **✅ แก้ไขแล้ว มี regression test อัตโนมัติ** | อ่านหลักฐานที่ `docs/production-readiness-report.md` หัวข้อ 2 (C-1) — สรุป: `research_document_texts` เคยให้ดึง `extracted_text`/`ocr_text` เต็มไฟล์ได้ตรงผ่าน REST ด้วย anon key แม้เอกสารเป็น `read_only` (ห้ามดาวน์โหลด) แก้ด้วย migration `supabase/migrations/20260822100000_restrict_document_text_exposure.sql` (ตัด column grant ของเนื้อหาดิบจาก anon/authenticated ทั้งหมด + ฟังก์ชัน SECURITY DEFINER ใหม่ `search_research_document_excerpts()` ที่คืนเฉพาะ excerpt ~2000 ตัวอักษรรอบจุดที่ตรงคำค้นหา ไม่ใช่ทั้งไฟล์) — รันซ้ำได้ทุกเมื่อด้วย `npm run test lib/data/research-search-rls.integration.test.ts` (ต้องมี local Supabase รันอยู่) | ต้องเห็นเฉพาะ snippet/excerpt ที่ตัดความยาวแล้วเสมอ — **ห้ามพบข้อความเต็มของไฟล์หลุดมาในทุก field ของ response ไม่ว่าจะเรียกผ่านหน้าเว็บหรือ REST/RPC ตรง** ยืนยันแล้วด้วย automated test 28 รายการใน `lib/data/research-search-rls.integration.test.ts` (`describe("C-1 regression...")`) — select ตรงจาก `research_document_texts` ถูกปฏิเสธ (403/401) ทั้ง anon และ authenticated, RPC คืนเฉพาะ excerpt ที่พิสูจน์แล้วว่าสั้นกว่าเอกสารเต็มมาก (ทดสอบกับเอกสาร ~25,600 ตัวอักษร ได้ excerpt ไม่เกิน ~2010 ตัวอักษร) | **Blocker (แก้ไขแล้ว — ผ่านแล้ว)** |
| SEARCH-04 | สิทธิ์การมองเห็นผลค้นหาตาม access_level — **✅ มี regression test อัตโนมัติ** | `lib/data/research-search-rls.integration.test.ts` มี describe block แยกตามบทบาทครบ: Guest, Member, Staff, Librarian/Admin/Super Admin (`it.each`) + เคสเฉพาะ metadata_only (เจ้าของ/rank≥30 เห็น แต่ guest/member/staff ทั่วไปไม่เห็นแม้บรรณานุกรมจะเห็น) | `metadata_only` ไม่มีใครเห็นเนื้อหา PDF เลยยกเว้นเจ้าของ/rank≥30 (แต่เห็นบรรณานุกรม/title ได้ปกติ — ตามสเปก), `member_only`/`staff_only` เห็นเฉพาะ rank ที่ถึงเกณฑ์ — ทดสอบผ่านอัตโนมัติแล้วทั้งหมด | Blocker |
| SEARCH-05 | ตัวกรอง (หมวดหมู่/ปี/สิทธิ์การเข้าถึง) — **✅ มี unit test อัตโนมัติ** | `lib/data/research-search.pagination.test.ts` (`describe("finalizeResults — filtering")`) ทดสอบกรองทีละตัวและหลายตัวพร้อมกัน | ผลลัพธ์ตรงตามเงื่อนไขทุกตัวกรองพร้อมกัน — ทดสอบผ่านอัตโนมัติแล้ว | Medium |
| SEARCH-06 | คำค้นหาสั้น/ยาวเกินกำหนด/ไม่พบผล — **✅ มี regression test อัตโนมัติ (บางส่วน)** | RPC-level: `research-search-rls.integration.test.ts` ทดสอบ query ว่าง, query ยาวผิดปกติ (5000 ตัวอักษร), query ที่ไม่ match อะไรเลย — ทั้งหมดคืนค่าว่างโดยไม่ error | มีข้อความแจ้ง ไม่ error/ไม่ query DB โดยไม่จำเป็น — ระดับ UI (ข้อความแจ้งผู้ใช้จริง) ยังต้องตรวจด้วยมือ | Low |
| SEARCH-07 | Pagination (รวม **ความคงที่ข้ามคำขอ** — แก้ M-1) — **✅ มี unit test อัตโนมัติ** | `lib/data/research-search.pagination.test.ts` (`describe("finalizeResults — pagination")` + `describe("... M-1: pagination stability across differently-ordered input")`) ทดสอบแบ่งหน้า, หน้าสุดท้ายไม่เต็ม, หน้าเกินขอบเขต, `totalPages` ขั้นต่ำ 1, **และยืนยันว่าผลลัพธ์ 3 หน้าเหมือนกันทุกประการแม้ input array จะถูกสลับลำดับ (จำลองว่า Postgres/RPC คืนแถวมาคนละลำดับระหว่างคำขอ)** | แบ่งหน้าถูกต้องทุกกรณี และคงที่ไม่ขึ้นกับลำดับแถวดิบที่ฐานข้อมูลคืนมา — ทดสอบผ่านอัตโนมัติแล้ว | Medium |
| SEARCH-08 | Sorting (ใหม่สุด/เก่าสุด/ยอดนิยม/ดาวน์โหลด/ความเกี่ยวข้อง) — **✅ มี unit test อัตโนมัติ** | `lib/data/research-search.pagination.test.ts` (`describe("finalizeResults — sorting")`) รวมเคส "ผลที่ตรงคำค้นหาต้องมาก่อนเสมอแม้ sort จะขอ newest-first" | เรียงลำดับถูกต้องทุกโหมด ความเกี่ยวข้องชนะการเรียงลำดับปกติเสมอเมื่อมีคำค้นหา — ทดสอบผ่านอัตโนมัติแล้ว | Medium |
| SEARCH-11 | **การจัดลำดับ (rank) ปลอดภัยจากค่าผิดปกติและตัดสินผลเสมอกันแบบคาดเดาได้ — ✅ แก้ไขแล้ว มี regression test อัตโนมัติ (M-1)** | อ่านหลักฐานที่ `docs/production-readiness-report.md` — สรุป: comparator เดิมของ relevance ไม่มีด่านตรวจสอบว่าค่าคะแนนเป็นตัวเลขจำกัดจริง (เสี่ยง `NaN` หาก `matchSource` ในอนาคตไม่ตรงกับตารางคะแนน) และไม่มีตัวตัดสินลำดับสุดท้ายที่ไม่ซ้ำกัน แก้ด้วย `lib/search/rank.ts` (utility กลาง `normalizeRank()`/`chainComparators()`/`compareByIdAsc()`) ใช้ร่วมกันทั้ง `lib/data/research-search.server.ts` และ `lib/search.ts` (โหมด Mock Data) + เพิ่ม `ORDER BY` ที่ชั้น RPC (`supabase/migrations/20260823100000_search_excerpt_deterministic_order.sql`) | rank ปกติ/null/undefined/NaN/Infinity ทุกกรณีไม่ทำให้ sort พัง (คืนค่า fallback 0 เสมอ ไม่ throw ไม่เกิด NaN), ผลลัพธ์คะแนน/วันที่เผยแพร่เท่ากันเรียงลำดับเหมือนเดิมทุกครั้งผ่าน `id` เป็นตัวตัดสินสุดท้าย, `snippetMatchStart`/`snippetMatchEnd` ที่ไม่ใช่ตัวเลขจำกัดไม่ทำให้ `ResearchCard.tsx` ไฮไลต์ผิดตำแหน่งเงียบๆ (fallback แสดง snippet เดิมไม่ไฮไลต์) — ยืนยันด้วย automated test 39 รายการใหม่ (`lib/search/rank.test.ts` 20 รายการ + ส่วนเพิ่มใน `research-search.pagination.test.ts` 19 รายการ) และ regression test C-1 ทั้ง 28 รายการยังผ่านครบหลังแก้ไข | **Medium (แก้ไขแล้ว — ผ่านแล้ว)** |
| SEARCH-09 | สิทธิ์เข้าถึงเอกสาร (`document_access_grants`) ไม่รั่วไหลเข้าสู่ผลค้นหา — **✅ มี regression test อัตโนมัติ** | `research-search-rls.integration.test.ts`: สร้าง grant "read" แบบ active ให้ Member สำหรับเอกสาร `staff_only` แล้วยืนยันว่ายังค้นหา/เห็น excerpt ไม่ได้ (grant มีผลเฉพาะ Signed URL ไม่เคยอยู่ใน RLS ของ research_items/research_document_texts) | Member มี grant ที่ active จริง แต่ผลค้นหา/จำนวนผลลัพธ์ไม่เปลี่ยนแปลงเลย — ทดสอบผ่านอัตโนมัติแล้ว (ดูหมายเหตุสำคัญด้านล่าง) | High |
| SEARCH-10 | ค้นหาผ่าน UI/API/Server Action ให้ผลตรงกัน | — | ระบบมีเพียง **เส้นทางเดียว** สำหรับค้นหา: `app/research/page.tsx` (Server Component) → `searchResearchServer()` → RPC ใหม่ — ไม่มี Route Handler หรือ Server Action แยกต่างหากสำหรับค้นหาเลย จึงไม่มีทางที่ผลลัพธ์จะ "ไม่ตรงกัน" ระหว่างช่องทางต่างๆ ได้ตั้งแต่ต้น (ไม่ใช่ gap ที่ต้องปิด เพราะไม่มีเส้นทางที่สองอยู่จริง) | Low (ไม่มี gap) |

> **หมายเหตุสำคัญเกี่ยวกับ SEARCH-09**: ผลการทดสอบนี้ "ถูกต้องตามที่ออกแบบไว้" — `document_access_grants` เป็นชั้นสิทธิ์เสริมสำหรับ Signed URL (`getResearchReadUrl`/`getResearchDownloadUrl`) เท่านั้น ไม่เคยถูกอ้างอิงในนโยบาย RLS ของ `research_items`/`research_document_texts` เลยตั้งแต่ migration ที่สร้างตารางนี้ (`20260808100000_document_access_requests.sql`) หากทีมผลิตภัณฑ์ต้องการให้สมาชิกที่ได้รับ grant เห็นเอกสารในผลค้นหาด้วย (ไม่ใช่แค่เข้าถึงไฟล์ได้หลังเปิดหน้ารายละเอียดเอง) จะต้องเป็นการตัดสินใจเปลี่ยนแปลงพฤติกรรมแยกต่างหาก ไม่ใช่บั๊ก

## 4. PDF Reader (Flipbook)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| PDF-01 | เปิดอ่านเอกสารที่มีสิทธิ์ | เปิด `/research/[id]/read` สำหรับเอกสารที่มีสิทธิ์อ่าน | แสดง Flipbook พลิกหน้าได้ ใช้ปุ่ม/คีย์บอร์ดลูกศรได้ | Blocker |
| PDF-02 | เปิดอ่านเอกสารที่ไม่มีสิทธิ์ | Guest พยายามเปิดเอกสาร `member_only`/`metadata_only` | ถูกปฏิเสธ ไม่มี Signed URL หลุดออกมา | Blocker |
| PDF-03 | ไฟล์ที่ยังไม่ผ่านสแกนความปลอดภัย | เปิดอ่านเอกสารที่ `scan_status` เป็น `pending`/`infected`/`error` | ปฏิเสธการสร้าง Signed URL พร้อมข้อความอธิบาย | Blocker |
| PDF-04 | ไฟล์หลายหน้า (windowed rendering) | เปิดไฟล์ที่มีมากกว่า 15 หน้า เลื่อนไปมาเร็วๆ | ไม่ค้าง/ไม่พัง render เฉพาะหน้าในช่วง ±2 จากหน้าปัจจุบัน | Medium |
| PDF-05 | ดาวน์โหลด | กดดาวน์โหลดจากหน้าอ่าน สำหรับเอกสารที่อนุญาต | ได้ไฟล์ PDF จริง มีการบันทึก `download_logs` | Blocker |
| PDF-06 | ดาวน์โหลดเอกสาร `read_only` | พยายามดาวน์โหลดเอกสาร `read_only` | ปุ่มดาวน์โหลดถูกซ่อน/ปิดใช้งาน และ Server Action ปฏิเสธหากเรียกตรง | Blocker |
| PDF-07 | มือถือ/หน้าจอแคบ | เปิดหน้าอ่านบนอุปกรณ์มือถือจริงหรือ DevTools responsive mode | Flipbook ปรับขนาดถูกต้อง ไม่ตัดขอบ/ไม่ overflow | Medium |

## 5. Upload (อัปโหลดไฟล์)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| UP-01 | อัปโหลดไฟล์ถูกชนิด/ขนาดตามกำหนด | อัปโหลด PDF/ภาพปก/เอกสารแนบตามขนาดที่ตั้งค่าไว้ | สำเร็จ | Blocker |
| UP-02 | อัปโหลดไฟล์เกินขนาด | อัปโหลดไฟล์ใหญ่กว่าที่ `/superadmin/system-settings` ตั้งไว้ | ถูกปฏิเสธทั้งฝั่ง client (แจ้งทันที) และฝั่ง Storage bucket (บังคับจริง) | Blocker |
| UP-03 | ไฟล์นามสกุลไม่ตรง MIME จริง | เปลี่ยนนามสกุลไฟล์ `.txt` เป็น `.pdf` แล้วอัปโหลด | ถูกปฏิเสธด้วย magic-byte check, ไม่มีแถวถูกสร้าง, ไฟล์ถูกลบออกจาก Storage | Blocker |
| UP-04 | ไฟล์ติดมัลแวร์ (EICAR test file) | อัปโหลดไฟล์ทดสอบ EICAR ผ่าน provider สแกนจริง (ClamAV/HTTP) ที่ตั้งค่าไว้ | ถูกปฏิเสธ, บันทึก audit log `file_upload_rejected` | Blocker (เมื่อเปิดใช้งาน malware scan provider จริง) |
| UP-05 | Bulk rescan ไฟล์เดิม | Super Admin สั่ง rescan ที่ `/superadmin/file-security` | สร้าง background job ครบตามจำนวนไฟล์ที่กรอง, ผลอัปเดต `scan_status` ถูกต้อง | Medium |

## 6. Access Request (ขอสิทธิ์เข้าถึงเอกสาร)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| ACR-01 | ส่งคำขอสิทธิ์อ่าน/ดาวน์โหลด | Member ที่ไม่มีสิทธิ์กดขอสิทธิ์ที่หน้ารายละเอียดงานวิจัย | สร้างคำขอสถานะ `pending`, กันคำขอซ้ำด้วย unique index | High |
| ACR-02 | อนุมัติคำขอ (ถาวร/มีวันหมดอายุ) | Librarian อนุมัติที่ `/dashboard/access-requests/[id]` | สิทธิ์มีผลทันที (สร้าง signed URL ได้), หมดอายุตามที่กำหนดจริง | Blocker |
| ACR-03 | ปฏิเสธ/ขอข้อมูลเพิ่ม | Librarian ปฏิเสธ/ขอข้อมูลเพิ่มพร้อมเหตุผลบังคับ | บันทึกเหตุผล แจ้งผู้ขอ | Medium |
| ACR-04 | เพิกถอนสิทธิ์ที่เคยอนุมัติ | Librarian เพิกถอนสิทธิ์ที่อนุมัติไปแล้ว | สร้าง Signed URL ใหม่ไม่ได้ทันที | Blocker |
| ACR-05 | **ผู้ใช้อื่นเห็นคำขอของคนอื่นไม่ได้** | Member A ล็อกอินแล้วพยายามเปิด `/access-requests` ดูว่าเห็นคำขอของ Member B หรือไม่ (รวมถึงลอง query REST ตรงด้วย anon/authenticated key) | เห็นเฉพาะคำขอของตัวเอง — **regression test สำหรับ RLS ของ `access_requests`** | Blocker |
| ACR-06 | สิทธิ์หมดอายุอัตโนมัติ (lazy expire) | รอให้สิทธิ์ที่อนุมัติแบบมีวันหมดอายุผ่านไปแล้วเปิดหน้ารายการคำขอ | สถานะเปลี่ยนเป็น `expired` อัตโนมัติ | Medium |
| ACR-07 | **`document_access_grants` ที่หมดอายุต้องไม่ให้สร้าง Signed URL ได้อีก แม้ยังไม่ถูก lazy-expire เป็นสถานะ `expired` ก็ตาม — ✅ ทดสอบเชิงประจักษ์แล้วในรอบ Final QA** | สร้าง grant `read` ที่ `expires_at` เป็นอดีต และ grant `download` ที่ยัง active คู่กันในฐานข้อมูลจริง แล้วยิง query ที่จำลอง filter เดียวกับ `hasActiveAccessGrantBySlug()` เป๊ะ (`revoked_at is null AND (expires_at is null OR expires_at > now())`) ด้วย session ของสมาชิกจริง (ไม่ใช่ service role) — ดูหลักฐานที่ `docs/production-readiness-report.md` หัวข้อ 0.3 | grant ที่หมดอายุถูกกรองออก (คืนค่าว่างเปล่า) ทันทีที่ query ระดับ row ไม่ต้องรอ lazy-expire flip สถานะก่อน ส่วน grant ที่ active ยังปรากฏตามปกติ (positive control) — ยืนยันแล้วว่า `getResearchReadUrl`/`getResearchDownloadUrl` จะไม่ได้รับ `hasReadGrant`/`hasDownloadGrant = true` จากสิทธิ์ที่หมดอายุแล้ว | **Blocker (ทดสอบผ่านแล้ว)** |

## 7. Notifications (การแจ้งเตือน)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| NOTI-01 | แจ้งเตือนงานวิจัยใหม่ตามหมวดหมู่ที่ติดตาม | ติดตามหมวดหมู่ที่ `/profile/notification-settings` แล้วให้ librarian เผยแพร่งานวิจัยในหมวดนั้น | ได้ in-app notification (+อีเมลถ้าตั้งค่า `RESEND_API_KEY`) ไม่ซ้ำแม้เอกสารอยู่หลายหมวดหมู่ที่ติดตาม | Medium |
| NOTI-02 | แจ้งเตือนผลคำขอสิทธิ์เข้าถึง | อนุมัติ/ปฏิเสธคำขอ | ผู้ขอได้รับแจ้งเตือนถูกต้อง | Medium |
| NOTI-03 | แจ้งเตือนก่อนสิทธิ์หมดอายุ | ตั้งค่าจำนวนวันแจ้งเตือนล่วงหน้าที่ `/superadmin/notifications` แล้วรอ job `access_expiration` | แจ้งเตือนตามจำนวนวันที่ตั้ง ไม่แจ้งซ้ำ | Low |
| NOTI-04 | อ่านทั้งหมด/อ่านทีละรายการ | ใช้ปุ่ม mark read ที่ `/notifications` และ NotificationBell | สถานะอัปเดตถูกต้อง, ตัวเลขนับไม่อ่านลดลง | Low |

## 8. Dashboard (เจ้าหน้าที่/ผู้ดูแล — rank ≥ 30/40)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| DASH-01 | สิทธิ์เข้าถึงตาม rank | ทดสอบเข้า `/dashboard/*` ด้วยบัญชี member/staff/librarian/admin | member/staff ถูกเด้ง `/403`, librarian+ เข้าได้ตามหน้าที่กำหนด, `/dashboard/users`+`/audit-logs`+`/settings` เฉพาะ admin | Blocker |
| DASH-02 | จัดการหมวดหมู่/หน่วยงาน (เพิ่ม/แก้ไข/ปิดใช้งาน/ลบ) | ทดสอบ CRUD ครบที่ `/dashboard/categories`, `/dashboard/organizations` | ลบไม่ได้เมื่อยังมีงานวิจัย/หมวดหมู่ย่อยผูกอยู่ | High |
| DASH-03 | เปลี่ยนบทบาทผู้ใช้ | Admin เปลี่ยนบทบาทที่ `/dashboard/users` | เปลี่ยนทันที, บันทึก audit log, **ปฏิเสธการเปลี่ยนบทบาทของ super_admin ที่หน้านี้** | Blocker |
| DASH-04 | ระงับ/เปิดใช้งานบัญชี | Admin ระงับบัญชีคนอื่น และพยายามระงับบัญชีตัวเอง | ระงับคนอื่นสำเร็จ (ban จริงผ่าน Auth Admin API), **ระงับตัวเองถูกปฏิเสธ** | Blocker |
| DASH-05 | รายงาน + ส่งออก CSV | สร้างรายงานที่ `/dashboard/reports` พร้อมตัวกรอง แล้ว export | ไฟล์ CSV เปิดด้วย Excel แสดงภาษาไทยถูกต้อง (มี BOM) | Medium |
| DASH-06 | จัดการผู้วิจัย/หน่วยงานมาตรฐาน | เพิ่ม/แก้ไข/รวมผู้วิจัยที่ `/dashboard/authors` | คำเตือนชื่อซ้ำแสดงถูกต้อง, ORCID ตรวจ checksum ก่อนบันทึกเสมอ | Medium |
| DASH-07 | Audit Log ครบถ้วน | ทำ action ที่มีผลต่อระบบ (เปลี่ยนบทบาท/ลบ/รวมข้อมูล) แล้วตรวจที่ `/dashboard/audit-logs` | ปรากฏครบทุก action พร้อมผู้กระทำ/เวลา/รายละเอียด | High |

## 9. Super Admin (rank ≥ 50 + MFA aal2)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| SA-01 | Admin ปกติเข้า `/superadmin/*` ไม่ได้ | ล็อกอินด้วยบัญชี admin (rank 40) แล้วพยายามเข้า `/superadmin/overview` | ถูกเด้งไป `/403` | Blocker |
| SA-02 | มอบ/ถอดถอน Super Admin ผ่าน UI | ที่ `/superadmin/users/[id]` พิมพ์ `CONFIRM`/อีเมลผิด แล้วพิมพ์ถูก | ผิด → ปุ่มไม่ทำงาน/ถูกปฏิเสธที่ server; ถูก → มอบ/ถอดถอนสำเร็จ พร้อม audit log ครบ (บทบาทเดิม/ใหม่/เหตุผล) | Blocker |
| SA-03 | ป้องกันถอดถอน super_admin คนสุดท้าย | พยายามถอดถอน super_admin คนเดียวที่เหลือในระบบ | ถูกปฏิเสธด้วยข้อความจาก database trigger (`P0001`) | Blocker |
| SA-04 | รีเซ็ต MFA ผู้ใช้อื่น | รีเซ็ต MFA ให้บัญชีอื่นที่ `/superadmin/users/[id]` (ยืนยัน 2 ขั้น: อีเมล + พิมพ์ `RESET MFA`) | สำเร็จเฉพาะเมื่อยืนยันครบถูกต้อง, **ปุ่มถูกซ่อนเมื่อดูโปรไฟล์ตัวเอง**, เจ้าของบัญชีถูกออกจากระบบทุกเซสชันทันที | Blocker |
| SA-05 | จัดลำดับหมวดหมู่/หน่วยงานแบบลากวาง | ลากวางที่ `/superadmin/categories`, `/superadmin/organizations` | บันทึกสำเร็จเป็น transaction เดียว, คืนค่าลำดับเดิมถ้าบันทึกล้มเหลว, ใช้คีย์บอร์ด/ปุ่มเลื่อนขึ้นลงได้ | Medium |
| SA-06 | ตั้งค่าระบบขั้นสูง | อัปโหลดโลโก้/favicon, ปรับขนาดไฟล์สูงสุดที่ `/superadmin/system-settings` | มีผลจริงกับ Storage bucket ทันที | Medium |
| SA-07 | Storage — สแกน/ลบไฟล์ค้าง | สแกนหาไฟล์ orphaned ที่ `/superadmin/storage` แล้วลบ | ลบได้เฉพาะหลังยืนยัน, บันทึก audit log | Medium |
| SA-08 | ภาพรวมสถานะ MFA | ตรวจ `/superadmin/mfa-status` | แสดงสถานะ MFA ของทุก super_admin ถูกต้อง ไม่แสดง secret/QR/recovery code | Low |

## 10. Background Jobs (Queue/DLQ/Cron)

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| JOB-01 | Worker ประมวลผล job สำเร็จ | เรียก `POST /api/jobs/process` พร้อม header `Authorization: Bearer $CRON_SECRET` ที่ถูกต้อง | job สถานะ `pending` ถูก claim และประมวลผล | Blocker |
| JOB-02 | Worker ปฏิเสธเมื่อไม่มี/ผิด secret | เรียกโดยไม่มี header หรือ secret ผิด | ปฏิเสธ 401/403 เสมอ (fail closed) | Blocker |
| JOB-03 | Retry + Dead-letter Queue | จำลอง job ที่ล้มเหลวซ้ำจนครบ `max_attempts` | เข้า DLQ ที่ `/superadmin/jobs`, แจ้งเตือน Super Admin (in-app/email) ไม่ซ้ำ | High |
| JOB-04 | ยกเลิก/หยุดชั่วคราว Master Job (job_batches) | สั่ง pause/resume/cancel ชุดงาน bulk ที่ `/superadmin/jobs` | cancel กระทบเฉพาะรายการที่ยัง `pending` เท่านั้น, รายการที่ทำสำเร็จ/กำลังทำไม่ถูกแตะ | Medium |
| JOB-05 | Concurrency ต่อประเภทงาน (ข้าม worker/instance) | รัน worker พร้อมกัน 2 instance (จำลอง Cron ทับซ้อน) | ไม่มีงานประเภทเดียวกัน processing เกินค่าที่ตั้งไว้พร้อมกัน | Medium |
| JOB-06 | Cron watchdog แจ้งเตือนความผิดปกติ | หยุดเรียก `/api/jobs/process` เกินเวลาที่กำหนดไว้ที่ `/superadmin/cron-monitoring` | Watchdog (`/api/cron/health-check`) ตรวจพบและแจ้งเตือน Super Admin พร้อม cooldown กันแจ้งซ้ำ | Medium |
| JOB-07 | Idempotency key กันสร้าง job ซ้ำ | กดปุ่ม "ประมวลผลทั้งหมดตามตัวกรอง" ซ้ำเร็วๆ ด้วยตัวกรองเดิม | ไม่สร้างชุดงานซ้ำซ้อน | Medium |

## 11. OCR Configuration

| ID | Test Case | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ระดับ |
| --- | --- | --- | --- | --- |
| OCR-01 | OCR ปิดใช้งานเป็นค่าเริ่มต้น | ไม่ตั้งค่า `OCR_ENABLED` แล้วสั่ง OCR เอกสารที่ `no_text_found` | สถานะ `blocked` (ไม่ใช่ `failed`), ไม่มีการเชื่อมต่อเครือข่ายเกิดขึ้น | Blocker |
| OCR-02 | OCR Readiness Check | เปิด `/superadmin/ocr` กดปุ่ม "ตรวจสอบการเชื่อมต่อ" (ยังไม่ตั้งค่า provider จริง) | แสดงสถานะไม่พร้อมอย่างชัดเจน ไม่ส่งไฟล์ใดๆ ระหว่างตรวจสอบ | High |
| OCR-03 | Controlled OCR Test | เปิด `OCR_TEST_MODE=true` แล้วรันทดสอบด้วยไฟล์ตัวอย่างใน `public/ocr-test-fixtures/` | ผลบันทึกใน `ocr_test_runs` เท่านั้น **ไม่ปรากฏในผลค้นหาสาธารณะ** (ตาราง `ocr_test_runs` ไม่มี FK ไปยัง research_items) | Blocker |
| OCR-04 | จำกัดขนาด/จำนวนหน้า/โควตา | ทดสอบไฟล์เกินเพดานที่ตั้งไว้ (env + settings) | ปฏิเสธก่อนสร้างงาน พร้อมคำแนะนำ ไม่สร้าง job ที่ล้มเหลวทีหลัง | High |
| OCR-05 | นโยบายเอกสาร private ไป external provider | ตั้ง `OCR_PROVIDER=external_api` โดยไม่เปิด `OCR_ALLOW_PRIVATE_DOCUMENTS` แล้วสั่ง OCR เอกสารที่ไม่ใช่ `public` | ถูกปฏิเสธ | Blocker |
| OCR-06 | ผลลัพธ์ OCR ค้นหาได้พร้อมป้ายเตือน | OCR สำเร็จแล้วค้นหาคำที่อยู่ในผลลัพธ์ | เจอผลลัพธ์พร้อมป้าย "จาก OCR อาจคลาดเคลื่อน" | Medium |

---

## Automated Unit Tests

### Pure logic (ไม่ต้องต่อ Supabase — ปลอดภัย รันได้ทุกที่รวม CI)

| ไฟล์ | ครอบคลุม |
| --- | --- |
| `lib/validation/orcid.test.ts` | ตรวจ checksum ORCID (ISO 7064 MOD 11-2), การตัด URL/ขีด, กรณี invalid |
| `lib/labels.test.ts` | `canReadOnline`/`canDownload` — ฟังก์ชันที่ควบคุมว่า Signed URL จะถูกสร้างหรือไม่ต่อ access level |
| `lib/reports/csv.test.ts` | BOM, การ escape comma/quote/newline, การจัดการ null |
| `lib/errors/safe-message.server.test.ts` | `toSafeErrorMessage()` — จุดเดียวที่ป้องกัน raw error หลุดไปที่ผู้ใช้ (เกี่ยวข้องโดยตรงกับ finding H-1) |
| `lib/data/research-search.pagination.test.ts` | Pagination/sorting/filtering ของ `finalizeResults()` รวมส่วน rank normalization/deterministic tiebreak/pagination stability — SEARCH-05/07/08/11 |
| `lib/search/rank.test.ts` | Utility กลาง `normalizeRank()`/`chainComparators()`/`compareByIdAsc()`/`compareByPublishedAt*()` — SEARCH-11 (M-1) |

### Integration tests (ต้องมี local Supabase รันอยู่ — `npx supabase start`)

| ไฟล์ | ครอบคลุม |
| --- | --- |
| `lib/data/research-search-rls.integration.test.ts` | **Regression test สำหรับ C-1** — ต่อ local Supabase จริง (Postgres + Auth จริง ไม่ mock RLS) สร้าง/ลบ test fixtures ครบทุก access level (`public`/`read_only`/`member_only`/`staff_only`/`metadata_only`) และบัญชีทดสอบครบทุกบทบาท (member/staff/librarian/admin/super_admin + เจ้าของเอกสาร) เอง 28 test case ครอบคลุม SEARCH-03/04/06/09 — ดูรายละเอียดในหัวไฟล์และคอมเมนต์ท้ายแต่ละ describe block |

รัน**ทั้งหมด**ด้วย `npm run test` — ไฟล์ pure logic รันได้เสมอ ส่วนไฟล์ integration จะ **ข้ามตัวเองโดยอัตโนมัติ** (ไม่ fail) ถ้าไม่พบ `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local` — เพื่อรันจริงต้อง `npx supabase start` ก่อนเสมอ ทดสอบแล้วว่ารันซ้ำได้ต่อเนื่องหลายรอบโดยไม่มีข้อมูลค้าง (fixture ทั้งหมดถูกลบใน `afterAll` เสมอแม้ test บางตัวจะ fail กลางคัน)

**ข้อจำกัดที่ทราบอยู่แล้ว (ไม่ใช่ blocker):**
- ไม่มี E2E test ผ่านเบราว์เซอร์จริง (Playwright) — integration test ข้างต้นทดสอบที่ชั้น Postgres/PostgREST/Auth โดยตรง (เป็นชั้นที่ C-1 เกิดขึ้นจริง) ไม่ได้ทดสอบผ่าน UI จริงหรือ `searchResearchServer()` โดยตรง (ฟังก์ชันนั้นต้องพึ่ง `next/headers` cookies() ซึ่งต้องมี Next.js request context) — แนะนำเพิ่ม Playwright สำหรับ golden path ที่สำคัญที่สุด 3-4 เส้นทาง (ล็อกอิน→ค้นหา→อ่านเอกสาร, ส่งงานวิจัย→อนุมัติ→เผยแพร่, ขอสิทธิ์เข้าถึง→อนุมัติ→เข้าถึงได้) เมื่อทีมพร้อมดูแลรักษาชุดทดสอบที่ต้องพึ่งเบราว์เซอร์จริง
- integration test ผูกกับชื่อ Docker container ของ local Supabase (`supabase_db_Ebooks` ตามค่าเริ่มต้น ปรับได้ผ่าน env var `SUPABASE_DB_CONTAINER`) เนื่องจากต้องใช้สิทธิ์ระดับ `postgres` (ไม่ใช่ `service_role`) สร้าง fixture บางส่วน (`research_items`, `user_roles`, `document_access_grants` — `service_role` ไม่มีสิทธิ์ INSERT บนตารางเหล่านี้โดยเจตนา ตรงกับที่แอปจริงก็ไม่เคยเขียนผ่าน `service_role` เช่นกัน) จึงรันได้เฉพาะบนเครื่อง dev ที่มี Docker/local Supabase เท่านั้น ไม่ใช่ CI ทั่วไปที่ไม่มี Docker
