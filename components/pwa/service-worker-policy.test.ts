import { describe, expect, it } from "vitest";
import {
  SERVICE_WORKER_CACHE_PREFIX,
  decideServiceWorkerAction,
} from "@/components/pwa/service-worker-policy";

describe("decideServiceWorkerAction", () => {
  it("นอก production (dev/test) ไม่ลงทะเบียน แต่ให้ถอดของเดิมที่ค้างอยู่ ไม่ว่าจะเปิดจากโฮสต์ไหน", () => {
    for (const nodeEnv of ["development", "test", undefined]) {
      for (const hostname of ["localhost", "127.0.0.1", "example.com"]) {
        expect(
          decideServiceWorkerAction({ nodeEnv, protocol: "http:", hostname })
        ).toBe("unregister");
      }
    }
  });

  it("production บน https ลงทะเบียนตามปกติ", () => {
    expect(
      decideServiceWorkerAction({
        nodeEnv: "production",
        protocol: "https:",
        hostname: "digital-library-sls.vercel.app",
      })
    ).toBe("register");
  });

  it("production บน localhost (รัน production build ในเครื่อง เช่น test:a11y) ลงทะเบียนเหมือนเดิม", () => {
    expect(
      decideServiceWorkerAction({
        nodeEnv: "production",
        protocol: "http:",
        hostname: "localhost",
      })
    ).toBe("register");
  });

  it("production บน http ที่ไม่ใช่ localhost ข้าม (ไม่ลงทะเบียน และไม่ถอด)", () => {
    expect(
      decideServiceWorkerAction({
        nodeEnv: "production",
        protocol: "http:",
        hostname: "192.168.1.10",
      })
    ).toBe("skip");
  });

  it("ชื่อแคชที่ถอดตรงกับชื่อแคชใน public/sw.js", () => {
    expect("ebooks-v1".startsWith(SERVICE_WORKER_CACHE_PREFIX)).toBe(true);
    expect("ebooks-v2".startsWith(SERVICE_WORKER_CACHE_PREFIX)).toBe(true);
    expect("workbox-precache".startsWith(SERVICE_WORKER_CACHE_PREFIX)).toBe(false);
  });
});
