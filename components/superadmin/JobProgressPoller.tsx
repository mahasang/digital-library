"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { JobBatchList } from "@/components/superadmin/JobBatchList";
import type { JobBatchSummary } from "@/lib/data/job-batches.server";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/actions/types";

type BatchAction = (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;

const POLL_INTERVAL_MS = 5000;

/**
 * แสดงรายการ batch พร้อมรีเฟรชสถานะเป็นระยะ (5 วินาที) โดยไม่ต้องโหลดทั้งหน้า
 * ใหม่ (router.refresh() จะรัน query รายการผู้สมัคร 500 แถวของหน้าซ้ำโดยไม่
 * จำเป็น) — รับ initialBatches จาก Server Component เป็นค่าตั้งต้นเสมอ (ไม่มี
 * loading flash ตอนโหลดหน้าครั้งแรก) หยุด poll เมื่อแท็บไม่ได้อยู่ในโฟกัส
 * (document.visibilityState) กันยิง request เปล่าประโยชน์เวลาผู้ใช้สลับแท็บไปทำ
 * งานอื่น เมื่อ fetch ไม่สำเร็จจะแสดงคำเตือนเล็กๆ แต่ยังคงข้อมูลล่าสุดที่มีไว้
 * ให้เห็น (fail-open แบบเดียวกับจุดอื่นในโปรเจกต์ ไม่ใช่ล้างข้อมูลทิ้ง)
 */
export default function JobProgressPoller({
  jobType,
  initialBatches,
  batchActions,
}: {
  jobType: BackgroundJobTypeRow;
  initialBatches: JobBatchSummary[];
  batchActions?: { pause: BatchAction; resume: BatchAction; cancel: BatchAction; retryFailed: BatchAction };
}) {
  const [batches, setBatches] = useState(initialBatches);
  const [pollError, setPollError] = useState(false);
  const batchesRef = useRef(initialBatches);

  useEffect(() => {
    setBatches(initialBatches);
    batchesRef.current = initialBatches;
  }, [initialBatches]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/superadmin/jobs/batches?jobType=${encodeURIComponent(jobType)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { batches: JobBatchSummary[] };
        if (!cancelled) {
          setBatches(data.batches);
          batchesRef.current = data.batches;
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
  }, [jobType]);

  return (
    <div className="flex flex-col gap-2">
      {pollError && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ไม่สามารถอัปเดตข้อมูลล่าสุดได้ — แสดงข้อมูลล่าสุดที่มีอยู่
        </p>
      )}
      <JobBatchList batches={batches} batchActions={batchActions} />
    </div>
  );
}
