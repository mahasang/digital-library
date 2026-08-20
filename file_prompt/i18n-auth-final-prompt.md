# i18n — Auth Final Cleanup (3 จุดที่เหลือ)

## Context

- next-intl v4, locales: `lo` (default), `th`, `en`, `vi`
- `auth` namespace มี keys อยู่แล้วครบแล้ว — งานนี้เพิ่มอีก 5 keys และแก้ 3 จุด
- `lib/supabase/error-messages.ts` เป็น utility function ที่เรียกจาก Server Actions
- OS: Windows, shell: Git Bash, dev port: 3001

## Scope

1. เพิ่ม keys ใหม่ใน `messages/*.json` (5 keys)
2. Wire amber fallback block ใน `reset-password/page.tsx`
3. เพิ่ม `organizationPlaceholder` key ใน `RegisterForm.tsx`
4. แก้ `lib/supabase/error-messages.ts` ให้รองรับหลายภาษา
5. รัน lint + tsc + test + build + test:a11y

## ห้ามทำ

- ห้ามแตะ server actions logic (เฉพาะ `error-messages.ts` เท่านั้น)
- ห้ามแตะ RLS, middleware, signed URL, MFA, `app/api/`
- ห้ามแก้ keys ที่มีอยู่แล้ว — เพิ่มอย่างเดียว

---

## Step 1 — เพิ่ม keys ใหม่ใน messages/*.json

เพิ่มต่อท้าย namespace `auth` ใน **ทุก 4 locale**:

### `messages/lo.json`:
```json
"resetLinkExpiredTitle": "ລິ້ງໝົດອາຍຸຫຼືບໍ່ຖືກຕ້ອງ",
"resetLinkExpiredDescription": "ກະລຸນາເປີດໜ້ານີ້ຈາກລິ້ງໃນອີເມລທີ່ໄດ້ຮັບ ຫຼື ຂໍລິ້ງຕັ້ງລະຫັດຜ່ານໃໝ່ອີກຄັ້ງທີ່ໜ້າ",
"resetLinkForgotPasswordLink": "ລືມລະຫັດຜ່ານ",
"organizationPlaceholder": "ເຊັ່ນ: ຄະນະວິສະວະກຳສາດ",
"authErrorGeneric": "ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ"
```

### `messages/th.json`:
```json
"resetLinkExpiredTitle": "ลิงก์หมดอายุหรือไม่ถูกต้อง",
"resetLinkExpiredDescription": "กรุณาเปิดหน้านี้จากลิงก์ในอีเมลที่ได้รับ หรือขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้งที่หน้า",
"resetLinkForgotPasswordLink": "ลืมรหัสผ่าน",
"organizationPlaceholder": "เช่น คณะวิศวกรรมศาสตร์",
"authErrorGeneric": "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
```

### `messages/en.json`:
```json
"resetLinkExpiredTitle": "Link expired or invalid",
"resetLinkExpiredDescription": "Please open this page from the link in your email, or request a new reset link at the",
"resetLinkForgotPasswordLink": "Forgot password",
"organizationPlaceholder": "e.g. Faculty of Engineering",
"authErrorGeneric": "An error occurred. Please try again."
```

### `messages/vi.json`:
```json
"resetLinkExpiredTitle": "Liên kết đã hết hạn hoặc không hợp lệ",
"resetLinkExpiredDescription": "Vui lòng mở trang này từ liên kết trong email bạn đã nhận, hoặc yêu cầu liên kết đặt lại mật khẩu mới tại trang",
"resetLinkForgotPasswordLink": "Quên mật khẩu",
"organizationPlaceholder": "Ví dụ: Khoa Kỹ thuật",
"authErrorGeneric": "Đã xảy ra lỗi. Vui lòng thử lại."
```

---

## Step 2 — Wire amber fallback block ใน reset-password/page.tsx

เปิด `app/[locale]/auth/reset-password/page.tsx` แล้วแก้ amber block:

```tsx
// ก่อน
<p className="text-sm font-semibold text-amber-800">
  ลิงก์หมดอายุหรือไม่ถูกต้อง
</p>
<p className="text-xs leading-relaxed text-amber-700">
  กรุณาเปิดหน้านี้จากลิงก์ในอีเมลที่ได้รับ หรือขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
  ที่หน้า{" "}
  <Link href="/auth/forgot-password" className="underline">
    ลืมรหัสผ่าน
  </Link>
</p>

// หลัง
<p className="text-sm font-semibold text-amber-800">
  {t("resetLinkExpiredTitle")}
</p>
<p className="text-xs leading-relaxed text-amber-700">
  {t("resetLinkExpiredDescription")}{" "}
  <Link href="/auth/forgot-password" className="underline">
    {t("resetLinkForgotPasswordLink")}
  </Link>
</p>
```

`t` มีอยู่แล้วในไฟล์นี้ (จากงานก่อนหน้า) ไม่ต้องเพิ่ม import ใหม่

---

## Step 3 — Wire organization placeholder ใน RegisterForm.tsx

เปิด `components/auth/RegisterForm.tsx` บรรทัด 67:

```tsx
// ก่อน
placeholder="เช่น คณะวิศวกรรมศาสตร์"

// หลัง
placeholder={t("organizationPlaceholder")}
```

`t` มีอยู่แล้วในไฟล์นี้ ไม่ต้องเพิ่ม import

---

## Step 4 — แก้ lib/supabase/error-messages.ts

ไฟล์นี้เรียกจาก Server Actions — ต้องรับ `locale` เป็น parameter แล้ว
return ข้อความตาม locale แทนที่จะ hardcode ไทยเสมอ

**วิธีที่ทำได้โดยไม่ต้องแก้ Server Actions:** ใช้ next-intl `getTranslations` ใน function นี้เอง โดยรับ `locale` จาก caller

ตรวจก่อนว่า Server Actions เรียก `mapAuthErrorMessage` แบบไหน:
```bash
grep -rn "mapAuthErrorMessage" app/ lib/ | head -10
```

### Option A — ถ้า caller ส่ง locale ได้

แก้ signature และเพิ่ม keys ใน `errors` namespace:
```typescript
import { getTranslations } from 'next-intl/server';

export async function mapAuthErrorMessage(
  rawMessage: string,
  locale: string
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'errors' });
  const message = rawMessage.toLowerCase();

  if (message.includes("invalid login credentials")) return t('invalidCredentials');
  if (message.includes("email not confirmed")) return t('emailNotConfirmed');
  if (message.includes("user already registered")) return t('alreadyRegistered');
  if (message.includes("password should be at least")) return t('passwordTooShort');
  if (message.includes("rate limit")) return t('rateLimitExceeded');
  if (message.includes("network")) return t('networkError');
  return t('genericError');
}
```

### Option B — ถ้าแก้ caller ยากเกินไป (ซับซ้อน)

**ให้รายงานมาแทน** — บันทึกเป็น backlog ไม่แก้ในรอบนี้
เพราะการแก้ Server Actions อยู่นอก scope และอาจกระทบ auth flow

**ให้ตรวจ `grep` ก่อนแล้วตัดสินใจเองว่า Option ไหนเหมาะ**
ถ้าเลือก Option B ให้รายงานผลและข้ามไป Step 5 ได้เลย

---

## Step 5 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npm run test:a11y
```

---

## รายงานผลที่ต้องการ

1. ผล `grep -rn "mapAuthErrorMessage"` — caller ส่ง locale ได้ไหม
2. เลือก Option A หรือ B สำหรับ error-messages.ts และเหตุผล
3. ไฟล์ที่แก้ไขทั้งหมด
4. ผล tsc / lint / test / build / test:a11y
5. ปัญหาที่พบ + วิธีแก้
