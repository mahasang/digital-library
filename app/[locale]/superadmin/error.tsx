"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Error boundary ของ /superadmin — จับข้อผิดพลาดที่ไม่คาดคิดระหว่าง render
 * แสดงข้อความทั่วไปแก่ผู้ใช้เท่านั้น (ไม่มี error.message ของ Postgres/
 * stack trace หลุดออกมาใน UI) ส่วนรายละเอียดจริงถูก log ไว้ในคอนโซลฝั่ง
 * เซิร์ฟเวอร์/เบราว์เซอร์สำหรับการแก้ไขปัญหาเท่านั้น
 */
export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Super Admin overview error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-10 text-center">
      <AlertTriangle className="h-10 w-10 text-red-500" />
      <p className="text-sm font-semibold text-red-800">เกิดข้อผิดพลาดที่ไม่คาดคิด</p>
      <p className="text-xs text-red-700">
        ไม่สามารถแสดงหน้านี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาซ้ำ
        กรุณาตรวจสอบ log ฝั่งเซิร์ฟเวอร์
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
      >
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
