"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, FileQuestion, KeyRound, Loader2, XCircle } from "lucide-react";
import { submitAccessRequestAction } from "@/app/research/[id]/access-request-actions";
import { idleActionResult } from "@/lib/actions/types";
import { accessRequestStatusLabels } from "@/lib/labels";
import type { AccessRequestStatus, AccessRequestType } from "@/types/research";

const STATUS_ICON: Record<AccessRequestStatus, typeof Clock> = {
  pending: Clock,
  under_review: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  more_information_required: FileQuestion,
  cancelled: XCircle,
  expired: Clock,
};

const STATUS_COLOR: Record<AccessRequestStatus, string> = {
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  under_review: "text-amber-700 bg-amber-50 border-amber-200",
  approved: "text-green-700 bg-green-50 border-green-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
  more_information_required: "text-blue-700 bg-blue-50 border-blue-200",
  cancelled: "text-gray-500 bg-gray-50 border-gray-200",
  expired: "text-gray-500 bg-gray-50 border-gray-200",
};

// สถานะที่ยังไม่ควรให้ส่งคำขอใหม่ซ้ำ (มีคำขอที่ยัง active อยู่แล้ว — ตรงกับ
// unique index idx_access_requests_active_unique ในฐานข้อมูล)
const ACTIVE_STATUSES: AccessRequestStatus[] = ["pending", "under_review", "more_information_required"];

export default function AccessRequestButton({
  researchSlug,
  requestType,
  isLoggedIn,
  reviewerNote,
  latestStatus,
  variant = "secondary",
}: {
  researchSlug: string;
  requestType: AccessRequestType;
  isLoggedIn: boolean;
  reviewerNote?: string | null;
  latestStatus: AccessRequestStatus | null;
  /** "primary" ใช้เมื่อปุ่มนี้อยู่ในตำแหน่ง action หลักของหน้า (แทนที่ปุ่ม
   * "อ่านออนไลน์" เมื่อผู้ใช้ยังไม่มีสิทธิ์) — เปลี่ยนเฉพาะ className ไม่มีผล
   * ต่อ logic การส่งคำขอ/สิทธิ์การเข้าถึงใดๆ ทั้งสิ้น */
  variant?: "primary" | "secondary";
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState(submitAccessRequestAction, idleActionResult);
  const label = requestType === "read" ? "ขอสิทธิ์อ่านเอกสาร" : "ขอสิทธิ์ดาวน์โหลด";
  const ctaClassName =
    variant === "primary"
      ? "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto"
      : "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-accent-soft px-6 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-soft-hover sm:w-auto";

  useEffect(() => {
    if (state.status === "success") setExpanded(false);
  }, [state.status]);

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(`/research/${researchSlug}`)}`}
        className={ctaClassName}
      >
        <KeyRound className="h-4 w-4" />
        เข้าสู่ระบบเพื่อ{label}
      </Link>
    );
  }

  if (latestStatus && ACTIVE_STATUSES.includes(latestStatus)) {
    const Icon = STATUS_ICON[latestStatus];
    return (
      <div className={`flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm ${STATUS_COLOR[latestStatus]}`}>
        <span className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4" />
          {label}: {accessRequestStatusLabels[latestStatus]}
        </span>
        {reviewerNote && <p className="text-xs opacity-90">หมายเหตุจากเจ้าหน้าที่: {reviewerNote}</p>}
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={ctaClassName}
        >
          <KeyRound className="h-4 w-4" />
          {label}
        </button>
        {latestStatus && (
          <p className="text-xs text-gray-500">
            คำขอก่อนหน้า: {accessRequestStatusLabels[latestStatus]} — ส่งคำขอใหม่ได้
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface p-4"
    >
      <input type="hidden" name="researchSlug" value={researchSlug} />
      <input type="hidden" name="requestType" value={requestType} />

      <p className="text-sm font-semibold text-gray-900">{label}</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`purpose-${requestType}`} className="text-xs font-medium text-gray-700">
          วัตถุประสงค์การใช้งาน (จำเป็น)
        </label>
        <textarea
          id={`purpose-${requestType}`}
          name="purpose"
          required
          minLength={10}
          rows={3}
          disabled={pending}
          placeholder="เช่น ใช้ประกอบการทำวิทยานิพนธ์ระดับปริญญาโท สาขา..."
          className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {state.status === "error" && state.fieldErrors?.purpose && (
          <p className="text-xs text-red-600">{state.fieldErrors.purpose[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`note-${requestType}`} className="text-xs font-medium text-gray-700">
          รายละเอียดเพิ่มเติม (ไม่บังคับ)
        </label>
        <textarea
          id={`note-${requestType}`}
          name="requesterNote"
          rows={2}
          disabled={pending}
          className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          name="termsAccepted"
          value="true"
          required
          disabled={pending}
          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
        />
        ข้าพเจ้ายอมรับเงื่อนไขการใช้งานเอกสาร และจะใช้เอกสารนี้ตามวัตถุประสงค์ที่ระบุไว้เท่านั้น
      </label>

      {state.status === "error" && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="flex items-start gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          ส่งคำขอ
        </button>
      </div>
    </form>
  );
}
