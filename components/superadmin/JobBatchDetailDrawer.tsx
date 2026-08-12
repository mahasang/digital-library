"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Pause, Play, RotateCcw, X, XCircle } from "lucide-react";
import type { JobBatchDetail } from "@/lib/data/job-batches.server";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";
import { useDialogA11y } from "@/lib/hooks/useDialogA11y";

type BatchAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;

const POLL_INTERVAL_MS = 5000;

const STATUS_LABEL: Record<string, string> = {
  enqueueing: "กำลังสร้างงาน",
  ready: "สร้างงานครบแล้ว (บางรายการอาจยังทำงานอยู่)",
  paused: "หยุดชั่วคราว",
  cancelled: "ยกเลิกแล้ว",
  completed: "เสร็จสมบูรณ์",
  failed: "ล้มเหลว",
};

function formatEta(etaSeconds: number | null): string {
  if (etaSeconds === null) return "ยังไม่สามารถประมาณเวลาได้";
  if (etaSeconds < 60) return "เหลืออีกไม่ถึง 1 นาที";
  const minutes = Math.round(etaSeconds / 60);
  if (minutes < 60) return `เหลืออีกประมาณ ${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  return `เหลืออีกประมาณ ${hours} ชม. ${minutes % 60} นาที`;
}

/** แผงรายละเอียด master job หนึ่งชุด — แสดงตัวนับละเอียด (แยก pending/processing
 * ที่รายการสรุปไม่มี), เวลาต่างๆ, ETA, และปุ่มควบคุม pause/resume/cancel/
 * ลองใหม่เฉพาะที่ล้มเหลว — รับ action ของแต่ละหน้ามาเป็น prop เพราะแต่ละหน้า
 * (pdf-processing/data-quality/file-security) มี Server Action ของตัวเอง
 * (ต้อง revalidatePath คนละ path) แต่ตรรกะฝั่ง SQL เหมือนกันทุกจุด (ดู
 * lib/jobs/batch-control.server.ts) */
export default function JobBatchDetailDrawer({
  batchId,
  onClose,
  pauseAction,
  resumeAction,
  cancelAction,
  retryFailedAction,
}: {
  batchId: string;
  onClose: () => void;
  pauseAction: BatchAction;
  resumeAction: BatchAction;
  cancelAction: BatchAction;
  retryFailedAction: BatchAction;
}) {
  const [detail, setDetail] = useState<JobBatchDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [pauseState, pauseFormAction, pausePending] = useActionState(pauseAction, idleActionResult);
  const [resumeState, resumeFormAction, resumePending] = useActionState(resumeAction, idleActionResult);
  const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelAction, idleActionResult);
  const [retryState, retryFormAction, retryPending] = useActionState(retryFailedAction, idleActionResult);

  async function fetchDetail() {
    try {
      const res = await fetch(`/api/superadmin/jobs/batches?batchId=${encodeURIComponent(batchId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { detail: JobBatchDetail };
      setDetail(data.detail);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchDetail();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    if (pauseState.status === "success" || resumeState.status === "success" || cancelState.status === "success" || retryState.status === "success") {
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseState, resumeState, cancelState, retryState]);

  const anyPending = pausePending || resumePending || cancelPending || retryPending;
  const errorMessage =
    (pauseState.status === "error" && pauseState.message) ||
    (resumeState.status === "error" && resumeState.message) ||
    (cancelState.status === "error" && cancelState.message) ||
    (retryState.status === "error" && retryState.message) ||
    null;

  const dialogRef = useDialogA11y(true, onClose, anyPending);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-batch-detail-title"
        tabIndex={-1}
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto rounded-xl bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="job-batch-detail-title" className="text-base font-semibold text-gray-900">รายละเอียดชุดงาน</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!detail && !loadError && <p className="text-sm text-gray-500">กำลังโหลด...</p>}
        {loadError && !detail && <p className="text-sm text-red-600">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>}

        {detail && (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {STATUS_LABEL[detail.status] ?? detail.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
              <div>สร้างงานแล้ว: {detail.enqueuedItems}{detail.totalItems !== null ? ` / ${detail.totalItems}` : ""}</div>
              <div>ขนาด chunk: {detail.batchSize}</div>
              <div className="text-green-700">สำเร็จ: {detail.completed}</div>
              <div className="text-red-600">ล้มเหลว: {detail.failed}</div>
              <div className="text-amber-700">รอ/กำลังทำ: {detail.pending} / {detail.processing}</div>
              <div className="text-gray-500">ยกเลิก: {detail.cancelled}</div>
              <div className="text-gray-500">ข้าม: {detail.skipped}</div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-gray-500">
              <span>สร้างเมื่อ {new Date(detail.createdAt).toLocaleString("th-TH")}</span>
              {detail.startedAt && <span>เริ่มเมื่อ {new Date(detail.startedAt).toLocaleString("th-TH")}</span>}
              <span>อัปเดตล่าสุด {new Date(detail.updatedAt).toLocaleString("th-TH")}</span>
              {detail.completedAt && <span>เสร็จเมื่อ {new Date(detail.completedAt).toLocaleString("th-TH")}</span>}
              {(detail.status === "enqueueing" || detail.status === "ready") && <span>{formatEta(detail.etaSeconds)}</span>}
            </div>

            {errorMessage && (
              <p className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {errorMessage}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {(detail.status === "enqueueing" || detail.status === "ready") && (
                <form action={pauseFormAction}>
                  <input type="hidden" name="batchId" value={batchId} />
                  <button
                    type="submit"
                    disabled={anyPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {pausePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                    หยุดชั่วคราว
                  </button>
                </form>
              )}
              {detail.status === "paused" && (
                <form action={resumeFormAction}>
                  <input type="hidden" name="batchId" value={batchId} />
                  <button
                    type="submit"
                    disabled={anyPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                  >
                    {resumePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    ทำงานต่อ
                  </button>
                </form>
              )}
              {(detail.status === "enqueueing" || detail.status === "ready" || detail.status === "paused") && (
                <>
                  {!confirmCancel ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      disabled={anyPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      ยกเลิกชุดงาน
                    </button>
                  ) : (
                    <form action={cancelFormAction} className="flex items-center gap-2">
                      <input type="hidden" name="batchId" value={batchId} />
                      <span className="text-xs text-red-700">ยืนยันยกเลิก? (รายการที่ทำสำเร็จแล้วจะไม่ถูกลบ)</span>
                      <button
                        type="submit"
                        disabled={anyPending}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {cancelPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ยืนยัน"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        ไม่ยกเลิก
                      </button>
                    </form>
                  )}
                </>
              )}
              {detail.failed > 0 && (
                <form action={retryFormAction}>
                  <input type="hidden" name="batchId" value={batchId} />
                  <button
                    type="submit"
                    disabled={anyPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {retryPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    ลองใหม่เฉพาะที่ล้มเหลว
                  </button>
                </form>
              )}
            </div>

            {retryState.status === "success" && (
              <p className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {retryState.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
