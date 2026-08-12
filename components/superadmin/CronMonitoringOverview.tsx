import Link from "next/link";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import type { CronMonitoringRow, RecentCronAlert } from "@/lib/data/cron-monitoring.server";

const JOB_NAME_LABELS: Record<string, string> = {
  queue_worker: "Worker ประมวลผลคิวหลัก",
  access_expiration: "ตรวจสอบสิทธิ์หมดอายุ",
  notification_delivery: "ส่งอีเมลแจ้งเตือนผู้ติดตามหมวดหมู่",
  maintenance_cleanup: "บำรุงรักษา/ล้างข้อมูลเก่า",
  health_monitoring: "ตรวจสุขภาพ Cron/Worker",
};

const STATUS_LABEL: Record<string, string> = {
  running: "กำลังทำงาน",
  completed: "สำเร็จ",
  failed: "ล้มเหลว",
};

function HeartbeatBadge({ status }: { status: CronMonitoringRow["heartbeatStatus"] }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        ปกติ
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        <AlertTriangle className="h-3 w-3" />
        เกินกำหนด
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      <HelpCircle className="h-3 w-3" />
      ยังไม่เคยทำงาน
    </span>
  );
}

export function CronMonitoringTable({ rows }: { rows: CronMonitoringRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 font-medium">Cron</th>
            <th className="py-2 pr-3 font-medium">Heartbeat</th>
            <th className="py-2 pr-3 font-medium">รันล่าสุด</th>
            <th className="py-2 pr-3 font-medium">สถานะล่าสุด</th>
            <th className="py-2 pr-3 font-medium">สำเร็จ/ล้มเหลว</th>
            <th className="py-2 font-medium">รอบถัดไปที่คาดว่าจะทำงาน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.jobName} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 text-gray-800">{JOB_NAME_LABELS[row.jobName] ?? row.jobName}</td>
              <td className="py-2 pr-3">
                <HeartbeatBadge status={row.heartbeatStatus} />
              </td>
              <td className="py-2 pr-3 text-gray-600">
                {row.lastRun ? new Date(row.lastRun.startedAt).toLocaleString("th-TH") : "ยังไม่เคยทำงาน"}
              </td>
              <td className="py-2 pr-3 text-gray-600">
                {row.lastRun ? STATUS_LABEL[row.lastRun.status] ?? row.lastRun.status : "-"}
                {row.lastRun?.errorSummary && (
                  <p className="mt-0.5 max-w-xs truncate text-red-600" title={row.lastRun.errorSummary}>
                    {row.lastRun.errorSummary}
                  </p>
                )}
              </td>
              <td className="py-2 pr-3 text-gray-600">
                {row.lastRun ? `${row.lastRun.processedCount} / ${row.lastRun.failedCount}` : "-"}
              </td>
              <td className="py-2 text-gray-600">
                {row.lastRun?.nextExpectedRunAt
                  ? new Date(row.lastRun.nextExpectedRunAt).toLocaleString("th-TH")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecentCronAlertsList({ alerts }: { alerts: RecentCronAlert[] }) {
  if (alerts.length === 0) {
    return <EmptyState icon={CheckCircle2} title="ยังไม่มีการแจ้งเตือนล่าสุด" compact />;
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <div key={alert.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-amber-800">{alert.title}</p>
            <span className="shrink-0 text-amber-500">{new Date(alert.createdAt).toLocaleString("th-TH")}</span>
          </div>
          <p className="mt-1 text-amber-700">{alert.message}</p>
        </div>
      ))}
      <Link href="/superadmin/jobs" className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
        ไปที่หน้างานพื้นหลัง/Dead-letter Queue →
      </Link>
    </div>
  );
}
