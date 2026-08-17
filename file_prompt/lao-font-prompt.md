# เพิ่ม Noto Serif Lao font สำหรับ locale ลาว
# Prompt สำหรับ Claude Code / Cursor

## วัตถุประสงค์

เพิ่ม `Noto Serif Lao` จาก Google Fonts สำหรับ locale `lo` เท่านั้น
ภาษาไทยและอังกฤษยังใช้ `Noto Sans Thai` เหมือนเดิมทุกประการ

---

## ขั้น 0 — Inspect ก่อน

```bash
cat app/layout.tsx
cat app/globals.css | head -80
```

---

## ขั้น 1 — แก้ไข app/layout.tsx

**อ่านไฟล์จริงก่อน** แล้วแก้ 3 จุด:

### 1.1 เพิ่ม import
```ts
// เดิม
import { Noto_Sans_Thai } from "next/font/google";

// ใหม่
import { Noto_Sans_Thai, Noto_Serif_Lao } from "next/font/google";
```

### 1.2 เพิ่ม font config (ต่อจาก notoSansThai)
```ts
const notoSerifLao = Noto_Serif_Lao({
  subsets: ["lao"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-lao",
  display: "swap",
});
```

### 1.3 เพิ่ม CSS variable ใน className บน html element
```tsx
// เดิม
<html lang={locale} className={notoSansThai.variable} suppressHydrationWarning>

// ใหม่
<html
  lang={locale}
  className={`${notoSansThai.variable} ${notoSerifLao.variable}`}
  suppressHydrationWarning
>
```

---

## ขั้น 2 — แก้ไข app/globals.css

เพิ่ม rule ต่อไปนี้หลัง `:root { ... }` block:

```css
/* Noto Serif Lao — ใช้เฉพาะ locale ลาว (/lo/*) เท่านั้น */
:lang(lo) {
  font-family: var(--font-noto-lao), ui-serif, serif;
}
```

`:lang(lo)` จะ override font เฉพาะเมื่อ `<html lang="lo">` เท่านั้น
ไม่กระทบ `/th/` และ `/en/` แม้แต่บรรทัดเดียว

---

## ขั้น 3 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```

**Manual smoke test:**
```bash
npm run dev
# /lo/ → font ควรเปลี่ยนเป็น Noto Serif Lao (serif, มี serifs ที่ปลาย stroke)
# /th/ → font ยังเป็น Noto Sans Thai เหมือนเดิม (ไม่มี serifs)
# /en/ → font ยังเป็น Noto Sans Thai เหมือนเดิม
```

ตรวจใน browser DevTools:
- เปิด `/lo/` → Inspect element → Computed → font-family
- ควรเห็น `Noto Serif Lao` อยู่ต้นรายการ

---

## เกณฑ์ความสำเร็จ

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run build` → 0 error
- [ ] `/lo/` → ใช้ Noto Serif Lao
- [ ] `/th/` → ยังใช้ Noto Sans Thai (ไม่เปลี่ยน)
- [ ] `/en/` → ยังใช้ Noto Sans Thai (ไม่เปลี่ยน)

---

## ข้อห้าม

- ห้ามแตะ `tailwind.config.ts` — fontFamily ยังใช้ `--font-noto-thai` เหมือนเดิม
- ห้ามแตะ `[locale]/layout.tsx`
- ห้ามแตะ component ใดๆ
- แก้เฉพาะ `app/layout.tsx` และ `app/globals.css` เท่านั้น
ENDOFFILE