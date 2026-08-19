"use client";

import { useEffect } from "react";

/**
 * ลงทะเบียน Service Worker แบบ manual ทั้งหมด — เดิมใช้ @ducanh2912/next-pwa
 * แต่ compiled output ของปลั๊กอินนั้นมีบั๊กจริง (auto-inject handlerDidError
 * plugin ที่เรียก _async_to_generator ซึ่งไม่ถูก define ไว้ใน SW scope เลย —
 * ยืนยันแล้วจากการ evaluate โค้ดตรงๆ ภายใน SW execution context) จึงถอด
 * ปลั๊กอินออกทั้งหมด กลับไปใช้ next.config.ts แบบ withNextIntl(nextConfig)
 * เดิม และเขียน public/sw.js เองแบบ minimal ไม่มี dependency (ดูไฟล์นั้น)
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => console.log("[SW] registered", reg.scope))
      .catch((err) => console.error("[SW] registration failed", err));
  }, []);

  return null;
}
