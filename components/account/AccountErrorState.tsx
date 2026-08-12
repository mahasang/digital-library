"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * สถานะข้อผิดพลาดที่ใช้ร่วมกันในหน้ากลุ่มบัญชี — แสดงข้อความทั่วไปเป็นภาษาไทย
 * เสมอ ไม่แสดงข้อความ error ดิบจากเซิร์ฟเวอร์/ฐานข้อมูล (`error.message` อาจมี
 * รายละเอียดภายในที่ไม่ควรให้ผู้ใช้เห็น) — รับ `reset` จาก Next.js error.tsx
 * convention เพื่อให้ลองโหลดใหม่ได้โดยไม่ต้องรีเฟรชทั้งหน้า
 */
export default function AccountErrorState({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-6 w-6 text-red-600" />
      </span>
      <p className="text-sm font-medium text-red-800">ไม่สามารถโหลดข้อมูลได้ในขณะนี้</p>
      <p className="max-w-sm text-sm text-red-600">
        เกิดข้อผิดพลาดบางอย่างระหว่างโหลดข้อมูล กรุณาลองใหม่อีกครั้ง
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-surface px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        <RotateCcw className="h-4 w-4" />
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
