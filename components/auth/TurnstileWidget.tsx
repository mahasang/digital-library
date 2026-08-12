"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptLoadingPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("โหลดสคริปต์ Turnstile ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/**
 * ฝัง Cloudflare Turnstile widget จริง — ต้องได้ token จาก callback ก่อนจึงจะ
 * ส่งฟอร์มได้ (บังคับตรวจสอบซ้ำอีกชั้นฝั่งเซิร์ฟเวอร์เสมอ ไม่เชื่อ client เพียงอย่างเดียว)
 * เก็บ token ไว้ใน hidden input (`inputName`) เพื่อให้ติดไปกับ FormData
 * โดยอัตโนมัติเมื่อฟอร์มถูกส่งผ่าน `<form action={...}>` ปกติ และเปิดให้ใช้ผ่าน
 * `onToken` callback สำหรับฟอร์มที่ประกอบ FormData เองด้วยมือ
 */
export default function TurnstileWidget({
  siteKey,
  inputName = "turnstileToken",
  onToken,
}: {
  siteKey: string;
  inputName?: string;
  onToken?: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [token, setToken] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (t) => {
            setToken(t);
            onTokenRef.current?.(t);
          },
          "error-callback": () => {
            setToken("");
            onTokenRef.current?.("");
          },
          "expired-callback": () => {
            setToken("");
            onTokenRef.current?.("");
          },
        });
      })
      .catch((err) => {
        console.error("TurnstileWidget load failed:", err);
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return (
    <div>
      <div ref={containerRef} />
      <input type="hidden" name={inputName} value={token} />
      {loadError && (
        <p className="text-xs text-amber-600">
          ไม่สามารถโหลดระบบยืนยันตัวตน (CAPTCHA) ได้ในขณะนี้ กรุณาลองรีเฟรชหน้านี้
        </p>
      )}
    </div>
  );
}
