"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LogOut } from "lucide-react";

/**
 * โหลด `lib/supabase/client.ts` (และ `@supabase/supabase-js` ทั้งก้อนที่มัน
 * ผูกมาด้วย — รวม Realtime client ที่ instantiate เสมอไม่ว่าจะใช้จริงหรือไม่)
 * แบบ dynamic import() ภายใน handler แทนการ import แบบ static ไว้บนสุดของ
 * ไฟล์ — ปุ่มนี้ render อยู่ในทุกหน้าผ่าน UserMenu/HeaderAccountArea (root
 * layout) ดังนั้น static import เดิมทำให้ปุ่มนี้ (พร้อม dependency ทั้งหมด)
 * ถูก bundle รวมเข้า chunk ที่โหลดทุก route แม้แต่หน้า guest ที่ไม่มีปุ่มนี้
 * render เลยก็ตาม (ดู docs/realtime-bundle-optimization.md) — ย้ายมาเป็น
 * dynamic import() ไม่เปลี่ยนพฤติกรรมใดๆ ที่มองเห็นได้เลย (ปุ่มยัง render
 * ทันทีเหมือนเดิมทุกประการ, ไม่มี loading state ใหม่) เพราะ createClient()
 * ถูกเรียกใช้ตอนกดปุ่มอยู่แล้วในโค้ดเดิม ไม่ได้เรียกตอน mount — แค่ตอนนี้
 * ตัวไฟล์ที่มี createClient() เองก็โหลดตอนกดปุ่มเช่นกัน ไม่ใช่โหลดล่วงหน้า
 */
export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("header");

  function handleLogout() {
    startTransition(async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={
        className ||
        "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <LogOut className="h-4 w-4" />
      {isPending ? t("loggingOut") : t("logout")}
    </button>
  );
}
