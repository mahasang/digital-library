"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle, Clock, ImageOff, Loader2, RefreshCw, ScanText } from "lucide-react";
import { reprocessResearchTextAction, triggerOcrAction } from "@/app/dashboard/research/[id]/edit/actions";
import { idleActionResult } from "@/lib/actions/types";
import { extractionStatusLabels, ocrStatusLabels } from "@/lib/labels";
import type { ExtractionStatusRow, OcrStatusRow } from "@/lib/supabase/database.types";

const STATUS_ICON: Record<ExtractionStatusRow, typeof CheckCircle2> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  no_text_found: ImageOff,
  failed: AlertCircle,
};

const STATUS_COLOR: Record<ExtractionStatusRow, string> = {
  pending: "text-gray-500",
  processing: "text-blue-600",
  completed: "text-green-600",
  no_text_found: "text-amber-600",
  failed: "text-red-600",
};

const OCR_STATUS_COLOR: Record<OcrStatusRow, string> = {
  not_required: "text-gray-500",
  pending: "text-gray-500",
  processing: "text-blue-600",
  completed: "text-green-600",
  failed: "text-red-600",
  blocked: "text-amber-600",
};

/** สถานะการดึงข้อความ PDF + OCR + ปุ่มสั่งประมวลผลใหม่ — เฉพาะ librarian/admin/
 * super_admin (rank >= 30, ตรวจซ้ำฝั่งเซิร์ฟเวอร์ใน reprocessResearchTextAction/
 * triggerOcrAction เสมอ ไม่ใช่แค่ซ่อนปุ่มที่นี่) หน้านี้
 * (/dashboard/research/[id]/edit) ถูกกันด้วย rank >= 30 อยู่แล้วในระดับหน้าเว็บ
 * จึงไม่ต้องส่ง prop สิทธิ์เพิ่ม */
export default function ExtractionStatusCard({
  researchId,
  status,
  extractedAt,
  errorMessage,
  ocrStatus,
  ocrErrorMessage,
  ocrProcessedAt,
  ocrProvider,
  ocrConfidence,
}: {
  researchId: string;
  status: ExtractionStatusRow | null;
  extractedAt: string | null;
  errorMessage: string | null;
  ocrStatus?: OcrStatusRow;
  ocrErrorMessage?: string | null;
  ocrProcessedAt?: string | null;
  ocrProvider?: string | null;
  ocrConfidence?: number | null;
}) {
  const [state, formAction, pending] = useActionState(
    reprocessResearchTextAction,
    idleActionResult
  );
  const [ocrState, ocrFormAction, ocrPending] = useActionState(triggerOcrAction, idleActionResult);

  const effectiveStatus = status ?? "pending";
  const Icon = STATUS_ICON[effectiveStatus];
  const canRetry = effectiveStatus === "failed" || effectiveStatus === "no_text_found" || effectiveStatus === "completed";
  const effectiveOcrStatus = ocrStatus ?? "not_required";
  const showOcrSection = effectiveStatus === "no_text_found" || effectiveOcrStatus !== "not_required";

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">การค้นหาเนื้อหาภายใน PDF</h2>

      <div className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${STATUS_COLOR[effectiveStatus]} ${effectiveStatus === "processing" ? "animate-spin" : ""}`} />
        <span className={STATUS_COLOR[effectiveStatus]}>
          {status ? extractionStatusLabels[status] : "ยังไม่เคยประมวลผล"}
        </span>
      </div>

      {extractedAt && (
        <p className="mt-1.5 text-xs text-gray-500">
          ดึงข้อความล่าสุด: {new Date(extractedAt).toLocaleString("th-TH")}
        </p>
      )}

      {errorMessage && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {errorMessage}
        </p>
      )}

      <form action={formAction} className="mt-3">
        <input type="hidden" name="researchId" value={researchId} />
        <button
          type="submit"
          disabled={pending || effectiveStatus === "processing"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {canRetry ? "ประมวลผลข้อความใหม่" : "เริ่มประมวลผลข้อความ"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}

      {showOcrSection && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <ScanText className="h-3.5 w-3.5" />
            OCR สำหรับเอกสารสแกน
          </h3>
          <p className="mb-2 text-xs text-gray-500">
            เอกสารนี้ไม่พบข้อความที่คัดลอกได้ (อาจเป็นไฟล์สแกน) สามารถสั่ง OCR เพิ่มเติมได้ —
            <span className="font-medium"> ข้อความจาก OCR อาจมีความคลาดเคลื่อน โดยเฉพาะภาษาไทย</span>
          </p>

          <p className={`text-sm ${OCR_STATUS_COLOR[effectiveOcrStatus]}`}>
            {ocrStatusLabels[effectiveOcrStatus]}
          </p>
          {ocrProcessedAt && (
            <p className="mt-1 text-xs text-gray-500">
              ประมวลผลล่าสุด: {new Date(ocrProcessedAt).toLocaleString("th-TH")}
              {ocrProvider ? ` · ${ocrProvider}` : ""}
              {typeof ocrConfidence === "number" ? ` · ความมั่นใจ ${Math.round(ocrConfidence * 100)}%` : ""}
            </p>
          )}
          {ocrErrorMessage && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {ocrErrorMessage}
            </p>
          )}

          <form action={ocrFormAction} className="mt-2">
            <input type="hidden" name="researchId" value={researchId} />
            <button
              type="submit"
              disabled={ocrPending || effectiveOcrStatus === "processing"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ocrPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
              {effectiveOcrStatus === "not_required" || effectiveOcrStatus === "pending"
                ? "เริ่ม OCR"
                : "ประมวลผล OCR ใหม่"}
            </button>
          </form>

          {ocrState.status === "error" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {ocrState.message}
            </p>
          )}
          {ocrState.status === "success" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {ocrState.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
