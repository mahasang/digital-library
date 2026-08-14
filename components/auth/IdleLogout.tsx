"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_LIMIT_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
const ACTIVITY_THROTTLE_MS = 5 * 1000;
const STORAGE_KEY = "lastActivityAt";
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

/**
 * ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งานเกิน 10 นาที
 * ใช้ localStorage เก็บเวลากิจกรรมล่าสุด เพื่อให้ทำงานสอดคล้องกันทุกแท็บที่เปิดอยู่
 *
 * `lib/supabase/client.ts` โหลดผ่าน dynamic import() ภายใน callback ที่เช็ค
 * idle timeout เท่านั้น (ไม่ import แบบ static ไว้บนสุดของไฟล์เหมือนเดิม) —
 * component นี้ render อยู่ทุกหน้าผ่าน IdleLogoutGate (root layout) สำหรับ
 * ผู้ใช้ที่ login อยู่ ตัว component เองไม่มี UI ที่มองเห็นเลย (คืน null เสมอ)
 * แต่ static import เดิมทำให้ dependency ของ Supabase client (รวม Realtime
 * client ที่ import มาด้วยเสมอ) ถูก bundle เข้า chunk ที่โหลดทุก route แม้แต่
 * ตอนที่ยังไม่ครบ 10 นาที (คือแทบทุกครั้ง) ก็ตาม — ย้ายเป็น dynamic import()
 * ทำให้โมดูลนี้ถูกโหลดเฉพาะตอน idle timeout เกิดขึ้นจริงเท่านั้น (นานๆ ครั้ง)
 * ไม่กระทบพฤติกรรมใดๆ เลยเพราะไม่มี UI ให้เกิด loading state ที่มองเห็นได้อยู่แล้ว
 */
export default function IdleLogout() {
  const router = useRouter();
  const lastWriteRef = useRef(0);

  useEffect(() => {
    function markActivity() {
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // ไม่มี localStorage (เช่น private mode บางเบราว์เซอร์) ข้ามไปได้ ไม่กระทบการทำงานหลัก
      }
    }

    markActivity();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    );

    const interval = setInterval(async () => {
      let lastActivity = Date.now();
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) lastActivity = Number(stored);
      } catch {
        // ไม่มี localStorage ใช้เวลาปัจจุบันแทน (จะไม่ auto-logout ในกรณีนี้)
      }

      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) {
        clearInterval(interval);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login?timeout=1");
        router.refresh();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, markActivity)
      );
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
