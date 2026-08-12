"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * จุดเดียวที่ตั้งค่าระบบธีมทั้งเว็บ (Hallmark Audit Phase 5) — ห่อไว้เป็น
 * component ของโปรเจกต์เองแทนการเรียก next-themes ตรงๆ ในแต่ละ layout เพื่อ
 * ไม่ให้ config (attribute/ค่าเริ่มต้น) กระจายซ้ำหลายจุด ดู
 * docs/theme-system.md
 *
 * attribute="data-theme" — ใช้ attribute เดียวกับที่ app/globals.css กำหนดมา
 * ตั้งแต่ Phase 0 (`:root[data-theme="dark"]`) ไม่ใช่ค่าเริ่มต้นของ
 * next-themes (`class`) เพื่อไม่ต้องแก้ CSS ที่มีอยู่แล้ว
 * defaultTheme="system" + enableSystem — ตรงตามข้อกำหนด "System preference
 * via prefers-color-scheme"
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
