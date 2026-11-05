"use client";

import {
  useCallback,
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
import ShelfInspector from "@/components/home/shelf/ShelfInspector";
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

/** โฟกัสต้องวนอยู่ในแผงข้อมูลขณะเปิด dialog แม้ผู้ใช้เพิ่งคลิกเล่มจนโฟกัสหลุดไปที่ body */
function trapTab(event: globalThis.KeyboardEvent, section: HTMLElement) {
  const items = Array.from(
    section.querySelectorAll<HTMLElement>("[data-shelf-panel] a, [data-shelf-panel] button"),
  );
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (!active || !items.includes(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
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
  const [selected, setSelected] = useState(() => Math.floor(books.length / 2));
  const latestIndexRef = useRef(selected);
  const [inspecting, setInspecting] = useState(false);
  // refresh อาจส่งรายการใหม่ที่สั้นลง จึงห้ามใช้ค่าที่เกินรายการ
  const index = stepIndex(selected, 0, books.length);
  // array ใหม่ที่เล่มเหมือนเดิมต้องไม่ทำให้สร้าง scene ซ้ำ
  const bookKey = books.map((book) => book.id).join("|");

  const openBook = useCallback((bookIndex: number) => {
    handleRef.current?.inspect(bookIndex);
    setInspecting(true);
  }, []);

  const closeBook = useCallback(() => {
    handleRef.current?.closeInspect();
    setInspecting(false);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!inspecting || !section) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ฟังที่ document เพราะการลากหมุนเล่มทำให้โฟกัสหลุดออกจาก section
    const handleDialogKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeBook();
      if (event.key === "Tab") trapTab(event, section);
    };
    document.addEventListener("keydown", handleDialogKey);

    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      document.body.style.overflow = previousOverflow;
      section.querySelector<HTMLElement>("[data-shelf-inspect]")?.focus();
    };
  }, [inspecting, closeBook]);

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

    const fallBackToList = (error: unknown) => {
      if (cancelled) return;
      cancelled = true;
      // ผู้ใช้ยังใช้รายการลิงก์ได้ตามปกติ แต่ต้องเหลือร่องรอยไว้ไล่ปัญหา
      console.warn("[HeroShelf] 3D shelf unavailable", error);
      release();
      setInspecting(false);
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
        latestIndexRef.current = stepIndex(latestIndexRef.current, 0, books.length);
        setSelected(latestIndexRef.current);
        const handle = createShelfScene(canvas, books, {
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          initialIndex: latestIndexRef.current,
          onSelect: (next) => {
            latestIndexRef.current = next;
            setSelected(next);
          },
          onOpen: openBook,
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
    // bookKey แทน books: สร้าง scene ใหม่เฉพาะเมื่อเล่มบนชั้นเปลี่ยนจริง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsScene, bookKey, openBook]);

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
    if (inspecting || mode !== "3d") return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();

    const next = stepIndex(index, event.key === "ArrowRight" ? 1 : -1, books.length);
    handleRef.current?.goTo(next);
    // Enter ต้องพาไปเล่มที่เห็นอยู่ ไม่ใช่ลิงก์เดิมที่โฟกัสค้างไว้
    if (focusedBookIndex(event.target) !== null) {
      sectionRef.current?.querySelector<HTMLElement>(`a[data-shelf-index="${next}"]`)?.focus();
    }
  }

  const listClass = inspecting ? "hidden" : mode === "3d" ? "sr-only" : "h-full";
  const sectionClass = inspecting
    ? "fixed inset-0 z-50 bg-brand-950"
    : `relative h-full border-b-[10px] outline-2 outline-offset-[-4px] outline-white [&:has(a:focus-visible)]:outline ${
        mode === "3d" ? "border-transparent" : "border-[#5A3A26]"
      }`;
  const canvasPlacement = inspecting
    ? "left-0 top-0 h-[52%] w-full lg:h-full lg:w-[calc(100%-26rem)]"
    : "inset-x-0 top-0 h-[calc(100%+10px)] w-full touch-pan-y";

  return (
    // กล่องนอกคงความสูงไว้ เปิด dialog แล้ว hero จึงไม่ยุบและหน้าเว็บด้านหลังไม่ขยับ
    <div className="relative h-[260px] sm:h-[clamp(280px,38vh,420px)]">
      <section
        ref={sectionRef}
        data-testid="hero-shelf"
        data-shelf-mode={mode}
        data-shelf-index={index}
        role={inspecting ? "dialog" : undefined}
        aria-modal={inspecting ? true : undefined}
        aria-label={inspecting ? books[index].title : t("shelfLabel")}
        onFocusCapture={handleFocus}
        onKeyDown={handleKeyDown}
        className={sectionClass}
      >
        <div className={listClass}>{children}</div>
        {wantsScene && (
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute cursor-grab transition-opacity duration-300 active:cursor-grabbing ${canvasPlacement} ${
              mode === "3d" ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        )}
        {mode === "3d" && !inspecting && (
          <ShelfControls
            index={index}
            count={books.length}
            title={books[index].title}
            onChange={(next) => handleRef.current?.goTo(next)}
            onInspect={() => openBook(index)}
          />
        )}
        {inspecting && <ShelfInspector book={books[index]} onClose={closeBook} />}
      </section>
    </div>
  );
}
