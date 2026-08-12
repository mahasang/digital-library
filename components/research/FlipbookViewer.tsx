"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Document, Page, pdfjs } from "react-pdf";
import HTMLFlipBook from "react-pageflip";
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

/** จำนวนหน้าก่อน/หลังหน้าปัจจุบันที่ยอม render เนื้อหาจริง — หน้านอกช่วงนี้
 * แสดงกรอบเปล่าขนาดเท่ากันไปก่อน เพื่อไม่ให้ต้อง render ทุกหน้าพร้อมกันตอน
 * เปิดเอกสารยาวๆ (หลายสิบ/หลายร้อยหน้า) ซึ่งจะทำให้หน้าเว็บหน่วง */
const RENDER_WINDOW = 2;
const DEFAULT_ASPECT_RATIO = 1.4142; // A4 แนวตั้งโดยประมาณ ใช้จนกว่าจะรู้ขนาดจริงจากหน้าแรก

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.125;

const TOOLBAR_BUTTON =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--reader-ink-soft)] transition-colors hover:bg-[var(--reader-control-hover)] hover:text-[var(--reader-ink)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

interface PdfPageProps {
  pageNumber: number;
  width: number;
  shouldRender: boolean;
  onFirstPageLoad?: (aspectRatio: number) => void;
}

const PdfPage = forwardRef<HTMLDivElement, PdfPageProps>(
  ({ pageNumber, width, shouldRender, onFirstPageLoad }, ref) => {
    return (
      <div
        ref={ref}
        // พื้นหลังของหน้าเอกสารจริงคงเป็นสีขาวเสมอไม่ว่าจะสลับโหมดสีของ
        // "เปลือก" reader เป็นแบบไหน — หน้ากระดาษต้องดูเป็นหน้าเอกสารจริง
        // ไม่ใช่ส่วนหนึ่งของ UI ที่เปลี่ยนสีไปมา
        className="page-flip-page relative flex h-full w-full items-center justify-center overflow-hidden bg-surface"
      >
        {shouldRender ? (
          <Page
            pageNumber={pageNumber}
            width={width}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            onLoadSuccess={
              onFirstPageLoad
                ? (page) => {
                    const viewport = page.getViewport({ scale: 1 });
                    if (viewport.width > 0) {
                      onFirstPageLoad(viewport.height / viewport.width);
                    }
                  }
                : undefined
            }
            loading={
              <div className="flex h-full w-full items-center justify-center bg-[var(--reader-page-slot-bg)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--reader-ink-faint)]" />
              </div>
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--reader-page-slot-bg)] text-xs text-[var(--reader-ink-faint)]">
            หน้า {pageNumber}
          </div>
        )}
      </div>
    );
  }
);
PdfPage.displayName = "PdfPage";

interface PageFlipApi {
  flipNext: () => void;
  flipPrev: () => void;
  turnToPage: (page: number) => void;
  getCurrentPageIndex: () => number;
}

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
  const [currentPage, setCurrentPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [baseWidth, setBaseWidth] = useState(360);
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
  // react-pageflip ไม่ export type ของ ref ที่แม่นยำ — ใช้ any เท่าที่จำเป็นเฉพาะจุดนี้
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);

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
      setBaseWidth(Math.max(200, Math.min(available > 700 ? available / 2 : available, 480)));
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const api: PageFlipApi | undefined = bookRef.current?.pageFlip?.();
      if (!api) return;
      if (e.key === "ArrowLeft") api.flipPrev();
      if (e.key === "ArrowRight") api.flipNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleFirstPageLoad = useCallback((ratio: number) => setAspectRatio(ratio), []);

  function goPrev() {
    bookRef.current?.pageFlip?.()?.flipPrev();
  }
  function goNext() {
    bookRef.current?.pageFlip?.()?.flipNext();
  }
  function handleFlip(event: { data: number }) {
    setCurrentPage(event.data);
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
  const bookHeight = Math.round(pageWidth * aspectRatio);

  return (
    <div
      ref={shellRef}
      data-reader-theme={readerTheme}
      className="reader-shell flex flex-col overflow-hidden rounded-xl border border-[var(--reader-border)] bg-[var(--reader-surface)] shadow-elevated-md"
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
        className="relative flex min-h-[65vh] items-center justify-center overflow-auto bg-[var(--reader-bg)] py-6 sm:min-h-[75vh]"
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
              <HTMLFlipBook
                ref={bookRef}
                width={pageWidth}
                height={bookHeight}
                size="fixed"
                minWidth={150}
                maxWidth={720}
                minHeight={210}
                maxHeight={1350}
                startPage={0}
                drawShadow
                flippingTime={500}
                usePortrait
                startZIndex={0}
                autoSize={false}
                maxShadowOpacity={0.5}
                showCover
                mobileScrollSupport={false}
                clickEventForward
                useMouseEvents
                swipeDistance={30}
                showPageCorners
                disableFlipByClick={false}
                onFlip={handleFlip}
                className="mx-auto shadow-2xl"
                style={{}}
              >
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
                  <PdfPage
                    key={pageNumber}
                    pageNumber={pageNumber}
                    width={pageWidth}
                    shouldRender={Math.abs(pageNumber - 1 - currentPage) <= RENDER_WINDOW}
                    onFirstPageLoad={pageNumber === 1 ? handleFirstPageLoad : undefined}
                  />
                ))}
              </HTMLFlipBook>
            )}
          </Document>
        )}
      </div>

      {numPages && !failed && (
        <div className="flex items-center justify-center gap-4 border-t border-[var(--reader-border)] px-4 py-2.5">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 0}
            title="หน้าก่อนหน้า (คีย์ลูกศรซ้าย)"
            aria-label="ไปหน้าก่อนหน้า"
            className={TOOLBAR_BUTTON}
          >
            <ChevronLeft className="h-4 w-4" />
            ก่อนหน้า
          </button>
          <span className="text-xs tabular-nums text-[var(--reader-ink-faint)]">
            หน้า {Math.min(currentPage + 1, numPages)} / {numPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= numPages - 1}
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
