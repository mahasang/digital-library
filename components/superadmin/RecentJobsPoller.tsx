"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { RecentJobsList } from "@/components/superadmin/JobBatchList";
import type { RecentJobRow } from "@/lib/data/job-batches.server";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

const POLL_INTERVAL_MS = 5000;

/**
 * เหมือน JobProgressPoller.tsx (ช่วงที่ 25) ทุกประการแต่ดึงรายการ job แบบไม่
 * จัดกลุ่ม (getRecentJobs, ?mode=recent) แทนรายการ batch — ใช้กับ ocr_processing
 * ที่หน้า /superadmin/pdf-processing และ /superadmin/ocr (ช่วงที่ 29) เพราะ
 * งาน OCR ที่สั่งทีละรายการไม่มี batch_id ให้จัดกลุ่ม
 */
export default function RecentJobsPoller({
  jobType,
  initialJobs,
  emptyMessage,
}: {
  jobType: BackgroundJobTypeRow;
  initialJobs: RecentJobRow[];
  emptyMessage: string;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [pollError, setPollError] = useState(false);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/api/superadmin/jobs/batches?jobType=${encodeURIComponent(jobType)}&mode=recent`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { jobs: RecentJobRow[] };
        if (!cancelled) {
          setJobs(data.jobs);
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
      <RecentJobsList jobs={jobs} emptyMessage={emptyMessage} />
    </div>
  );
}
