import Link from "next/link";
import type { Metadata } from "next";
import { History } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getDeadLetterJobs, getResolvedDeadLetterJobs } from "@/lib/data/job-batches.server";
import { getJobConcurrencySettingsList } from "@/lib/data/job-type-settings.server";
import { getQueueHealth } from "@/lib/data/queue-health.server";
import { describeJobsForDisplay, JOB_TYPE_LABELS } from "@/lib/jobs/dlq.server";
import DeadLetterJobList from "@/components/superadmin/DeadLetterJobList";
import ConcurrencySettingsForm from "@/components/superadmin/ConcurrencySettingsForm";
import QueueHealthPanel from "@/components/superadmin/QueueHealthPanel";
import {
  retryDeadLetterJobAction,
  cancelDeadLetterJobAction,
  resolveDeadLetterJobAction,
  updateJobConcurrencyAction,
} from "./actions";

export const metadata: Metadata = { title: "งานพื้นหลังที่ล้มเหลวถาวร — Super Admin" };
export const dynamic = "force-dynamic";

export default async function DeadLetterQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "resolved" ? "resolved" : "active";

  const [jobs, concurrencySettings, queueHealth] = await Promise.all([
    view === "resolved" ? getResolvedDeadLetterJobs() : getDeadLetterJobs(),
    getJobConcurrencySettingsList(),
    getQueueHealth(),
  ]);
  const infos = await describeJobsForDisplay(jobs);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          งานพื้นหลังที่ล้มเหลวถาวร (Dead-letter Queue)
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          งานที่ลองประมวลผลซ้ำครบจำนวนครั้งแล้วยังไม่สำเร็จ รวมทุกประเภทงาน — ลองใหม่, ยกเลิก,
          หรือทำเครื่องหมายว่าแก้ไขแล้วได้ที่นี่ ทุกการดำเนินการถูกบันทึกใน Audit Log เสมอ
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">สถานะ Queue โดยรวม</h2>
        <p className="mb-3 text-xs text-gray-500">
          จำนวน worker ที่กำลังทำงานจริงและจำนวนงานต่อสถานะ — นับรวมทุก process/instance ที่กำลัง
          เรียก worker endpoint พร้อมกันจริง ไม่ใช่แค่การเรียกครั้งล่าสุด
        </p>
        <QueueHealthPanel health={queueHealth} labels={JOB_TYPE_LABELS} />
      </section>

      <div className="flex gap-2 border-b border-gray-200">
        <Link
          href="/superadmin/jobs?view=active"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            view === "active" ? "border-brand-600 text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          ยังต้องดำเนินการ
        </Link>
        <Link
          href="/superadmin/jobs?view=resolved"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            view === "resolved" ? "border-brand-600 text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          ประวัติที่จัดการแล้ว
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        {view === "active" ? (
          <DeadLetterJobList
            jobs={jobs}
            infos={infos}
            retryAction={retryDeadLetterJobAction}
            cancelAction={cancelDeadLetterJobAction}
            resolveAction={resolveDeadLetterJobAction}
            emptyMessage="ไม่มีงานที่ล้มเหลวถาวรในขณะนี้"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.length === 0 ? (
              <EmptyState
                icon={History}
                title="ยังไม่มีประวัติการจัดการ"
                description="เมื่อมีการลองใหม่ ยกเลิก หรือทำเครื่องหมายว่าแก้ไขแล้ว จะบันทึกไว้ที่นี่"
                compact
              />
            ) : (
              jobs.map((job, i) => (
                <div key={job.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
                  <p className="font-medium text-gray-800">{infos[i].safeSummary}</p>
                  <p className="mt-0.5 text-gray-500">
                    {job.status === "cancelled" ? "ยกเลิกแล้ว" : "แก้ไขแล้ว"} เมื่อ{" "}
                    {job.resolvedAt ? new Date(job.resolvedAt).toLocaleString("th-TH") : "-"}
                  </p>
                  {job.resolutionNote && <p className="mt-0.5 text-gray-600">หมายเหตุ: {job.resolutionNote}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Concurrency ของ Worker</h2>
        <p className="mb-3 text-xs text-gray-500">
          จำนวนงานสูงสุดที่ worker ประมวลผลพร้อมกันได้ต่อประเภทงานหนึ่ง (1-20) — ปรับสูงเกินไป
          อาจชนขีดจำกัดของ provider ภายนอก (เช่น OCR) หรือ Storage ควรปรับทีละน้อย
        </p>
        <ConcurrencySettingsForm
          settings={concurrencySettings}
          labels={JOB_TYPE_LABELS}
          action={updateJobConcurrencyAction}
        />
      </section>
    </div>
  );
}
