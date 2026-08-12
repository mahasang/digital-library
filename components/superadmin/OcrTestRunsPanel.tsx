"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Loader2, PlayCircle, RotateCcw } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";
import type { OcrTestRunRow } from "@/lib/data/ocr-test-runs.server";
import type { OcrTestFixture } from "@/lib/ocr/test-fixtures.server";

const POLL_INTERVAL_MS = 5000;

const STATUS_LABEL: Record<string, string> = {
  pending: "รอดำเนินการ",
  processing: "กำลังประมวลผล",
  completed: "สำเร็จ",
  failed: "ล้มเหลว",
};

const STATUS_TONE: Record<string, "green" | "brand" | "amber" | "red" | "gray"> = {
  pending: "amber",
  processing: "brand",
  completed: "green",
  failed: "red",
};

type TriggerAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;

function StartTestForm({ fixtures, action }: { fixtures: OcrTestFixture[]; action: TriggerAction }) {
  const [state, formAction, pending] = useActionState(action, idleActionResult);
  const availableFixtures = fixtures.filter((f) => f.available);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          เลือกไฟล์ทดสอบ
          <select
            name="fixtureName"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            disabled={availableFixtures.length === 0}
          >
            {availableFixtures.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || availableFixtures.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          เริ่มทดสอบ
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {fixtures.map((f) => (
          <p key={f.name} className="text-xs text-gray-500">
            <span className={f.available ? "text-gray-600" : "text-amber-600"}>
              {f.available ? "✓" : "✗ ยังไม่มีไฟล์ —"} {f.label}
            </span>
            : {f.description}
          </p>
        ))}
      </div>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      {state.status === "success" && <p className="text-xs text-green-600">{state.message}</p>}
    </form>
  );
}

function RetryButton({ fixtureName, action }: { fixtureName: string; action: TriggerAction }) {
  const [, formAction, pending] = useActionState(action, idleActionResult);
  return (
    <form action={formAction}>
      <input type="hidden" name="fixtureName" value={fixtureName} />
      <input type="hidden" name="isRetry" value="true" />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        ลองใหม่
      </button>
    </form>
  );
}

export default function OcrTestRunsPanel({
  fixtures,
  initialRuns,
  triggerAction,
}: {
  fixtures: OcrTestFixture[];
  initialRuns: OcrTestRunRow[];
  triggerAction: TriggerAction;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [pollError, setPollError] = useState(false);

  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/superadmin/ocr/test-runs", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { runs: OcrTestRunRow[] };
        if (!cancelled) {
          setRuns(data.runs);
          setPollError(false);
        }
      } catch {
        if (!cancelled) setPollError(true);
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <StartTestForm fixtures={fixtures} action={triggerAction} />

      {pollError && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ไม่สามารถอัปเดตข้อมูลล่าสุดได้ — แสดงข้อมูลล่าสุดที่มีอยู่
        </p>
      )}

      {runs.length === 0 ? (
        <p className="text-sm text-gray-500">ยังไม่มีการทดสอบ</p>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((run) => (
            <div key={run.id} className="rounded-lg border border-gray-200 bg-surface p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[run.status]}>{STATUS_LABEL[run.status]}</Badge>
                  <span className="font-medium text-gray-800">{run.fixtureName}</span>
                  {run.status === "processing" && run.currentPage !== null && run.totalPages !== null && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      หน้าที่ {run.currentPage} จาก {run.totalPages}
                    </span>
                  )}
                  {run.status === "processing" && run.currentPage === null && run.progressMessage && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      {run.progressMessage}
                    </span>
                  )}
                </div>
                {run.status === "failed" && <RetryButton fixtureName={run.fixtureName} action={triggerAction} />}
              </div>
              <p className="mt-1 text-gray-500">
                เริ่ม {run.startedAt ? new Date(run.startedAt).toLocaleString("th-TH") : "ยังไม่เริ่ม"}
                {run.completedAt && ` · เสร็จ ${new Date(run.completedAt).toLocaleString("th-TH")}`}
                {run.pageCount !== null && ` · ${run.pageCount} หน้า`}
                {run.extractedCharCount !== null && ` · ดึงข้อความได้ ${run.extractedCharCount} ตัวอักษร`}
              </p>
              {run.errorMessage && <p className="mt-1 text-red-600">{run.errorMessage}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
