"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/** ปุ่มแชร์ฝั่งไคลเอนต์ล้วนๆ — ใช้ Web Share API ของเบราว์เซอร์ถ้ามี (ส่วนใหญ่
 * บนมือถือ) ไม่มีก็คัดลอกลิงก์หน้านี้แทน ไม่มีการเรียก API เซิร์ฟเวอร์เพิ่มเติม */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // ผู้ใช้ปิด share sheet เอง หรืออุปกรณ์รายงานว่ารองรับแต่ใช้งานไม่ได้จริง
        // — ทำต่อด้วยการคัดลอกลิงก์แทนโดยไม่ต้องแจ้ง error
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ไม่มี Clipboard API ให้ใช้งานในบริบทนี้ — ไม่มีอะไรให้ทำเพิ่มฝั่ง client
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {copied ? "คัดลอกลิงก์แล้ว" : "แชร์"}
    </button>
  );
}
