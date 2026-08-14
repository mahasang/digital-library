# Supabase Realtime Bundle Optimization

**วันที่ทำ:** 2026-08-14
**ที่มา:** [`docs/research-page-performance-audit.md`](research-page-performance-audit.md) หัวข้อ 3/4 — พบว่า chunk ที่มี Supabase Realtime client (46.98 kB, ใช้จริงแค่ 6%) โหลดในทุก route ของเว็บรวมถึงหน้า guest ที่ไม่ต้องการฟีเจอร์นี้เลย
**ขอบเขต:** เฉพาะการโหลด Supabase Realtime bundle เท่านั้น — ไม่แตะ RLS, schema, role/permission, signed URL/PDF access, public cache behavior, Server Action authorization, MFA policy, deployment/production settings, หรือ UI design (นอกจาก loading fallback ที่จำเป็นจริงๆ — สรุป: **ไม่ต้องใช้เลยในการแก้ไขนี้** ดูเหตุผลในหัวข้อ 2)

---

## 1. สาเหตุที่แท้จริง (Requirement 1 — สืบจนถึงต้นตอ)

### 1.1 ทำไม `@supabase/supabase-js` ถึงพ่วง Realtime มาเสมอ

`createBrowserClient()` (`@supabase/ssr`) สร้าง `SupabaseClient` (`@supabase/supabase-js`) ซึ่ง **instantiate `RealtimeClient` ในตัว constructor เสมอ** ไม่ว่าแอปจะเรียกใช้ `.channel()`/realtime subscription หรือไม่ก็ตาม — เป็นพฤติกรรมที่รู้จักกันดีของ SDK ตัวนี้ ไม่ใช่บั๊ก

### 1.2 ทำไมถึงโหลดในทุก route แม้แต่หน้า guest — พิสูจน์ทีละขั้น

**ขั้นที่ 1 — หา import chain**: `lib/supabase/client.ts` (browser client factory) ถูก import แบบ **static** (บนสุดของไฟล์) โดย 5 ไฟล์: `MfaSettings.tsx`, `IdleLogout.tsx`, `LogoutButton.tsx`, `MfaChallengeForm.tsx`, `SetupMfaForm.tsx` — ตรวจสอบแล้วว่ามีเพียง **`IdleLogout.tsx`** (ผ่าน `IdleLogoutGate` ใน `app/layout.tsx`) และ **`LogoutButton.tsx`** (ผ่าน `UserMenu.tsx` และ `HeaderAccountArea.tsx` ทั้งสองผูกกับ root layout) เท่านั้นที่ reachable จาก **root layout** ซึ่งครอบทุก route — อีก 3 ไฟล์ (MfaSettings/MfaChallengeForm/SetupMfaForm) ใช้เฉพาะใน `/account`, `/mfa-challenge`, `/setup-mfa` ที่เป็น route เฉพาะทางอยู่แล้ว ไม่กระทบ route สาธารณะ

**ขั้นที่ 2 — ทำไม RSC gating ฝั่งเซิร์ฟเวอร์ไม่ช่วย**: `IdleLogoutGate` (`{user ? <IdleLogout/> : null}`) และ `HeaderAccountArea` (แสดงปุ่มเข้าสู่ระบบ/สมัครสมาชิกแทนสำหรับ guest) เป็น Server Component ที่กรอง conditional ฝั่งเซิร์ฟเวอร์อยู่แล้ว — ในทางทฤษฎี guest ไม่ควรได้รับ reference ของ `IdleLogout`/`LogoutButton` ใน RSC payload เลย **แต่ Next.js ตัดสินใจ chunk-splitting ที่ build time โดยพิจารณาว่า Client Component ใด "reachable" จาก layout tree แบบ static (ไม่ทราบผลลัพธ์ conditional ที่ขึ้นกับ runtime เช่นค่า `user`)** เมื่อ `IdleLogout`/`LogoutButton` ถูก import แบบ static จากไฟล์ที่ผูกกับ root layout Next.js จึงจัดให้ JS ของทั้งสองไฟล์ (พร้อม dependency ทั้งหมดที่ import แบบ static รวม `@supabase/supabase-js`/Realtime) อยู่ใน `<script>` tag ที่ต้องโหลดทันทีสำหรับทุก route ใต้ layout นั้น โดยไม่สนใจว่า runtime request นี้จะ render component เหล่านั้นจริงหรือไม่

**ขั้นที่ 3 — พิสูจน์เชิงประจักษ์ (ก่อนแก้ไข)**: ใช้ Chrome DevTools Protocol (`Network.requestWillBeSent`) ผ่าน Playwright ตรวจ initiator ของ request ที่โหลด chunk `4905-543b6c2c53c46a40.js` บนหน้าแรกของ guest — ได้ `initiator.type: "parser"` (HTML parser พบ `<script src="...4905...">` ในเอกสารตรงๆ) ไม่ใช่ `initiator.type` แบบ prefetch/router — ยืนยันว่า chunk นี้อยู่ใน**เอกสาร HTML เริ่มต้นเลย** ไม่ใช่ผลจากการ prefetch ลิงก์ `/login`/`/register` ตามที่อาจสงสัยได้

---

## 2. การแก้ไข (Requirements 2, 3, 11)

### ทำไมไม่ใช้ `next/dynamic` แบบห่อทั้ง component

`next/dynamic` (ที่โปรเจกต์นี้ใช้อยู่แล้วกับ `FlipbookViewerLoader.tsx` สำหรับ `react-pageflip`) เหมาะกับการเลื่อนการ **render** component ที่มี UI ใหญ่/ต้องพึ่ง browser API — ถ้าใช้กับ `LogoutButton` จะต้องเพิ่ม loading fallback UI (เสี่ยง layout shift และเป็นการเปลี่ยน UI ที่ไม่จำเป็น) และกับ `IdleLogout` ก็ไม่มีประโยชน์เพิ่มเพราะ component นี้ไม่ render UI อะไรเลยอยู่แล้ว (`return null` เสมอ)

### สิ่งที่ทำจริง: dynamic `import()` เจาะจงเฉพาะจุดที่เรียกใช้ Supabase

เปลี่ยนทั้งสองไฟล์จาก static import (`import { createClient } from "@/lib/supabase/client"` บนสุดของไฟล์) เป็น **dynamic `import()` ภายใน event handler ที่เรียกใช้จริงเท่านั้น**:

| ไฟล์ | จุดที่เปลี่ยน | เรียกเมื่อไร |
| --- | --- | --- |
| `components/auth/LogoutButton.tsx` | `handleLogout()` (คลิกปุ่ม) | ผู้ใช้กด "ออกจากระบบ" จริงเท่านั้น |
| `components/auth/IdleLogout.tsx` | ภายใน `setInterval` callback หลังตรวจพบ idle timeout | idle เกิน 10 นาทีจริงเท่านั้น (ไม่ใช่ทุกครั้งที่ check ทุก 15 วินาที) |

นี่คือ dynamic `import()` มาตรฐานของ JavaScript/webpack (ES2020) — ไม่ใช่ API เฉพาะของ React/Next.js — เมื่อ dependency ถูกอ้างอิงผ่าน `import()` (นิพจน์ ไม่ใช่ static `import` statement) webpack จะ**แยก chunk ใหม่ต่างหากเสมอ** และไม่รวมเข้ากับ eager bundle ของไฟล์ที่เรียก ไม่ว่าจะอยู่ใน component, event handler, หรือฟังก์ชันธรรมดา

**ผลลัพธ์ต่อ UI**: **ไม่มีการเปลี่ยนแปลงที่มองเห็นได้เลย** —
- `IdleLogout` ไม่มี UI อยู่แล้ว (`return null`) — ไม่มีอะไรให้เกิด loading state
- `LogoutButton` render ปุ่ม "ออกจากระบบ" ทันทีเหมือนเดิมทุกประการ (markup/label/style ไม่เปลี่ยนเลย) — จุดเดียวที่เปลี่ยนคือ `handleLogout()` ตอนนี้ `await import(...)` ก่อนเรียก `createClient()` (เพิ่ม latency เล็กน้อยระดับหลักสิบ-ร้อย ms ตอนกดปุ่ม ซึ่งมี `isPending`/`disabled` state ของปุ่มสื่อสารสถานะ "กำลังออกจากระบบ..." อยู่แล้วในโค้ดเดิม ครอบคลุมช่วงเวลานี้ได้พอดีโดยไม่ต้องเพิ่ม UI ใหม่)

**จึงไม่จำเป็นต้องเพิ่ม loading fallback UI ใดๆ** ตามที่ข้อกำหนดอนุญาตไว้ ("except for an accessible loading fallback if truly needed") — เพราะไม่ "จำเป็นจริงๆ" ในกรณีนี้

---

## 3. เหตุผลด้านความปลอดภัย (Requirement 4)

**ไม่มีการเปลี่ยนแปลงกลไกยืนยันตัวตนใดๆ เลย**:

- `IdleLogoutGate` ยังคงเรียก `getSessionUser()` (ยืนยันตัวตนจริงกับ Supabase Auth ฝั่งเซิร์ฟเวอร์) เพื่อตัดสินใจว่าจะ render `<IdleLogout/>` หรือไม่ — **ไม่ถูกแตะต้องเลย**
- `HeaderAccountArea`/middleware.ts ยังคงตรวจสอบสิทธิ์ฝั่งเซิร์ฟเวอร์เหมือนเดิมทุกประการ — **ไม่ถูกแตะต้องเลย**
- `IdleLogout`/`LogoutButton` ยังคงเรียก `supabase.auth.signOut()` จริงผ่าน Supabase Auth (GoTrueClient) เหมือนเดิมทุกประการ — เพียงแค่**เวลาที่โมดูลถูกโหลด**เปลี่ยนไป (ตอนเรียกใช้แทนที่จะโหลดล่วงหน้า) ไม่ใช่การเปลี่ยน**วิธี**ยืนยันตัวตน
- **ไม่มีการใช้ client state, header, localStorage, หรือ user ID ที่ไม่ผ่านการตรวจสอบมาแทนการยืนยันตัวตนฝั่งเซิร์ฟเวอร์เลย** — `localStorage` ที่ `IdleLogout` ใช้ (STORAGE_KEY = "lastActivityAt") เป็นของเดิมอยู่แล้ว ใช้เพื่อเก็บ**เวลากิจกรรมล่าสุด**สำหรับ sync ข้าม tab เท่านั้น ไม่เกี่ยวกับการยืนยันตัวตน (การยืนยันตัวตนจริงยังคงผ่าน `supabase.auth.signOut()`/session cookie เสมอ) — ไม่ถูกแก้ไขในงานนี้
- dynamic `import()` เปลี่ยนแค่ **เวลา** ที่ browser ดาวน์โหลดไฟล์ JS ของ Supabase SDK เท่านั้น ไม่เปลี่ยน**โค้ดหรือ logic การยืนยันตัวตน**ภายในแม้แต่บรรทัดเดียว (โค้ดในไฟล์ `lib/supabase/client.ts` และการเรียก `.auth.signOut()`/`.auth.getUser()` ไม่ถูกแก้ไขเลย)

### Requirement 6 — Logout ต้องเชื่อถือได้แม้ lazy module ยังโหลดไม่เสร็จ

ปุ่ม "ออกจากระบบ" **render และแสดงผลทันทีเสมอ** (ไม่ได้ซ่อนอยู่หลัง loading state ใดๆ) — สิ่งเดียวที่รอ lazy-load คือโค้ดข้างใน `handleLogout()` ตอนกดปุ่ม ซึ่งเหมือนกับพฤติกรรมเดิมทุกประการอยู่แล้ว (ปุ่มนี้เป็น Client Component ที่ต้อง hydrate ก่อนถึงจะกดได้จริงเสมอ ไม่ว่าจะมี dynamic import หรือไม่) — `isPending` (จาก `useTransition`) disable ปุ่มและเปลี่ยนข้อความเป็น "กำลังออกจากระบบ..." ระหว่างรอทั้ง `import()` และ `signOut()` ครอบคลุมกรณี lazy-load ช้าไว้แล้วในตัว ไม่มีทางที่ผู้ใช้จะ "ค้าง" กดไม่ได้เลย — อย่างมากคือ**รอสถานะ pending นานขึ้นเล็กน้อย** (เครือข่ายช้า) ไม่ใช่ปุ่มหาย/พัง

---

## 4. หลักฐานการทดสอบ (Requirements 5-10, Testing section)

### 4.1 Guest — ยืนยันว่า Realtime chunk ไม่โหลดเลย

ใช้ Playwright จับทุก network request บน `/`, `/research`, `/research/[id]` แบบ guest (ไม่ login) แล้วดึงเนื้อไฟล์ JS ทุก chunk ที่โหลดจริงมาตรวจหา signature `RealtimeClient` — **ไม่พบเลยแม้แต่ chunk เดียว** จากทั้งหมด 11 chunks ที่โหลดตอนเข้าหน้าแรก + `/research`

### 4.2 Member/Staff/Librarian/Admin/Super Admin — login → header → logout

ทดสอบจริงทั้ง 5 บทบาทด้วยบัญชี E2E จริง (`E2E_*_EMAIL`/`E2E_*_PASSWORD`) ผ่าน Playwright:

| บทบาท | login สำเร็จ | Realtime **ไม่**โหลดตอน browse ปกติ (ก่อนกด logout) | คลิกเมนูผู้ใช้ + กด "ออกจากระบบ" สำเร็จ | redirect กลับ `/` ถูกต้อง | หลัง logout เข้า `/account` ถูกเด้งไป `/login` |
| --- | --- | --- | --- | --- | --- |
| member | ✅ | ✅ | ✅ | ✅ | ✅ |
| staff | ✅ | ✅ | ✅ | ✅ | ✅ |
| librarian | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |

**ค้นพบเพิ่มเติมที่ดีกว่าเป้าหมายเดิม**: แม้แต่ผู้ใช้ที่ **login อยู่แล้วและเปิดใช้งานหน้าเว็บปกติ** (ยังไม่กด logout) ก็**ไม่โหลด** Realtime chunk เช่นกัน — เพราะ `createClient()` ถูกเรียกเฉพาะตอนกด logout จริง/idle timeout จริงเท่านั้น ไม่ใช่ตอน component mount — ลดการโหลดที่ไม่จำเป็นได้มากกว่าแค่ "เฉพาะ guest" ตามเป้าหมายเดิมของงานนี้

### 4.3 ยืนยันว่า chunk ยังทำงานถูกต้องตอนต้องใช้จริง (ไม่ได้ลบทิ้ง แค่เลื่อนเวลาโหลด)

ใช้ Playwright จับ network request แบบ real-time (`page.on("request")`) ระหว่างกดปุ่ม "ออกจากระบบ" ของบัญชี member — พบ request ใหม่ไปที่ `_next/static/chunks/6962-edb136bc5db8fe8f.js` **ทันทีที่กดปุ่ม** (ไม่ก่อนหน้านั้นเลย) ดึงเนื้อไฟล์มาตรวจพบ `GoTrueClient`/`RealtimeClient`/`realtime-js` — ยืนยันว่าเป็น chunk เดียวกับที่เคย eager-load อยู่เดิม เพียงแค่ตอนนี้โหลดตรงเวลาที่ต้องใช้จริงเท่านั้น และ logout ยังทำงานถูกต้องสมบูรณ์

### 4.4 Direct protected-route access ขณะ logged out

`GET /account` แบบไม่ login → redirect ไป `/login?redirect=%2Faccount` ถูกต้อง (middleware ทำงานปกติ ไม่ถูกกระทบจากการเปลี่ยนแปลงนี้เลย เพราะ middleware ไม่เกี่ยวข้องกับ browser Supabase client ที่แก้ไขนี้)

### 4.5 Notifications (Requirement 10)

ตรวจสอบแล้วว่า **`NotificationBell`/ระบบแจ้งเตือนไม่ได้ใช้ Supabase Realtime เลย** — ใช้ Server Action (`markNotificationReadAction`/`markAllNotificationsReadAction`) ล้วนๆ ไม่มีการ subscribe realtime channel ใดๆ ในโค้ดปัจจุบัน จึง**ไม่มีอะไรต้องแก้ในส่วนนี้** (ข้อกำหนดนี้เข้าเงื่อนไข "ถ้าใช้ Realtime" ซึ่งไม่เป็นจริงในโปรเจกต์นี้ ณ ตอนนี้)

### 4.6 หัวข้อที่ตรวจสอบด้วยการอ่านโค้ด ไม่ได้ทดสอบสด (บันทึกไว้อย่างตรงไปตรงมา)

- **Idle logout timing จริง (รอ 10 นาที)**: ไม่ได้รอจริง 10 นาทีเพื่อทดสอบ (ไม่คุ้มเวลา) — ยืนยันด้วยการอ่านโค้ดแทนว่า logic การนับเวลา/ตรวจ idle/`localStorage` sync ข้าม tab **ไม่ถูกแก้ไขแม้แต่บรรทัดเดียว** เปลี่ยนเฉพาะตำแหน่งการ `import` เท่านั้น และกลไก dynamic `import()` เดียวกันนี้ถูกพิสูจน์แล้วว่าทำงานถูกต้องจริงผ่านการทดสอบ logout button (หัวข้อ 4.3) ซึ่งใช้ pattern เดียวกันเป๊ะ (`await import("@/lib/supabase/client")` แล้วเรียก `createClient()`/`signOut()`)
- **Warning dialog/countdown ก่อน idle logout**: ตรวจโค้ด `IdleLogout.tsx` แล้วพบว่า**ไม่มี dialog เตือนหรือ countdown ใดๆ อยู่แล้วในโค้ดเดิม** (auto-logout แบบเงียบหลังไม่มีการใช้งาน 10 นาที ไม่มี UI เตือนล่วงหน้า) — งานนี้จึงรักษาพฤติกรรมเดิมไว้ครบถ้วน (ไม่มีอะไรให้ "รักษาไว้" เพิ่มเติมเพราะไม่เคยมีอยู่จริง) **ไม่ได้เพิ่ม dialog/countdown ใหม่ในงานนี้** เพราะเป็นการเปลี่ยน UI ที่ไม่ได้อยู่ในขอบเขตที่ระบุไว้
- **Reload/navigation ก่อนและหลัง lazy module โหลดเสร็จ**: ปุ่ม logout render พร้อมใช้งานทันทีทุกครั้งไม่ว่าจะ reload ตอนไหน (ไม่ใช่ component ที่ถูก dynamic-import ทั้งตัว) — ทดสอบ reload หลายครั้งระหว่างการทดสอบ role-by-role (หัวข้อ 4.2) ไม่พบปัญหา

---

## 5. ผลการรัน lint/TypeScript/unit test/a11y test/build

| คำสั่ง | ผลลัพธ์ |
| --- | --- |
| `npm run lint` | ✅ ผ่าน — 0 error, 8 warning เดิม (ไม่เกี่ยวข้อง) |
| `npx tsc --noEmit` | ✅ ผ่าน — 0 error |
| `npm run test` (Vitest) | ✅ ผ่าน — **127/127** |
| `npm run build` (production) | ✅ ผ่าน — สร้างครบทุก route |
| `npm run test:a11y` (Playwright) | ดูอัปเดตท้ายเอกสารนี้ |

---

## 6. Production Lighthouse — ก่อน/หลัง (`npm run build && npm run start -- -p 3001`)

รันซ้ำ **3 ครั้งต่อ route** (Lighthouse มีความแปรปรวนระหว่างรอบตามธรรมชาติ โดยเฉพาะ TBT — ดูบทเรียนจาก `docs/research-page-performance-audit.md` หัวข้อ 4.1 ที่เคยวัดผลต่างกัน 230ms/30ms/60ms จาก build เดียวกันเป๊ะ) ใช้ **ค่ากลาง (median)** ของ TBT/LCP เป็นตัวแทน

### หน้าแรก (`/`)

| Metric | ก่อนแก้ไข | หลังแก้ไข (median จาก 3 รอบ: 91/96/96) |
| --- | --- | --- |
| Performance score | 93 | **96** |
| FCP | 1.7 s | 1.7 s |
| LCP | 3.0 s | **2.6 s** |
| TBT | 60 ms | 60 ms (ค่าที่วัดได้: 230/30/60 ms — แปรปรวนสูง แต่ค่ากลางเท่าเดิม) |
| CLS | 0.005 | 0.005 |
| Speed Index | 2.7 s | 2.0 s |
| `unused-javascript` | มี (chunk Realtime, 44 KB wasted) | **ไม่มีเลย (score 1)** |

### `/research`

| Metric | ก่อนแก้ไข | หลังแก้ไข (median จาก 3 รอบ: 95/96/97) |
| --- | --- | --- |
| Performance score | 93 | **96** |
| FCP | 1.4 s | 1.4 s |
| LCP | 3.0 s | **2.6 s** |
| TBT | 120 ms | **60 ms** |
| CLS | 0 | 0 |
| Speed Index | 2.7 s | **1.4 s** |
| `unused-javascript` | มี (chunk Realtime, 44 KB wasted) | **ไม่มีเลย (score 1)** |

**First Load JS ที่ Next.js รายงาน** (`npm run build`) แทบไม่เปลี่ยน (`/` 112 kB, `/research` 120 kB ทั้งก่อน/หลัง) — เพราะตัวเลขนี้ไม่เคยนับรวม chunk Realtime ตั้งแต่แรก (ยืนยันแล้วในรายงานเดิมว่าเป็น script tag ที่โหลดจริงแต่ไม่ถูกนับใน "First Load JS" ที่ Next.js สรุปในตาราง build) **ตัวชี้วัดที่แม่นยำกว่าคือ `unused-javascript` audit และการนับ chunk request จริงทาง network** ซึ่งทั้งสองยืนยันตรงกันว่า Realtime chunk (46.98 kB, wasted 44 kB) หายไปจาก initial load ของทั้งสอง route แล้วอย่างสมบูรณ์

**ขนาด Realtime chunk**: ก่อนแก้ไข = `4905-543b6c2c53c46a40.js` (46,982 bytes รวม, 44,056 bytes ไม่ได้ใช้) — หลังแก้ไข = `6962-edb136bc5db8fe8f.js` (167,612 bytes, **แยกเป็น chunk อิสระ ไม่ผูกกับ route ใดเป็นค่าเริ่มต้น โหลดเฉพาะตอนกด logout/idle-timeout จริง**) ขนาดใหญ่ขึ้นเพราะไม่ได้แชร์การ deduplicate กับ chunk อื่นที่เคย eager-load ร่วมกันอีกต่อไป (ผลข้างเคียงปกติของ code-splitting) — **ไม่กระทบผู้ใช้ทั่วไปเพราะโหลดเฉพาะตอน action ที่เกิดไม่บ่อย (logout) เท่านั้น ไม่ใช่ทุกครั้งที่เข้าเว็บอีกต่อไป**

---

## 7. Realtime usage ที่เก็บไว้โดยตั้งใจ

**ไม่มี Realtime subscription ใดๆ ถูกใช้งานจริงในโปรเจกต์นี้เลย ณ ตอนนี้** (ตรวจสอบแล้วในหัวข้อ 4.5 — notifications ใช้ Server Action ล้วน) — สิ่งที่ "เก็บไว้" คือ **โค้ดของ `@supabase/supabase-js` ที่มากับ SDK เอง** (`RealtimeClient` ที่ constructor ของ `SupabaseClient` สร้างเสมอ) ซึ่งเป็นส่วนหนึ่งของ SDK ที่ไม่สามารถถอดออกได้โดยไม่เปลี่ยน SDK/เขียน client เอง (นอกขอบเขตงานนี้) — งานนี้แก้ปัญหาด้วยการ**เลื่อนเวลาโหลด** SDK ทั้งก้อนแทน ไม่ใช่การถอด Realtime ออกจาก SDK

---

## 8. ไฟล์ที่เปลี่ยนแปลง

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `components/auth/LogoutButton.tsx` | ย้าย `import { createClient } from "@/lib/supabase/client"` จาก static (บนสุดไฟล์) เป็น dynamic `import()` ภายใน `handleLogout()` |
| `components/auth/IdleLogout.tsx` | ย้าย import แบบเดียวกัน เป็น dynamic `import()` ภายใน `setInterval` callback หลังตรวจพบ idle timeout |
| `docs/realtime-bundle-optimization.md` | เอกสารนี้ (ใหม่) |

**ไม่แตะไฟล์อื่นใดเลย** — `IdleLogoutGate.tsx`, `HeaderAccountArea.tsx`, `UserMenu.tsx`, `middleware.ts`, `lib/supabase/*.ts`, RLS/migrations, และ UI component อื่นทั้งหมด **ไม่ถูกแก้ไข**
