# PWA Phase 3 — PNG Icons + Apple Touch Icon + theme_color fix

## Context

ต่อเนื่องจาก PWA Phase 1+2:
- `public/icons/icon-192.svg` และ `icon-512.svg` เป็น open-book design สีน้ำเงิน
- `public/manifest.webmanifest` ใช้ SVG icons อยู่, `theme_color: "#1D4ED8"`, `start_url: "/lo/"`, `lang: "lo"`
- `app/layout.tsx` มี metadata manifest อยู่แล้ว
- `app/globals.css` มี `--color-accent: #185ff2` (สีจริงของแอป)
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope

1. แปลง SVG → PNG 192×192, 512×512, และ apple-touch-icon 180×180
2. อัปเดต `manifest.webmanifest` ให้ใช้ PNG และแก้ `theme_color: "#185ff2"`
3. เพิ่ม `apple-touch-icon` ใน `app/layout.tsx`
4. รัน lint + tsc + test + build

## ห้ามทำ (Out of Scope)

- ห้ามแตะ RLS, middleware, signed URL, MFA, `app/api/`
- ห้ามแตะ i18n messages หรือ translation logic
- ห้ามแตะ Supabase client, server actions, database schema
- ห้ามแตะ `public/sw.js`, `public/offline.html`
- ห้าม deploy หรือเปลี่ยน production config

---

## Step 1 — ตรวจไฟล์ก่อนทำ

```bash
ls -la public/icons/
cat public/manifest.webmanifest
grep -n "metadata\|icons\|apple\|manifest\|viewport\|themeColor" app/layout.tsx | head -20
node -e "require('sharp')" 2>/dev/null && echo "sharp: OK" || echo "sharp: not found"
```

รายงานสิ่งที่พบก่อนดำเนินการต่อ

---

## Step 2 — แปลง SVG → PNG

เลือกวิธีตามผล Step 1:

### วิธี A — ถ้า sharp มีอยู่แล้ว (แนะนำ):

```bash
node -e "
const sharp = require('sharp');
const fs = require('fs');
async function convert() {
  const svg192 = fs.readFileSync('public/icons/icon-192.svg');
  const svg512 = fs.readFileSync('public/icons/icon-512.svg');
  await sharp(svg192).resize(192,192).png().toFile('public/icons/icon-192.png');
  await sharp(svg512).resize(512,512).png().toFile('public/icons/icon-512.png');
  await sharp(svg192).resize(180,180).png().toFile('public/icons/apple-touch-icon.png');
  console.log('Done: icon-192.png, icon-512.png, apple-touch-icon.png');
}
convert().catch(console.error);
"
```

### วิธี B — ติดตั้ง sharp แล้วใช้:

```bash
npm install --save-dev sharp
# แล้วรัน script จากวิธี A
```

### วิธี C — ใช้ Playwright (มีอยู่แล้วในโปรเจกต์):

สร้าง `scripts/generate-icons.mjs`:

```js
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const makePage = (size) => `
<html><body style="margin:0;padding:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#185ff2"/>
  <path d="M40 60 C40 56 44 54 48 56 L90 72 L90 140 L48 124 C44 122 40 120 40 116 Z"
        fill="white" opacity="0.95"/>
  <path d="M152 60 C152 56 148 54 144 56 L102 72 L102 140 L144 124 C148 122 152 120 152 116 Z"
        fill="white" opacity="0.85"/>
  <rect x="89" y="68" width="14" height="74" rx="3" fill="white" opacity="0.6"/>
  <line x1="55" y1="88" x2="82" y2="94" stroke="#185ff2" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
  <line x1="55" y1="100" x2="82" y2="106" stroke="#185ff2" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
  <line x1="55" y1="112" x2="82" y2="118" stroke="#185ff2" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
  <line x1="137" y1="88" x2="110" y2="94" stroke="#185ff2" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
  <line x1="137" y1="100" x2="110" y2="106" stroke="#185ff2" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
  <line x1="137" y1="112" x2="110" y2="118" stroke="#185ff2" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
</svg>
</body></html>`;

const browser = await chromium.launch();
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(makePage(size));
  await page.waitForTimeout(300);
  const buf = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: size, height: size }
  });
  writeFileSync(`public/icons/${name}.png`, buf);
  console.log(`Generated ${name}.png (${buf.length} bytes)`);
  await page.close();
}
await browser.close();
```

```bash
node scripts/generate-icons.mjs
```

**เลือกวิธีที่เหมาะกับสภาพแวดล้อม ตรวจ Step 1 ก่อนเสมอ**

---

## Step 3 — ตรวจ PNG ที่ได้

```bash
node -e "
const fs = require('fs');
['icon-192.png','icon-512.png','apple-touch-icon.png'].forEach(f => {
  try {
    const s = fs.statSync('public/icons/'+f).size;
    console.log(f+': '+s+' bytes '+(s>1000?'OK':'ERROR - too small'));
  } catch(e) { console.log(f+': NOT FOUND'); }
});
"
```

ถ้าไฟล์ใดได้ขนาด < 1000 bytes หรือไม่พบ ให้หยุดและรายงานก่อนดำเนินการต่อ

---

## Step 4 — อัปเดต public/manifest.webmanifest

แทนที่เนื้อหาทั้งหมดด้วย:

```json
{
  "name": "ຫ້ອງສະໝຸດດິຈິຕອນເພື່ອເຜີຍແຜ່ງານວິໄຈຂອງອົງກອນ",
  "short_name": "ຫ້ອງສະໝຸດ",
  "description": "ລະບົບຫ້ອງສະໝຸດດິຈິຕອນ",
  "start_url": "/lo/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#185ff2",
  "lang": "lo",
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

**สำคัญ:** `start_url` และ `lang` ต้องเป็น `lo` เสมอ (defaultLocale เปลี่ยนเป็น lo แล้ว)

---

## Step 5 — เพิ่ม apple-touch-icon ใน app/layout.tsx

ตรวจโครงสร้างจริงก่อน:
```bash
sed -n '1,50p' app/layout.tsx
```

**ถ้ามี `export const metadata: Metadata`** — เพิ่ม/อัปเดต fields เหล่านี้:

```typescript
export const metadata: Metadata = {
  // ... fields เดิมทั้งหมด ...
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ຫ້ອງສະໝຸດ",
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

**ถ้ามี `export const viewport: Viewport`** — อัปเดต themeColor:

```typescript
export const viewport: Viewport = {
  // ... fields เดิม ...
  themeColor: "#185ff2",
};
```

ถ้ายังไม่มี viewport export ให้เพิ่มใหม่ และ import `Viewport` จาก `next`:
```typescript
import type { Metadata, Viewport } from "next";
```

---

## Step 6 — ตรวจ .gitignore

```bash
grep -n "png\|icon" .gitignore
```

PNG icons ต้อง commit เข้า repo ถ้ามี pattern ที่ exclude ออกให้ลบ

---

## Step 7 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build

# ตรวจ HTTP หลัง build
npm run start &
sleep 5
curl -s -o /dev/null -w "icon-192.png: %{http_code}\n" http://localhost:3001/icons/icon-192.png
curl -s -o /dev/null -w "icon-512.png: %{http_code}\n" http://localhost:3001/icons/icon-512.png
curl -s -o /dev/null -w "apple-touch-icon.png: %{http_code}\n" http://localhost:3001/icons/apple-touch-icon.png
curl -s -o /dev/null -w "manifest: %{http_code}\n" http://localhost:3001/manifest.webmanifest
# ทุกค่าต้องเป็น 200
```

หยุด server:
```powershell
Stop-Process -Name "node" -Force
```

---

## รายงานผลที่ต้องการ

1. วิธีที่เลือกแปลง SVG→PNG และขนาดไฟล์ที่ได้ (bytes)
2. ไฟล์ที่สร้างใหม่และไฟล์ที่แก้ไข
3. ผล tsc / lint / test / build
4. HTTP status ของ icons ทั้ง 3 และ manifest
5. ปัญหาที่พบ + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| PNG เป็น 0 bytes หรือ corrupt | ตรวจขนาดใน Step 3 ก่อนดำเนินการต่อ |
| sharp ไม่รองรับ Windows arm64 | ใช้วิธี C (Playwright) แทน |
| `theme_color` ไม่อัปเดตใน browser | Unregister SW + Clear cache ก่อนทดสอบ |
| `apple-touch-icon` ไม่แสดงบน iOS | ต้องเป็น PNG ไม่ใช่ SVG และ link ใน `<head>` |
| manifest `start_url` กลับเป็น `/th/` | ตรวจให้แน่ใจว่าเป็น `/lo/` ตาม defaultLocale ใหม่ |
