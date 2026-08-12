import { AlertTriangle } from "lucide-react";
import type { QueueHealth } from "@/lib/data/queue-health.server";
import type { BackgroundJobStatusRow, BackgroundJobTypeRow } from "@/lib/supabase/database.types";

const STATUS_LABEL: Record<BackgroundJobStatusRow, string> = {
  pending: "รอดำเนินการ",
  processing: "กำลังประมวลผล",
  completed: "สำเร็จ",
  failed: "ล้มเหลว",
  cancelled: "ยกเลิกแล้ว",
};

/**
 * สรุปสถานะ queue แบบสด (snapshot ณ เวลาที่โหลดหน้า ไม่ auto-refresh — เหมือน
 * /superadmin/system-health) ที่หน้า /superadmin/jobs (ช่วงที่ 30) — แสดงแค่
 * ตัวเลขรวมที่ปลอดภัย ไม่มี payload/worker id ดิบ/รายละเอียด infrastructure
 */
export default function QueueHealthPanel({
  health,
  labels,
}: {
  health: QueueHealth;
  labels: Record<BackgroundJobTypeRow, string>;
}) {
  const totalActiveWorkers = health.byJobType.reduce((sum, row) => sum + row.activeWorkerCount, 0);
  const totalExpiredLease = health.byJobType.reduce((sum, row) => sum + row.expiredLeaseCount, 0);
  const totalStuckPending = health.byJobType.reduce((sum, row) => sum + row.stuckPendingCount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((status) => (
          <div key={status} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
            <p className="text-lg font-semibold text-gray-900">{health.statusCounts[status] ?? 0}</p>
            <p className="text-xs text-gray-500">{STATUS_LABEL[status]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-ink">
          worker ที่กำลังทำงานอยู่ตอนนี้: {totalActiveWorkers}
        </span>
        {totalExpiredLease > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            lease หมดอายุค้างอยู่: {totalExpiredLease} (จะถูกดึงกลับมาทำต่ออัตโนมัติรอบถัดไป)
          </span>
        )}
        {totalStuckPending > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            รอคิวนานผิดปกติ (เกิน 15 นาที): {totalStuckPending}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-3 font-medium">ประเภทงาน</th>
              <th className="py-2 pr-3 font-medium">Concurrency</th>
              <th className="py-2 pr-3 font-medium">กำลังทำงานจริง</th>
              <th className="py-2 pr-3 font-medium">Worker ที่ active</th>
              <th className="py-2 pr-3 font-medium">รอคิว</th>
              <th className="py-2 pr-3 font-medium">รอนานผิดปกติ</th>
              <th className="py-2 font-medium">lease หมดอายุค้าง</th>
            </tr>
          </thead>
          <tbody>
            {health.byJobType.map((row) => (
              <tr key={row.jobType} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 text-gray-800">{labels[row.jobType] ?? row.jobType}</td>
                <td className="py-2 pr-3 text-gray-600">{row.concurrencyLimit}</td>
                <td className="py-2 pr-3 text-gray-600">
                  <span
                    className={row.processingCount > row.concurrencyLimit ? "font-semibold text-red-600" : undefined}
                  >
                    {row.processingCount}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-600">{row.activeWorkerCount}</td>
                <td className="py-2 pr-3 text-gray-600">{row.pendingCount}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {row.stuckPendingCount > 0 ? (
                    <span className="font-medium text-amber-700">{row.stuckPendingCount}</span>
                  ) : (
                    0
                  )}
                </td>
                <td className="py-2 text-gray-600">
                  {row.expiredLeaseCount > 0 ? (
                    <span className="font-medium text-amber-700">{row.expiredLeaseCount}</span>
                  ) : (
                    0
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        ข้อมูลนี้เป็นภาพรวม ณ เวลาที่โหลดหน้า (ไม่ auto-refresh) — โหลดหน้าใหม่เพื่อดูค่าล่าสุด
      </p>
    </div>
  );
}
