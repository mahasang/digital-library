# i18n Cleanup Pass — Locale-aware Navigation (ก่อน Phase 1)
# Prompt สำหรับ Claude Code / Cursor

## สถานะก่อนเริ่ม (Phase 0A + 0B + 0C เสร็จแล้ว)

- `npm run lint` → 0 error
- `npm run test` → 127/127
- `npm run test:a11y` → 50/50
- `npm run build` → 0 error
- `i18n/navigation.ts` มี Link, useRouter, usePathname, redirect (createNavigation wrapper)
- Public pages แปลครบแล้ว

ถ้า checks ยังไม่ผ่านครบ → หยุดและแจ้งทันที

---

## วัตถุประสงค์

ปิด technical debt ที่สะสมจาก Phase 0B + 0C — เปลี่ยน `next/link` และ
`next/navigation` ที่เหลือใน 3 ไฟล์ ให้เป็น locale-aware navigation จาก
`@/i18n/navigation` เพื่อให้ navigation สม่ำเสมอทั้งระบบก่อนเริ่ม Phase 1

**เป้าหมาย:** ไม่มีการเปลี่ยนพฤติกรรมที่ผู้ใช้เห็น — เป็นการทำให้ locale
prefix ถูกต้องตั้งแต่ตอน render แทนที่จะพึ่ง middleware redirect (self-heal)

---

## สิ่งที่พบจาก inspect จริง

### components/ui/Button.tsx
- `LinkButton` ใช้ `import Link from "next/link"` ภายใน
- **shared primitive — ใช้ทั่วทั้งระบบ** รวม dashboard/superadmin/account ที่ยังไม่ i18n
- รับ `href: string` (type กว้าง)
- `Button` (ปุ่มธรรมดา) ไม่ใช้ Link — ไม่ต้องแตะ

### components/layout/UserMenu.tsx
- Client Component ("use client")
- `import Link from "next/link"` — workspace links + `/account` link
- string hardcode `"โปรไฟล์ของฉัน"` 2 จุด (ปุ่ม trigger + link ใน dropdown)
- workspaceLinks รับ `label` เป็น prop อยู่แล้ว (ไม่ต้องแปลใน component นี้)

### components/home/HomeSearchBox.tsx
- Client Component ("use client")
- `import { useRouter } from "next/navigation"` + `router.push('/research...')`
- string แปลแล้ว (Phase 0C) เหลือแค่ router

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Inspect + ตรวจการใช้งาน LinkButton

```bash
cat components/ui/Button.tsx
cat components/layout/UserMenu.tsx
cat components/home/HomeSearchBox.tsx
cat i18n/navigation.ts

# ตรวจว่า LinkButton ถูกใช้ที่ไหนบ้าง และ href แบบไหน (static vs dynamic)
grep -rn "LinkButton" app/ components/ --include="*.tsx" | grep -v "Button.tsx"

# ตรวจว่ามี href แบบ dynamic/template ที่อาจทำให้ next-intl type error
grep -rn 'LinkButton' app/ components/ --include="*.tsx" -A 2 | grep 'href='
```

**สำคัญ:** ถ้า LinkButton ถูกเรียกด้วย `href={dynamicVariable}` หรือ template string
จำนวนมาก → next-intl Link อาจ type error เพราะ type เข้มกว่า ให้ประเมินก่อนตัดสินใจ

### ขั้น 1 — components/ui/Button.tsx (LinkButton)

**ทางเลือกที่ปลอดภัยที่สุด** — เปลี่ยน import เป็น next-intl Link:

```tsx
// เดิม
import Link from "next/link";

// ใหม่
import { Link } from "@/i18n/navigation";
```

**ตรวจ type compatibility:**
- next-intl `Link` รับ `href` ที่อาจเป็น string หรือ object
- ถ้า `href: string` ใน LinkButton props ยังใช้ได้กับ next-intl Link → เปลี่ยนได้เลย
- ถ้า TypeScript error เรื่อง href type:
  - ตัวเลือก A: cast type ที่ LinkButton (`href={href as any}` — ไม่แนะนำ)
  - ตัวเลือก B: เปลี่ยน `href: string` เป็น type ที่ next-intl ยอมรับ
  - ตัวเลือก C: **ถ้า type error เยอะเกินไปในหน้าที่ยังไม่ i18n → หยุดและรายงาน** อาจเก็บ LinkButton ไว้ทำใน Phase 1 พร้อมหน้าที่ใช้มัน

**หลังเปลี่ยน — ต้อง build ผ่านทุกหน้า** เพราะ LinkButton ใช้กว้าง
ถ้า build fail ในหน้า dashboard/superadmin → ประเมินว่าคุ้มที่จะแก้ตอนนี้หรือ defer

### ขั้น 2 — components/layout/UserMenu.tsx

**2.1 เปลี่ยน Link import:**
```tsx
// เดิม
import Link from "next/link";

// ใหม่
import { Link } from "@/i18n/navigation";
```

**2.2 แปล string hardcode "โปรไฟล์ของฉัน":**

UserMenu เป็น Client Component — ใช้ `useTranslations`:
```tsx
import { useTranslations } from 'next-intl';

export default function UserMenu({ user, workspaceLinks }) {
  const t = useTranslations('header');
  const [open, setOpen] = useState(false);

  // ปุ่ม trigger:
  // {user.fullName || user.email || "โปรไฟล์ของฉัน"}
  // →
  // {user.fullName || user.email || t('myProfile')}

  // link ใน dropdown (Settings icon):
  // โปรไฟล์ของฉัน
  // →
  // {t('myProfile')}
}
```

**หมายเหตุ:** `workspaceLinks` `label` มาจาก props (สร้างจาก HeaderAccountArea)
ไม่ต้องแปลใน UserMenu — label ยังเป็น string เดิม (workspace-links.ts จะแปลใน Phase 1)

### ขั้น 3 — components/home/HomeSearchBox.tsx

เปลี่ยน useRouter จาก next-intl:
```tsx
// เดิม
import { useRouter } from "next/navigation";

// ใหม่
import { useRouter } from "@/i18n/navigation";
```

`router.push('/research?...')` — next-intl router จะเพิ่ม locale prefix ให้อัตโนมัติ
handleSubmit logic ไม่ต้องเปลี่ยน:
```tsx
function handleSubmit(e: FormEvent) {
  e.preventDefault();
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  router.push(`/research${params.toString() ? `?${params.toString()}` : ""}`);
}
```

**ตรวจ:** next-intl `router.push` รับ string ได้ แต่ถ้า type error เรื่อง query string
ให้เปลี่ยนเป็น object form:
```tsx
router.push({
  pathname: '/research',
  query: query.trim() ? { q: query.trim() } : {}
});
```

### ขั้น 4 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
```

**Manual smoke test:**
```bash
npm run dev

# UserMenu desktop dropdown
# /th/ → login → คลิก user menu → workspace links ชี้ /th/favorites ฯลฯ
# /en/ → login → workspace links ชี้ /en/favorites
# "โปรไฟล์ของฉัน" แสดงถูก locale

# HomeSearchBox
# /th/ → พิมพ์ค้นหา → submit → ไป /th/research?q=xxx
# /en/ → submit → ไป /en/research?q=xxx

# LinkButton (ถ้าเปลี่ยนสำเร็จ)
# /th/403 → ปุ่ม "กลับหน้าแรก" ชี้ /th/
# /en/403 → ปุ่ม ชี้ /en/
```

---

## เกณฑ์ความสำเร็จ

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] `npm run test:a11y` → 50/50
- [ ] UserMenu desktop workspace links มี locale prefix ตอน render (ไม่พึ่ง redirect)
- [ ] HomeSearchBox submit ไปหน้า research ที่มี locale prefix ถูกต้อง
- [ ] "โปรไฟล์ของฉัน" ใน UserMenu แปลตาม locale
- [ ] ถ้า LinkButton เปลี่ยนสำเร็จ → 403 buttons มี locale prefix
- [ ] ไม่มีการเปลี่ยนพฤติกรรมที่ผู้ใช้เห็น (นอกจาก URL ที่ถูกต้องขึ้น)

---

## ข้อห้าม

- ห้ามแตะ `lib/auth/workspace-links.ts` labels — Phase 1
- ห้ามแตะ page content ใน dashboard/superadmin/account — Phase 1+
- ห้ามเปลี่ยน `Button` (ปุ่มธรรมดา) — แค่ `LinkButton`
- ห้ามเปลี่ยน dynamic import ใน LogoutButton (ที่ UserMenu เรียกใช้)
- ห้ามแตะ `middleware.ts`, `lib/supabase/`
- ถ้า test จำนวนลดลง → หยุดทันที

---

## ความเสี่ยงที่ต้องระวัง

1. **LinkButton เป็น shared primitive** — ใช้ในหน้าที่ยังไม่ i18n จำนวนมาก
   ถ้าเปลี่ยนแล้ว build fail เพราะ type/href ในหน้าเหล่านั้น → **หยุดและรายงาน**
   ก่อนพยายามแก้ทุกหน้า อาจ defer LinkButton ไป Phase 1 พร้อมหน้าที่ใช้มัน

2. **next-intl Link type เข้มกว่า next/link** — `href` ต้องเป็น known pathname
   ถ้ามีการใช้ dynamic href มาก → พิจารณา type strategy ก่อน

3. **HomeSearchBox query string** — ถ้า `router.push(string)` type error
   ใช้ object form `{ pathname, query }` แทน

4. **Port 3001 ค้าง** — ก่อน test:a11y ตรวจก่อนเสมอ
   PowerShell: `Stop-Process -Id $(Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force`

5. **UserMenu ทำให้ e2e อาจต้องอัปเดต** — ถ้า e2e เช็ค desktop UserMenu href
   แบบ bare path เหมือนที่เกิดกับ mobile ใน Phase 0B → อาจต้องอัปเดต assertion
   ตรวจ `e2e/header-roles.spec.ts` ว่าเช็ค desktop workspace link href หรือไม่

---

## หมายเหตุสำคัญ

ถ้าขั้นที่ 1 (LinkButton) พบว่า type error เยอะเกินไปในหน้าที่ยังไม่ i18n:
- **ทำขั้น 2 (UserMenu) และ 3 (HomeSearchBox) ให้เสร็จก่อน** — สองอันนี้ scope แคบ ความเสี่ยงต่ำ
- **defer LinkButton** ไป Phase 1 พร้อมหน้า dashboard/superadmin/account
- รายงานเหตุผลชัดเจนว่าทำไม defer

การทำ 2 ใน 3 สำเร็จยังถือว่าคุ้ม — ปิด debt ที่แก้ได้ง่ายก่อน
