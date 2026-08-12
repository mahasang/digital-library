# ระบบธีม (Light / Dark / System)

**เพิ่มใน:** Hallmark Audit Phase 5 — Dark Mode and Accessibility Close-out (2026-08)

เอกสารนี้อธิบายสถาปัตยกรรมของระบบสลับธีมทั้งเว็บ สำหรับทีมที่จะดูแล/ต่อยอดโค้ดต่อไป — ไม่ใช่คู่มือผู้ใช้ปลายทาง

---

## 1. ภาพรวม

เว็บรองรับ 3 สถานะธีม:

- **Light** — ค่าสี light palette เดิมของเว็บ (Phase 0)
- **Dark** — ค่าสีมืดใหม่ทั้งหมด (Phase 5)
- **System** — ตาม `prefers-color-scheme` ของ OS/เบราว์เซอร์ผู้ใช้ (ค่าเริ่มต้น)

ผู้ใช้สลับธีมได้จาก `ThemeToggle` ใน Header (เดสก์ท็อป + เมนูมือถือ) ค่าที่เลือกจะถูกจำไว้ใน `localStorage` (key `theme`) และมีผลทันทีในทุกแท็บ/ทุกครั้งที่กลับมาเปิดเว็บ โดยไม่ขึ้นกับการล็อกอิน (ไม่มี profile preference สำหรับธีมในระบบนี้)

## 2. กลไกหลัก: `next-themes`

ใช้ไลบรารี [`next-themes`](https://github.com/pacocoursey/next-themes) แทนการเขียนเอง เพราะจัดการปัญหา hydration mismatch (ธีมที่เซิร์ฟเวอร์ไม่รู้ค่า แต่ต้อง render ให้ตรงกับ client ในรอบแรกเป๊ะ) ให้อัตโนมัติผ่านสคริปต์ inline ที่รันก่อน React hydrate

- `components/layout/ThemeProvider.tsx` — wrapper บาง ๆ รอบ `next-themes`'s `ThemeProvider`
  - `attribute="data-theme"` — **ไม่ใช้ค่าเริ่มต้นของไลบรารี (`class`)** เพราะ token system เดิมของโปรเจกต์ (Phase 0) ใช้ selector `[data-theme="dark"]` อยู่แล้ว การตั้งค่านี้ทำให้ next-themes ต่อเข้ากับ CSS ที่มีอยู่แล้วโดยไม่ต้องแก้ CSS selector ใดๆ
  - `defaultTheme="system"` — ผู้ใช้ใหม่ที่ยังไม่เคยเลือกจะได้ธีมตาม OS
  - `enableSystem` — เปิดใช้ตัวเลือก "System" ในกลไกของไลบรารี
- ต่อเข้าที่ `app/layout.tsx` ครอบ `<body>` ทั้งหมด (skip-link, Header, main, Footer, IdleLogout) — ทุกหน้าที่ผ่าน root layout จึงมีธีมพร้อมใช้เสมอ ไม่ต้องเซ็ตอัพเพิ่มต่อหน้า
- `<html suppressHydrationWarning>` และ `<body suppressHydrationWarning>` (มีอยู่แล้วตั้งแต่ Phase 0) — จำเป็นเพราะ next-themes เซ็ต `data-theme` ผ่าน JS ตรงๆ ไม่ผ่าน React เลย React จึงไม่มีทางรู้ค่าที่ถูกต้องตอน server-render และจะเตือน mismatch ถ้าไม่ปิดไว้ (เป็น mismatch ที่ตั้งใจและปลอดภัย เพราะ React ไม่ได้เป็นเจ้าของ attribute นี้)

## 3. CSS token system (3-state pattern)

ทุกกลุ่ม token ใน `app/globals.css` ใช้ pattern เดียวกันทั้งไฟล์ — สำคัญมากที่จะรักษารูปแบบนี้เวลาเพิ่ม token ใหม่:

```css
:root {
  /* ค่า Light — ค่าเริ่มต้น */
  --color-background: #f6f7fb;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Fallback ระดับ OS — ใช้เมื่อผู้ใช้ยังไม่เคยเลือกอะไรเอง (ธีม "System"
       และ OS เป็น dark) ถูก guard ด้วย :not([data-theme="light"]) เพื่อให้
       การเลือก "Light" แบบชัดเจนของผู้ใช้ชนะค่า OS เสมอ */
    --color-background: #0b1220;
  }
}

:root[data-theme="dark"] {
  /* Override ชัดเจน — next-themes เซ็ต data-theme="dark" ตรงนี้เมื่อผู้ใช้
     กด "Dark" เอง (ไม่ว่า OS จะเป็นอะไร) ต้องซ้ำค่าเดียวกับบล็อกข้างบนเสมอ
     ทั้งสองบล็อกควรมีค่าตรงกันทุกประการ — มีสองบล็อกเพราะคนละเงื่อนไข ไม่ใช่
     คนละค่า */
  --color-background: #0b1220;
}
```

**เมื่อเพิ่ม token สีใหม่ ต้องเติมครบทั้ง 3 บล็อกเสมอ** (light `:root`, media-query dark, `[data-theme="dark"]`) มิฉะนั้นธีม System-dark หรือธีม explicit-dark อย่างใดอย่างหนึ่งจะไม่ได้ค่าที่ตั้งใจไว้

### กลุ่ม token ที่มีอยู่

- **Semantic tokens** (Phase 0, เสร็จสมบูรณ์ใน Phase 5): `--color-background`, `--color-surface`, `--color-surface-muted`, `--color-surface-translucent`, `--color-border`, `--color-border-strong`, `--color-ink` (+ `-soft`/`-faint`), `--color-accent` (+ `-strong`/`-soft`/`-soft-hover`/`-ink`), `--color-success/-warning/-danger/-info`, `--color-focus-ring`, `--shadow-sm/-md`
- **Tailwind stock palette remap** (ใหม่ทั้งหมดใน Phase 5): `--gray-50..900`, `--red-*`, `--green-*`, `--amber-*`, `--blue-*`, `--purple-*` — ดูหัวข้อ 4
- **`.cover-tone-N`** (ปกงานวิจัยที่ไม่มีรูป, 8 เฉดสี) — ธีมของตัวเองมาตั้งแต่ Phase 1/2 ตอนนี้ผ่าน pattern เดียวกันครบแล้ว
- **`color-scheme`** — ดูหัวข้อ 6

## 4. ทำไม `bg-gray-500`, `text-red-600` ฯลฯ ถึงกลายเป็นธีมอัตโนมัติ

โจทย์: โค้ดหลาย phase ก่อนหน้าเขียน Tailwind stock color อยู่ทั่วทั้งแอป (`bg-gray-50`, `text-red-600`, `border-green-200` ฯลฯ) เป็นร้อยๆ จุด การไล่แก้เป็น `dark:` variant ทีละจุดจะเสี่ยงตกหล่นสูงและดูแลยาก

**วิธีแก้ที่เลือก:** รีแมป key สีเดิมของ Tailwind (`gray`, `red`, `green`, `amber`, `blue`, `purple`) ใน `tailwind.config.ts` ให้ชี้ไปที่ CSS variable แทนค่า hex ตรงๆ:

```ts
// tailwind.config.ts
const shade = (name: string) =>
  Object.fromEntries([50,100,...,900].map((n) => [n, `var(--${name}-${n})`]));

colors: {
  gray: shade("gray"),   // gray.50 = var(--gray-50), ...
  red: shade("red"),
  // ...
}
```

ค่า **light** ของแต่ละ `--gray-N` ฯลฯ ใน `globals.css` เท่ากับค่า default จริงของ Tailwind เป๊ะ (ตรวจสอบด้วย `require('tailwindcss/colors')`) — แปลว่า **โหมด Light ไม่เปลี่ยนรูปลักษณ์แม้แต่พิกเซลเดียว** ส่วนค่า **dark** เป็นเฉดใหม่ที่เขียนขึ้นเอง (ไม่ใช่การกลับค่าสีตรงๆ — ปรับให้อ่านง่ายบนพื้นเข้ม)

ผลคือ `bg-gray-50`, `text-red-600`, `border-green-200` ที่เขียนไว้แล้วในทุก Phase ก่อนหน้า (ประมาณ 90 ไฟล์) **กลายเป็นธีมอัตโนมัติโดยไม่ต้องแก้โค้ดคอมโพเนนต์แม้แต่บรรทัดเดียว**

`brand` (สี identity ของแบรนด์ #185ff2 เป็นต้น) และ `background/surface/border/ink/accent/...` (semantic tokens) **ไม่ถูกรีแมปด้วยกลไกนี้** — คงเป็นค่าคงที่ตามที่ตั้งใจ (ดูหัวข้อ 5 สำหรับกรณีที่ `brand-*` ถูกใช้ผิดบทบาท)

## 5. `accent-soft` / `accent-soft-hover` / `accent-ink`

ระหว่างตรวจสอบพบว่าโค้ดก่อน Phase 5 ใช้ `bg-brand-50` + `text-brand-700` เป็น "การ์ดสีอ่อนของแบรนด์" (active nav state, badge, ปุ่มรอง, กล่องข้อมูลสำคัญ) ในกว่า 25 จุด — เพราะ `brand-*` ไม่ถูกรีแมป (โดยตั้งใจ, ดูหัวข้อ 4) รูปแบบนี้เลยกลายเป็นกล่องสีฟ้าอ่อนที่ค้างอยู่แบบเดิมกลางหน้าจอมืด

แก้ด้วยการสวอปไปใช้ semantic tokens ที่มีอยู่แล้วจาก Phase 0 (`--color-accent-soft` / `--color-accent-ink`) ซึ่งออกแบบมาให้เป็น "กล่อง/ป้ายสีเน้นที่อ่านง่าย" ในทั้งสองธีมอยู่แล้ว และเพิ่ม `--color-accent-soft-hover` ใหม่สำหรับ hover state ของรูปแบบนี้โดยเฉพาะ — `bg-brand-50` → `bg-accent-soft`, คู่ข้อความ `text-brand-700/900` → `text-accent-ink`, `hover:bg-brand-100` → `hover:bg-accent-soft-hover`

**กติกาสำหรับโค้ดใหม่:** ถ้าต้องการ "กล่อง/ป้ายสีเน้นของแบรนด์ที่ต้องอ่านออกทั้งสองธีม" ให้ใช้ `bg-accent-soft text-accent-ink` เสมอ **อย่าใช้ `bg-brand-50` ตรงๆ** (เป็นค่าคงที่ ไม่ปรับตามธีม)

## 6. `color-scheme` — form control ของเบราว์เซอร์เอง

Native form control บางชนิด (`<input type="date">`, scrollbar, checkbox/radio เริ่มต้นของเบราว์เซอร์) **ไม่ได้อ่าน `data-theme` ของเรา** — มันตาม CSS property `color-scheme` ของเบราว์เซอร์เท่านั้น ถ้าไม่ประกาศ property นี้ เบราว์เซอร์จะเดาตาม OS preference เอง ซึ่งอาจไม่ตรงกับธีมที่ผู้ใช้เลือกในแอป (เช่น ผู้ใช้เลือก "Dark" ในแอปแต่ OS เป็น light → date picker จะยังเป็น light chrome ทั้งที่หน้าเว็บมืด หรือกลับกัน)

`globals.css` จึงประกาศ `color-scheme` คู่กับทุกบล็อกธีมเดียวกัน (`light` ใน `:root`, `dark` ในทั้งบล็อก media-query และ `[data-theme="dark"]`) ทำให้ native chrome ของฟอร์มตรงกับธีมของแอปเสมอ

**ข้อควรระวังเวลาเพิ่ม input ใหม่:** เมื่อ `color-scheme: dark` ทำงาน เบราว์เซอร์ (Chromium) จะใช้พื้นหลังเข้มของตัวเอง (ค่าคงที่ประมาณ `#3b3b3b` ไม่ใช่ token ของเรา) สำหรับ `<input type="date">` — ถ้า input นั้นไม่มีสี text ชัดเจน จะ inherit สีจาก ancestor ซึ่งอาจไม่พอ contrast กับพื้นเข้มคงที่นี้ (พบเป็นบั๊กจริงระหว่างตรวจสอบ — ดู `docs/accessibility-audit.md`) **ให้ใส่ `text-gray-900` ตรงๆ บน input วันที่ทุกตัวเสมอ** แทนการพึ่งการ inherit สี

## 7. `ThemeToggle`

`components/layout/ThemeToggle.tsx` — ปุ่มสลับ 3 สถานะ (Light/Dark/System) ใช้ `useTheme()` จาก next-themes ตรงๆ **ไม่มี state ของตัวเองซ้ำซ้อน** จึงวางซ้ำได้หลายจุดพร้อมกัน (Header เดสก์ท็อป + เมนูมือถือ) โดยค่า sync กันเองเสมอผ่าน context ของ next-themes

ใช้ `mounted` flag (`useEffect` ตั้ง `true` หลัง mount) ก่อนแสดงสถานะ active จริง — ป้องกัน hydration mismatch เพราะเซิร์ฟเวอร์ไม่รู้ค่าที่ผู้ใช้ตั้งไว้ใน `localStorage`

แต่ละปุ่มมี `aria-pressed`, `aria-label`, `title` ของตัวเอง และห่อด้วย `role="group"` พร้อม `aria-label` รวม — คีย์บอร์ดกด Tab ไล่ทีละปุ่มได้ปกติ (ไม่ใช่ radio-group แบบ arrow-key เพราะเป็นปุ่มอิสระ 3 ปุ่ม ไม่ใช่ radiogroup จริง)

## 8. กรณีพิเศษ: PDF reader (`FlipbookViewer`)

Reader shell (กรอบ/แถบเครื่องมือรอบตัวอ่าน PDF) มีระบบสลับธีมของตัวเองแยกต่างหาก ผ่าน `data-reader-theme` บน `.reader-shell` (คนละ attribute กับ `data-theme` ของทั้งเว็บ) — **เป็นการตัดสินใจตั้งใจตั้งแต่ Phase 2** เพราะผู้อ่านอาจต้องการโหมดอ่านที่ต่างจากธีมทั้งเว็บ (เช่น อ่าน PDF โหมดมืดตอนกลางคืนแม้เว็บทั้งหมดตั้งเป็น Light) **หน้ากระดาษ PDF จริงเองยังคงพื้นขาวเสมอไม่ว่าจะสลับโหมดไหน** — ไม่ใช่ส่วนหนึ่งของ UI ที่เปลี่ยนสีไปมา เพราะต้องดูเป็นเอกสารจริง ไม่มีการแตะ logic การ render PDF (react-pdf) เลยในทั้ง Phase 5

สิ่งที่ Phase 5 เพิ่ม: ค่าเริ่มต้นของ reader theme (ก่อนหน้านี้ hardcode เป็น `"dark"` เสมอ) ตอนนี้ sync จากธีมของทั้งเว็บครั้งเดียวหลัง mount (`useTheme()`'s `resolvedTheme`) เพื่อให้ประสบการณ์แรกสอดคล้องกับธีมที่ผู้ใช้เลือกไว้แล้ว — จากนั้นปุ่มสลับในตัว reader เองยังคงเป็นอิสระจากธีมเว็บทันทีที่ผู้อ่านกดสลับเอง (ไม่ถูกเขียนทับซ้ำ)

## 9. Chart (Recharts)

Recharts render เป็น SVG โดยตรง (`stroke`, `fill` เป็น presentation attribute) ซึ่ง **ไม่ resolve CSS custom property ผ่าน `var()` ได้แน่นอนในทุกกรณี** ต่างจาก DOM element ที่ผูกกับ class ปกติ — `components/superadmin/OverviewCharts.tsx` จึงคำนวณค่าสี explicit เป็น JS ผ่าน `useTheme()`'s `resolvedTheme` แทนการใส่ Tailwind class ตรงๆ บน element ของ Recharts (ดู `useChartColors()` ในไฟล์เดียวกัน)

## 10. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `app/globals.css` | นิยาม token ทั้งหมด (3-state pattern), `color-scheme`, `prefers-reduced-motion` |
| `tailwind.config.ts` | รีแมป Tailwind palette → CSS var, `darkMode: ["selector", '[data-theme="dark"]']` |
| `components/layout/ThemeProvider.tsx` | ต่อ next-themes เข้ากับ `data-theme` attribute |
| `components/layout/ThemeToggle.tsx` | ปุ่มสลับธีม 3 สถานะ |
| `app/layout.tsx` | ครอบ `ThemeProvider` รอบทั้งแอป |
| `components/superadmin/OverviewCharts.tsx` | ตัวอย่างการทำสี SVG/Recharts ให้ตอบสนองธีม |
