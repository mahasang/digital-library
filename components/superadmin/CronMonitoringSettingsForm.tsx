"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";
import type { CronMonitoringRow } from "@/lib/data/cron-monitoring.server";

const JOB_NAME_LABELS: Record<string, string> = {
  queue_worker: "Worker ประมวลผลคิวหลัก",
  access_expiration: "ตรวจสอบสิทธิ์หมดอายุ",
  notification_delivery: "ส่งอีเมลแจ้งเตือนผู้ติดตามหมวดหมู่",
  maintenance_cleanup: "บำรุงรักษา/ล้างข้อมูลเก่า",
  health_monitoring: "ตรวจสุขภาพ Cron/Worker",
};

function SettingsRow({
  row,
  action,
}: {
  row: CronMonitoringRow;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, idleActionResult);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-2.5">
      <input type="hidden" name="jobName" value={row.jobName} />
      <span className="min-w-[14rem] flex-1 text-sm text-gray-700">{JOB_NAME_LABELS[row.jobName] ?? row.jobName}</span>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        ความถี่ที่คาดหวัง (นาที)
        <input
          type="number"
          name="expectedFrequencyMinutes"
          min={1}
          max={1440}
          defaultValue={row.expectedFrequencyMinutes}
          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        เกณฑ์จำนวนงานล้มเหลว
        <input
          type="number"
          name="failureThreshold"
          min={1}
          defaultValue={row.failureThreshold}
          className="w-16 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        บันทึก
      </button>
      {state.status === "error" && <p className="w-full text-xs text-red-600">{state.message}</p>}
      {state.status === "success" && <p className="w-full text-xs text-green-600">{state.message}</p>}
    </form>
  );
}

export default function CronMonitoringSettingsForm({
  rows,
  action,
}: {
  rows: CronMonitoringRow[];
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <SettingsRow key={row.jobName} row={row} action={action} />
      ))}
    </div>
  );
}
