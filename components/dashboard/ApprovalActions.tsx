"use client";

import { useActionState, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Globe,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { idleActionResult } from "@/lib/actions/types";
import {
  approveAction,
  archiveAction,
  publishAction,
  rejectAction,
  requestRevisionAction,
} from "@/app/dashboard/approvals/[id]/actions";
import type { DocumentStatus } from "@/types/research";

export default function ApprovalActions({
  researchId,
  status,
}: {
  researchId: string;
  status: DocumentStatus;
}) {
  const [approveState, approveFormAction, approvePending] = useActionState(
    approveAction,
    idleActionResult
  );
  const [publishState, publishFormAction, publishPending] = useActionState(
    publishAction,
    idleActionResult
  );
  const [archiveState, archiveFormAction, archivePending] = useActionState(
    archiveAction,
    idleActionResult
  );
  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    rejectAction,
    idleActionResult
  );
  const [revisionState, revisionFormAction, revisionPending] = useActionState(
    requestRevisionAction,
    idleActionResult
  );

  const [rejectNote, setRejectNote] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const canReview = status === "pending_review" || status === "revision_requested";
  const canPublish = status === "approved";
  const canArchive = status !== "archived";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-surface p-5">
      <h2 className="text-sm font-semibold text-gray-900">การดำเนินการ</h2>

      {[approveState, publishState, archiveState, rejectState, revisionState].map(
        (state, i) =>
          state.status === "error" && (
            <p key={i} className="text-xs text-red-600">
              {state.message}
            </p>
          )
      )}
      {[approveState, publishState, archiveState, rejectState, revisionState].map(
        (state, i) =>
          state.status === "success" && (
            <p key={i} className="text-xs text-green-600">
              {state.message}
            </p>
          )
      )}

      {canReview && (
        <form action={approveFormAction}>
          <input type="hidden" name="researchId" value={researchId} />
          <button
            type="submit"
            disabled={approvePending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approvePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            อนุมัติ
          </button>
        </form>
      )}

      {canPublish && (
        <form action={publishFormAction}>
          <input type="hidden" name="researchId" value={researchId} />
          <button
            type="submit"
            disabled={publishPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            เผยแพร่ (Publish)
          </button>
        </form>
      )}

      {canReview && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowRevisionForm((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-300 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50"
          >
            <RotateCcw className="h-4 w-4" />
            ขอให้แก้ไข
          </button>
          {showRevisionForm && (
            <form action={revisionFormAction} className="flex flex-col gap-2">
              <input type="hidden" name="researchId" value={researchId} />
              <textarea
                name="note"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
                required
                placeholder="ระบุรายละเอียดที่ต้องการให้ผู้ส่งแก้ไข"
                className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={revisionPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {revisionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                ส่งคำขอแก้ไข
              </button>
            </form>
          )}
        </div>
      )}

      {canReview && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowRejectForm((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            ไม่อนุมัติ
          </button>
          {showRejectForm && (
            <form action={rejectFormAction} className="flex flex-col gap-2">
              <input type="hidden" name="researchId" value={researchId} />
              <textarea
                name="note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                required
                placeholder="ระบุเหตุผลที่ไม่อนุมัติงานวิจัยนี้"
                className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                type="submit"
                disabled={rejectPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejectPending && <Loader2 className="h-4 w-4 animate-spin" />}
                ยืนยันไม่อนุมัติ
              </button>
            </form>
          )}
        </div>
      )}

      {canArchive && (
        <form action={archiveFormAction} className="border-t border-gray-100 pt-4">
          <input type="hidden" name="researchId" value={researchId} />
          <button
            type="submit"
            disabled={archivePending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {archivePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            จัดเก็บถาวร (Archive)
          </button>
        </form>
      )}
    </div>
  );
}
