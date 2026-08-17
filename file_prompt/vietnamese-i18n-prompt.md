# เพิ่มภาษาเวียดนาม (vi) เป็นภาษาที่ 4
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม

- ระบบมี 3 ภาษา: th, en, lo
- `i18n/routing.ts` มี `locales: ['th', 'en', 'lo']`
- `messages/th.json`, `messages/en.json`, `messages/lo.json` มีอยู่แล้ว
- `components/layout/SettingsDropdown.tsx` หรือ `LanguageSwitcher.tsx` มีอยู่แล้ว

---

## ขั้น 0 — Inspect ก่อน

```bash
cat i18n/routing.ts
cat messages/en.json
cat components/layout/SettingsDropdown.tsx 2>/dev/null || cat components/layout/LanguageSwitcher.tsx
grep -rn "th.*en.*lo\|locales\|LOCALE_LABELS\|LOCALE_FLAGS" \
  i18n/ components/layout/ --include="*.ts" --include="*.tsx"
```

---

## ขั้น 1 — อัปเดต i18n/routing.ts

```ts
// เดิม
locales: ['th', 'en', 'lo'] as const,

// ใหม่
locales: ['th', 'en', 'lo', 'vi'] as const,
```

---

## ขั้น 2 — สร้าง messages/vi.json

สร้างไฟล์ใหม่ `messages/vi.json` โดย copy structure จาก `messages/en.json`
แล้วแปลทุก value เป็นภาษาเวียดนาม

**ไฟล์ vi.json ที่แปลแล้ว (เนื้อหาด้านล่าง):**

```json
PLACEHOLDER_VI_JSON
```

*(Claude Code จะใช้ไฟล์ที่แนบมาพร้อม prompt นี้)*

---

## ขั้น 3 — อัปเดต SettingsDropdown.tsx (หรือ LanguageSwitcher.tsx)

**อ่านไฟล์จริงก่อน** แล้วเพิ่ม `vi` ใน:

```ts
const LOCALE_LABELS: Record<string, string> = {
  th: 'ไทย',
  en: 'EN',
  lo: 'ລາວ',
  vi: 'VI',   // เพิ่ม
};

const LOCALE_FLAGS: Record<string, string> = {
  th: '🇹🇭',
  en: '🇬🇧',
  lo: '🇱🇦',
  vi: '🇻🇳',  // เพิ่ม
};
```

ถ้า dropdown แสดงชื่อภาษาแบบ full name ให้ใช้ `"Tiếng Việt"` แทน `"VI"`

---

## ขั้น 4 — อัปเดต messages ทุกภาษา

เพิ่ม key `"vi"` ใน namespace `"nav"` ของทุกไฟล์:

**th.json:**
```json
"vi": "เวียดนาม"
```

**en.json:**
```json
"vi": "Tiếng Việt"
```

**lo.json:**
```json
"vi": "ພາສາຫວຽດນາມ"
```

**vi.json:**
```json
"vi": "Tiếng Việt"
```

---

## ขั้น 5 — อัปเดต e2e tests (ถ้ามี hardcode locale list)

```bash
grep -rn "th.*en.*lo\|'th'\|\"th\"" e2e/ --include="*.ts" | grep -v "//\|#"
```

ถ้าพบ locale array hardcode → เพิ่ม `'vi'` ด้วย
ถ้าพบ path `/th/` แบบ hardcode ในชุด test ที่ test ทุก locale → เพิ่ม `/vi/`

---

## ขั้น 6 — ตรวจ middleware.ts

```bash
grep -n "th\|en\|lo\|locale" middleware.ts | head -20
```

ถ้ามี locale list hardcode ใน middleware → เพิ่ม `'vi'`
ปกติ next-intl middleware อ่านจาก `routing.ts` อัตโนมัติ ไม่ต้องแก้เพิ่ม

---

## ขั้น 7 — รัน checks

```bash
rm -rf .next
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

**Manual smoke test:**
```bash
npm run dev
# /vi/         → หน้าแรกภาษาเวียดนาม
# /vi/research → หน้าค้นหาภาษาเวียดนาม
# /vi/login    → หน้า login ภาษาเวียดนาม
# SettingsDropdown → เห็น 🇻🇳 Tiếng Việt เป็นตัวเลือก
# สลับจาก /th/research → VI → /vi/research (path คงเดิม)
# /            → redirect ไป /th/ (default locale ยังเป็น th)
```

---

## เกณฑ์ความสำเร็จ

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → ไม่น้อยกว่าเดิม
- [ ] `npm run build` → 0 error ไม่มี MISSING_MESSAGE สำหรับ vi
- [ ] `/vi/` โหลดได้และแสดงภาษาเวียดนาม
- [ ] SettingsDropdown แสดง 🇻🇳 เป็นตัวเลือกที่ 4
- [ ] สลับภาษาแล้ว path + query string คงเดิม
- [ ] `/th/`, `/en/`, `/lo/` ยังทำงานปกติ (ไม่ regression)

---

## ข้อห้าม

- ห้ามเปลี่ยน defaultLocale (ยังเป็น 'th')
- ห้ามแตะ auth, middleware auth logic, RLS
- ห้ามแตะ messages/th.json, en.json, lo.json โดยไม่จำเป็น (แค่เพิ่ม key "vi" ใน nav namespace)
- ถ้า test ลดลง → หยุดทันที
