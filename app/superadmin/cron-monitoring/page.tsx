import Link from "next/link";
import type { Metadata } from "next";
import { RefreshCw, ActivitySquare } from "lucide-react";
import { getCronMonitoringOverview, getRecentCronAlerts } from "@/lib/data/cron-monitoring.server";
import { CronMonitoringTable, RecentCronAlertsList } from "@/components/superadmin/CronMonitoringOverview";
import CronMonitoringSettingsForm from "@/components/superadmin/CronMonitoringSettingsForm";
import { updateCronMonitoringSettingsAction } from "./actions";

export const metadata: Metadata = { title: "ตรวจสอบ Cron/Worker — Super Admin" };
export const dynamic = "force-dynamic";

export default async function CronMonitoringPage() {
  const [rows, alerts] = await Promise.all([getCronMonitoringOverview(), getRecentCronAlerts()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <ActivitySquare className="h-6 w-6 text-accent" />
            ตรวจสอบ Cron/Worker
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            ประวัติการทำงานของ Cron/Worker ที่สำคัญ, สถานะ heartbeat, และการแจ้งเตือนเมื่อพบความผิดปกติ
          </p>
        </div>
        <Link
          href="/superadmin/cron-monitoring"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <strong>ข้อมูลนี้ไม่ใช่แบบ Real-time</strong> — อัปเดตตามรอบที่ Cron/Worker ทำงานจริงเท่านั้น
        (ไม่ใช่ทุกครั้งที่โหลดหน้านี้) หน้านี้เป็นภาพรวมล่าสุด ณ เวลาที่ Cron/Worker แต่ละตัวรันครั้งล่าสุด ไม่ใช่การตรวจสอบสด
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">สถานะ Cron ล่าสุด</h2>
        <p className="mb-3 text-xs text-gray-500">
          &ldquo;ตรวจสอบสิทธิ์หมดอายุ&rdquo; และ &ldquo;ส่งอีเมลแจ้งเตือนผู้ติดตามหมวดหมู่&rdquo; ไม่มี Cron แยกของตัวเอง — ทำงานตามจังหวะที่{" "}
          <Link href="/superadmin/jobs" className="text-accent hover:underline">
            Worker ประมวลผลคิวหลัก
          </Link>{" "}
          ถูกเรียกจริง ความถี่ที่คาดหวังของสองรายการนี้จึงควรตั้งให้เท่ากับหรือมากกว่าความถี่ Cron ของ Worker หลักเสมอ
        </p>
        <CronMonitoringTable rows={rows} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">การแจ้งเตือนล่าสุด</h2>
        <p className="mb-3 text-xs text-gray-500">แจ้งเตือน Super Admin ทุกคนเมื่อพบความผิดปกติ (มี cooldown กันแจ้งซ้ำ)</p>
        <RecentCronAlertsList alerts={alerts} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">ความถี่ที่คาดหวัง/เกณฑ์แจ้งเตือน</h2>
        <p className="mb-3 text-xs text-gray-500">
          ปรับได้ต่อ Cron หนึ่งชื่อ — ตั้งสูงเกินไปจะแจ้งเตือนช้าเมื่อมีปัญหาจริง ตั้งต่ำเกินไปอาจแจ้งเตือนเท็จได้ถ้าไม่ตรงกับความถี่ Cron จริงที่ตั้งไว้
        </p>
        <CronMonitoringSettingsForm rows={rows} action={updateCronMonitoringSettingsAction} />
      </section>

      <p className="text-xs text-gray-500">
        ดูรายละเอียดงาน/Dead-letter Queue/Concurrency เพิ่มเติมได้ที่{" "}
        <Link href="/superadmin/jobs" className="text-accent hover:underline">
          /superadmin/jobs
        </Link>
      </p>
    </div>
  );
}
