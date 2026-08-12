"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Layers, Loader2, X } from "lucide-react";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";
import { useDialogA11y } from "@/lib/hooks/useDialogA11y";

/**
 * กล่องยืนยันก่อนสั่ง "ประมวลผลทั้งหมดตามตัวกรอง" — ต่างจากปุ่มเดิม (ช่วงที่ 25)
 * ที่ submit ทันทีโดยไม่มีการยืนยัน ตอนนี้แสดงสรุปตัวกรอง/ประเภทงาน/ขนาด chunk
 * ที่ปรับได้ พร้อมคำเตือนว่าอาจใช้เวลานานก่อนสั่งจริงเสมอ — ใช้ร่วมกันทั้ง 3 หน้า
 * (pdf-processing/data-quality/file-security)
 */
export default function BulkAllMatchingFilterDialog({
  action,
  hiddenFields,
  label,
  jobTypeLabel,
  filterSummary,
  defaultBatchSize,
  estimatedCount,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  hiddenFields: Record<string, string>;
  label: string;
  jobTypeLabel: string;
  filterSummary: string[];
  defaultBatchSize: number;
  estimatedCount: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [batchSize, setBatchSize] = useState(defaultBatchSize);
  const [state, formAction, pending] = useActionState(action, idleActionResult);
  const dialogRef = useDialogA11y(open, () => setOpen(false), pending);

  // ปุ่มเปิด/ปิดเป็นสาขาการ render คนละต้นไม้กัน (button vs dialog) — React จึง
  // unmount/mount ปุ่มเดิมทิ้งไปจริงๆ เมื่อสลับกลับมา ปุ่มที่ useDialogA11y คืน
  // focus ให้ตอนปิด (จาก document.activeElement ตอน mount) จึงเป็น node เก่าที่
  // หลุดจาก DOM ไปแล้ว ต้องคืน focus เองด้วย ref ที่ผูกกับปุ่มตัวใหม่แทน
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-soft-hover"
      >
        <Layers className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={pending ? undefined : () => setOpen(false)} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-filter-dialog-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 shrink-0 text-accent" />
            <h3 id="bulk-filter-dialog-title" className="text-base font-semibold text-gray-900">ยืนยันประมวลผลทั้งหมดตามตัวกรอง</h3>
          </div>
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-gray-500 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <div>
            <span className="text-xs text-gray-500">ประเภทงาน</span>
            <p className="font-medium text-gray-900">{jobTypeLabel}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">ตัวกรองที่ใช้</span>
            {filterSummary.length === 0 ? (
              <p className="text-gray-700">ทั้งหมด (ไม่มีตัวกรอง)</p>
            ) : (
              <ul className="list-inside list-disc text-gray-700">
                {filterSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <span className="text-xs text-gray-500">จำนวนรายการโดยประมาณ</span>
            <p className="font-medium text-gray-900">{estimatedCount === null ? "กำลังตรวจสอบ..." : `${estimatedCount} รายการ`}</p>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="batchSize" value={batchSize} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-batch-size" className="text-xs font-medium text-gray-700">
              ขนาด chunk ต่อรอบ (1-500)
            </label>
            <input
              id="bulk-batch-size"
              type="number"
              min={1}
              max={500}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.min(500, Math.max(1, Number(e.target.value) || defaultBatchSize)))}
              disabled={pending}
              className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            การประมวลผลอาจใช้เวลานาน (ทยอยทำเป็นชุดในพื้นหลัง) ดูความคืบหน้าและหยุด/ยกเลิกได้ที่รายการ &quot;ชุดงานล่าสุด&quot; ด้านล่าง
          </p>

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

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending || estimatedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              เริ่มประมวลผล
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
