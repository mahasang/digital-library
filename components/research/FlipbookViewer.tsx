"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize,
  Minimize,
  Moon,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// ไฟล์ worker คัดลอกมาจาก pdfjs-dist ไว้ที่ public/ อัตโนมัติทุกครั้งหลัง
// npm install (ดู scripts/copy-pdf-worker.js) — เสิร์ฟเป็น static asset ตรงๆ
// แทนการพึ่ง CDN ภายนอกสำหรับฟีเจอร์หลักของเว็บ
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.125;
const MIN_CONTAINER_WIDTH = 220;
const MAX_CONTAINER_WIDTH = 900;

const TOOLBAR_BUTTON =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--reader-ink-soft)] transition-colors hover:bg-[var(--reader-control-hover)] hover:text-[var(--reader-ink)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

export default function FlipbookViewer({
  fileUrl,
  titleTh,
  downloadUrl,
  downloadDisabled,
}: {
  fileUrl: string;
  titleTh: string;
  downloadUrl?: string;
  downloadDisabled?: boolean;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [baseWidth, setBaseWidth] = useState(480);
  const [zoom, setZoom] = useState(1);
  // ค่าเริ่มต้น "dark" ตรงกับรูปลักษณ์เดิมของ reader ก่อนไฮเดรต (เซิร์ฟเวอร์ไม่รู้
  // ธีมของผู้ใช้) — หลัง mount จะซิงก์ตามธีมของทั้งเว็บครั้งเดียวโดยอัตโนมัติ
  // (ดู readerThemeSynced ด้านล่าง) จากนั้นเป็นอิสระจากธีมเว็บทันทีที่ผู้อ่านกด
  // สลับเอง — ปุ่มสลับในตัว reader ยังคงเป็นสถานะของตัวเองแยกต่างหากเสมอ
  const { resolvedTheme } = useTheme();
  const [readerTheme, setReaderTheme] = useState<"dark" | "light">("dark");
  const readerThemeSynced = useRef(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // refs ที่สะท้อนค่า state ล่าสุดเสมอ — ให้ goPrev/goNext/changePage อ่านค่า
  // ปัจจุบันได้โดยไม่ต้องใส่ currentPage/numPages ไว้ใน dependency array ของ
  // keydown effect (ซึ่งจะทำให้ effect ผูก/ถอด listener ใหม่ทุกครั้งที่พลิกหน้า)
  const currentPageRef = useRef(1);
  const numPagesRef = useRef<number | null>(null);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    numPagesRef.current = numPages;
  }, [numPages]);

  useEffect(() => {
    if (readerThemeSynced.current || !resolvedTheme) return;
    setReaderTheme(resolvedTheme === "light" ? "light" : "dark");
    readerThemeSynced.current = true;
  }, [resolvedTheme]);

  const handleToggleReaderTheme = useCallback(() => {
    readerThemeSynced.current = true;
    setReaderTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    function updateWidth() {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth;
      setBaseWidth(Math.max(MIN_CONTAINER_WIDTH, Math.min(available, MAX_CONTAINER_WIDTH)));
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  function changePage(target: number) {
    const total = numPagesRef.current;
    if (!total) return;
    const clamped = Math.min(Math.max(target, 1), total);
    if (clamped === currentPageRef.current) return;
    setVisible(false);
    setTimeout(() => {
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      setVisible(true);
    }, 150);
  }
  function goPrev() {
    changePage(currentPageRef.current - 1);
  }
  function goNext() {
    changePage(currentPageRef.current + 1);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
        return;
      }
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen, goPrev, goNext]);

  // Ctrl/Cmd+scroll ซูมหน้า — ใช้ setZoom แบบ clamp โดยตรง (ไม่เรียก zoomIn/
  // zoomOut ตรงๆ เพื่อเลี่ยงต้องใส่ไว้ใน dependency array ซึ่งจะทำให้ effect นี้
  // ผูก/ถอด listener ใหม่ทุก render)
  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 1000) / 1000));
      } else if (e.deltaY > 0) {
        setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 1000) / 1000));
      }
    }
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  const isEditingRef = useRef(false);
  useEffect(() => {
    if (!isEditingRef.current) {
      setPageInput(String(currentPage));
    }
  }, [currentPage]);

  // Fullscreen API ไม่รองรับในทุกเบราว์เซอร์ (เช่น iOS Safari) — ตรวจสอบก่อน
  // แสดงปุ่ม แทนที่จะแสดงปุ่มที่กดแล้วไม่ทำงาน; component นี้ไม่ถูก
  // server-render อยู่แล้ว (ssr:false ใน FlipbookViewerLoader) จึงเช็ค
  // document ตรงๆ ใน useEffect ได้โดยไม่มีปัญหา hydration mismatch
  useEffect(() => {
    setFullscreenSupported(typeof document !== "undefined" && Boolean(document.fullscreenEnabled));
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!shellRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shellRef.current.requestFullscreen();
      }
    } catch {
      // เบราว์เซอร์บางตัวปฏิเสธคำขอเต็มจอ (เช่นไม่ได้มาจาก user gesture โดยตรง)
      // — ไม่มีอะไรให้ทำเพิ่มฝั่ง client นอกจากปล่อยผ่านเงียบๆ
    }
  }

  function goToPage(target: number) {
    changePage(target);
  }
  function commitPageInput() {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    goToPage(parsed);
  }
  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 1000) / 1000));
  }
  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 1000) / 1000));
  }
  function resetZoom() {
    setZoom(1);
  }

  const pageWidth = Math.round(baseWidth * zoom);

  return (
    <div
      ref={shellRef}
      data-reader-theme={readerTheme}
      className={`reader-shell flex flex-col rounded-xl border border-[var(--reader-border)] bg-[var(--reader-surface)] shadow-elevated-md ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--reader-border)] px-3 py-2.5 sm:px-4">
        <p className="line-clamp-1 text-xs text-[var(--reader-ink-soft)]">{titleTh}</p>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="ย่อขนาดหน้า"
            aria-label="ย่อขนาดหน้า"
            className={TOOLBAR_BUTTON}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            title="รีเซ็ตเป็น 100%"
            aria-label={`ขนาดหน้าปัจจุบัน ${Math.round(zoom * 100)}% — กดเพื่อรีเซ็ตเป็น 100%`}
            className={`${TOOLBAR_BUTTON} tabular-nums`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="ขยายขนาดหน้า"
            aria-label="ขยายขนาดหน้า"
            className={TOOLBAR_BUTTON}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <span className="mx-1 h-4 w-px bg-[var(--reader-border)]" aria-hidden="true" />

          <button
            type="button"
            onClick={handleToggleReaderTheme}
            title={readerTheme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
            aria-label={readerTheme === "dark" ? "สลับหน้าอ่านเป็นโหมดสว่าง" : "สลับหน้าอ่านเป็นโหมดมืด"}
            className={TOOLBAR_BUTTON}
          >
            {readerTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "แสดงผลเต็มจอ"}
              aria-label={isFullscreen ? "ออกจากโหมดเต็มจอ" : "แสดงผลเต็มจอ"}
              className={TOOLBAR_BUTTON}
            >
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </button>
          )}

          <span className="mx-1 h-4 w-px bg-[var(--reader-border)]" aria-hidden="true" />

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="เปิดเอกสารในแท็บใหม่"
            className={TOOLBAR_BUTTON}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">เปิดในแท็บใหม่</span>
          </a>
          {downloadUrl && !downloadDisabled && (
            <a
              href={downloadUrl}
              title="ดาวน์โหลดไฟล์ PDF"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Download className="h-3.5 w-3.5" />
              ดาวน์โหลด
            </a>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`relative flex min-h-[65vh] items-center justify-center bg-[var(--reader-bg)] py-6 sm:min-h-[75vh] ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}
      >
        {failed ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
            <p className="text-sm font-medium text-[var(--reader-ink)]">
              ไม่สามารถแสดงเอกสารในหน้านี้ได้
            </p>
            <p className="text-xs text-[var(--reader-ink-faint)]">
              เบราว์เซอร์ของคุณอาจไม่รองรับการแสดงผลแบบนี้ กรุณาใช้ปุ่ม &quot;เปิดในแท็บใหม่&quot;
              ด้านบนแทน
            </p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: total }) => setNumPages(total)}
            onLoadError={(error) => {
              console.error("FlipbookViewer: โหลดเอกสารไม่สำเร็จ:", error.message);
              setFailed(true);
            }}
            loading={
              <div className="flex items-center gap-2 text-sm text-[var(--reader-ink-soft)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลดเอกสาร...
              </div>
            }
            error={
              <div className="flex items-center gap-2 text-sm text-[var(--reader-ink-soft)]">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                ไม่สามารถโหลดเอกสารได้
              </div>
            }
          >
            {numPages && (
              <div
                className="bg-surface shadow-2xl"
                style={{ opacity: visible ? 1 : 0, transition: "opacity 0.15s ease" }}
              >
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  loading={
                    <div
                      style={{ width: pageWidth, height: Math.round(pageWidth * 1.4142) }}
                      className="flex items-center justify-center bg-[var(--reader-page-slot-bg)]"
                    >
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--reader-ink-faint)]" />
                    </div>
                  }
                />
              </div>
            )}
          </Document>
        )}
      </div>

      {numPages && !failed && (
        <div className="flex items-center justify-center gap-4 border-t border-[var(--reader-border)] px-4 py-2.5">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 1}
            title="หน้าก่อนหน้า (คีย์ลูกศรซ้าย)"
            aria-label="ไปหน้าก่อนหน้า"
            className={TOOLBAR_BUTTON}
          >
            <ChevronLeft className="h-4 w-4" />
            ก่อนหน้า
          </button>
          <span className="flex items-center gap-1.5 text-xs tabular-nums text-[var(--reader-ink-faint)]">
            หน้า
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              onFocus={() => {
                isEditingRef.current = true;
              }}
              onBlur={() => {
                isEditingRef.current = false;
                commitPageInput();
              }}
              aria-label="ไปยังหน้าที่ต้องการ"
              className="w-12 rounded-md border border-[var(--reader-border)] bg-transparent px-1.5 py-0.5 text-center tabular-nums text-[var(--reader-ink)] focus:border-brand-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            / {numPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= numPages}
            title="หน้าถัดไป (คีย์ลูกศรขวา)"
            aria-label="ไปหน้าถัดไป"
            className={TOOLBAR_BUTTON}
          >
            ถัดไป
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
