"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { idleActionResult, type ActionResult } from "@/lib/actions/types";
import type { JobTypeConcurrency } from "@/lib/data/job-type-settings.server";
import type { BackgroundJobTypeRow } from "@/lib/supabase/database.types";

function ConcurrencyRow({
  setting,
  label,
  action,
}: {
  setting: JobTypeConcurrency;
  label: string;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, idleActionResult);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-2.5">
      <input type="hidden" name="jobType" value={setting.jobType} />
      <span className="min-w-[10rem] flex-1 text-sm text-gray-700">{label}</span>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        Concurrency
        <input
          type="number"
          name="concurrency"
          min={1}
          max={20}
          defaultValue={setting.concurrency}
          className="w-16 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        ขนาด chunk เริ่มต้น
        <input
          type="number"
          name="defaultBatchSize"
          min={1}
          max={500}
          defaultValue={setting.defaultBatchSize}
          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

export default function ConcurrencySettingsForm({
  settings,
  labels,
  action,
}: {
  settings: JobTypeConcurrency[];
  labels: Record<BackgroundJobTypeRow, string>;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {settings.map((setting) => (
        <ConcurrencyRow key={setting.jobType} setting={setting} label={labels[setting.jobType]} action={action} />
      ))}
    </div>
  );
}
