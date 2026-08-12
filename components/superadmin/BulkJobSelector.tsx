"use client";

import { useActionState, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";

export interface BulkSelectItem {
  id: string;
  title: string;
  meta?: string;
  badge?: { label: string; tone: "brand" | "green" | "amber" | "red" | "gray" | "purple" };
}

/**
 * รายการเลือกงานวิจัยแบบ checkbox + ปุ่มสั่งประมวลผลเป็นชุด — ใช้ร่วมกันระหว่าง
 * /superadmin/pdf-processing (backfill ข้อความ) และ /superadmin/file-security
 * (rescan ความปลอดภัย) ต่างกันแค่ action ที่ผูกกับปุ่ม เก็บ selection ไว้ฝั่ง
 * client เท่านั้น (ไม่ persist) ส่งเป็น hidden input ตอน submit ให้ Server
 * Action อ่านด้วย formData.getAll("selectedIds")
 */
export default function BulkJobSelector({
  items,
  action,
  submitLabel,
  emptyMessage,
}: {
  items: BulkSelectItem[];
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  emptyMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleActionResult);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-surface py-10 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="selectedIds" value={id} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={items.length > 0 && selected.size === items.length}
            onChange={(e) => toggleAll(e.target.checked)}
          />
          เลือกทั้งหมด ({items.length} รายการ)
        </label>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <label htmlFor="batchSize">ขนาด batch สูงสุดต่อครั้ง:</label>
          <input
            id="batchSize"
            name="batchSize"
            type="number"
            min={1}
            max={200}
            defaultValue={50}
            className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel} ({selected.size})
        </button>
      </div>

      {state.status === "error" && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-surface p-3 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={(e) => toggleOne(item.id, e.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-gray-900">{item.title}</span>
              {item.meta && <span className="block truncate text-xs text-gray-500">{item.meta}</span>}
            </span>
            {item.badge && <Badge tone={item.badge.tone}>{item.badge.label}</Badge>}
          </label>
        ))}
      </div>
    </form>
  );
}
