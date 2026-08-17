# QA-05 — Raw Error Message Sanitization
# Prompt สำหรับ Claude Code / Cursor

## บริบท

`toSafeErrorMessage()` ถูกใช้ใน `lib/data/queries.ts` แล้ว 9 จุด
ยังเหลืออีก 5 ไฟล์ที่ throw raw error message โดยตรง

**ความเสี่ยง:** error message จาก Supabase อาจมี schema/table name
หรือข้อมูล internal รั่วไปถึง client ใน edge case
Next.js redact ใน production แต่ defense-in-depth ดีกว่า

---

## งานที่ต้องทำ

แก้ทุก `throw new Error(...)` ที่มีการ interpolate `error.message` หรือ
`error` ใน 5 ไฟล์ต่อไปนี้ให้ใช้ `toSafeErrorMessage()` แทน

---

## ขั้นตอน

### ขั้น 0 — Inspect ก่อน

```bash
cat lib/data/reports.server.ts
cat lib/data/favorites.server.ts
cat lib/data/categories.server.ts
cat lib/data/submissions.server.ts
cat lib/data/submission-write.server.ts
cat lib/errors/safe-message.server.ts   # ดู signature ของ toSafeErrorMessage
```

### ขั้น 1 — Pattern การแก้ไข

**เดิม (unsafe):**
```ts
if (error) throw new Error(`ดึงข้อมูลไม่ได้: ${error.message}`)
if (error) throw new Error(`บันทึกไม่สำเร็จ: ${String(error)}`)
throw error
```

**ใหม่ (safe):**
```ts
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";

if (error) throw new Error(
  toSafeErrorMessage(error, "ดึงข้อมูลไม่ได้", "functionName failed")
)
```

**`toSafeErrorMessage` signature (ดูจากไฟล์จริง):**
- param 1: error object จาก Supabase หรือ unknown
- param 2: user-facing message (ภาษาไทย ไม่มีข้อมูล internal)
- param 3: context string สำหรับ server log (ชื่อ function + context)

### ขั้น 2 — กฎสำหรับแต่ละ case

**case ที่ต้องแก้:**
- `throw new Error(\`...: ${error.message}\`)` → toSafeErrorMessage
- `throw new Error(\`...: ${String(error)}\`)` → toSafeErrorMessage
- `throw new Error(\`...: ${error}\`)` → toSafeErrorMessage
- `throw error` ใน catch block ที่ error มาจาก Supabase → toSafeErrorMessage

**case ที่ไม่ต้องแก้:**
- `throw new Error("static string")` — ไม่มี interpolation → ปลอดภัยแล้ว
- error ที่ throw จาก validation logic (ไม่ใช่ Supabase error)
- `console.error(error)` — แค่ log ไม่ throw

### ขั้น 3 — รัน checks

```bash
npx tsc --noEmit
npm run lint
npm run test
```

---

## เกณฑ์ความสำเร็จ

- [ ] `npx tsc --noEmit` → 0 error
- [ ] `npm run lint` → 0 error
- [ ] `npm run test` → 127/127
- [ ] ไม่มี `${error.message}` หรือ `${String(error)}` ใน throw statements อีกต่อไป:

```bash
grep -rn 'throw new Error.*error\.message\|throw new Error.*String(error)\|throw new Error.*\${error}' \
  lib/data/reports.server.ts \
  lib/data/favorites.server.ts \
  lib/data/categories.server.ts \
  lib/data/submissions.server.ts \
  lib/data/submission-write.server.ts
```

ผลต้องว่างเปล่า

---

## ข้อห้าม

- ห้ามเปลี่ยน logic การดึงข้อมูลหรือ query ใดๆ
- ห้ามเปลี่ยน function signature
- ห้ามแตะไฟล์อื่นนอกจาก 5 ไฟล์นี้
- ถ้า test ลดลง → หยุดทันที
