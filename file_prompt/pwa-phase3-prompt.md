# PWA Phase 3 — PNG Icons + Apple Touch Icon + theme_color fix

## Context

ต่อเนื่องจาก PWA Phase 1+2 ที่เสร็จแล้ว:
- `public/manifest.webmanifest` มีอยู่แล้ว (ใช้ SVG icons ปัจจุบัน)
- `public/icons/icon-192.svg` และ `icon-512.svg` เป็น open-book design สีน้ำเงิน
- `public/sw.js` เป็น custom SW (manual, ไม่ใช้ library)
- `app/layout.tsx` มี metadata manifest และ ServiceWorkerRegister อยู่แล้ว
- `app/globals.css` มี `--color-accent: #185ff2` (สีจริงของแอป)
- `manifest.webmanifest` ใช้ `theme_color: "#1D4ED8"` (ไม่ตรงกับสีจริง — ต้องแก้)
- URL structure: `/th/`, `/en/`, `/lo/`, `/vi/`
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope — ทำเฉพาะสิ่งต่อไปนี้เท่านั้น

1. แปลง SVG icons → PNG ขนาด 192×192 และ 512×512
2. สร้าง apple-touch-icon PNG 180×180
3. อัปเดต `manifest.webmanifest` ให้ใช้ PNG icons
4. เพิ่ม `<link rel="apple-touch-icon">` ใน `app/layout.tsx`
5. แก้ `theme_color` ใน manifest จาก `#1D4ED8` → `#185ff2`
6. รัน lint + tsc + test + build แล้วรายงานผล

## ห้ามทำ (Out of Scope)

- ห้ามแตะ RLS, middleware auth logic, signed URL, MFA flow
- ห้ามแตะ `app/api/` ทุกไฟล์
- ห้ามแตะ i18n messages หรือ translation logic
- ห้ามแตะ Supabase client, server actions, database schema
- ห้ามแตะ `public/sw.js` (custom SW จาก Phase 2)
- ห้ามแตะ `public/offline.html`
- ห้าม deploy หรือเปลี่ยน production config

---

## Step 1 — ตรวจไฟล์ก่อนทำ

```bash
# ดูโครงสร้าง public/icons/
ls -la public/icons/

# ดู manifest ปัจจุบัน
cat public/manifest.webmanifest

# ดู metadata ใน app/layout.tsx
grep -A 20 "metadata" app/layout.tsx | head -30

# ตรวจว่า sharp หรือ canvas มีอยู่ไหม
node -e "require('sharp')" 2>/dev/null && echo "sharp: OK" || echo "sharp: not found"
node -e "require('canvas')" 2>/dev/null && echo "canvas: OK" || echo "canvas: not found"

# ตรวจ Inkscape หรือ rsvg-convert (สำหรับแปลง SVG→PNG)
inkscape --version 2>/dev/null || echo "inkscape: not found"
rsvg-convert --version 2>/dev/null || echo "rsvg-convert: not found"
```

รายงานสิ่งที่พบก่อนดำเนินการต่อ

---

## Step 2 — แปลง SVG → PNG

เลือกวิธีแปลงตามสิ่งที่มีในระบบ ตามลำดับความสำคัญ:

### วิธี A — ใช้ sharp (แนะนำ ถ้ามีอยู่แล้ว)

```bash
node -e "
const sharp = require('sharp');
const fs = require('fs');

// อ่าน SVG แล้วแปลงเป็น PNG
async function convert() {
  const svg192 = fs.readFileSync('public/icons/icon-192.svg');
  const svg512 = fs.readFileSync('public/icons/icon-512.svg');

  await sharp(svg192).resize(192, 192).png().toFile('public/icons/icon-192.png');
  await sharp(svg512).resize(512, 512).png().toFile('public/icons/icon-512.png');
  await sharp(svg192).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');

  console.log('Done: icon-192.png, icon-512.png, apple-touch-icon.png');
}
convert().catch(console.error);
"
```

### วิธี B — ติดตั้ง sharp แล้วใช้ (ถ้ายังไม่มี)

```bash
npm install --save-dev sharp
# แล้วรัน script จาก วิธี A
```

### วิธี C — ใช้ Node.js Canvas API (ถ้า sharp ไม่ทำงาน)

สร้าง `scripts/generate-icons.mjs`:

```javascript
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.17; // border radius

  // พื้นหลังสีน้ำเงิน
  ctx.fillStyle = '#185ff2';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // หนังสือเปิด — หน้าซ้าย
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  const lx = size * 0.21, ly = size * 0.31;
  const lw = size * 0.24, lh = size * 0.42;
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + lw, ly + size * 0.08);
  ctx.lineTo(lx + lw, ly + lh + size * 0.08);
  ctx.lineTo(lx, ly + lh);
  ctx.closePath();
  ctx.fill();

  // หนังสือเปิด — หน้าขวา
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  const rx2 = size * 0.79, ry = size * 0.31;
  ctx.moveTo(rx2, ry);
  ctx.lineTo(rx2 - lw, ry + size * 0.08);
  ctx.lineTo(rx2 - lw, ry + lh + size * 0.08);
  ctx.lineTo(rx2, ry + lh);
  ctx.closePath();
  ctx.fill();

  // สันกลาง
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(size * 0.463, size * 0.354, size * 0.073, size * 0.385);

  return canvas.toBuffer('image/png');
}

writeFileSync('public/icons/icon-192.png', drawIcon(192));
writeFileSync('public/icons/icon-512.png', drawIcon(512));
writeFileSync('public/icons/apple-touch-icon.png', drawIcon(180));
console.log('Icons generated successfully');
```

```bash
npm install --save-dev canvas
node scripts/generate-icons.mjs
```

### วิธี D — สร้างจาก HTML Canvas ผ่าน Playwright (ถ้าทุกอย่างข้างต้นไม่ได้)

```javascript
// scripts/generate-icons.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const html = (size) => `
<html><body style="margin:0;background:transparent">
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const size = ${size}, r = size * 0.17;
ctx.fillStyle = '#185ff2';
ctx.beginPath();
ctx.roundRect(0, 0, size, size, r);
ctx.fill();
// หน้าซ้าย
ctx.fillStyle = 'rgba(255,255,255,0.95)';
ctx.beginPath();
ctx.moveTo(size*.21,size*.31);ctx.lineTo(size*.45,size*.39);
ctx.lineTo(size*.45,size*.73);ctx.lineTo(size*.21,size*.73);ctx.fill();
// หน้าขวา
ctx.fillStyle = 'rgba(255,255,255,0.85)';
ctx.beginPath();
ctx.moveTo(size*.79,size*.31);ctx.lineTo(size*.55,size*.39);
ctx.lineTo(size*.55,size*.73);ctx.lineTo(size*.79,size*.73);ctx.fill();
// สัน
ctx.fillStyle = 'rgba(255,255,255,0.6)';
ctx.fillRect(size*.463,size*.354,size*.073,size*.385);
<\/script></body></html>`;

const browser = await chromium.launch();
for (const size of [192, 512, 180]) {
  const page = await browser.newPage();
  await page.setContent(html(size));
  await page.waitForTimeout(200);
  const buf = await page.locator('canvas').screenshot({ type: 'png' });
  const name = size === 180 ? 'apple-touch-icon' : `icon-${size}`;
  writeFileSync(`public/icons/${name}.png`, buf);
  console.log(`Generated ${name}.png`);
  await page.close();
}
await browser.close();
```

**เลือกวิธีที่เหมาะสมที่สุดกับสภาพแวดล้อม** — ตรวจสอบจาก Step 1 ก่อน

---

## Step 3 — ตรวจ PNG ที่ได้

```bash
ls -la public/icons/*.png
# ต้องมี: icon-192.png, icon-512.png, apple-touch-icon.png

# ตรวจขนาดไฟล์ (ต้องไม่เป็น 0 bytes)
node -e "
const fs = require('fs');
['icon-192.png','icon-512.png','apple-touch-icon.png'].forEach(f => {
  const s = fs.statSync('public/icons/' + f).size;
  console.log(f + ': ' + s + ' bytes ' + (s > 1000 ? 'OK' : 'ERROR - too small'));
});
"
```

---

## Step 4 — อัปเดต manifest.webmanifest

เปิด `public/manifest.webmanifest` แล้วแก้ `icons` array และ `theme_color`:

```json
{
  "name": "ห้องสมุดงานวิจัย",
  "short_name": "Ebooks",
  "description": "ระบบห้องสมุดดิจิทัลและที่เก็บงานวิจัย",
  "start_url": "/th/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#185ff2",
  "lang": "th",
  "dir": "ltr",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["education", "books"]
}
```

**สังเกต:**
- `theme_color` เปลี่ยนจาก `#1D4ED8` → `#185ff2` (ตรงกับ `--color-accent` จริง)
- SVG icons ถูกแทนที่ด้วย PNG ทั้งหมด
- `icon-512.png` ใช้สองครั้ง: `purpose: "any"` และ `purpose: "maskable"`

---

## Step 5 — เพิ่ม apple-touch-icon ใน app/layout.tsx

เปิด `app/layout.tsx` แล้วเพิ่มใน `metadata` export:

```typescript
export const metadata: Metadata = {
  // ... metadata เดิมที่มีอยู่ทั้งหมด ...
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ebooks",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};
```

ถ้า layout ใช้ Viewport export แยก ให้อัปเดต themeColor ด้วย:

```typescript
export const viewport: Viewport = {
  themeColor: "#185ff2",
};
```

**ตรวจโครงสร้าง layout จริงก่อน** แล้วเลือกวิธีที่เหมาะสม

---

## Step 6 — เพิ่ม PNG icons เข้า .gitignore ออก

PNG icons ต้อง commit เข้า repo (ไม่ใช่ generated file):

```bash
# ตรวจว่า .gitignore มี pattern ที่ครอบ PNG ไหม
grep "png\|icons" .gitignore
```

ถ้ามี pattern ที่ exclude PNG icons ออก ให้ลบออก

---

## Step 7 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build

# ตรวจ icons HTTP
npm run start &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/icons/icon-192.png
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/icons/icon-512.png
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/icons/apple-touch-icon.png
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/manifest.webmanifest
# ทุกค่าต้องเป็น 200
```

หยุด server:
```powershell
Stop-Process -Name "node" -Force
```

---

## Step 8 — ตรวจ manifest ใน Chrome DevTools

หลัง build และ start แล้ว:
1. Chrome → `http://localhost:3001/th/`
2. F12 → Application → Manifest
3. ตรวจ:
   - Icons แสดงผลถูกต้อง (ต้องเห็น PNG preview)
   - `theme_color` แสดง `#185ff2`
   - ไม่มี warning เรื่อง icons

---

## รายงานผลที่ต้องการ

1. วิธีที่เลือกในการแปลง SVG → PNG และเหตุผล
2. ขนาดไฟล์ PNG ที่ได้ (bytes)
3. ผล tsc / lint / test / build
4. HTTP status ของ icons ทั้ง 3 ไฟล์
5. ผล Application → Manifest ใน DevTools (screenshot ถ้าทำได้)
6. ปัญหาที่พบ (ถ้ามี) + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| PNG เป็น 0 bytes หรือ corrupt | ตรวจขนาดไฟล์ใน Step 3 ก่อนดำเนินการต่อ |
| sharp ไม่รองรับ Windows path | ใช้ forward slash ใน path เสมอ |
| `maskable` icon มีพื้นที่ safe zone ไม่พอ | icon-512 ใช้สี solid background → ผ่าน maskable ได้ |
| `theme_color` ไม่อัปเดตใน browser เดิม | ต้อง unregister SW + clear cache ก่อนทดสอบ |
| `apple-touch-icon` ไม่แสดงบน iOS | ต้องเป็น PNG ไม่ใช่ SVG และต้อง link ใน `<head>` |
