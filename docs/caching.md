# Public Homepage Caching

**เพิ่มใน:** Hallmark — public homepage caching (2026-08). ต่อยอดจาก Hallmark — homepage data-flow optimization (ดู `app/page.tsx`, `lib/data/research.server.ts` สำหรับพื้นฐานการดึงข้อมูลหน้าแรกที่ทำ query ให้แคบ/เรียงลำดับที่ฐานข้อมูลไว้ก่อนแล้ว)

เอกสารนี้อธิบายว่าอะไรถูก cache, cache นานแค่ไหน, และอะไรทำให้ cache ถูกล้างทันที — สำหรับทีมที่จะดูแล/ต่อยอดโค้ดต่อไป

---

## 1. ขอบเขต — cache เฉพาะข้อมูลสาธารณะของหน้าแรกเท่านั้น

| ฟังก์ชันที่ cache | ไฟล์ | ใช้ที่ไหน |
| --- | --- | --- |
| `getPublicHomeSettings()` | `lib/data/settings.server.ts` | `app/page.tsx` (ชื่อเว็บใน Hero, จำนวน "ล่าสุด"/"ยอดนิยม") |
| `getCategories()` | `lib/data/categories.server.ts` | `app/page.tsx`, `app/layout.tsx` (Footer), หน้าอื่นๆ ที่ต้องเลือกหมวดหมู่ |
| `getPublishedResearchStats()` | `lib/data/research.server.ts` | `app/page.tsx` (สถิติ Hero + จำนวนต่อหมวดหมู่) |
| `getLatestResearch(limit)` | `lib/data/research.server.ts` | `app/page.tsx` (งานวิจัยล่าสุด) |
| `getPopularResearch(limit)` | `lib/data/research.server.ts` | `app/page.tsx` (งานวิจัยยอดนิยม) |

**สิ่งที่ไม่ถูก cache เด็ดขาด** (ตามข้อกำหนดของงานนี้): session/identity ผู้ใช้ (`getSessionUser()`), บทบาท/สิทธิ์, การแจ้งเตือน (`getMyNotifications()`), สถานะคำขอเข้าถึงเอกสาร, Signed URL, งานวิจัยระดับ `member_only`/`staff_only`, และ `getSettings()` เต็มรูปแบบ (มีฟิลด์ที่ใช้ตัดสินใจเชิงธุรกิจ เช่น `registrationEnabled` — ดูหัวข้อ 4)

## 2. เครื่องมือที่ใช้ — ทำไมถึงเลือก `unstable_cache`

โปรเจกต์นี้ใช้ **Next.js 15.5.22** (`npm ls next` / `package.json`) — ไม่ใช่ Next.js 16 จึงไม่มี Cache Components (`"use cache"`, `cacheLife`, `cacheTag`) แบบ stable ให้ใช้ (ต้องเปิด `experimental.cacheComponents` ซึ่งเป็นการเปลี่ยนพฤติกรรม build/runtime แบบกว้างและ**ไม่ได้เปิดอยู่ในโปรเจกต์นี้** — ตามข้อกำหนดของงานนี้ ห้ามเปิดเว้นแต่จำเป็นและมีการบันทึกไว้ชัดเจน ซึ่งไม่จำเป็นสำหรับ scope นี้)

ใช้ **`unstable_cache` + `revalidateTag`** (`next/cache`) แทน — เป็น API ที่เสถียร ใช้งานได้ใน Next.js 13+ ทุกเวอร์ชันรวมถึง 15.5.22 ก่อนหน้านี้โปรเจกต์ไม่มีการ cache ข้ามผู้ใช้/ข้าม request เลย (ตรวจสอบแล้ว — ไม่มี `unstable_cache`/`revalidateTag`/`experimental.cacheComponents` ที่ใดในโค้ดเดิม มีแต่ `revalidatePath` ซึ่งเป็นคนละ cache layer กัน — ล้าง Router Cache/Full Route Cache ไม่ใช่ Data Cache ที่ `unstable_cache` ใช้)

## 3. Client สาธารณะที่ไม่ผูก cookies — เงื่อนไขบังคับของการ cache ข้ามผู้ใช้

`lib/supabase/public.ts` — `createPublicClient()` ใช้ Anon key ล้วนๆ ไม่อ่าน cookies ของ request ใดๆ เลย จึงมีพฤติกรรมเหมือนกันทุกครั้งไม่ว่าใครเรียก (มองเห็นเฉพาะแถวที่ role "anon" เห็นได้ตาม RLS เสมอ)

**เหตุผล**: `unstable_cache` เก็บผลลัพธ์ไว้ใช้ซ้ำข้าม request และข้ามผู้ใช้ทุกคน ถ้าใช้ client ที่ผูกกับ cookies ของผู้ใช้คนใดคนหนึ่ง ผลลัพธ์ที่คำนวณจากสิทธิ์ของผู้ใช้คนแรกที่เรียก (ซึ่งอาจมี rank สูงกว่า เห็นข้อมูลมากกว่า) จะถูกนำไปแสดงซ้ำให้ผู้เข้าชมคนอื่นที่ไม่มีสิทธิ์เห็นข้อมูลนั้นจริง — เป็นช่องโหว่ข้อมูลรั่วไหลข้ามผู้ใช้ ฟังก์ชันที่ cache ทั้ง 5 ตัวข้างต้นทุกตัวใช้ client นี้แทน `createClient()` (cookie-bound) เดิม

**ไม่ใช้ `service_role`** — client นี้ยังอยู่ภายใต้ RLS ปกติทุกประการ เพียงแค่เป็นมุมมองของ role "anon" เสมอ

### ⚠️ ผลที่ตามมาที่มองเห็นได้จริง — สำคัญ

ตาม RLS policy `research_items_select` (`supabase/migrations/20260731100200_rls_policies.sql`):
- งานวิจัยเผยแพร่แล้วระดับ `public`/`read_only`/`metadata_only` → ทุกคนเห็น (รวม guest)
- ระดับ `member_only` → ต้อง rank ≥ 10 (member ขึ้นไป)
- ระดับ `staff_only` → ต้อง rank ≥ 20 (staff ขึ้นไป)
- librarian/admin/super_admin (rank ≥ 30) → เห็นทุกระดับ

**ก่อนหน้านี้** (ก่อนงาน caching นี้) ผู้ใช้ที่ login เป็น member/staff/librarian/admin จะเห็นงานวิจัยระดับ `member_only`/`staff_only` ปนอยู่ใน "ล่าสุด"/"ยอดนิยม"/สถิติจำนวนของหน้าแรกด้วย เพราะฟังก์ชันเหล่านี้ใช้ client ที่ผูกกับ session ของผู้ใช้จริง

**ตอนนี้** ทุกคนเห็นชุดข้อมูลเดียวกันเสมอบนหน้าแรก (เฉพาะที่ guest เห็นได้) ไม่ว่าจะ login อยู่หรือมีสิทธิ์สูงแค่ไหนก็ตาม — **นี่คือพฤติกรรมที่ตั้งใจตามข้อกำหนดของงานนี้โดยตรง** ("Never cache ... member-only data, or staff-only data") ไม่ใช่ผลข้างเคียงที่ไม่ได้ตั้งใจ การ cache ผลลัพธ์ที่ขึ้นกับ role ของผู้เรียกแล้วนำไปใช้ซ้ำข้ามผู้ใช้ทุกคนจะเป็นช่องโหว่ข้อมูลรั่วไหลจริง จึงต้อง "ตัดลงมาให้เท่ากับสิ่งที่ผู้เยี่ยมชมทั่วไปเห็น" เสมอสำหรับส่วนที่ cache ได้

หน้ารายละเอียดงานวิจัย (`/research/[id]`, ใช้ `getRelatedResearch()`/`getPublishedResearch()`) และหน้าค้นหา (`/research`) **ไม่ถูกแตะต้อง** ยังคง role-aware เหมือนเดิมทุกประการ — เฉพาะ 5 ฟังก์ชันในหัวข้อ 1 ที่ใช้บนหน้าแรกเท่านั้นที่เปลี่ยน

### ทำไม `getSettings()` เต็มรูปแบบไม่ถูก cache

`getSettings()` ถูกใช้ในเส้นทางตัดสินใจทางธุรกิจจริงหลายจุดที่ต้องการค่าล่าสุดเป๊ะเสมอ เช่น `registrationEnabled`/`captchaEnabled` ใน `app/register/actions.ts`, `submissionEnabled` ใน `app/submit-research/actions.ts`, ค่า rate limit/OCR quota ต่างๆ — ถ้า cache ทั้งฟังก์ชันแล้วมี admin ปิดรับสมัครสมาชิกไป ระบบอาจยังรับสมัครสมาชิกใหม่ต่อได้จนกว่า cache จะหมดอายุ (บั๊กด้านตรรกะธุรกิจจริง ไม่ใช่แค่ข้อมูลหน้าแรกเก่า) จึงแยก `getPublicHomeSettings()` ออกมาต่างหาก cache เฉพาะ 4 ฟิลด์ที่หน้าแรกใช้จริง (`siteName`, `logoUrl`, `homepageLatestCount`, `homepagePopularCount`) ส่วน `getSettings()` เดิมยังคง**ไม่ cache เลย**

`getCategories()` ไม่มีปัญหานี้ — ใช้เพื่อแสดง/เลือกหมวดหมู่เท่านั้นในทุกจุดที่เรียก ไม่มีจุดใดใช้ตัดสินใจเชิงสิทธิ์/ธุรกิจ และ RLS (`categories_select_all` = `using (true)`) ไม่ขึ้นกับ role เลย จึง cache ทั้งฟังก์ชันได้อย่างปลอดภัย (ยังคง React `cache()` แบบ per-request ที่ห่อไว้จาก Hallmark ก่อนหน้าด้วย — ทั้งสองชั้นทำงานร่วมกัน: `cache()` ลดการเรียกซ้ำภายใน request เดียวกัน, `unstable_cache` ลดการ query จริงข้าม request/ผู้ใช้)

`getOrganizations()` (ใช้แสดงจำนวนหน่วยงานใน Hero) **ยังไม่ถูก cache** — ไม่อยู่ในรายการที่ระบุไว้ของงานนี้ ("public homepage settings, public categories, homepage statistics, latest research, and popular research") ยังคงดึงสดทุกครั้งเหมือนเดิมทุกประการ

## 4. เวลา cache

```ts
// lib/cache/public-home.ts
export const PUBLIC_HOME_REVALIDATE_SECONDS = 60;
```

**60 วินาที** สำหรับทุก cache ในหัวข้อ 1 (ค่าเดียวกันทั้งหมด ไม่แยกตามตาราง เพื่อให้เข้าใจ/ตรวจสอบนโยบายได้ง่าย) — เป็นเพียง **"ตาข่ายนิรภัยสำรอง"** เผื่อเส้นทางเขียนข้อมูลจุดใดจุดหนึ่งลืมเรียก `revalidateTag()` หรือมีการแก้ไขข้อมูลนอกแอปนี้โดยตรง (เช่นผ่าน SQL Editor) **ไม่ใช่กลไกหลักที่ทำให้เห็นข้อมูลใหม่**

**กลไกหลัก** คือการเรียก `revalidateTag()` แบบ on-demand จาก Server Action ทุกจุดที่แก้ไขข้อมูลจริง (ดูหัวข้อ 5) — จากการวัดจริงระหว่างพัฒนา (`e2e/public-home-cache.spec.ts`, dev server) การเปลี่ยนแปลงปรากฏบนหน้าแรกภายใน **~2-3 วินาที** หลังจาก Server Action เสร็จสมบูรณ์ ไม่ใช่ synchronous ทันทีเป๊ะ (เป็นพฤติกรรมภายในของ Next.js เอง ไม่ใช่สิ่งที่แอปนี้ควบคุมเวลาได้ตรงๆ) แต่เร็วกว่าเวลาหมดอายุสำรอง 60 วินาทีมาก — ทดสอบเฉพาะกับ dev server เท่านั้น ยังไม่ได้วัดกับ production build จริง

## 5. จุด revalidate — เมื่อไรที่ cache ถูกล้าง

`lib/cache/public-home.ts` มี 3 ฟังก์ชันช่วย แต่ละตัวล้างทั้ง tag เฉพาะของตัวเองและ tag ร่วม `public-home`:

```ts
revalidatePublicSettings()   // -> revalidateTag("public-settings"), revalidateTag("public-home")
revalidatePublicCategories() // -> revalidateTag("public-categories"), revalidateTag("public-home")
revalidatePublicResearch()   // -> revalidateTag("public-research"), revalidateTag("public-home")
```

เรียกจาก Server Action ต่อไปนี้ (ทุกจุดที่ระบุไว้ในข้อกำหนดของงานนี้ — แก้ไขการตั้งค่า/หมวดหมู่ หรือเผยแพร่/เลิกเผยแพร่/แก้ไข/ลบงานวิจัย):

| ไฟล์ | ฟังก์ชัน | เรียก |
| --- | --- | --- |
| `app/superadmin/system-settings/actions.ts` | `updateSystemSettingsAction` | `revalidatePublicSettings()` |
| `app/dashboard/categories/actions.ts` | `createCategoryAction` | `revalidatePublicCategories()` |
| `app/dashboard/categories/actions.ts` | `updateCategoryAction` | `revalidatePublicCategories()` |
| `app/dashboard/categories/actions.ts` | `toggleCategoryActiveAction` | `revalidatePublicCategories()` |
| `app/dashboard/categories/actions.ts` | `deleteCategoryAction` | `revalidatePublicCategories()` |
| `app/dashboard/approvals/[id]/actions.ts` | `changeStatus()` (ใช้ร่วมโดย `approveAction`/`rejectAction`/`requestRevisionAction`/`publishAction`/`archiveAction`) | `revalidatePublicResearch()` |
| `app/dashboard/research/[id]/edit/actions.ts` | `adminUpdateResearchAction` | `revalidatePublicResearch()` |
| `app/dashboard/duplicate-reviews/actions.ts` | `mergeResearchItemsAction` | `revalidatePublicResearch()` |

**หมายเหตุการออกแบบ**: `changeStatus()` เรียก `revalidatePublicResearch()` แบบไม่มีเงื่อนไข (ไม่แยกว่าการเปลี่ยนสถานะครั้งนี้กระทบชุดข้อมูลสาธารณะจริงหรือไม่ เช่น `draft` → `pending_review` ไม่กระทบ) เพราะการล้าง cache ที่ไม่จำเป็นเป็นแค่ต้นทุนของการ query ใหม่ครั้งเดียว ไม่ใช่บั๊ก — ตรงข้ามกับการลืมล้างซึ่งทำให้ผู้ใช้เห็นข้อมูลเก่าค้างอยู่

**ไม่มีจุด hard-delete สำหรับ `research_items`** ในโค้ดปัจจุบัน — แอปนี้ใช้สถานะ `archived` แทนการลบจริง (ผ่าน `archiveAction`) ซึ่งครอบคลุมอยู่แล้วในตาราง กรณีสร้างงานวิจัยใหม่ (`app/dashboard/research/new/actions.ts`) ไม่ต้อง revalidate เพราะ intent `"published"` ถูกลดเป็น `"pending_review"` เสมอโดยไม่มีเงื่อนไข (ไฟล์ที่เพิ่งอัปโหลดยังไม่ผ่านการสแกนความปลอดภัย) — งานวิจัยที่สร้างใหม่จึงไม่มีทางปรากฏบนหน้าแรกได้ทันที

## 6. Cache tags

| Tag | ใช้เมื่อ |
| --- | --- |
| `public-home` | tag ร่วม ("ร่ม") ผูกกับ cache ทุกตัวในหัวข้อ 1 — ล้างทั้งหมดพร้อมกันได้ในคราวเดียว (เช่นจาก maintenance action ในอนาคต) |
| `public-settings` | เฉพาะ `getPublicHomeSettings()` |
| `public-categories` | เฉพาะ `getCategories()` |
| `public-research` | `getLatestResearch()`, `getPopularResearch()`, `getPublishedResearchStats()` ทั้งสามตัว (ผูก tag เดียวกันเพราะทั้งสามมาจาก `research_items` table เดียวกัน การเปลี่ยนแปลงที่กระทบตัวหนึ่งมักกระทบอีกสองตัวด้วย) |

## 7. Mock data / empty-state fallback

ทุกฟังก์ชันที่ cache ยังคงเช็ค `isSupabaseConfigured()` **ก่อน** เรียกส่วนที่ cache เสมอ — ถ้ายังไม่ได้ตั้งค่า Supabase จะคืนค่าจาก mock data (`data/research.ts`, `data/categories.ts`) หรือค่าเริ่มต้น (`DEFAULT_SETTINGS`) ทันที **ไม่ผ่าน `unstable_cache` เลย** (mock data เป็นค่าคงที่ในหน่วยความจำอยู่แล้ว การ cache ซ้ำไม่มีประโยชน์และเพิ่มความซับซ้อนโดยไม่จำเป็น) — พฤติกรรม fallback เดิมจึงเหมือนเดิมทุกประการ ไม่ถูกแตะต้อง

## 8. การทดสอบ

- **`lib/cache/public-home.test.ts`** (Vitest, unit) — ยืนยันว่า `revalidatePublicSettings()`/`revalidatePublicCategories()`/`revalidatePublicResearch()` แต่ละตัวล้าง tag ที่ถูกต้องเป๊ะ (mock `next/cache`'s `revalidateTag`) — เร็ว กำหนดผลได้แน่นอน แต่ไม่ได้ทดสอบ `unstable_cache` จริง (ทำไม่ได้ในสภาพแวดล้อม Vitest ธรรมดาที่ไม่มี Next.js server runtime เต็มรูปแบบ)
- **`e2e/public-home-cache.spec.ts`** (Playwright, ต้องมี `.env.local` ตั้งค่า `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` ไม่งั้น skip ตัวเอง) — พิสูจน์ pipeline เต็มรูปแบบจริงกับ dev server จริง: สร้างหมวดหมู่ทดสอบ → เห็นบนหน้าแรกภายในไม่กี่วินาที → ลบทิ้ง → หายไปจากหน้าแรกภายในไม่กี่วินาที (ทำความสะอาดข้อมูลทดสอบของตัวเองเสมอ) ใช้ flow หมวดหมู่เพราะเข้าถึงได้ด้วยบัญชี admin ธรรมดา (ไม่ต้อง MFA) — settings อยู่ใต้ `/superadmin/system-settings` ที่ต้อง super_admin + TOTP สดซึ่งไม่สามารถทำอัตโนมัติได้ในสภาพแวดล้อมนี้ (ข้อจำกัดเดียวกับที่บันทึกไว้ใน `docs/accessibility-audit.md` §5) แต่ settings/research ใช้ API `unstable_cache`/`revalidateTag` แบบเดียวกันเป๊ะ ผลการพิสูจน์นี้จึงสรุปทั่วไปได้
- **`lib/data/research.homepage.test.ts`** (Vitest, จาก Hallmark ก่อนหน้า) — ยังคงผ่านเหมือนเดิม ทดสอบ mock-data fallback path ซึ่งไม่แตะ `unstable_cache` เลย
- **`lib/data/research-search-rls.integration.test.ts`** — **ไม่ถูกแก้ไข** ยืนยันว่า RLS/authorization behavior ของหน้าค้นหา/รายละเอียดยังคงเดิมทุกประการ (28/28 ผ่าน)

รันทั้งหมด: `npm run lint && npx tsc --noEmit && npm run test && npm run test:a11y`
