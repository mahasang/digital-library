# Audit: การเรียกซ้ำของการยืนยันตัวตน/สิทธิ์ผ่าน Supabase

**เพิ่มใน:** Hallmark — audit ลดการเรียกซ้ำของการยืนยันตัวตน (2026-08). แยกต่างหากจาก Hallmark — header rendering refactor ก่อนหน้า (งานนั้นระบุไว้ชัดเจนว่า "Do not optimize or remove duplicate Supabase auth getUser calls in this task" — งานนี้คือรอบที่ตามมาเพื่อทำเรื่องนั้นโดยเฉพาะ)

เอกสารนี้บันทึกว่า `supabase.auth.getUser()` และการตรวจสอบ rank/role ถูกเรียกที่ไหนบ้าง วัดผลจริงก่อน/หลัง อะไรลดได้อย่างปลอดภัย และอะไร**ตั้งใจไม่ลด**พร้อมเหตุผล

---

## 1. จุดที่เรียก `supabase.auth.getUser()` ทั้งหมด

| ชั้น | ไฟล์ | ความถี่ต่อ request |
| --- | --- | --- |
| Middleware (Edge, ก่อน RSC render เสมอ) | `lib/supabase/middleware.ts` (`updateSession`) | เรียก 1 ครั้งเสมอ ทุก request ที่ไม่ถูกยกเว้นโดย `matcher` |
| RSC render — session ผู้ใช้ | `lib/supabase/session.ts` (`getSessionUser`) | **เดิม**: เรียกตรงทุกจุดที่ถูกเรียก (ดูตารางที่ 2) — **ตอนนี้**: ห่อด้วย React `cache()` จึงยิง network จริงแค่ 1 ครั้งต่อ request ไม่ว่าจะมีกี่จุดเรียก |
| Server Action guard | `lib/data/admin-guard.server.ts` (`requireMinRank`) | เรียกตรง 1 ครั้งต่อการเรียก Server Action หนึ่งครั้ง (เจตนา — ดูหัวข้อ 4) |
| Server Action อื่นๆ ที่ตรวจ user เอง (เช่น `toggleFavoriteAction`, `hasActiveAccessGrantBySlug`) | กระจายอยู่หลายไฟล์ | เรียกตรง 1 ครั้งต่อการเรียกฟังก์ชันนั้น |

จุดที่เรียก `getSessionUser()` ต่อ 1 การโหลดหน้าเว็บทั่วไป (ก่อน optimize):

| จุดเรียก | ไฟล์ |
| --- | --- |
| Header ส่วนเดสก์ท็อป | `components/layout/HeaderAccountArea.tsx` (`variant="desktop"`) |
| Header ส่วนมือถือ | `components/layout/HeaderAccountArea.tsx` (`variant="mobile"`) |
| ตัวจับ idle-logout | `components/auth/IdleLogoutGate.tsx` |
| `/dashboard/*` เพิ่มอีก 1 จุด | `app/dashboard/layout.tsx` |
| `/superadmin/*` เพิ่มอีก 1 จุด | `app/superadmin/layout.tsx` |
| หน้ารายละเอียดงานวิจัย เพิ่มอีก 1 จุด | `app/research/[id]/page.tsx` |

ทุกหน้าที่ผ่าน root layout (ทุกหน้าในเว็บ) จึงมีอย่างน้อย 3 จุดเรียกเสมอ (Header desktop/mobile + IdleLogoutGate) และมากกว่านั้นถ้าอยู่ใต้ layout ที่ต้องตรวจสิทธิ์เพิ่ม

## 2. วัดผลจริง (ก่อน/หลัง) — dev server จริง, ไม่ใช่การประมาณ

วิธีวัด: ใส่ log ชั่วคราวที่จุดเรียกจริงแต่ละจุด (`console.error` มี tag `[AUTH-AUDIT]`) รันคำขอเดี่ยวๆ ผ่าน `curl`/สคริปต์ Playwright ที่แยกจาก prefetch ของเบราว์เซอร์ (ใช้ cookie ที่ได้จาก login จริงยิง request เดียวตรงๆ ไม่ผ่านการนำทางในเบราว์เซอร์ที่อาจมี prefetch ปน) นับจำนวนบรรทัด log ต่อ 1 request แล้วลบ log ออกทั้งหมดหลังวัดเสร็จ

**ผู้เยี่ยมชมทั่วไป (guest) — `GET /`:**

| | middleware `getUser()` | RSC `getSessionUser()` |
| --- | --- | --- |
| ก่อน | 1 | 3 |
| หลัง | 1 | **1** |

**ผู้ใช้ที่ login แล้ว (admin) — `GET /dashboard`:**

| | middleware `getUser()` | RSC `getSessionUser()` | rank RPC (`user_max_role_rank`) รวม |
| --- | --- | --- | --- |
| ก่อน | 1 | 4 | 5 (4 ฝังใน `getSessionUser()` + 1 จาก `getCurrentUserRoleRank()` ที่ `DashboardLayout` เรียกแยก) |
| หลัง | 1 | **1** | **1** (ใช้ค่าเดียวกันร่วมกันระหว่าง `getSessionUser()` กับ `getCurrentUserRoleRank()`) |

middleware ยังคงอยู่ที่ 1 เท่าเดิมทั้งก่อนและหลัง — เป็นไปตามที่ควรจะเป็น (ดูหัวข้อ 4)

## 3. สิ่งที่ลดได้อย่างปลอดภัย — React `cache()` ภายใน request เดียวกัน

**เครื่องมือ**: React `cache()` (จาก `"react"`, **ไม่ใช่** `unstable_cache`) — memoize เฉพาะภายในการ render RSC ของ 1 request เท่านั้น รีเซ็ตใหม่ทุก request เสมอ (เป็น API มาตรฐานของ Next.js App Router สำหรับ dedupe การเรียกฟังก์ชันซ้ำในทรีเดียวกัน — โปรเจกต์นี้ใช้ pattern เดียวกันนี้อยู่แล้วกับ `getCategories()` มาก่อน ดู `docs/homepage-caching.md`)

**เปลี่ยน 2 ไฟล์:**

- `lib/supabase/session.ts` — ห่อ `getSessionUser()` ด้วย `cache()`
- `lib/supabase/roles.ts` — ห่อ `getCurrentUserRoleRank()` ด้วย `cache()`, และเปลี่ยน `getSessionUser()` ให้เรียก `getCurrentUserRoleRank()` (ที่ cache แล้ว) แทนการยิง `rpc("user_max_role_rank")` เองซ้ำอีกชุด — ยุบการคำนวณ rank ที่ซ้ำกันระหว่างสองฟังก์ชันนี้ลงเหลือ query เดียวต่อ request ด้วย

**ทำไมปลอดภัย — ไม่ลดทอนความปลอดภัยแม้แต่น้อย:**

1. ยังคงยืนยันตัวตนจริงกับ Supabase Auth server อย่างน้อย 1 ครั้งทุก request เสมอ (ไม่มีทาง "ข้าม" การตรวจสอบไปเลย)
2. `cache()` **ไม่ใช่** cache ข้าม request/ข้ามผู้ใช้แบบ `unstable_cache` — ทุก request ใหม่ (ผู้ใช้คนใหม่, tab ใหม่, การรีเฟรช) จะยิง `auth.getUser()` จริงใหม่เสมอ ไม่มีทางที่ผลของผู้ใช้ A จะรั่วไปเป็นผลของผู้ใช้ B
3. **ไม่มีการเปลี่ยน call site ใดๆ เลย** — ทุกหน้า/Server Action ทั้ง ~45 จุดที่เรียก `getCurrentUserRoleRank()` โดยตรง (ดู `app/dashboard/**/actions.ts`, `app/superadmin/**/actions.ts` ฯลฯ) ยังคงเรียกเหมือนเดิมทุกประการ — รูปแบบ "ตรวจสิทธิ์ซ้ำทุกชั้น" (defense-in-depth) ที่มีอยู่เดิมทั้งระบบไม่ถูกแตะต้องหรือลดทอนเลย `cache()` แค่ทำให้จุดที่เรียกซ้ำ**ภายใน request เดียวกัน**ได้ผลลัพธ์จาก network round-trip เดียวกัน แทนที่จะยิงซ้ำ
4. ผลลัพธ์ที่ได้ (identity, role, rank, `hasVerifiedMfa`) เหมือนเดิมทุกประการ — เปลี่ยนแค่ "จำนวนครั้งที่เรียกเครือข่าย" ไม่เปลี่ยน "คำตอบ" เลย

## 4. สิ่งที่**ตั้งใจไม่ลด** — ขอบเขตของ middleware กับ RSC render

middleware.ts เรียก `supabase.auth.getUser()` ของตัวเองแยกต่างหากจาก RSC เสมอ (1 ครั้งต่อ request เท่าเดิมทั้งก่อน/หลัง) **ไม่สามารถยุบรวมกับฝั่ง RSC ได้อย่างปลอดภัย** ด้วยเหตุผลทางสถาปัตยกรรม ไม่ใช่ข้อจำกัดที่แก้ได้ในอนาคต:

- middleware ทำงานใน**คนละช่วงเวลา/คนละ runtime** จากการ render RSC โดยสิ้นเชิง (ทำงาน**ก่อน**เสมอ ตัดสินใจ redirect/บล็อกก่อนแม้แต่จะเริ่ม render หน้าเว็บ) React `cache()` ที่ใช้ในหัวข้อ 3 ผูกอยู่กับ request-scoped storage ของการ render RSC เท่านั้น ไม่มี mechanism ใดที่แชร์ cache ข้ามสองช่วงนี้ได้
- ทางเดียวที่จะ "ยุบรวม" ได้จริงคือส่งต่อผลการยืนยันตัวตนจาก middleware ไปให้ RSC ผ่าน request header ที่ middleware ตั้งค่าเอง แล้วให้ RSC **เชื่อ** header นั้นแทนการตรวจสอบเอง — นี่คือรูปแบบที่**งานนี้ระบุห้ามไว้ชัดเจน** ("Do not trust client-provided headers, cookies, or middleware-added identity headers as authorization proof") และเป็นรูปแบบที่ไม่ปลอดภัยโดยหลักการอยู่แล้วแม้จะไม่ถูกห้ามก็ตาม (มี route ที่ static generation/ISR revalidate/RSC prefetch บางกรณีที่ middleware ไม่ได้ทำงานครบตามที่คาดเสมอไป — เชื่อ header ในสถานการณ์เหล่านั้นเท่ากับข้ามการตรวจสอบไปเงียบๆ)
- ทั้งสองชั้นตรวจสอบเรื่อง**คนละแง่มุมกัน**ด้วย: middleware ตัดสินใจว่าจะ**ให้ผ่านไปถึงหน้าเว็บเลยหรือไม่** (redirect ก่อน render), RSC (layout/page/Server Action) ตัดสินใจว่า**จะแสดงอะไร/อนุญาตอะไร**ในหน้าที่ render จริง — เป็นด่านตรวจสองด่านที่ทำหน้าที่ต่างกัน ไม่ใช่การตรวจซ้ำสิ่งเดียวกันแบบไม่มีประโยชน์ (ดูคอมเมนต์ใน `app/superadmin/layout.tsx` ที่อธิบาย pattern "RBAC สองชั้น" นี้ไว้อยู่แล้วก่อนงานนี้)

**สรุป**: การเรียกซ้ำระหว่าง middleware กับ RSC (1 ครั้ง + 1 ครั้ง = 2 ครั้งต่อ request) **คงไว้ตามเดิมโดยเจตนา** เป็นการออกแบบเพื่อความปลอดภัยที่ถูกต้อง ไม่ใช่จุดบกพร่องที่มองข้ามไป

Server Action guard (`requireMinRank` ใน `lib/data/admin-guard.server.ts`) ก็เช่นกัน — แต่ละการเรียก Server Action คือ request แยกต่างหากจากการ render หน้าที่แสดงปุ่ม/ฟอร์มที่เรียกมัน (Server Action เรียกได้โดยตรงผ่าน `fetch` โดยไม่ต้องผ่านการ render หน้าเว็บเลยด้วยซ้ำ) จึง**ต้อง**ยืนยันตัวตนใหม่ทุกครั้งเสมอ ไม่นำผลจากการ render ก่อนหน้ามาเชื่อซ้ำ — นี่คือพฤติกรรมที่ถูกต้องเช่นกัน ไม่ใช่การเรียกซ้ำที่ควรลด

## 5. การทดสอบ

- **`npx tsc --noEmit`, `npm run lint`** — ผ่านสะอาด ไม่มี error ใหม่
- **`npm run test`** (Vitest ทั้งชุด รวม `lib/data/research-search-rls.integration.test.ts`) — ผ่าน 127/127 เหมือนเดิมทุกประการ (ไม่ถูกแก้ไข) ยืนยันว่า RLS/authorization behavior ไม่เปลี่ยน
- **`e2e/header-roles.spec.ts`** (มีอยู่ก่อนแล้วจาก Hallmark — header rendering refactor) — ผ่าน 13/13 ยืนยันว่าเมนู/สิทธิ์ตามบทบาทยังแสดงถูกต้องทุกบทบาทหลัง optimize
- **`e2e/auth-verification.spec.ts`** (ใหม่ในงานนี้) — ผ่าน 12/12 ครอบคลุม:
  - **logout**: ออกจากระบบแล้วหน้าที่ต้อง login เด้งไป `/login` อีกครั้งจริง
  - **role gate matrix** (guest + member/staff/librarian/admin/super_admin): แต่ละบทบาทเข้าหน้าที่ตัวเองมีสิทธิ์ได้ และถูกเด้งไป `/403` จากหน้าที่ต้องมี rank สูงกว่าจริง (ตรวจตรงกับ `ROLE_REQUIRED_PREFIXES` ใน `middleware.ts`)
  - **token เสียหาย/ปลอมแปลง**: แก้ไข payload ของ access-token cookie หลัง login แล้วยิง request ใหม่ — ต้องไม่ 500 (ไม่ crash) และต้องถูกปฏิบัติเหมือน guest (middleware ตรวจพบ `getUser()` ล้มเหลว → `signOut()` — ไม่ใช่การ bypass)
  - **สิทธิ์ดาวน์โหลดเอกสารจริง** (ใช้ข้อมูลจริงจาก `supabase/seed.sql`): เอกสาร `public` (`eng-2024-001`) guest ดาวน์โหลดได้เลย, เอกสาร `member_only` (`it-2024-002`) guest มองไม่เห็นเลย (404) แต่ member ดาวน์โหลดได้, เอกสาร `read_only` (`edu-2024-005`) ไม่มีปุ่มดาวน์โหลดที่ใช้งานได้จริงแม้จะเป็นสมาชิกก็ตาม
- **`npm run build`** (production) — สำเร็จ ทุก route ยังเป็น `ƒ` dynamic เหมือนเดิม

รันทั้งหมด: `npx tsc --noEmit && npm run lint && npm run test && npx playwright test e2e/auth-verification.spec.ts e2e/header-roles.spec.ts e2e/accessibility.spec.ts e2e/public-home-cache.spec.ts && npm run build`
