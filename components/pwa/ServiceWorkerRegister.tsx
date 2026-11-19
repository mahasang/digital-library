"use client";

import { useEffect } from "react";
import {
  SERVICE_WORKER_CACHE_PREFIX,
  decideServiceWorkerAction,
} from "@/components/pwa/service-worker-policy";

/**
 * ลงทะเบียน Service Worker แบบ manual ทั้งหมด — เดิมใช้ @ducanh2912/next-pwa
 * แต่ compiled output ของปลั๊กอินนั้นมีบั๊กจริง (auto-inject handlerDidError
 * plugin ที่เรียก _async_to_generator ซึ่งไม่ถูก define ไว้ใน SW scope เลย —
 * ยืนยันแล้วจากการ evaluate โค้ดตรงๆ ภายใน SW execution context) จึงถอด
 * ปลั๊กอินออกทั้งหมด กลับไปใช้ next.config.ts แบบ withNextIntl(nextConfig)
 * เดิม และเขียน public/sw.js เองแบบ minimal ไม่มี dependency (ดูไฟล์นั้น)
 *
 * นอก production (npm run dev) จะไม่ลงทะเบียน และถอด SW/แคชเดิมที่ค้างอยู่ออกให้
 * (ดูเหตุผลใน service-worker-policy.ts)
 */
async function removeServiceWorkerAndCaches() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(SERVICE_WORKER_CACHE_PREFIX))
          .map((key) => caches.delete(key))
      );
    }
  } catch (err) {
    console.warn("[SW] cleanup failed", err);
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const action = decideServiceWorkerAction({
      nodeEnv: process.env.NODE_ENV,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    });
    if (action === "skip") return;
    if (action === "unregister") {
      void removeServiceWorkerAndCaches();
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => console.log("[SW] registered", reg.scope))
      .catch((err) => console.error("[SW] registration failed", err));
  }, []);

  return null;
}
