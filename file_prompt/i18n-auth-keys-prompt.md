# i18n — เพิ่ม keys auth (ForgotPassword + ResetPassword + RegisterForm)

## Context

- next-intl v4, locales: `lo` (default), `th`, `en`, `vi`
- `auth` namespace มี 9 keys อยู่แล้ว: `loginTitle`, `registerTitle`, `email`, `password`, `forgotPassword`, `noAccount`, `hasAccount`, `loginHere`, `registerHere`
- งานนี้: **เพิ่ม keys ใหม่** ใน `messages/*.json` ทุก 4 locale แล้ว wire เข้า components

## Scope

1. เพิ่ม keys ใน `messages/{lo,th,en,vi}.json` → namespace `auth`
2. Wire `ForgotPasswordForm.tsx` (Client Component)
3. Wire `app/[locale]/auth/forgot-password/page.tsx` (Server Component)
4. Wire `ResetPasswordForm.tsx` (Client Component)
5. Wire `app/[locale]/auth/reset-password/page.tsx` — ดูไฟล์จริงก่อน
6. Wire `RegisterForm.tsx` ส่วนที่เหลือ (Client Component)
7. รัน lint + tsc + test + build + test:a11y

## ห้ามทำ

- ห้ามแตะ server actions (`actions.ts`) ทุกไฟล์
- ห้ามแตะ RLS, middleware, signed URL, MFA, `app/api/`
- ห้ามแตะ Supabase client หรือ database schema
- ห้ามแก้ keys ที่มีอยู่แล้ว — เพิ่มอย่างเดียว

---

## Step 1 — ตรวจไฟล์ที่ยังไม่ได้ดู

```bash
cat "app/[locale]/auth/reset-password/page.tsx"
sed -n '20,150p' components/auth/RegisterForm.tsx
```

รายงานสิ่งที่พบก่อนดำเนินการต่อ

---

## Step 2 — เพิ่ม keys ใน messages/*.json

เพิ่ม keys ต่อไปนี้ต่อท้าย namespace `auth` ที่มีอยู่แล้วใน **ทุก 4 locale**

### `messages/lo.json` (ลาว):
```json
"forgotPasswordTitle": "ລືມລະຫັດຜ່ານ",
"forgotPasswordDescription": "ກະລຸນາປ້ອນອີເມລທີ່ໃຊ້ສະໝັກສະມາຊິກ ພວກເຮົາຈະສົ່ງລິ້ງສຳລັບຕັ້ງລະຫັດຜ່ານໃໝ່ໄປໃຫ້",
"forgotPasswordEmailLabel": "ອີເມລທີ່ໃຊ້ສະໝັກສະມາຊິກ",
"forgotPasswordSubmit": "ສົ່ງລິ້ງຕັ້ງລະຫັດຜ່ານໃໝ່",
"forgotPasswordSubmitting": "ກຳລັງສົ່ງລິ້ງ...",
"forgotPasswordSuccess": "ສົ່ງຄຳຂໍສຳເລັດ",
"backToLogin": "ກັບໄປໜ້າເຂົ້າສູ່ລະບົບ",
"resetPasswordTitle": "ຕັ້ງລະຫັດຜ່ານໃໝ່",
"resetPasswordDescription": "ກະລຸນາຕັ້ງລະຫັດຜ່ານໃໝ່ສຳລັບບັນຊີຂອງທ່ານ",
"newPassword": "ລະຫັດຜ່ານໃໝ່",
"confirmNewPassword": "ຢືນຢັນລະຫັດຜ່ານໃໝ່",
"showPassword": "ສະແດງລະຫັດຜ່ານ",
"hidePassword": "ເຊື່ອງລະຫັດຜ່ານ",
"resetPasswordSubmit": "ຕັ້ງລະຫັດຜ່ານໃໝ່",
"resetPasswordSubmitting": "ກຳລັງບັນທຶກ...",
"fullName": "ຊື່-ນາມສະກຸນ",
"fullNamePlaceholder": "ກະລຸນາປ້ອນຊື່-ນາມສະກຸນ",
"organization": "ໜ່ວຍງານ/ສັງກັດ",
"confirmPassword": "ຢືນຢັນລະຫັດຜ່ານ",
"acceptTerms": "ຂ້າພະເຈົ້າຍອມຮັບຂໍ້ກຳນົດການໃຊ້ງານ ແລະ ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວຂອງຫ້ອງສະໝຸດດິຈິຕອນ",
"registerSuccess": "ສະໝັກສະມາຊິກສຳເລັດ",
"registerSubmit": "ສະໝັກສະມາຊິກ",
"registerSubmitting": "ກຳລັງສະໝັກສະມາຊິກ..."
```

### `messages/th.json` (ไทย):
```json
"forgotPasswordTitle": "ลืมรหัสผ่าน",
"forgotPasswordDescription": "กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้",
"forgotPasswordEmailLabel": "อีเมลที่ใช้สมัครสมาชิก",
"forgotPasswordSubmit": "ส่งลิงก์ตั้งรหัสผ่านใหม่",
"forgotPasswordSubmitting": "กำลังส่งลิงก์...",
"forgotPasswordSuccess": "ส่งคำขอสำเร็จ",
"backToLogin": "กลับไปหน้าเข้าสู่ระบบ",
"resetPasswordTitle": "ตั้งรหัสผ่านใหม่",
"resetPasswordDescription": "กรุณาตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ",
"newPassword": "รหัสผ่านใหม่",
"confirmNewPassword": "ยืนยันรหัสผ่านใหม่",
"showPassword": "แสดงรหัสผ่าน",
"hidePassword": "ซ่อนรหัสผ่าน",
"resetPasswordSubmit": "ตั้งรหัสผ่านใหม่",
"resetPasswordSubmitting": "กำลังบันทึก...",
"fullName": "ชื่อ-นามสกุล",
"fullNamePlaceholder": "กรอกชื่อ-นามสกุล",
"organization": "หน่วยงาน/สังกัด",
"confirmPassword": "ยืนยันรหัสผ่าน",
"acceptTerms": "ฉันยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวของห้องสมุดดิจิทัล",
"registerSuccess": "สมัครสมาชิกสำเร็จ",
"registerSubmit": "สมัครสมาชิก",
"registerSubmitting": "กำลังสมัครสมาชิก..."
```

### `messages/en.json` (อังกฤษ):
```json
"forgotPasswordTitle": "Forgot Password",
"forgotPasswordDescription": "Enter your registered email address and we will send you a link to reset your password.",
"forgotPasswordEmailLabel": "Registered email address",
"forgotPasswordSubmit": "Send reset link",
"forgotPasswordSubmitting": "Sending link...",
"forgotPasswordSuccess": "Request sent successfully",
"backToLogin": "Back to login",
"resetPasswordTitle": "Reset Password",
"resetPasswordDescription": "Please set a new password for your account.",
"newPassword": "New password",
"confirmNewPassword": "Confirm new password",
"showPassword": "Show password",
"hidePassword": "Hide password",
"resetPasswordSubmit": "Reset password",
"resetPasswordSubmitting": "Saving...",
"fullName": "Full name",
"fullNamePlaceholder": "Enter your full name",
"organization": "Organization / Affiliation",
"confirmPassword": "Confirm password",
"acceptTerms": "I accept the terms of use and privacy policy of the Digital Library.",
"registerSuccess": "Registration successful",
"registerSubmit": "Register",
"registerSubmitting": "Registering..."
```

### `messages/vi.json` (เวียดนาม):
```json
"forgotPasswordTitle": "Quên mật khẩu",
"forgotPasswordDescription": "Nhập địa chỉ email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.",
"forgotPasswordEmailLabel": "Email đã đăng ký",
"forgotPasswordSubmit": "Gửi liên kết đặt lại",
"forgotPasswordSubmitting": "Đang gửi liên kết...",
"forgotPasswordSuccess": "Gửi yêu cầu thành công",
"backToLogin": "Quay lại đăng nhập",
"resetPasswordTitle": "Đặt lại mật khẩu",
"resetPasswordDescription": "Vui lòng đặt mật khẩu mới cho tài khoản của bạn.",
"newPassword": "Mật khẩu mới",
"confirmNewPassword": "Xác nhận mật khẩu mới",
"showPassword": "Hiện mật khẩu",
"hidePassword": "Ẩn mật khẩu",
"resetPasswordSubmit": "Đặt lại mật khẩu",
"resetPasswordSubmitting": "Đang lưu...",
"fullName": "Họ và tên",
"fullNamePlaceholder": "Nhập họ và tên",
"organization": "Tổ chức / Đơn vị",
"confirmPassword": "Xác nhận mật khẩu",
"acceptTerms": "Tôi đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của Thư viện Số.",
"registerSuccess": "Đăng ký thành công",
"registerSubmit": "Đăng ký",
"registerSubmitting": "Đang đăng ký..."
```

---

## Step 3 — Wire ForgotPasswordForm.tsx

Client Component — เพิ่ม `useTranslations('auth')`:

```tsx
'use client';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordForm() {
  const t = useTranslations('auth');
  // ...

  if (state.status === "success") {
    return (
      <div ...>
        <CheckCircle2 ... />
        <p ...>{t('forgotPasswordSuccess')}</p>
        <p ...>{state.message}</p>
      </div>
    );
  }

  return (
    <form ...>
      <div ...>
        <label htmlFor="email" ...>
          {t('forgotPasswordEmailLabel')}
        </label>
        {/* input เดิม */}
      </div>
      <button ... disabled={isPending}>
        <Send ... />
        {isPending ? t('forgotPasswordSubmitting') : t('forgotPasswordSubmit')}
      </button>
    </form>
  );
}
```

---

## Step 4 — Wire forgot-password/page.tsx

Server Component — เปลี่ยนจาก hardcode เป็น `getTranslations`:

```tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation'; // ไม่ใช่ next/link

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return {
    title: t('forgotPasswordTitle'),
    description: t('forgotPasswordDescription'),
  };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <AuthFormShell
      title={t('forgotPasswordTitle')}
      description={t('forgotPasswordDescription')}
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t('backToLogin')}
        </Link>
      }
    >
      {/* เดิม */}
    </AuthFormShell>
  );
}
```

**สำคัญ:** `Link` ต้อง import จาก `@/i18n/navigation` ไม่ใช่ `next/link`
ตรวจ import ในไฟล์จริงก่อนแก้

---

## Step 5 — Wire ResetPasswordForm.tsx

Client Component — เพิ่ม `useTranslations('auth')`:

```tsx
const t = useTranslations('auth');

// label
<label htmlFor="password">{t('newPassword')}</label>
<label htmlFor="confirmPassword">{t('confirmNewPassword')}</label>

// aria-label ปุ่ม show/hide password
aria-label={showPassword ? t('hidePassword') : t('showPassword')}

// ปุ่ม submit
{isPending ? t('resetPasswordSubmitting') : t('resetPasswordSubmit')}
```

---

## Step 6 — Wire reset-password/page.tsx

ตรวจโครงสร้างจาก Step 1 แล้วเพิ่ม `getTranslations('auth')`:

```tsx
export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('resetPasswordTitle') };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <AuthFormShell
      title={t('resetPasswordTitle')}
      description={t('resetPasswordDescription')}
    >
      {/* เดิม */}
    </AuthFormShell>
  );
}
```

---

## Step 7 — Wire RegisterForm.tsx ส่วนที่เหลือ

Client Component — เพิ่ม keys ที่ยังขาด:

```tsx
// label ชื่อ-นามสกุล
<label htmlFor="fullName">{t('fullName')}</label>
<input placeholder={t('fullNamePlaceholder')} ... />

// label หน่วยงาน
<label htmlFor="organization">{t('organization')}</label>

// label ยืนยันรหัสผ่าน
<label htmlFor="confirmPassword">{t('confirmPassword')}</label>

// terms
<span>{t('acceptTerms')}</span>

// success message
<p>{t('registerSuccess')}</p>

// ปุ่ม submit
{isPending ? t('registerSubmitting') : t('registerSubmit')}
```

ให้ตรวจ `components/auth/RegisterForm.tsx` จริงก่อน อย่า assume ชื่อ field หรือ id

---

## Step 8 — รัน Automated Checks

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npm run test:a11y
```

---

## รายงานผลที่ต้องการ

1. ผล `cat app/[locale]/auth/reset-password/page.tsx` จาก Step 1
2. ไฟล์ที่แก้ไขทั้งหมด
3. ผล tsc / lint / test / build / test:a11y
4. keys ที่ไม่ได้ใช้ (ถ้ามี) — รายงานแต่ไม่ต้องลบ
5. ปัญหาที่พบ + วิธีแก้

---

## ตารางความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| `Link` จาก `next/link` แทน `@/i18n/navigation` | ตรวจ import ก่อนแก้ทุกไฟล์ |
| `useTranslations` ใน Server Component | ตรวจ `'use client'` ก่อนเสมอ |
| Key ไม่ตรงกับที่เพิ่มใน catalog | copy key name จาก Step 2 ตรงๆ |
| `state.message` มาจาก server action (ภาษาไทย hardcode) | ไม่แก้ในรอบนี้ — แสดงค่าเดิม |
