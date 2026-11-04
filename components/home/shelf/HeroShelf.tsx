"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { detectCapability, shouldEnable3D } from "@/components/home/shelf/capability";
import ShelfControls from "@/components/home/shelf/ShelfControls";
import { stepIndex } from "@/components/home/shelf/shelfMath";
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
  const handleRef = useRef<ShelfSceneHandle | undefined>(undefined);
  const [mode, setMode] = useState<ShelfMode>("list");
  // เริ่มกลางชั้นเพื่อให้มีหนังสือทั้งสองข้างของเล่มที่เลือกบนจอกว้าง
  const [index, setIndex] = useState(() => Math.floor(books.length / 2));
  const initialIndexRef = useRef(index);

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
    const section = sectionRef.current;
    if (!wantsScene || !canvas || !section) return;

    let cancelled = false;
    let stopWatching: (() => void) | undefined;

    const release = () => {
      stopWatching?.();
      stopWatching = undefined;
      handleRef.current?.dispose();
      handleRef.current = undefined;
    };

    const fallBackToList = () => {
      if (cancelled) return;
      cancelled = true;
      release();
      setMode("list");
      setWantsScene(false);
    };

    /** หยุดเรนเดอร์เมื่อแถบพ้นจอหรือแท็บถูกซ่อน และปรับขนาดตามแถบ */
    const watch = (handle: ShelfSceneHandle) => {
      let onScreen = true;
      const sync = () => handle.setVisible(onScreen && !document.hidden);

      const resizeObserver = new ResizeObserver(() =>
        handle.resize(canvas.clientWidth, canvas.clientHeight),
      );
      resizeObserver.observe(canvas);

      const visibilityObserver = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      });
      visibilityObserver.observe(section);
      document.addEventListener("visibilitychange", sync);

      return () => {
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", sync);
      };
    };

    import("@/components/home/shelf/shelfScene")
      .then(async ({ createShelfScene }) => {
        if (cancelled) return;
        const handle = createShelfScene(canvas, books, {
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          initialIndex: initialIndexRef.current,
          onSelect: setIndex,
          onOpen: () => undefined,
          onError: fallBackToList,
        });
        handleRef.current = handle;
        stopWatching = watch(handle);
        await handle.ready;
        if (!cancelled) setMode("3d");
      })
      .catch(fallBackToList);

    return () => {
      cancelled = true;
      release();
      setMode("list");
    };
  }, [wantsScene, books]);

  function focusedBookIndex(target: EventTarget): number | null {
    const link = (target as HTMLElement).closest<HTMLElement>("[data-shelf-index]");
    return link?.tagName === "A" ? Number(link.dataset.shelfIndex) : null;
  }

  /** ลิงก์ซ่อนอยู่แต่ยังโฟกัสได้ ชั้นจึงต้องเลื่อนตามเพื่อให้เห็นว่ากำลังอยู่ที่เล่มไหน */
  function handleFocus(event: FocusEvent<HTMLElement>) {
    const bookIndex = focusedBookIndex(event.target);
    if (bookIndex !== null) handleRef.current?.goTo(bookIndex);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (mode !== "3d" || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();

    const next = stepIndex(index, event.key === "ArrowRight" ? 1 : -1, books.length);
    handleRef.current?.goTo(next);
    // Enter ต้องพาไปเล่มที่เห็นอยู่ ไม่ใช่ลิงก์เดิมที่โฟกัสค้างไว้
    if (focusedBookIndex(event.target) !== null) {
      sectionRef.current?.querySelector<HTMLElement>(`a[data-shelf-index="${next}"]`)?.focus();
    }
  }

  return (
    <section
      ref={sectionRef}
      data-testid="hero-shelf"
      data-shelf-mode={mode}
      data-shelf-index={index}
      aria-label={t("shelfLabel")}
      onFocusCapture={handleFocus}
      onKeyDown={handleKeyDown}
      className={`relative h-[260px] border-b-[10px] outline-2 outline-offset-[-4px] outline-white sm:h-[clamp(280px,38vh,420px)] [&:has(a:focus-visible)]:outline ${
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
      {mode === "3d" && (
        <ShelfControls
          index={index}
          count={books.length}
          title={books[index].title}
          onChange={(next) => handleRef.current?.goTo(next)}
          onInspect={() => undefined}
        />
      )}
    </section>
  );
}
