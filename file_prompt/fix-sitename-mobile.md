# Fix: Site name hidden on mobile — Phase 0 (inspect + fix)

## ปัญหา
ชื่อเว็บไซต์ (siteName) ไม่ปรากฏบน Header ขณะดูผ่านมือถือ

## Phase 0 — Inspect (อย่าเปลี่ยนโค้ดก่อน)

อ่านไฟล์เหล่านี้ก่อนทั้งหมด:

```
components/layout/Header.tsx          ← ทั้งไฟล์
app/[locale]/layout.tsx               ← ดู siteName prop ที่ส่งลงมา
```

ระหว่างอ่าน ให้ตอบคำถามเหล่านี้:

1. **โครงสร้าง mobile header flex container** คืออะไร?
   - `<header>` มี class อะไร?
   - ส่วนที่แสดงโลโก้ + siteName มี class อะไร? (โดยเฉพาะ `min-w-0`, `truncate`, `overflow-hidden`, `flex-shrink`, `hidden`, `sm:block` หรือ responsive class อื่นๆ)
   - ส่วนขวา (mobileAccountArea + hamburger) มี class อะไร? (โดยเฉพาะ `flex-shrink-0`, `flex-none`, `gap-*`)

2. **siteName text element** — มี class อะไร? มี `hidden sm:block` หรือ `hidden md:block` หรือ responsive ที่ซ่อนบน mobile หรือไม่?

3. **LanguageSwitcher บน mobile** — แสดงกี่ปุ่ม? ใช้พื้นที่กว้างแค่ไหน? (นี่อาจเป็นตัวดัน siteName ออกไป)

4. siteName prop รับมาจาก layout ใน type ไหน (`string | undefined | null`)?

---

## Phase 1 — Fix

หลังจาก inspect แล้ว ให้แก้ไข **เฉพาะ `components/layout/Header.tsx`** ตามสาเหตุที่พบ โดยใช้ guideline ด้านล่าง:

### Guideline การแก้ไข

**เป้าหมาย:** siteName ต้องมองเห็นบนทุก viewport รวม mobile เล็กสุด (320px)

#### กรณีที่ 1 — siteName text มี `hidden sm:block` หรือ responsive ที่ซ่อนบน mobile
→ เปลี่ยนเป็นแสดงเสมอ แต่จำกัดความกว้าง:
```tsx
// แทนที่ class เดิมด้วย:
className="... truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none"
// หรือใช้ text-sm บน mobile แล้ว text-base บน sm:
className="... text-sm sm:text-base font-semibold truncate"
```

#### กรณีที่ 2 — flex container ซ้ายไม่มี `min-w-0` ทำให้ถูก squeeze
→ เพิ่ม `min-w-0` บน flex item ที่ห่อโลโก้+siteName:
```tsx
// container ซ้าย:
<div className="flex items-center gap-2 min-w-0 flex-1">
  {/* logo */}
  <span className="truncate ...">{ siteName }</span>
</div>
// container ขวา: ต้องมี flex-shrink-0 หรือ flex-none
<div className="flex items-center gap-1 flex-shrink-0">
  { mobileAccountArea }
  { /* hamburger */ }
</div>
```

#### กรณีที่ 3 — LanguageSwitcher กินพื้นที่บน mobile มากเกิน
→ ดูว่า LanguageSwitcher บน mobile แสดงข้อความเต็ม ("ภาษาไทย") หรือแค่ตัวย่อ ("TH")
→ ถ้ากินพื้นที่มาก ให้ซ่อน LanguageSwitcher mobile จาก header แถบบน แล้วย้ายไปอยู่ใน mobile menu (hamburger panel) แทน — **แต่ตรวจก่อนว่ามันอยู่ที่ไหนแน่ๆ**

#### กรณีที่ 4 — siteName `undefined`/`null` ใน render
→ ตรวจ fallback: ถ้า siteName เป็น nullish ให้แสดง fallback string เช่น `t('siteName')` จาก next-intl แทน
→ pattern ที่ถูกต้อง (จาก memory): `siteName ?? tHeader("siteName")`

---

## ข้อห้าม
- ห้ามแก้ไขนอก `components/layout/Header.tsx` (และ messages/*.json ถ้าจำเป็นต้องเพิ่ม key)
- ห้ามแตะ RLS, middleware, auth, หรือ layout อื่นๆ
- ห้าม hide LanguageSwitcher บน desktop

---

## หลังแก้ไข — รัน checks

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

รายงานผลและบอกว่าแก้ class อะไรบ้างใน element ไหน
