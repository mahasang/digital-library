"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Loader2, RefreshCw, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";
import type { DeadLetterJobRow } from "@/lib/data/job-batches.server";
import type { JobDisplayInfo } from "@/lib/jobs/dlq.server";

type JobAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;

function DeadLetterJobRow({
  job,
  info,
  retryAction,
  cancelAction,
  resolveAction,
}: {
  job: DeadLetterJobRow;
  info: JobDisplayInfo;
  retryAction: JobAction;
  cancelAction: JobAction;
  resolveAction: JobAction;
}) {
  const [note, setNote] = useState("");
  const [retryState, retryFormAction, retryPending] = useActionState(retryAction, idleActionResult);
  const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelAction, idleActionResult);
  const [resolveState, resolveFormAction, resolvePending] = useActionState(resolveAction, idleActionResult);

  const errorMessage =
    (retryState.status === "error" && retryState.message) ||
    (cancelState.status === "error" && cancelState.message) ||
    (resolveState.status === "error" && resolveState.message) ||
    null;

  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-800">{info.safeSummary}</p>
          <p className="mt-0.5 truncate text-red-600">{job.errorMessage ?? "ล้มเหลว"}</p>
          <p className="mt-0.5 text-red-500">
            ลองแล้ว {job.attempts}/{job.maxAttempts} ครั้ง ·{" "}
            {new Date(job.createdAt).toLocaleString("th-TH")}
          </p>
        </div>
        <form action={retryFormAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <button
            type="submit"
            disabled={retryPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-surface px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retryPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            ลองใหม่
          </button>
        </form>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (จำเป็นสำหรับ &quot;แก้ไขแล้ว&quot;)"
          className="min-w-[12rem] flex-1 rounded border border-red-200 bg-surface px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
        />
        <form action={resolveFormAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="note" value={note} />
          <button
            type="submit"
            disabled={resolvePending || !note.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-surface px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resolvePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            แก้ไขแล้ว
          </button>
        </form>
        <form action={cancelFormAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="note" value={note} />
          <button
            type="submit"
            disabled={cancelPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-surface px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            ยกเลิกงานนี้
          </button>
        </form>
      </div>

      {errorMessage && (
        <p className="mt-1.5 flex items-center gap-1 text-red-700">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/** รายการ Dead-letter queue ที่ยัง active พร้อมปุ่มลองใหม่/ยกเลิก/ทำเครื่องหมาย
 * ว่าแก้ไขแล้ว — ใช้ที่หน้า /superadmin/jobs เท่านั้น (ต่างจาก FailedJobList
 * เดิมที่มีแค่ปุ่มลองใหม่และผูกกับ job_type เดียว) */
export default function DeadLetterJobList({
  jobs,
  infos,
  retryAction,
  cancelAction,
  resolveAction,
  emptyMessage,
}: {
  jobs: DeadLetterJobRow[];
  infos: JobDisplayInfo[];
  retryAction: JobAction;
  cancelAction: JobAction;
  resolveAction: JobAction;
  emptyMessage: string;
}) {
  if (jobs.length === 0) {
    return <EmptyState icon={CheckCircle2} title={emptyMessage} compact />;
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map((job, i) => (
        <DeadLetterJobRow
          key={job.id}
          job={job}
          info={infos[i]}
          retryAction={retryAction}
          cancelAction={cancelAction}
          resolveAction={resolveAction}
        />
      ))}
    </div>
  );
}
