import Link from "next/link";
import type { Metadata } from "next";
import {
  getPdfProcessingCandidates,
  getPdfProcessingCandidatesCount,
  type PdfProcessingFilter,
} from "@/lib/data/pdf-processing.server";
import { getRecentJobBatches, getFailedJobs, getRecentJobs } from "@/lib/data/job-batches.server";
import RecentJobsPoller from "@/components/superadmin/RecentJobsPoller";
import { getDefaultBatchSize } from "@/lib/data/job-type-settings.server";
import { getActiveCategoriesWithId } from "@/lib/data/categories.server";
import { getDistinctResearchYears } from "@/lib/data/duplicate-scan-candidates.server";
import BulkJobSelector, { type BulkSelectItem } from "@/components/superadmin/BulkJobSelector";
import ProcessQueueNowButton from "@/components/superadmin/ProcessQueueNowButton";
import { FailedJobList } from "@/components/superadmin/JobBatchList";
import JobProgressPoller from "@/components/superadmin/JobProgressPoller";
import BulkAllMatchingFilterDialog from "@/components/superadmin/BulkAllMatchingFilterDialog";
import type { OcrBulkFilter } from "@/lib/validation/bulk-filters";
import {
  bulkEnqueuePdfExtractionAction,
  retryFailedPdfJobAction,
  bulkEnqueueOcrAction,
  retryFailedOcrJobAction,
  bulkEnqueueAllMatchingFilterAction,
  pauseBatchAction,
  resumeBatchAction,
  cancelBatchAction,
  retryFailedInBatchAction,
} from "./actions";

export const metadata: Metadata = { title: "ประมวลผลข้อความ PDF — Super Admin" };
export const dynamic = "force-dynamic";

const FILTERS: { value: PdfProcessingFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "no_text", label: "ยังไม่มีข้อความ" },
  { value: "failed", label: "ดึงข้อความไม่สำเร็จ" },
  { value: "no_text_found", label: "ไม่พบข้อความ (อาจเป็นไฟล์สแกน)" },
  { value: "replaced", label: "ไฟล์ถูกแทนที่ (ยังไม่ประมวลผลไฟล์ใหม่)" },
];

const OCR_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "ทุกสถานะ OCR" },
  { value: "not_required", label: "ไม่จำเป็นต้อง OCR" },
  { value: "pending", label: "รอ OCR" },
  { value: "failed", label: "OCR ล้มเหลว" },
];

const PUBLISH_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "ทุกสถานะเผยแพร่" },
  { value: "draft", label: "ฉบับร่าง" },
  { value: "pending_review", label: "รอตรวจสอบ" },
  { value: "published", label: "เผยแพร่แล้ว" },
  { value: "archived", label: "เก็บถาวร" },
];

type Mode = "extract" | "ocr";

export default async function PdfProcessingPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    mode?: string;
    year?: string;
    categoryId?: string;
    publishStatus?: string;
    ocrStatus?: string;
  }>;
}) {
  const params = await searchParams;
  const mode: Mode = params.mode === "ocr" ? "ocr" : "extract";
  const filter: PdfProcessingFilter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as PdfProcessingFilter)
    : "all";
  const year = params.year ? Number(params.year) : undefined;
  const categoryId = params.categoryId || undefined;
  const publishStatus = params.publishStatus || undefined;
  const ocrStatus = params.ocrStatus || undefined;

  const jobType = mode === "ocr" ? "ocr_processing" : "pdf_text_extraction";

  // PdfProcessingFilter "no_text" (หน้าเว็บ, ไม่เคยดึงข้อความเลย) ตรงกับ
  // extractionState "never_attempted" ของ RPC ใหม่ (ช่วงที่ 28) — ค่าที่เหลือ
  // (failed/no_text_found/replaced) ใช้ชื่อเดียวกันทั้งสองฝั่งอยู่แล้ว
  const extractionState: OcrBulkFilter["extractionState"] =
    mode === "ocr" ? "no_text_found" : filter === "all" ? undefined : filter === "no_text" ? "never_attempted" : filter;

  const bulkAllFilter: OcrBulkFilter = {
    extractionState,
    ocrStatus: mode === "ocr" ? (ocrStatus as OcrBulkFilter["ocrStatus"]) : undefined,
    year,
    categoryId,
    publishStatus: publishStatus as OcrBulkFilter["publishStatus"],
  };

  const [allCandidates, batches, failedJobs, estimatedCount, defaultBatchSize, categories, years, recentOcrJobs] =
    await Promise.all([
      getPdfProcessingCandidates(mode === "ocr" ? "no_text_found" : filter),
      getRecentJobBatches(jobType),
      getFailedJobs(jobType),
      getPdfProcessingCandidatesCount(bulkAllFilter),
      getDefaultBatchSize(jobType),
      getActiveCategoriesWithId(),
      getDistinctResearchYears(),
      mode === "ocr" ? getRecentJobs("ocr_processing", 20) : Promise.resolve([]),
    ]);

  const candidates = mode === "ocr" ? allCandidates.filter((c) => c.ocrStatus !== "completed") : allCandidates;

  const items: BulkSelectItem[] = candidates.map((c) =>
    mode === "ocr"
      ? {
          id: c.id,
          title: c.titleTh,
          meta: c.pdfFile,
          badge:
            c.ocrStatus === "failed"
              ? { label: "OCR ล้มเหลว", tone: "red" }
              : c.ocrStatus === "processing"
                ? { label: "กำลัง OCR", tone: "brand" }
                : { label: "รอ OCR", tone: "gray" },
        }
      : {
          id: c.id,
          title: c.titleTh,
          meta: c.pdfFile,
          badge: c.fileReplaced
            ? { label: "ไฟล์ถูกแทนที่", tone: "amber" }
            : c.extractionStatus === "failed"
              ? { label: "ล้มเหลว", tone: "red" }
              : c.extractionStatus === "no_text_found"
                ? { label: "ไม่พบข้อความ", tone: "gray" }
                : c.extractionStatus === null
                  ? { label: "ยังไม่เคยประมวลผล", tone: "brand" }
                  : { label: "เสร็จแล้ว", tone: "green" },
        }
  );

  const filterSummary: string[] = [];
  if (mode === "extract") filterSummary.push(`สถานะ: ${FILTERS.find((f) => f.value === filter)?.label ?? filter}`);
  if (mode === "ocr") filterSummary.push("เฉพาะเอกสารที่ดึงข้อความปกติแล้วไม่พบข้อความ");
  if (mode === "ocr" && ocrStatus) filterSummary.push(`สถานะ OCR: ${OCR_STATUS_OPTIONS.find((o) => o.value === ocrStatus)?.label ?? ocrStatus}`);
  if (year) filterSummary.push(`ปี: ${year}`);
  if (categoryId) filterSummary.push(`หมวดหมู่: ${categories.find((c) => c.id === categoryId)?.nameTh ?? categoryId}`);
  if (publishStatus) filterSummary.push(`สถานะเผยแพร่: ${PUBLISH_STATUS_OPTIONS.find((o) => o.value === publishStatus)?.label ?? publishStatus}`);

  const batchActions = { pause: pauseBatchAction, resume: resumeBatchAction, cancel: cancelBatchAction, retryFailed: retryFailedInBatchAction };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ประมวลผลข้อความ PDF เป็นชุด</h1>
          <p className="mt-1 text-sm text-gray-500">
            สั่ง backfill/ประมวลผลข้อความ PDF หรือ OCR เอกสารสแกนหลายรายการพร้อมกันแบบ background job —
            ไม่บล็อกหน้าเว็บระหว่างรอ
          </p>
        </div>
        <ProcessQueueNowButton />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <Link
          href="/superadmin/pdf-processing?mode=extract"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            mode === "extract" ? "border-brand-600 text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          ดึงข้อความ PDF
        </Link>
        <Link
          href="/superadmin/pdf-processing?mode=ocr"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            mode === "ocr" ? "border-brand-600 text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          OCR เอกสารสแกน
        </Link>
      </div>

      {mode === "ocr" && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          แสดงเฉพาะเอกสารที่ดึงข้อความปกติแล้วได้ผล &quot;ไม่พบข้อความ&quot; (อาจเป็นไฟล์สแกน) — ข้อความจาก
          OCR อาจมีความคลาดเคลื่อน โดยเฉพาะภาษาไทย ต้องตั้งค่า OCR provider ก่อนจึงจะประมวลผลสำเร็จ
          (ดู docs/ocr-operations.md)
        </p>
      )}

      {mode === "extract" && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/superadmin/pdf-processing?mode=extract&filter=${f.value}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filter === f.value ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      {/* ตัวกรองเพิ่มเติม (ช่วงที่ 28) — มีผลเฉพาะกับปุ่ม "ประมวลผลทั้งหมดตามตัวกรอง"
          ด้านล่างเท่านั้น ไม่กระทบรายการเลือกด้วยตนเองด้านบน */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-xs">
        <input type="hidden" name="mode" value={mode} />
        {mode === "extract" && <input type="hidden" name="filter" value={filter} />}
        <div className="flex flex-col gap-1">
          <label className="text-gray-500">ปี</label>
          <select name="year" defaultValue={params.year ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5">
            <option value="">ทุกปี</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-500">หมวดหมู่</label>
          <select name="categoryId" defaultValue={params.categoryId ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5">
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nameTh}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-500">สถานะเผยแพร่</label>
          <select name="publishStatus" defaultValue={params.publishStatus ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5">
            {PUBLISH_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {mode === "ocr" && (
          <div className="flex flex-col gap-1">
            <label className="text-gray-500">สถานะ OCR</label>
            <select name="ocrStatus" defaultValue={params.ocrStatus ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5">
              {OCR_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="rounded-lg bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-800">
          ใช้ตัวกรอง
        </button>
      </form>

      <BulkJobSelector
        items={items}
        action={mode === "ocr" ? bulkEnqueueOcrAction : bulkEnqueuePdfExtractionAction}
        submitLabel={mode === "ocr" ? "เริ่ม OCR ที่เลือก" : "ประมวลผลที่เลือก"}
        emptyMessage="ไม่พบรายการตามเงื่อนไขที่เลือก"
      />

      <BulkAllMatchingFilterDialog
        action={bulkEnqueueAllMatchingFilterAction}
        hiddenFields={{
          mode,
          ...(extractionState ? { extractionState } : {}),
          ...(mode === "ocr" && ocrStatus ? { ocrStatus } : {}),
          ...(year ? { year: String(year) } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(publishStatus ? { publishStatus } : {}),
        }}
        label={mode === "ocr" ? "OCR ทั้งหมดที่ตรงตัวกรอง (ไม่จำกัด 500 รายการ)" : "ประมวลผลทั้งหมดตามตัวกรอง (ไม่จำกัด 500 รายการ)"}
        jobTypeLabel={mode === "ocr" ? "OCR เอกสารสแกน" : "ดึงข้อความ PDF"}
        filterSummary={filterSummary}
        defaultBatchSize={defaultBatchSize}
        estimatedCount={estimatedCount}
      />

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">ชุดงานล่าสุด</h2>
        <JobProgressPoller jobType={jobType} initialBatches={batches} batchActions={batchActions} />
      </section>

      {mode === "ocr" && (
        <section className="rounded-xl border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            งาน OCR รายรายการล่าสุด (สถานะ, ความคืบหน้าระดับหน้า, เวลาเริ่ม/อัปเดตล่าสุด)
          </h2>
          <RecentJobsPoller jobType="ocr_processing" initialJobs={recentOcrJobs} emptyMessage="ยังไม่มีงาน OCR" />
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">งานที่ล้มเหลวถาวร (ครบจำนวนครั้งลองใหม่แล้ว)</h2>
        <FailedJobList
          jobs={failedJobs}
          retryAction={mode === "ocr" ? retryFailedOcrJobAction : retryFailedPdfJobAction}
          emptyMessage="ไม่มีงานที่ล้มเหลวถาวรในขณะนี้"
        />
      </section>
    </div>
  );
}
