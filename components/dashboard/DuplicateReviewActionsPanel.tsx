"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, GitMerge, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  confirmDuplicateAction,
  dismissDuplicateAction,
  mergeResearchItemsAction,
} from "@/app/dashboard/duplicate-reviews/actions";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";

function ResultMessage({ state }: { state: ActionResult }) {
  if (state.status === "error") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-red-600">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }
  if (state.status === "success") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

export default function DuplicateReviewActionsPanel({
  reviewId,
  researchItemId,
  researchTitle,
  candidateResearchItemId,
  candidateTitle,
  canMerge,
}: {
  reviewId: string;
  researchItemId: string;
  researchTitle: string;
  candidateResearchItemId: string;
  candidateTitle: string;
  canMerge: boolean;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmDuplicateAction, idleActionResult);
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissDuplicateAction, idleActionResult);
  const [mergeState, mergeAction, mergePending] = useActionState(mergeResearchItemsAction, idleActionResult);
  const [keepTarget, setKeepTarget] = useState<"research" | "candidate">("research");
  const [confirmText, setConfirmText] = useState("");

  const sourceId = keepTarget === "research" ? candidateResearchItemId : researchItemId;
  const targetId = keepTarget === "research" ? researchItemId : candidateResearchItemId;
  const sourceTitle = keepTarget === "research" ? candidateTitle : researchTitle;
  const isConfirmValid = confirmText.trim() === "MERGE";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">ตรวจสอบว่าซ้ำกันหรือไม่</h2>
        <div className="flex flex-wrap gap-2">
          <form action={confirmAction}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <button
              type="submit"
              disabled={confirmPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {confirmPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <ThumbsUp className="h-3.5 w-3.5" />
              ยืนยันว่าซ้ำกัน
            </button>
          </form>
          <form action={dismissAction}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <button
              type="submit"
              disabled={dismissPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {dismissPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <ThumbsDown className="h-3.5 w-3.5" />
              ไม่ซ้ำกัน
            </button>
          </form>
        </div>
        <ResultMessage state={confirmState} />
        <ResultMessage state={dismissState} />
      </div>

      {canMerge ? (
        <div className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <GitMerge className="h-4 w-4 text-accent" />
            รวมงานวิจัย
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            เฉพาะ Admin/Super Admin — ย้ายรายการโปรด ประวัติการอ่าน ดาวน์โหลด และคำขอเข้าถึงเอกสารทั้งหมดไปยังรายการที่เก็บไว้โดยอัตโนมัติ
            รายการที่ถูกรวมจะไม่ถูกลบ แค่เปลี่ยนสถานะเป็น &quot;ถูกรวมเข้ากับรายการอื่น&quot;
          </p>

          <form action={mergeAction} className="flex flex-col gap-3">
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="sourceId" value={sourceId} />
            <input type="hidden" name="targetId" value={targetId} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="keepTarget" className="text-xs font-medium text-gray-700">
                เก็บรายการไหนไว้เป็นหลัก
              </label>
              <select
                id="keepTarget"
                value={keepTarget}
                onChange={(e) => setKeepTarget(e.target.value as "research" | "candidate")}
                disabled={mergePending}
                className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
              >
                <option value="research">{researchTitle}</option>
                <option value="candidate">{candidateTitle}</option>
              </select>
              <p className="text-xs text-gray-500">&quot;{sourceTitle}&quot; จะถูกรวมเข้าไปและปิดใช้งาน</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reason" className="text-xs font-medium text-gray-700">
                เหตุผล (ไม่บังคับ)
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={2}
                disabled={mergePending}
                className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmText" className="text-xs font-medium text-gray-700">
                พิมพ์ <span className="font-mono font-semibold">MERGE</span> เพื่อยืนยัน
              </label>
              <input
                id="confirmText"
                name="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={mergePending}
                autoComplete="off"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <ResultMessage state={mergeState} />

            <button
              type="submit"
              disabled={mergePending || !isConfirmValid}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mergePending && <Loader2 className="h-4 w-4 animate-spin" />}
              ยืนยันรวมงานวิจัย
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-surface p-5 text-sm text-gray-500">
          การรวมงานวิจัยต้องมีสิทธิ์ Admin/Super Admin ขึ้นไป
        </div>
      )}
    </div>
  );
}
