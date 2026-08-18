# PWA Phase 2 — Offline Fallback Page + App Icon จริง

## Context

ต่อเนื่องจาก PWA Phase 1 ที่เสร็จแล้ว:
- `@ducanh2912/next-pwa@^10.2.9` ติดตั้งและ config แล้วใน `next.config.ts`
- `public/manifest.webmanifest` มีอยู่แล้ว (`start_url: "/th/"`, `scope: "/"`)
- Icons ปัจจุบันเป็น placeholder SVG ตัว "E" สีน้ำเงิน
- URL structure: `app/[locale]/` รองรับ `/th/`, `/en/`, `/lo/`, `/vi/`
- `app/not-found.tsx` มีอยู่แล้วที่ root (ไม่อยู่ใน `[locale]`)
- Auth: Supabase cookie-based, MFA aal2 สำหรับ `/superadmin/*`
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope — ทำเฉพาะสิ่งต่อไปนี้เท่านั้น

1. สร้าง offline fallback page (`public/offline.html`)
2. ลงทะเบียน fallback ใน SW config (`next.config.ts`)
3. ออกแบบ App Icon ใหม่ที่สวยขึ้น (SVG, ยังไม่ต้อง PNG)
4. รัน lint + tsc + test + build แล้วรายงานผล

## ห้ามทำ (Out of Scope)

- ห้ามแตะ RLS, middleware auth logic, signed URL, MFA flow
- ห้ามแตะ `app/api/` ทุกไฟล์
- ห้ามแตะ i18n messages หรือ translation logic
- ห้ามแตะ Supabase client, server actions, database schema
- ห้ามแตะ runtimeCaching rules ที่ตั้งไว้ใน Phase 1 (อย่าลบหรือเปลี่ยน)
- ห้าม deploy หรือเปลี่ยน production config

---

## Step 1 — ตรวจไฟล์ก่อนทำ

```bash
# ดูโครงสร้าง public/
ls public/
ls public/icons/

# ดู next.config.ts ทั้งหมด (โดยเฉพาะ withPWA config)
cat next.config.ts

# ดู app/not-found.tsx เพื่อเข้าใจ design pattern
cat app/not-found.tsx

# ดู app/globals.css เพื่อรู้ color scheme / font
cat app/globals.css | head -60

# ดู manifest เพื่อยืนยัน theme_color
cat public/manifest.webmanifest
```

รายงานสิ่งที่พบ (โดยเฉพาะ color scheme และ font ที่ใช้) ก่อนดำเนินการต่อ

---

## Step 2 — Offline Fallback Page

สร้าง `public/offline.html` เป็น static HTML ที่ไม่พึ่ง JavaScript ใดๆ
เพราะ SW จะ serve ไฟล์นี้เมื่อผู้ใช้ออฟไลน์และไม่มี cached version ของหน้าที่ขอ

**ข้อกำหนดของหน้า:**
- ไม่มี `<script>` ใดๆ (เพราะอาจ fetch fail ขณะออฟไลน์)
- ไม่มี external CSS หรือ font (ใช้ system font stack แทน)
- แสดงข้อความ 4 ภาษา (ไทย, อังกฤษ, ลาว, เวียดนาม) เพราะ offline จะไม่รู้ locale ผู้ใช้
- มีปุ่ม "ลองใหม่" ที่ทำงานด้วย inline onclick `window.location.reload()`
- Responsive (ทำงานบนมือถือ)
- รองรับ dark mode ผ่าน `prefers-color-scheme`

**เนื้อหาที่ต้องมี:**

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</title>
  <style>
    /* ใช้ system font stack เพราะไม่มี network */
    :root {
      --bg: #ffffff;
      --fg: #111827;
      --muted: #6b7280;
      --accent: #1D4ED8;
      --border: #e5e7eb;
      --btn-bg: #1D4ED8;
      --btn-fg: #ffffff;
      --btn-hover: #1e40af;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111827;
        --fg: #f9fafb;
        --muted: #9ca3af;
        --accent: #60a5fa;
        --border: #374151;
        --btn-bg: #2563eb;
        --btn-fg: #ffffff;
        --btn-hover: #1d4ed8;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                   "Noto Sans Thai", "Noto Sans Lao", sans-serif;
      background: var(--bg);
      color: var(--fg);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      color: var(--muted);
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      line-height: 1.3;
    }
    .subtitle {
      color: var(--muted);
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    .divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.25rem 0;
    }
    .lang-block {
      margin-bottom: 0.75rem;
    }
    .lang-block .lang-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--fg);
      margin-bottom: 0.2rem;
    }
    .lang-block .lang-sub {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .btn {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.75rem 2rem;
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }
    .btn:hover { background: var(--btn-hover); }
  </style>
</head>
<body>
  <div class="card">
    <!-- Wifi-off icon (inline SVG ไม่ต้องโหลดจากภายนอก) -->
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22"/>
      <path d="M8.5 16.5a5 5 0 0 1 7 0"/>
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65"/>
      <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/>
      <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/>
      <path d="M5 12.85A10 10 0 0 1 12 10c.5 0 1 .05 1.5.14"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>

    <h1>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
    <p class="subtitle">
      กรุณาตรวจสอบการเชื่อมต่อเครือข่ายของคุณแล้วลองใหม่อีกครั้ง
    </p>

    <hr class="divider" />

    <div class="lang-block">
      <div class="lang-title">No Internet Connection</div>
      <div class="lang-sub">Please check your network connection and try again.</div>
    </div>

    <div class="lang-block">
      <div class="lang-title">ບໍ່ມີການເຊື່ອມຕໍ່ອິນເຕີເນັດ</div>
      <div class="lang-sub">ກະລຸນາກວດສອບການເຊື່ອມຕໍ່ເຄືອຂ່າຍຂອງທ່ານແລ້ວລອງໃໝ່ອີກຄັ້ງ</div>
    </div>

    <div class="lang-block">
      <div class="lang-title">Không có kết nối Internet</div>
      <div class="lang-sub">Vui lòng kiểm tra kết nối mạng và thử lại.</div>
    </div>

    <button class="btn" onclick="window.location.reload()">
      ลองใหม่ / Retry
    </button>
  </div>
</body>
</html>
```

---

## Step 3 — ลงทะเบียน Offline Fallback ใน SW Config

เปิด `next.config.ts` แล้วเพิ่ม `fallbacks` ใน `withPWAInit({})`:

```typescript
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    // เมื่อออฟไลน์และไม่มี cached version → serve offline.html แทน
    document: "/offline.html",
  },
  workboxOptions: {
    // ... runtimeCaching เดิมจาก Phase 1 ทั้งหมด — อย่าแตะ ...
  },
});
```

**สำคัญ:** อย่าเปลี่ยน runtimeCaching rules ที่มีอยู่ ให้เพิ่มแค่ `fallbacks` property ใหม่

---

## Step 4 — ออกแบบ App Icon ใหม่

แทนที่ placeholder SVG ตัว "E" ด้วย icon ที่สื่อความหมายมากขึ้น
ใช้ธีมสีน้ำเงิน `#1D4ED8` เหมือนเดิม (สอดคล้องกับ manifest `theme_color`)

**แนวคิด:** หนังสือเปิด (open book) บนพื้นสี่เหลี่ยมมนเหลี่ยม — สื่อถึง digital library โดยตรง

**`public/icons/icon-192.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <!-- พื้นหลัง -->
  <rect width="192" height="192" rx="32" fill="#1D4ED8"/>
  <!-- หนังสือเปิด — หน้าซ้าย -->
  <path d="M40 60 C40 56 44 54 48 56 L90 72 L90 140 L48 124 C44 122 40 120 40 116 Z"
        fill="white" opacity="0.95"/>
  <!-- หนังสือเปิด — หน้าขวา -->
  <path d="M152 60 C152 56 148 54 144 56 L102 72 L102 140 L144 124 C148 122 152 120 152 116 Z"
        fill="white" opacity="0.85"/>
  <!-- สันกลาง -->
  <rect x="89" y="68" width="14" height="74" rx="3" fill="white" opacity="0.6"/>
  <!-- เส้นบรรทัดหน้าซ้าย -->
  <line x1="55" y1="88" x2="82" y2="94" stroke="#1D4ED8" stroke-width="3.5"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="55" y1="100" x2="82" y2="106" stroke="#1D4ED8" stroke-width="3.5"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="55" y1="112" x2="82" y2="118" stroke="#1D4ED8" stroke-width="3.5"
        stroke-linecap="round" opacity="0.4"/>
  <!-- เส้นบรรทัดหน้าขวา -->
  <line x1="137" y1="88" x2="110" y2="94" stroke="#1D4ED8" stroke-width="3.5"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="137" y1="100" x2="110" y2="106" stroke="#1D4ED8" stroke-width="3.5"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="137" y1="112" x2="110" y2="118" stroke="#1D4ED8" stroke-width="3.5"
        stroke-linecap="round" opacity="0.4"/>
</svg>
```

**`public/icons/icon-512.svg`** — ขยาย viewBox เป็น 512×512 โดยคูณทุกค่าด้วย `512/192 ≈ 2.667`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="85" fill="#1D4ED8"/>
  <path d="M107 160 C107 149 117 144 128 149 L240 192 L240 373 L128 331 C117 326 107 320 107 309 Z"
        fill="white" opacity="0.95"/>
  <path d="M405 160 C405 149 395 144 384 149 L272 192 L272 373 L384 331 C395 326 405 320 405 309 Z"
        fill="white" opacity="0.85"/>
  <rect x="237" y="181" width="37" height="197" rx="8" fill="white" opacity="0.6"/>
  <line x1="147" y1="235" x2="219" y2="251" stroke="#1D4ED8" stroke-width="9"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="147" y1="267" x2="219" y2="283" stroke="#1D4ED8" stroke-width="9"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="147" y1="299" x2="219" y2="315" stroke="#1D4ED8" stroke-width="9"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="365" y1="235" x2="293" y2="251" stroke="#1D4ED8" stroke-width="9"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="365" y1="267" x2="293" y2="283" stroke="#1D4ED8" stroke-width="9"
        stroke-linecap="round" opacity="0.4"/>
  <line x1="365" y1="299" x2="293" y2="315" stroke="#1D4ED8" stroke-width="9"
        stroke-linecap="round" opacity="0.4"/>
</svg>
```

---

## Step 5 — เพิ่ม offline.html เข้า middleware exclusion

เปิด `middleware.ts` แล้วเพิ่ม `offline.html` เข้าใน matcher exclusion
(เหมือนที่ทำกับ `manifest.webmanifest` และ `sw.js` ใน Phase 1)

ให้ตรวจ matcher pattern ปัจจุบันก่อนแล้วเพิ่ม `/offline.html` เข้าไป

---

## Step 6 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build

# ตรวจว่า offline.html ถูก serve ได้
npm run start &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/offline.html
# ต้องได้ 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/manifest.webmanifest
# ต้องยังได้ 200 (regression check)
```

หยุด server (Windows):
```powershell
Stop-Process -Name "node" -Force
```

---

## รายงานผลที่ต้องการ

1. ผล `cat next.config.ts` จาก Step 1 (ยืนยัน config เดิมยังครบ)
2. ไฟล์ที่สร้างใหม่และไฟล์ที่แก้ไข
3. ผล tsc / lint / test / build
4. HTTP status ของ `/offline.html` และ `/manifest.webmanifest`
5. ปัญหาที่พบ (ถ้ามี) + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| `fallbacks.document` ผิด path → offline ยังเห็น browser error | ทดสอบ curl `/offline.html` ได้ 200 |
| แก้ `workboxOptions` แล้วลบ runtimeCaching เดิมโดยไม่ตั้งใจ | อ่าน config เดิมก่อน แล้ว add-only |
| `offline.html` โดน middleware redirect → 307 → ไม่พบ | เพิ่ม exclusion ใน matcher เหมือน Phase 1 |
| Icon SVG ใหม่ render ผิดใน browser เพราะ path คำนวณผิด | ตรวจสอบด้วย curl `/icons/icon-192.svg` ได้ 200 |
