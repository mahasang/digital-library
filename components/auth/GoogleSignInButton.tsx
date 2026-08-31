"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";


/**
 * ใช้ปุ่มธรรมดา + useTransition แทน <form action={signInWithGoogleAction}>
 * เพราะ component นี้ถูกวางไว้ "ข้างใน" <form> ของ LoginForm/RegisterForm
 * เสมอ (ดู scope ข้อห้ามของ file_prompt/fix-google-button.md — ห้ามย้ายออก
 * จาก form เดิม) การมี <form> ซ้อนกันเป็น HTML ที่ไม่ถูกต้อง (forms นับซ้อนกัน
 * ไม่ได้) เบราว์เซอร์จะปรับโครงสร้าง DOM ให้เองแบบเงียบๆ จนไม่ตรงกับที่ React
 * คิดว่า render ไว้ ทำให้ React 19 form action tracking สับสนแล้วโยน error
 * "A React form was unexpectedly submitted" ตอน production build — ไม่ใช้
 * <form> เลยจึงตัดปัญหาการซ้อน form ทิ้งไปตั้งแต่ต้น
 */
export default function GoogleSignInButton() {
  const t = useTranslations("auth");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.042l3.007-2.332z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          />
        </svg>
      )}
      {isPending ? t("loginSubmitting") : t("signInWithGoogle")}
    </button>
  );
}
