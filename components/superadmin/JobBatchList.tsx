"use client";

import { useState } from "react";
import type { JobBatchSummary, JobRow, RecentJobRow } from "@/lib/data/job-batches.server";
import type { ActionResult } from "@/lib/actions/types";
import type { BackgroundJobStatusRow } from "@/lib/supabase/database.types";
import Badge from "@/components/ui/Badge";
import RetryJobButton from "@/components/superadmin/RetryJobButton";
import JobBatchDetailDrawer from "@/components/superadmin/JobBatchDetailDrawer";

type BatchAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;

const STATUS_LABEL: Record<BackgroundJobStatusRow, string> = {
  pending: "รอดำเนินการ",
  processing: "กำลังประมวลผล",
  completed: "สำเร็จ",
  failed: "ล้มเหลว",
  cancelled: "ยกเลิกแล้ว",
};

const STATUS_TONE: Record<BackgroundJobStatusRow, "green" | "brand" | "amber" | "red" | "gray"> = {
  pending: "amber",
  processing: "brand",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

const BATCH_STATUS_LABEL: Record<string, string> = {
  enqueueing: "กำลังสร้างงาน",
  ready: "สร้างงานครบแล้ว",
  paused: "หยุดชั่วคราว",
  cancelled: "ยกเลิกแล้ว",
  completed: "เสร็จสมบูรณ์",
  failed: "ล้มเหลว",
};

const BATCH_STATUS_TONE: Record<string, "green" | "brand" | "amber" | "red" | "gray"> = {
  enqueueing: "brand",
  ready: "brand",
  paused: "amber",
  cancelled: "gray",
  completed: "green",
  failed: "red",
};

const BAR_SEGMENTS: Array<{ key: "completed" | "inProgress" | "failed" | "cancelled" | "skipped"; className: string }> = [
  { key: "completed", className: "bg-green-500" },
  { key: "inProgress", className: "bg-blue-500" },
  { key: "failed", className: "bg-red-500" },
  { key: "cancelled", className: "bg-gray-300" },
  { key: "skipped", className: "bg-gray-200" },
];

function BatchProgressBar({ batch }: { batch: JobBatchSummary }) {
  if (batch.enqueuedItems === 0) return null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
      {BAR_SEGMENTS.map(({ key, className }) => {
        const value = batch[key];
        if (value === 0) return null;
        return <div key={key} className={className} style={{ width: `${(value / batch.enqueuedItems) * 100}%` }} />;
      })}
    </div>
  );
}

/** ประวัติชุดงาน (batch) ล่าสุด พร้อม progress bar สรุปสถานะ — ใช้ร่วมกันทั้ง
 * หน้า pdf-processing/data-quality/file-security เปิดแผงรายละเอียด
 * (JobBatchDetailDrawer) ได้ต่อแถวเพื่อควบคุม pause/resume/cancel/ลองใหม่ */
export function JobBatchList({
  batches,
  batchActions,
}: {
  batches: JobBatchSummary[];
  batchActions?: {
    pause: BatchAction;
    resume: BatchAction;
    cancel: BatchAction;
    retryFailed: BatchAction;
  };
}) {
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  if (batches.length === 0) {
    return <p className="text-sm text-gray-500">ยังไม่มีการสั่งประมวลผลเป็นชุด</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {batches.map((batch) => (
        <div key={batch.batchId} className="rounded-lg border border-gray-200 bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <Badge tone={BATCH_STATUS_TONE[batch.status] ?? "gray"}>
                {BATCH_STATUS_LABEL[batch.status] ?? batch.status}
              </Badge>
              {new Date(batch.createdAt).toLocaleString("th-TH")}
            </span>
            <span>
              สร้างงานแล้ว {batch.enqueuedItems}
              {batch.totalItems !== null ? `/${batch.totalItems}` : ""} · สำเร็จ {batch.completed} · ล้มเหลว{" "}
              {batch.failed} · กำลังทำ {batch.inProgress} · ข้าม {batch.skipped}
            </span>
          </div>
          <BatchProgressBar batch={batch} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>
              {batch.startedAt
                ? `เริ่มเมื่อ ${new Date(batch.startedAt).toLocaleString("th-TH")}`
                : "ยังไม่เริ่มประมวลผล"}
            </span>
            {batchActions && (
              <button
                type="button"
                onClick={() => setOpenBatchId(batch.batchId)}
                className="font-medium text-accent hover:underline"
              >
                รายละเอียด/ควบคุม
              </button>
            )}
          </div>
        </div>
      ))}

      {openBatchId && batchActions && (
        <JobBatchDetailDrawer
          batchId={openBatchId}
          onClose={() => setOpenBatchId(null)}
          pauseAction={batchActions.pause}
          resumeAction={batchActions.resume}
          cancelAction={batchActions.cancel}
          retryFailedAction={batchActions.retryFailed}
        />
      )}
    </div>
  );
}

/** ประวัติการประมวลผลล่าสุดของ job ที่ไม่ได้จัดกลุ่มเป็น batch (เช่น
 * access_expiration, category_notification, ocr_processing ที่สั่งทีละรายการ)
 * — แสดงสถานะแต่ละ job แบบ list ธรรมดา พร้อมเวลาเริ่ม/อัปเดตล่าสุดเสมอ และ
 * progress ระดับหน้าเมื่อมี (ช่วงที่ 29 — ไม่เคยแสดงตัวเลข/ข้อความ progress ที่
 * ไม่ได้มาจาก provider จริง) */
export function RecentJobsList({ jobs, emptyMessage }: { jobs: RecentJobRow[]; emptyMessage: string }) {
  if (jobs.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-surface p-3 text-xs"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
              {job.status === "processing" && job.currentPage !== null && job.totalPages !== null && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  หน้าที่ {job.currentPage} จาก {job.totalPages}
                  {job.progressPercent !== null ? ` (${job.progressPercent}%)` : ""}
                </span>
              )}
              {job.status === "processing" && job.currentPage === null && job.progressMessage && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  {job.progressMessage}
                </span>
              )}
            </div>
            <p className="mt-1 text-gray-500">
              เริ่ม {job.startedAt ? new Date(job.startedAt).toLocaleString("th-TH") : "ยังไม่เริ่ม"} · อัปเดตล่าสุด{" "}
              {new Date(job.updatedAt).toLocaleString("th-TH")}
            </p>
            {job.errorMessage && <p className="mt-1 truncate text-red-600">{job.errorMessage}</p>}
          </div>
          {job.attempts > 0 && (
            <span className="shrink-0 text-gray-500">
              ลองแล้ว {job.attempts}/{job.maxAttempts} ครั้ง
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** รายการ job ที่ล้มเหลวถาวร พร้อมปุ่มลองใหม่ทีละรายการ */
export function FailedJobList({
  jobs,
  retryAction,
  emptyMessage,
}: {
  jobs: JobRow[];
  retryAction: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  emptyMessage: string;
}) {
  if (jobs.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-red-800">{job.errorMessage ?? "ล้มเหลว"}</p>
            <p className="mt-0.5 text-red-500">
              ลองแล้ว {job.attempts}/{job.maxAttempts} ครั้ง ·{" "}
              {new Date(job.createdAt).toLocaleString("th-TH")}
            </p>
          </div>
          <RetryJobButton jobId={job.id} action={retryAction} />
        </div>
      ))}
    </div>
  );
}
