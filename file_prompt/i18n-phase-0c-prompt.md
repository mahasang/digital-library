# i18n Phase 0C — Shared Strings + Public Pages
# Prompt สำหรับ Claude Code / Cursor

## บริบทและ prerequisite

**Phase 0A + 0B ต้องผ่านก่อนทั้งหมด:**
- `npm run lint` → 0 error
- `npx tsc --noEmit` → 0 error
- `npm run test` → ไม่น้อยกว่า baseline
- `npm run test:a11y` → ไม่น้อยกว่า baseline
- `npm run build` → 0 error
- Header แสดงภาษาที่ถูกต้องตาม locale
- LanguageSwitcher สลับภาษาได้และ path คงเดิม

ถ้ายังไม่ผ่าน → หยุดและแจ้งทันที

---

## งานที่ต้องทำ: Phase 0C

แปล string ใน **หน้าสาธารณะ (public pages) และ shared UI** เท่านั้น
ยังไม่แตะ dashboard, superadmin, account (protected pages) — Phase 1 ขึ้นไป

**ขอบเขต Phase 0C:**
1. `common` namespace — UI strings ที่ใช้ร่วมกัน (buttons, labels)
2. `app/[locale]/page.tsx` — หน้าแรก
3. `app/[locale]/research/page.tsx` — หน้าค้นหา
4. `app/[locale]/research/[id]/page.tsx` — หน้ารายละเอียดงานวิจัย
5. `app/[locale]/login/page.tsx` — หน้า login
6. `app/[locale]/register/page.tsx` — หน้าสมัครสมาชิก
7. `app/[locale]/403/page.tsx` — หน้า forbidden
8. `app/not-found.tsx` — หน้า 404

**หน้าที่ยังไม่แตะ (Phase 1+):**
- `/dashboard/` และทุก sub-route
- `/superadmin/` และทุก sub-route
- `/account/`
- `/auth/forgot-password/`, `/auth/reset-password/`
- Component ที่ใช้เฉพาะใน protected pages

---

## ขั้นตอนที่ต้องทำตามลำดับ

### ขั้น 0 — Survey ก่อนเริ่ม

```bash
# อ่านไฟล์ทั้งหมดในขอบเขตก่อน เพื่อรู้ว่ามี string อะไรบ้าง
cat app/\[locale\]/page.tsx
cat app/\[locale\]/research/page.tsx
cat app/\[locale\]/research/\[id\]/page.tsx
cat app/\[locale\]/login/page.tsx
cat app/\[locale\]/register/page.tsx
cat app/\[locale\]/403/page.tsx
cat app/not-found.tsx

# components ที่ใช้ใน public pages เท่านั้น
cat components/home/Hero.tsx
cat components/home/HomeSearchBox.tsx
cat components/home/CategorySection.tsx
cat components/home/ResearchSection.tsx

# ตรวจ messages ที่มีอยู่แล้ว
cat messages/th.json
```

จด string ทั้งหมดที่พบและ map ไปยัง key ที่ควรใช้ก่อนเขียนโค้ด

### ขั้น 1 — อัปเดต messages files

**กฎ:** เพิ่ม key ได้ แต่ห้ามลบ key ที่มีอยู่แล้ว

เพิ่ม keys ที่พบระหว่าง survey ลงใน:
- `messages/th.json` — ภาษาไทย (ต้นฉบับจริง)
- `messages/en.json` — ภาษาอังกฤษ (แปลจริง)
- `messages/lo.json` — ลาว (copy จาก th.json = placeholder)

**Keys ที่ควรมีแล้วจาก Phase 0A (ตรวจสอบว่ายังอยู่):**
```
common.*, header.*, nav.*, home.*, research.*, auth.*, errors.*
```

**เพิ่มเติมที่อาจพบใน public pages:**
```json
{
  "researchDetail": {
    "author": "ผู้วิจัย",
    "authors": "ผู้วิจัย",
    "publishedDate": "วันที่เผยแพร่",
    "category": "หมวดหมู่",
    "organization": "หน่วยงาน",
    "abstract": "บทคัดย่อ",
    "keywords": "คำสำคัญ",
    "accessLevel": "ระดับการเข้าถึง",
    "downloadPdf": "ดาวน์โหลด PDF",
    "readOnline": "อ่านออนไลน์",
    "requestAccess": "ขอสิทธิ์เข้าถึง",
    "addToFavorites": "เพิ่มในรายการโปรด",
    "removeFromFavorites": "ลบออกจากรายการโปรด",
    "backToList": "กลับไปรายการ",
    "relatedResearch": "งานวิจัยที่เกี่ยวข้อง",
    "noAbstract": "ไม่มีบทคัดย่อ"
  },
  "accessLevel": {
    "public": "สาธารณะ",
    "member": "สมาชิก",
    "restricted": "จำกัดการเข้าถึง",
    "private": "ส่วนตัว"
  },
  "footer": {
    "copyright": "สงวนลิขสิทธิ์",
    "contact": "ติดต่อ",
    "about": "เกี่ยวกับ"
  }
}
```

เพิ่มเฉพาะ key ที่พบจริงจาก survey เท่านั้น อย่าเพิ่ม key ที่ไม่ได้ใช้

### ขั้น 2 — แปล Public Pages (ทีละไฟล์)

**กฎทั่วไปสำหรับทุกไฟล์:**

Server Component (async):
```tsx
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('home');  // หรือ namespace ที่เหมาะสม
  return <h1>{t('title')}</h1>;
}
```

Client Component:
```tsx
'use client';
import { useTranslations } from 'next-intl';

export function SomeComponent() {
  const t = useTranslations('home');
  return <h1>{t('title')}</h1>;
}
```

**ลำดับการแปล:**

#### 2.1 `app/[locale]/page.tsx` (หน้าแรก)
- แปล string ในหน้าและ components ย่อย: Hero, HomeSearchBox, CategorySection, ResearchSection
- ตรวจ props ที่ส่งลง component ว่ามี string hardcode หรือไม่
- ถ้า component ย่อยเป็น Server Component → ใช้ `getTranslations` เอง
- ถ้าเป็น Client Component → รับ string เป็น prop หรือเรียก `useTranslations` เอง

#### 2.2 `app/[locale]/research/page.tsx` (หน้าค้นหา)
- แปล title, subtitle, placeholder, sort labels, filter labels
- `FilterBar`, `ResearchExplorer` อาจมี string ภายใน → แปลด้วย

#### 2.3 `app/[locale]/research/[id]/page.tsx` (หน้ารายละเอียด)
- แปล label ต่างๆ: ผู้วิจัย, วันที่, หมวดหมู่, หน่วยงาน, บทคัดย่อ, คำสำคัญ
- **ห้ามแปล dynamic content** (ชื่องานวิจัย, ชื่อผู้วิจัย, เนื้อหาบทคัดย่อ จาก database — ข้อมูลเหล่านี้ไม่ได้แปล)
- AccessBadge, StatusBadge อาจมี hardcode labels

#### 2.4 `app/[locale]/login/page.tsx`
- แปล labels, button text, link text
- ห้ามแก้ form validation logic หรือ action

#### 2.5 `app/[locale]/register/page.tsx`
- แปล labels, button text, link text
- ห้ามแก้ form validation logic หรือ action

#### 2.6 `app/[locale]/403/page.tsx`
- แปล error message, back button

#### 2.7 `app/not-found.tsx`
- หน้า 404 อยู่ที่ root ไม่ได้อยู่ใน `[locale]`
- ถ้าใช้ `useTranslations` จะไม่มี locale context → ให้ใช้ string ไทยคงเดิม หรือสร้าง `app/[locale]/not-found.tsx` แยกต่างหาก
- แนะนำ: สร้าง `app/[locale]/not-found.tsx` ใหม่ที่ใช้ translation ได้ และคง root `app/not-found.tsx` ไว้เป็น fallback ภาษาไทย

### ขั้น 3 — ตรวจ metadata (SEO)

ถ้ามี `generateMetadata()` ใน pages ที่แปล:

```tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}
```

### ขั้น 4 — รัน checks

```bash
rm -rf .next

npx tsc --noEmit
npm run lint
npm run test
npm run test:a11y
npm run build
```

**Manual smoke test:**
```bash
npm run dev

# หน้าแรก
# /th/    → ภาษาไทยครบ
# /en/    → ภาษาอังกฤษครบ
# /lo/    → ภาษาไทย (placeholder โอเค)

# หน้าค้นหา
# /th/research → ภาษาไทย
# /en/research → ภาษาอังกฤษ

# หน้ารายละเอียด
# /th/research/[slug] → label ไทย, ชื่องานวิจัย = ข้อมูลจาก DB (ไม่แปล)
# /en/research/[slug] → label อังกฤษ, ชื่องานวิจัย = ข้อมูลจาก DB (ไม่แปล)

# สลับภาษาที่ /th/research/[slug] → ไป /en/research/[slug] (slug เดิม)
```

---

## เกณฑ์ความสำเร็จ Phase 0C

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → ไม่น้อยกว่า baseline
- [ ] `npm run test:a11y` → ไม่น้อยกว่า baseline
- [ ] `npm run build` → 0 error
- [ ] `/th/` `/en/` `/lo/` แสดง content ตาม locale (lo = placeholder ไทย)
- [ ] `/th/research` `/en/research` แสดง UI text ตาม locale
- [ ] ชื่องานวิจัย/ชื่อผู้วิจัย/เนื้อหาจาก database ไม่ถูกแปล (แสดงข้อมูลเดิม)
- [ ] Metadata title/description เปลี่ยนตาม locale ใน pages ที่มี generateMetadata
- [ ] Protected pages (`/dashboard`, `/superadmin`, `/account`) ยังทำงานปกติ ไม่ broken
- [ ] Auth flow (login, register, logout) ยังทำงานปกติ
- [ ] ไม่มี string ภาษาไทย hardcode เหลือในไฟล์ที่อยู่ในขอบเขต (ยกเว้น lo.json placeholder)

---

## ไฟล์ที่จะแก้ (คาดการณ์)

| ไฟล์ | การกระทำ | ความเสี่ยง |
|------|----------|-----------|
| `messages/th.json` | เพิ่ม keys ใหม่ | ต่ำ |
| `messages/en.json` | เพิ่ม keys ใหม่ | ต่ำ |
| `messages/lo.json` | เพิ่ม keys (placeholder) | ต่ำ |
| `app/[locale]/page.tsx` | แปล string | ต่ำ |
| `components/home/Hero.tsx` | แปล string | ต่ำ |
| `components/home/HomeSearchBox.tsx` | แปล string | ต่ำ |
| `components/home/CategorySection.tsx` | แปล string | ต่ำ |
| `components/home/ResearchSection.tsx` | แปล string | ต่ำ |
| `app/[locale]/research/page.tsx` | แปล string | ต่ำ |
| `components/research/FilterBar.tsx` | แปล string | กลาง |
| `app/[locale]/research/[id]/page.tsx` | แปล label (ไม่แปล content DB) | กลาง |
| `components/research/AccessBadge.tsx` | แปล access level labels | ต่ำ |
| `app/[locale]/login/page.tsx` | แปล string | ต่ำ |
| `app/[locale]/register/page.tsx` | แปล string | ต่ำ |
| `app/[locale]/403/page.tsx` | แปล string | ต่ำ |
| `app/[locale]/not-found.tsx` | สร้างใหม่ (locale-aware) | ต่ำ |

**ห้ามแตะ:**
- `middleware.ts`
- `lib/supabase/` ทุกไฟล์
- `app/[locale]/dashboard/` ทุกไฟล์
- `app/[locale]/superadmin/` ทุกไฟล์
- `app/[locale]/account/` ทุกไฟล์
- Server Actions (`actions.ts`) ทุกไฟล์
- Supabase queries และ data layer

---

## ข้อควรระวังพิเศษ

1. **Dynamic content จาก database ไม่แปล** — ชื่องานวิจัย บทคัดย่อ ชื่อผู้วิจัย
   หมวดหมู่ ล้วนเป็นข้อมูลที่เจ้าของกรอกเข้ามา ไม่ใช่ UI string แปลเฉพาะ **label**
   เช่น "ผู้วิจัย:", "วันที่เผยแพร่:", "หมวดหมู่:" เท่านั้น

2. **Component ที่ใช้ร่วมกันระหว่าง public และ protected pages** เช่น `ResearchCard`
   ให้แปลได้ แต่ต้องทดสอบว่า protected pages ที่ใช้ component เดียวกันยังทำงานได้

3. **`useTranslations` ใช้ได้เฉพาะใน `NextIntlClientProvider` context** — ถ้า
   component render นอก `[locale]/layout.tsx` จะ error ตรวจสอบก่อนเสมอ

4. **ถ้า test จำนวนลดลง** → หยุดและ report ทันที ห้าม merge

5. **ถ้า component มีความซับซ้อนมาก** (เช่น ResearchExplorer ที่มี Client-side
   filtering ซับซ้อน) → แปล label ง่ายๆ ก่อน ส่วนที่ไม่แน่ใจ skip ไว้ก่อนและ
   บันทึกเป็น TODO เพื่อทำใน Phase 1

---

## สรุปภาพรวม Phase 0 ทั้งหมด

```
Phase 0A ✅ Infrastructure — next-intl setup, [locale] routing, messages files
Phase 0B ✅ Header + LanguageSwitcher — สลับภาษาได้จาก Header
Phase 0C 🔄 Public pages — แปล UI string ในหน้าสาธารณะ
─────────────────────────────────────────────────────
Phase 1  ⏳ Protected pages — dashboard, account (หลัง Phase 0C ผ่าน)
Phase 2  ⏳ Super Admin pages — superadmin/* (หลัง Phase 1 ผ่าน)
Phase 3  ⏳ lo.json translation — แปลจริงจากภาษาไทย → ลาว
```
