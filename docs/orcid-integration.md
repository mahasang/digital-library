# การเชื่อมต่อ ORCID (ORCID Integration)

## 1. สถานะปัจจุบัน — มีการยืนยันตัวตนสองระดับ ไม่ปนกัน

ระบบมีสถานะยืนยัน ORCID **สองแบบที่แยกจากกันโดยสิ้นเชิง** ทั้งในฐานข้อมูลและ
หน้าเว็บ:

| สถานะ | คอลัมน์ | ความหมาย | น่าเชื่อถือแค่ไหน |
| --- | --- | --- | --- |
| ยืนยันโดยเจ้าหน้าที่ | `orcid_verified_at` | เจ้าหน้าที่ห้องสมุดตรวจสอบด้วยตนเอง (เช่น เทียบเอกสารยืนยันตัวตน หรือดูหน้าโปรไฟล์ ORCID ด้วยตาเปล่า) — ไม่ใช่กลไกอัตโนมัติ | ขึ้นกับความรอบคอบของเจ้าหน้าที่ |
| **ยืนยันผ่าน ORCID OAuth จริง** (ช่วงที่ 23) | `orcid_oauth_verified_at` | ผู้วิจัย**ล็อกอินเข้า ORCID.org เอง**แล้วอนุญาตให้ระบบเข้าถึง (Authorization Code flow) — ORCID เป็นผู้ยืนยันตัวตนโดยตรง | น่าเชื่อถือกว่า เพราะยืนยันจาก ORCID.org จริง ไม่ใช่ดุลยพินิจของเจ้าหน้าที่ |

ทั้งสองสถานะ**แสดงแยกกันชัดเจนเสมอ**ทั้งที่หน้าโปรไฟล์ผู้ใช้ (`/account`) และ
หน้าจัดการผู้วิจัย (`/dashboard/authors/[id]`) — การมี OAuth ไม่ได้ลบ/เขียนทับ
สถานะเจ้าหน้าที่เดิม (แต่ถ้า ORCID เปลี่ยนค่าไปจากเดิม ทั้งสองสถานะจะถูกล้าง
อัตโนมัติ ต้องยืนยันใหม่ตามค่าที่เปลี่ยน)

**เชื่อมต่อ ORCID Public API แบบอ่านอย่างเดียวแล้ว** (ช่วงที่ 27 — ตรวจสอบว่า
ORCID iD มีอยู่จริง/ดึงชื่อสาธารณะมาเทียบ โดยไม่ต้องให้ผู้วิจัยล็อกอิน) — เป็น
**สถานะที่สาม** แยกจากสองสถานะข้างต้นโดยสิ้นเชิง (คอลัมน์ cache
`orcid_api_checked_at`/`orcid_api_public_name` ไม่ใช่สถานะยืนยันตัวตน) ดูหัวข้อ
6

## 2. ตรวจรูปแบบ + checksum (คงเดิมจากช่วงที่ 19 ทุกประการ)

`lib/validation/orcid.ts` — ORCID iD มี 16 หลัก รูปแบบ `0000-0000-0000-000X`
โดยหลักสุดท้ายเป็น checksum คำนวณตามมาตรฐาน **ISO 7064 MOD 11-2** ฟังก์ชัน
`validateOrcid()` รับ input ได้หลายรูปแบบ (มี/ไม่มีขีด, มี/ไม่มี
`https://orcid.org/` นำหน้า) แล้วคืนค่ารูปแบบมาตรฐานเสมอ — ใช้ตรวจทั้งการกรอก
ด้วยตนเองของเจ้าหน้าที่ **และ** ค่าที่ ORCID ส่งกลับมาผ่าน OAuth (ไม่เชื่อ
ORCID เฉยๆ โดยไม่ตรวจซ้ำ)

## 3. ORCID OAuth (Authorization Code flow) — วิธีทำงาน

```
ผู้วิจัยกดปุ่ม "เชื่อม ORCID" ที่ /account
        │  (startOrcidConnectAction — Server Action)
        ▼
สร้าง state แบบใช้ครั้งเดียว (orcid_oauth_states, อายุ 10 นาที)
ผูกกับทั้ง user_id (session ปัจจุบัน) และ author_id (แถวที่เชื่อมไว้)
        │
        ▼
redirect ไปยัง {sandbox.orcid.org|orcid.org}/oauth/authorize
(scope=/authenticate เท่านั้น — Public API ฟรี ไม่ใช่ Member API เสียเงิน)
        │  ผู้วิจัยล็อกอิน ORCID เอง แล้วกด "อนุญาต" หรือ "ยกเลิก"
        ▼
GET /api/orcid/callback?code=...&state=...  (หรือ ?error=access_denied ถ้ายกเลิก)
  1. ตรวจว่าล็อกอินอยู่ (ไม่งั้น redirect ไปหน้า error)
  2. ถ้ามี error param (ผู้ใช้กดยกเลิก) — consume state ทิ้ง แล้ว redirect
     ?orcid=cancelled ทันที (ไม่แตะข้อมูลอะไรเลย)
  3. consumeOrcidOAuthState(state, user.id) — ลบ state ทิ้งทันทีไม่ว่าผลจะ
     เป็นอย่างไร (ใช้ซ้ำไม่ได้แม้ตรวจสอบผ่าน) ตรวจ user_id ตรงกับ session
     ปัจจุบันด้วย (กัน state ของคนอื่นถูกสวมใช้)
  4. exchangeOrcidCode() — แลก code เป็น access token ฝั่งเซิร์ฟเวอร์เท่านั้น
     (ต้องใช้ client_secret) — ORCID คืนค่า orcid iD มาในตัว token response
     เลย ไม่ต้องเรียก API แยกอีกครั้ง
  5. validateOrcid() ตรวจซ้ำรูปแบบ/checksum ของ ORCID ที่ ORCID ส่งมา
  6. UPDATE authors SET orcid=..., orcid_oauth_verified_at=now() ผ่าน
     Service Role (ผู้ใช้ที่เชื่อมอาจเป็นแค่ Member/Guest ไม่ผ่าน RLS ที่บังคับ
     rank >= 20 ปกติ) — ถ้าชนกับ partial unique index เดิม (23505) แปลว่า
     ORCID นี้ถูกผูกกับผู้วิจัยคนอื่นไปแล้ว ปฏิเสธพร้อมข้อความให้ติดต่อ
     เจ้าหน้าที่ตรวจสอบ (ดูหัวข้อ 3.3)
  7. เก็บ access/refresh token ลง orcid_oauth_tokens (Service Role เท่านั้น)
  8. บันทึก audit_logs แล้ว redirect ?orcid=connected
```

ทุกขั้นตอนทำงาน**ฝั่งเซิร์ฟเวอร์ทั้งหมด** — ไม่มี Client Component ใดเรียก
ORCID API โดยตรง หรือเห็น `client_secret`/access token เลย

### 3.1 CSRF protection

`orcid_oauth_states` (migration `20260813100000_orcid_oauth_and_ocr.sql`):

- `state` เป็น random 32-byte hex (`crypto.randomBytes(32)`) — เดาไม่ได้
- ผูกกับทั้ง `user_id` และ `author_id` — แม้ state จะถูกขโมย ก็ใช้กับ session
  ของคนอื่นไม่ได้ (`consumeOrcidOAuthState` เทียบ `user_id` กับ session
  ปัจจุบันเสมอ)
- อายุ 10 นาที (`expires_at`) — หมดอายุแล้วถือว่าใช้ไม่ได้ทันที
- **ใช้ครั้งเดียว**: ลบทิ้งทันทีที่ `consumeOrcidOAuthState()` ถูกเรียก ไม่ว่า
  ผลลัพธ์จะผ่านหรือไม่ผ่านก็ตาม (กัน replay attack แม้ callback แรกจะ error
  ก็ตาม)
- ไม่ grant สิทธิ์ให้ `authenticated` เลย — เข้าถึงได้เฉพาะ Service Role
  เท่านั้น (client ธรรมดาอ่าน/แก้ตารางนี้ไม่ได้แม้จะพยายาม query ตรงๆ)

### 3.2 เก็บ token แยกตาราง ไม่ปนกับ `authors`

`orcid_oauth_tokens` (`author_id` เป็น primary key, หนึ่งแถวต่อผู้วิจัยหนึ่ง
คน) — **ตั้งใจแยกออกจากตาราง `authors` โดยเด็ดขาด** เพราะ `authors` มี RLS
policy `authors_select_all` (`USING (true)`) เปิดให้ทุกคนอ่านได้เป็นปกติ (ใช้
แสดงหน้ารายชื่อผู้วิจัยสาธารณะ) — ถ้าเก็บ token ปนอยู่ในแถวเดียวกัน จะรั่วไหล
ทันทีที่มีใครก็ตาม query ตาราง `authors`

- ไม่ grant สิทธิ์ให้ `authenticated` เลยเช่นเดียวกับ `orcid_oauth_states` —
  เข้าถึงได้เฉพาะ Service Role (`storeOrcidOAuthTokens()`) เท่านั้น
- ปัจจุบัน**ยังไม่มีจุดใดในระบบอ่าน token กลับมาใช้งาน** (เก็บไว้เผื่ออนาคต
  ต้องการเรียก ORCID API เพิ่มเติมด้วย token ของผู้วิจัย เช่น ดึงผลงานที่
  ลงทะเบียนไว้ — scope `/authenticate` ปัจจุบันใช้ยืนยันตัวตนอย่างเดียว ยังไม่
  พอสำหรับดึงข้อมูลเพิ่มเติม)

### 3.3 ป้องกัน ORCID เดียวผูกกับหลายคน

**ไม่ได้เพิ่ม constraint ใหม่** — ใช้ partial unique index เดิมจากช่วงที่ 19
(`idx_authors_orcid_unique_active` บน `authors.orcid`) ซึ่งบังคับอยู่แล้วว่า
ORCID หนึ่งค่าผูกกับผู้วิจัยที่ยัง active ได้แค่คนเดียว — callback route แค่
ปล่อยให้ `UPDATE` ชนกับ constraint นี้ตามธรรมชาติ (Postgres error code
`23505`) แล้วดักจับแปลงเป็นข้อความปลอดภัย **ไม่มีขั้นตอน auto-merge/auto-
override ใดๆ** — ต้องให้เจ้าหน้าที่ตรวจสอบด้วยตนเองเสมอตามข้อกำหนด (เช่น
ผู้วิจัยสองคนในระบบเป็นคนเดียวกันจริงและต้องรวมข้อมูล ให้ใช้ฟีเจอร์ตรวจสอบ/
รวมข้อมูลซ้ำเดิมจากช่วงที่ 19/22 ไม่ใช่ให้ OAuth เขียนทับกันเอง)

### 3.4 เชื่อม `profiles` กับ `authors` ก่อนใช้งานได้

ปุ่ม "เชื่อม ORCID" จะทำงานได้ก็ต่อเมื่อบัญชีผู้ใช้ (`profiles`) ถูกผูกกับแถว
`authors` แถวใดแถวหนึ่งแล้วผ่านคอลัมน์ `authors.profile_id` (มี unique index
กันหนึ่งบัญชีผูกกับผู้วิจัยได้มากกว่าหนึ่งคน) — คอลัมน์นี้มีอยู่ตั้งแต่ช่วงที่ 3
แต่ไม่เคยมี UI ให้ตั้งค่าเลยจนถึงช่วงที่ 23:

- เจ้าหน้าที่ (rank ≥ 30 — Librarian ขึ้นไป) เข้า `/dashboard/authors/[id]`
  ผูกบัญชีให้ผู้วิจัยด้วยอีเมล (`linkAuthorProfileAction`) หรือถอดผูกได้
  (`unlinkAuthorProfileAction`) — **ตั้งใจให้เจ้าหน้าที่เป็นผู้ผูกเท่านั้น**
  ไม่ให้ผู้ใช้ทั่วไปอ้างตัวเป็นผู้วิจัยคนไหนก็ได้เอง
- ถ้ายังไม่ถูกผูก หน้า `/account` จะแสดงข้อความแนะนำให้ติดต่อเจ้าหน้าที่แทนปุ่ม
  เชื่อม ORCID

## 4. ปิดปุ่ม/แสดงคำแนะนำเมื่อยังไม่ได้ตั้งค่า

`isOrcidOAuthConfigured()` (`lib/orcid/orcid-oauth.server.ts`) ตรวจว่ามีทั้ง
`ORCID_CLIENT_ID` และ `ORCID_CLIENT_SECRET` หรือไม่ — ถ้าไม่ครบ:

- หน้า `/account` แสดงกล่องคำแนะนำสีเหลืองแทนปุ่ม ระบุชื่อตัวแปร Environment
  Variable ที่ต้องตั้งค่าให้ผู้ดูแลระบบเห็นชัดเจน (ไม่ใช่แค่ปุ่มหาย/error ลอยๆ)
- `startOrcidConnectAction()` ปฏิเสธทันทีถ้าถูกเรียกทั้งที่ยังไม่ได้ตั้งค่า
  (กันกรณี inspect element เปิดปุ่มเองแล้วยิง Server Action ตรงๆ)
- `/api/orcid/callback` ตรวจ `isSupabaseConfigured()` เช่นกันตั้งแต่ต้น

## 5. Environment Variables

ดูรายละเอียดที่ `.env.example` — สรุป:

| ตัวแปร | จำเป็นไหม | ความหมาย |
| --- | --- | --- |
| `ORCID_CLIENT_ID` / `ORCID_CLIENT_SECRET` | ทางเลือก | จากแอปที่ลงทะเบียนกับ ORCID — ไม่ตั้งค่าปุ่มเชื่อม ORCID (หัวข้อ 3) และปุ่มตรวจสอบ ORCID Public API (หัวข้อ 6) จะปิด/ไม่พร้อมใช้งานทั้งคู่ (ใช้ credential ชุดเดียวกัน) |
| `ORCID_OAUTH_ENV` | ทางเลือก | `sandbox` (ค่าเริ่มต้นถ้าปล่อยว่าง) หรือ `production` — ต้องตั้งเป็น `production` อย่างชัดเจนก่อนเชื่อมกับ ORCID จริง มีผลกับทั้ง OAuth (หัวข้อ 3) และ Public API (หัวข้อ 6) พร้อมกัน |

**Redirect URI ต้องลงทะเบียนกับ ORCID Developer Tools ให้ตรงเป๊ะ**:
`https://<โดเมนจริงของคุณ>/api/orcid/callback` — ระบบคำนวณ URL นี้จาก request
header (`host` + `x-forwarded-proto`) เอง**ไม่ได้ใช้ตัวแปร Environment
Variable แยกสำหรับโดเมน** เพื่อไม่ต้องเพิ่มการตั้งค่าที่ซ้ำซ้อนกับสิ่งที่ Vercel
รู้อยู่แล้ว — แปลว่าถ้าโดเมนเปลี่ยน (เช่นเปลี่ยนจาก `.vercel.app` เป็นโดเมน
custom) ต้องไปอัปเดต redirect URI ที่ฝั่ง ORCID Developer Tools ด้วยตนเองเสมอ

Sandbox (`sandbox.orcid.org`) กับ Production (`orcid.org`) เป็นคนละระบบ คนละ
แอปที่ต้องลงทะเบียนแยกกัน คนละ Client ID/Secret — ห้ามใช้ค่า sandbox กับ
production หรือกลับกัน

## 6. ORCID Public API แบบอ่านอย่างเดียว (ช่วงที่ 27)

ตรวจสอบว่า ORCID iD มีอยู่จริงในระบบ ORCID และดึงชื่อสาธารณะมาเทียบกับชื่อใน
ระบบห้องสมุด **โดยไม่ต้องให้ผู้วิจัยล็อกอินเอง** (ต่างจาก OAuth ในหัวข้อ 3 ที่
ต้องให้ผู้วิจัยยืนยันตัวตนเอง) — เป็นเครื่องมือช่วยเจ้าหน้าที่ตรวจสอบเท่านั้น
**ไม่ใช่การยืนยันตัวตนและไม่เคยเขียนทับข้อมูลนักวิจัยอัตโนมัติ**

### 6.1 วิธีทำงาน

```
เจ้าหน้าที่กด "ตรวจสอบ ORCID" ที่ /dashboard/authors/[id]
        │  (checkOrcidPublicApiAction — Server Action, rank >= 30)
        ▼
ถ้าตรวจไปแล้วภายใน 24 ชม. (orcid_api_checked_at) และไม่ได้กด "บังคับตรวจสอบใหม่"
  → ใช้ผลเดิม ไม่เรียก ORCID ซ้ำ (cache กันเรียก API ซ้ำโดยไม่จำเป็น)
        │
        ▼
checkRateLimit("orcid_lookup:{userId}", 30 ครั้ง/ชม.) — กันเจ้าหน้าที่คนเดียว
เรียกรัวๆ และกันชนขีดจำกัดของ ORCID เอง
        │
        ▼
lookupOrcidPublicRecord() (lib/orcid/orcid-public-api.server.ts):
  1. validateOrcid() ตรวจรูปแบบ/checksum ก่อนเสมอ (ไม่ยิง request ถ้ารูปแบบผิด)
  2. ขอ Client Credentials token จาก {sandbox.orcid.org|orcid.org}/oauth/token
     (grant_type=client_credentials, scope=/read-public) — ใช้
     ORCID_CLIENT_ID/ORCID_CLIENT_SECRET ชุดเดียวกับ OAuth ในหัวข้อ 3
     แค่คนละ grant_type/scope ไม่ใช่ credential ใหม่ ไม่มีค่าใช้จ่ายเพิ่ม
     (cache token ไว้ในหน่วยความจำ server instance จนกว่าจะหมดอายุ)
  3. เรียก GET {pub.sandbox.orcid.org|pub.orcid.org}/v3.0/{orcid}/person
     (เลือก /person ไม่ใช่ /record เพราะต้องการแค่ชื่อ ไม่ต้องการ
     งานตีพิมพ์/การศึกษา/ฯลฯ ที่ /record คืนมาทั้งหมด)
  4. แปลผลเป็นสถานะที่ชัดเจนเสมอ ไม่ throw: not_configured, invalid_format,
     not_found (404), no_public_data (name.visibility != public),
     rate_limited (429), error (timeout/เครือข่ายล้มเหลว/5xx), found
        │
        ▼
เขียนกลับเฉพาะ authors.orcid_api_checked_at + authors.orcid_api_public_name
เท่านั้น (แม้ผลจะเป็น found ก็ตาม) → บันทึก audit_logs
(action: author_orcid_api_check) → แสดงผลเป็น "ข้อมูลแนะนำสำหรับตรวจสอบ" คู่กับ
ชื่อในระบบ พร้อมป้ายบอกว่าตรง/ไม่ตรงกัน (เทียบแบบ case-insensitive เท่านั้น
เป็นเพียงคำแนะนำ ไม่ใช่การตัดสินที่แม่นยำ)
```

### 6.2 ทำไมไม่มีปุ่ม "ใช้ข้อมูลนี้" ที่เขียนทับอัตโนมัติ

ตั้งใจไม่เพิ่ม action ใหม่สำหรับ "apply" ผลลัพธ์ลงในฟิลด์ข้อมูลนักวิจัยจริง —
เมื่อเจ้าหน้าที่เห็นว่าชื่อตรงกันแล้ว ให้ใช้ปุ่ม **"ยืนยันว่าตรวจสอบแล้ว"** เดิม
(`verifyOrcidAction`, ตั้งค่า `orcid_verified_at`) หรือแก้ไขชื่อในฟอร์มผู้วิจัย
เดิม (`updateAuthorAction`) ด้วยตนเองตามปกติ — ทั้งสอง action นี้มีอยู่แล้วและ
ผ่านการตรวจสอบสิทธิ์แบบเดียวกัน การใช้ path การเขียนที่มีอยู่แล้วแทนการสร้าง
path ใหม่ทำให้**ไม่มีทางที่ฟีเจอร์นี้จะเขียนทับข้อมูลนักวิจัยเองได้เลยแม้แต่
ทางเดียว** — ตรงตามข้อกำหนด "ห้ามเขียนทับข้อมูลผู้วิจัยโดยอัตโนมัติจาก ORCID"

### 6.3 คอลัมน์ cache — คนละความหมายกับสถานะยืนยัน

`authors.orcid_api_checked_at`/`authors.orcid_api_public_name`
(migration `20260816100000_orcid_public_api_and_ocr_limits.sql`) เป็น
**คอลัมน์ cache ผลการตรวจสอบ ไม่ใช่สถานะยืนยันตัวตน** — แยกขาดจาก
`orcid_verified_at`/`orcid_oauth_verified_at` โดยสิ้นเชิง ไม่มีโค้ดใดอ่านสอง
คอลัมน์นี้เพื่อตัดสินสิทธิ์การเข้าถึงหรือความน่าเชื่อถือใดๆ — มีไว้แสดงผลให้
เจ้าหน้าที่เห็นเท่านั้น

## 7. สิ่งที่ต้องระวังเสมอ

- Secret ทุกตัวเก็บใน Environment Variables เท่านั้น ตามธรรมเนียมเดิมของ
  โปรเจกต์ทุกประการ — ห้ามเก็บใน `settings` table (RLS เปิดให้ทุกคนอ่านได้)
- เรียก ORCID API จากฝั่งเซิร์ฟเวอร์เท่านั้น (Server Action/Route Handler)
  ไม่เคยเรียกจาก Client Component โดยตรง — ตรวจสอบแล้วว่า
  `components/account/OrcidConnect.tsx` เป็น Client Component ที่**เรียก
  Server Action เท่านั้น** ไม่มี `fetch()` ตรงไป ORCID เอง
- ห้ามแสดง error ดิบจาก ORCID API ต่อผู้ใช้ — callback route แปลงทุก error
  เป็นข้อความไทยสั้นๆ ที่ปลอดภัยเสมอ (error ดิบ log ด้วย `console.error` ฝั่ง
  เซิร์ฟเวอร์เท่านั้น)
- คง `orcid_verified_at` (ยืนยันโดยเจ้าหน้าที่) แยกจาก `orcid_oauth_verified_at`
  (ยืนยันผ่าน OAuth จริง) เสมอ — ห้ามรวม/ลบทิ้งอันใดอันหนึ่งโดยไม่ได้ตั้งใจ

## 8. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `supabase/migrations/20260813100000_orcid_oauth_and_ocr.sql` | `orcid_oauth_states`/`orcid_oauth_tokens`, `authors.profile_id` unique index, `authors.orcid_oauth_verified_at`, grant `select, update` บน `authors` ให้ service_role |
| `lib/orcid/orcid-oauth.server.ts` | ตรวจการตั้งค่า, สร้าง authorize URL, แลก code เป็น token |
| `lib/orcid/orcid-state.server.ts` | สร้าง/ใช้ CSRF state แบบใช้ครั้งเดียว |
| `lib/orcid/orcid-tokens.server.ts` | เก็บ token ลง `orcid_oauth_tokens` |
| `lib/validation/orcid.ts` | ตรวจรูปแบบ/checksum (ใช้ทั้งกรอกเองและค่าจาก OAuth) |
| `app/account/orcid-actions.ts` | `startOrcidConnectAction` — เริ่ม flow |
| `app/api/orcid/callback/route.ts` | callback endpoint — แลก token, บันทึกผล |
| `lib/data/orcid-profile.server.ts` | อ่านสถานะ ORCID ของผู้ใช้ปัจจุบันสำหรับหน้า `/account` |
| `components/account/OrcidConnect.tsx` | ปุ่ม/สถานะที่หน้า `/account` (4 สถานะ) |
| `app/dashboard/authors/actions.ts` (`linkAuthorProfileAction`/`unlinkAuthorProfileAction`) | ผูก/ถอดผูก `profiles` กับ `authors` (เจ้าหน้าที่เท่านั้น) |
| `components/dashboard/AuthorSidebarActions.tsx` (`LinkProfilePanel`, `OrcidPanel`, `OrcidApiCheckPanel`) | UI ผูกบัญชี + แสดงสถานะยืนยันทั้งสองแบบ + ผลตรวจสอบ ORCID Public API ที่หน้าจัดการผู้วิจัย |
| `lib/orcid/orcid-public-api.server.ts` (ช่วงที่ 27) | Client Credentials token + เรียก `/v3.0/{orcid}/person` แบบอ่านอย่างเดียว |
| `app/dashboard/authors/actions.ts` (`checkOrcidPublicApiAction`, ช่วงที่ 27) | เรียก lookup, cache ผล, บันทึก audit log — เขียนได้แค่คอลัมน์ cache เท่านั้น |
