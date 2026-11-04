"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { detectCapability, shouldEnable3D } from "@/components/home/shelf/capability";
import type { ShelfSceneHandle } from "@/components/home/shelf/shelfScene";
import type { ShelfBook } from "@/components/home/shelf/types";

type ShelfMode = "list" | "3d";

/** รอให้หน้าโหลดเสร็จและเบราว์เซอร์ว่าง 3D จึงไม่แย่งงานช่วงแสดงผลครั้งแรก */
function whenIdleAfterLoad(callback: () => void): () => void {
  let idleHandle: number | undefined;
  const schedule = () => {
    idleHandle = window.requestIdleCallback
      ? window.requestIdleCallback(callback, { timeout: 2000 })
      : window.setTimeout(callback, 200);
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    window.removeEventListener("load", schedule);
    if (idleHandle === undefined) return;
    if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
    else window.clearTimeout(idleHandle);
  };
}

/** แถบชั้นเต็มความกว้าง กันความสูงไว้ตั้งแต่ HTML แรกเพื่อไม่ให้เกิด layout shift */
export default function HeroShelf({
  books,
  children,
}: {
  books: ShelfBook[];
  children: ReactNode;
}) {
  const t = useTranslations("home");
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wantsScene, setWantsScene] = useState(false);
  const [mode, setMode] = useState<ShelfMode>("list");

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let cancelIdle: (() => void) | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        cancelIdle = whenIdleAfterLoad(() => {
          if (shouldEnable3D(detectCapability())) setWantsScene(true);
        });
      },
      { rootMargin: "200px" },
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      cancelIdle?.();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!wantsScene || !canvas) return;

    let cancelled = false;
    let handle: ShelfSceneHandle | undefined;

    const fallBackToList = () => {
      if (cancelled) return;
      cancelled = true;
      handle?.dispose();
      handle = undefined;
      setMode("list");
      setWantsScene(false);
    };

    import("@/components/home/shelf/shelfScene")
      .then(async ({ createShelfScene }) => {
        if (cancelled) return;
        handle = createShelfScene(canvas, books, {
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          // เริ่มกลางชั้นเพื่อให้มีหนังสือทั้งสองข้างของเล่มที่เลือกบนจอกว้าง
          initialIndex: Math.floor(books.length / 2),
          onSelect: () => undefined,
          onOpen: () => undefined,
          onError: fallBackToList,
        });
        await handle.ready;
        if (!cancelled) setMode("3d");
      })
      .catch(fallBackToList);

    return () => {
      cancelled = true;
      handle?.dispose();
      setMode("list");
    };
  }, [wantsScene, books]);

  return (
    <section
      ref={sectionRef}
      data-testid="hero-shelf"
      data-shelf-mode={mode}
      aria-label={t("shelfLabel")}
      className={`relative h-[260px] border-b-[10px] sm:h-[clamp(280px,38vh,420px)] ${
        mode === "3d" ? "border-transparent" : "border-[#5A3A26]"
      }`}
    >
      <div className={mode === "3d" ? "sr-only" : "h-full"}>{children}</div>
      {wantsScene && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-[calc(100%+10px)] w-full cursor-grab touch-pan-y transition-opacity duration-300 active:cursor-grabbing ${
            mode === "3d" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </section>
  );
}
