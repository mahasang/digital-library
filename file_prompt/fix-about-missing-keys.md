# Fix: Missing `about.features.*` translation keys

## ปัญหา
หน้า `/lo/about` (และอาจรวมถึง `/th/about`, `/en/about`) แสดง key ดิบเช่น
`about.features.search.title`, `about.features.readOnline.description` ฯลฯ
แทนที่จะเป็น text จริง

## Phase 0 — Inspect ก่อน (อย่าเปลี่ยนโค้ดยัง)

อ่านไฟล์เหล่านี้ทั้งหมดก่อน:

```
app/[locale]/about/page.tsx
messages/th.json              ← grep หา "about" namespace
messages/en.json              ← grep หา "about" namespace  
messages/lo.json              ← grep หา "about" namespace
```

ตอบคำถามต่อไปนี้:

1. `about/page.tsx` ใช้ `getTranslations('about')` หรือ namespace อะไร?
2. keys ที่ page ใช้มีอะไรบ้าง? (list ทุก key เช่น `about.features.search.title` ฯลฯ)
3. `messages/th.json` มี `"about"` namespace อยู่ไหม? ถ้ามี มี keys อะไรบ้าง?
4. `messages/en.json` มี `"about"` namespace อยู่ไหม?
5. `messages/lo.json` มี `"about"` namespace อยู่ไหม?
6. keys ไหนบ้างที่ขาดอยู่ใน messages files?

---

## Phase 1 — Fix

หลัง inspect แล้ว เพิ่ม keys ที่ขาดลงใน messages files ทั้ง 3 ไฟล์:

### กฎการเพิ่ม keys

**`messages/th.json`** — ใช้ค่าภาษาไทยที่ถูกต้องตามที่หน้า about ควรแสดง

**`messages/en.json`** — แปลเป็นภาษาอังกฤษ

**`messages/lo.json`** — **copy จาก `th.json` ก่อน** (placeholder) เช่นเดียวกับ pattern ที่ทำในทุก phase ก่อนหน้า — จะแปลเป็นลาวจริงใน Phase 3

### ตัวอย่าง structure ที่คาดว่าต้องการ (อิงจาก screenshot)

จาก key ที่เห็นใน screenshot:
```
about.features.search.title
about.features.search.description
about.features.readOnline.title
about.features.readOnline.description
about.features.accessControl.title
about.features.accessControl.description
about.features.reviewProcess.title
about.features.reviewProcess.description
about.features.multiRole.title
about.features.multiRole.description
about.features.stats.title
about.features.stats.description
```

ตรวจสอบ `about/page.tsx` จริงเพื่อดู keys ทั้งหมดที่ใช้ ไม่ใช่แค่ 6 features นี้
— อาจมี keys อื่นเช่น heading, subtitle, pageTitle ด้วย

### ตรวจ keys อื่นใน about page ด้วย

ดู screenshot ที่ 2 ยังเห็น:
- Section "ระดับสิทธิ์ผู้ใช้งาน" — อาจมี `about.accessLevels.*` keys
- Column headers "บัดนาค", "ถำอะเบีย" — ดูว่า keys เหล่านี้ถูกต้องหรือขาดหาย

---

## ข้อห้าม
- ห้ามแก้ไข `app/[locale]/about/page.tsx` (เว้นแต่พบว่า key ใน page เขียนผิด)
- แก้เฉพาะ `messages/th.json`, `messages/en.json`, `messages/lo.json`
- ห้ามแตะ RLS, middleware, auth

---

## หลังแก้ไข — รัน checks

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

ตรวจด้วยว่า build ไม่มี `MISSING_MESSAGE` warning ใหม่ที่ไม่เกี่ยวกับ `lo` locale
(warning ของ `lo` locale ยังยอมรับได้จนกว่าจะถึง Phase 3)

รายงาน:
1. keys ที่เพิ่มลงใน messages files (พร้อม count)
2. ผล lint/tsc/test/build
3. ถ้าพบ keys ขาดอื่นๆ นอกจาก about.features.* ให้ list มาด้วย
