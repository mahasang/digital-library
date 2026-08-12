"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "โหมดสว่าง", icon: Sun },
  { value: "dark", label: "โหมดมืด", icon: Moon },
  { value: "system", label: "ตามระบบ", icon: Monitor },
] as const;

/**
 * ตัวสลับธีม Light/Dark/System ที่ใช้ร่วมกันทั้งเว็บ (Hallmark Audit Phase
 * 5) — ใช้ useTheme() จาก next-themes โดยตรง ไม่มี state ของตัวเองซ้ำซ้อน
 * กับ ThemeProvider (ดู docs/theme-system.md) จึงวางซ้ำได้หลายจุด (เดสก์ท็อป
 * + เมนูมือถือ) โดยค่าจะซิงก์กันเองเสมอ
 *
 * รอให้ mount เสร็จก่อนแสดงสถานะ active จริง (`mounted` flag) — เซิร์ฟเวอร์
 * ไม่รู้ค่าที่ผู้ใช้ตั้งไว้ใน localStorage การ render แบบ "ไม่รู้ค่า" ในรอบ
 * แรกของฝั่ง client จึงต้องตรงกับเซิร์ฟเวอร์เป๊ะเพื่อไม่ให้เกิด hydration
 * mismatch — ไอคอนจะขึ้นตรงหลัง mount ทันที (ไม่มี flash ที่สังเกตเห็นได้)
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      role="group"
      aria-label="เลือกโหมดสีของหน้าเว็บ"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-surface-muted p-0.5 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mounted && theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={active}
            aria-label={opt.label}
            title={opt.label}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              active
                ? "bg-surface text-accent shadow-elevated-sm"
                : "text-gray-500 hover:bg-surface hover:text-gray-900"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
