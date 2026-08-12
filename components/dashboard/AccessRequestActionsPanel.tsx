"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  approveAccessRequestAction,
  rejectAccessRequestAction,
  requestMoreInfoAction,
} from "@/app/dashboard/access-requests/[id]/actions";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";

type Tab = "approve" | "reject" | "more_info";

function ActionResultMessage({ state }: { state: ActionResult }) {
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

export default function AccessRequestActionsPanel({ requestId }: { requestId: string }) {
  const [tab, setTab] = useState<Tab>("approve");
  const [approveState, approveAction, approvePending] = useActionState(
    approveAccessRequestAction,
    idleActionResult
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectAccessRequestAction,
    idleActionResult
  );
  const [moreInfoState, moreInfoAction, moreInfoPending] = useActionState(
    requestMoreInfoAction,
    idleActionResult
  );

  const tabs: { key: Tab; label: string; className: string }[] = [
    { key: "approve", label: "อนุมัติ", className: "bg-green-50 text-green-700" },
    { key: "reject", label: "ปฏิเสธ", className: "bg-red-50 text-red-700" },
    { key: "more_info", label: "ขอข้อมูลเพิ่ม", className: "bg-blue-50 text-blue-700" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">ดำเนินการกับคำขอนี้</h2>

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key ? t.className : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "approve" && (
        <form action={approveAction} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expiresAt" className="text-xs font-medium text-gray-700">
              วันหมดอายุสิทธิ์ (เว้นว่าง = ถาวร)
            </label>
            <input
              id="expiresAt"
              type="date"
              name="expiresAt"
              disabled={approvePending}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="approveNote" className="text-xs font-medium text-gray-700">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              id="approveNote"
              name="reviewerNote"
              rows={2}
              disabled={approvePending}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <ActionResultMessage state={approveState} />
          <button
            type="submit"
            disabled={approvePending}
            className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approvePending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            อนุมัติคำขอ
          </button>
        </form>
      )}

      {tab === "reject" && (
        <form action={rejectAction} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rejectNote" className="text-xs font-medium text-gray-700">
              เหตุผลที่ปฏิเสธ (จำเป็น)
            </label>
            <textarea
              id="rejectNote"
              name="reviewerNote"
              required
              rows={3}
              disabled={rejectPending}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <ActionResultMessage state={rejectState} />
          <button
            type="submit"
            disabled={rejectPending}
            className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rejectPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            ปฏิเสธคำขอ
          </button>
        </form>
      )}

      {tab === "more_info" && (
        <form action={moreInfoAction} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="moreInfoNote" className="text-xs font-medium text-gray-700">
              ข้อมูลที่ต้องการเพิ่มเติม (จำเป็น)
            </label>
            <textarea
              id="moreInfoNote"
              name="reviewerNote"
              required
              rows={3}
              disabled={moreInfoPending}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <ActionResultMessage state={moreInfoState} />
          <button
            type="submit"
            disabled={moreInfoPending}
            className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {moreInfoPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            ส่งคำขอข้อมูลเพิ่มเติม
          </button>
        </form>
      )}
    </div>
  );
}
