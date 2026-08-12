import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Users,
  FileText,
  Clock,
  Eye,
  Download,
  TrendingUp,
  UserPlus,
  HardDrive,
  DatabaseBackup,
  ScrollText,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  BarChart3,
  ListChecks,
  Activity,
  ArrowRight,
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import { getDashboardStats, getDateRangeStats } from "@/lib/data/admin-stats.server";
import { getAuditLogs } from "@/lib/data/audit-logs.server";
import {
  getUsersByRole,
  getResearchByStatus,
  getStorageUsage,
  getSystemAlerts,
  getBackupStatus,
} from "@/lib/data/superadmin-stats.server";
import {
  getNewMembersTimeSeries,
  getViewsDownloadsTimeSeries,
  getResearchCountByCategory,
  type ChartGranularity,
} from "@/lib/data/superadmin-charts.server";
import {
  MembersLineChart,
  ViewsDownloadsLineChart,
  CategoryBarChart,
  StatusPieChart,
} from "@/components/superadmin/OverviewCharts";
import { roleLabels, statusLabels } from "@/lib/labels";
import type { UserRole, DocumentStatus } from "@/types/research";

export const metadata: Metadata = { title: "ภาพรวมระบบ — Super Admin" };

/**
 * บังคับ dynamic render เสมอ (ไม่พยายาม static-generate) — หน้านี้ดึงข้อมูล
 * สดผ่าน cookies-based session เสมอ และฟังก์ชันใน superadmin-stats.server.ts
 * ดัก error ทุกกรณีไว้เอง (เพื่อแสดง "ไม่พร้อมใช้งาน" แทนการพังทั้งหน้า) ซึ่ง
 * จะดัก exception ควบคุมการทำงานภายในของ Next.js (DYNAMIC_SERVER_USAGE)
 * ระหว่างการพยายาม static-generate ไปด้วยโดยไม่ตั้งใจ ทำให้ build log มี
 * ข้อความ error ปลอมขึ้นแม้ build จะสำเร็จจริงก็ตาม
 */
export const dynamic = "force-dynamic";

const ROLE_ORDER: UserRole[] = ["super_admin", "admin", "librarian", "staff", "member"];
const STATUS_ORDER: DocumentStatus[] = [
  "pending_review",
  "revision_requested",
  "draft",
  "approved",
  "published",
  "rejected",
  "archived",
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/*
 * โครงสร้างหน้านี้จัดกลุ่มตามลำดับความสำคัญเชิงปฏิบัติการ (Hallmark Audit
 * Phase 4) แทนลำดับเดิมที่เรียงตามชนิดข้อมูล — ไม่มีการเพิ่ม/เปลี่ยน query
 * หรือ metric ใดๆ ทั้งสิ้น เป็นการจัดวางผลลัพธ์เดิมใหม่เท่านั้น:
 *   A. ต้องดำเนินการ (SystemAlertsSection, "รอตรวจสอบ" ที่แยกออกมาจาก
 *      CoreStatsSection เดิม, ลิงก์ด่วนไปยังหน้า DLQ/Cron ซึ่งมีข้อมูลของ
 *      ตัวเองอยู่แล้วในหน้านั้นๆ)
 *   B. ติดตามการทำงานของระบบ (Storage, Backup, Audit Log ล่าสุด)
 *   C. ข้อมูลอ้างอิง (ตัวเลขสรุปที่เหลือ, สัดส่วนผู้ใช้/สถานะ, งานวิจัยยอดนิยม,
 *      กราฟแนวโน้ม)
 */
export default async function SuperAdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; granularity?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const defaultTo = isoDate(today);
  const defaultFrom = isoDate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;
  const toExclusive = isoDate(new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000));
  const granularity: ChartGranularity = params.granularity === "month" ? "month" : "day";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ภาพรวมระบบ</h1>
        <p className="mt-1 text-sm text-gray-500">
          สรุปสถานะระบบทั้งหมดสำหรับ Super Admin — ผู้ใช้ งานวิจัย พื้นที่จัดเก็บ
          และเหตุการณ์สำคัญ
        </p>
      </div>

      {/* ============ A. ต้องดำเนินการ ============ */}
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          ต้องดำเนินการ
        </h2>
        <Suspense fallback={<CardsSkeleton count={1} />}>
          <PendingReviewCallout />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <SystemAlertsSection />
        </Suspense>
        <QuickLinksPanel />
      </div>

      {/* ============ B. ติดตามการทำงานของระบบ ============ */}
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Activity className="h-4 w-4" aria-hidden="true" />
          ติดตามการทำงานของระบบ
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<PanelSkeleton />}>
            <StorageUsageSection />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <BackupStatusSection />
          </Suspense>
        </div>
        <Suspense fallback={<PanelSkeleton />}>
          <RecentAuditLogSection />
        </Suspense>
      </div>

      {/* ============ C. ข้อมูลอ้างอิง ============ */}
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          ข้อมูลอ้างอิง
        </h2>

        <Suspense fallback={<CardsSkeleton count={6} />}>
          <ReferenceStatsSection />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<PanelSkeleton />}>
            <UsersByRoleSection />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <ResearchByStatusSection />
          </Suspense>
        </div>

        <Suspense fallback={<PanelSkeleton />}>
          <PopularResearchSection />
        </Suspense>

        <Panel
          icon={BarChart3}
          title="แนวโน้มเชิงลึก"
          action={
            <form className="flex flex-wrap items-center gap-2 text-sm" method="get">
              <input
                type="date"
                name="from"
                defaultValue={from}
                max={to}
                aria-label="จากวันที่"
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900"
              />
              <span className="text-gray-500">ถึง</span>
              <input
                type="date"
                name="to"
                defaultValue={to}
                max={defaultTo}
                aria-label="ถึงวันที่"
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900"
              />
              <select
                name="granularity"
                defaultValue={granularity}
                className="rounded-lg border border-gray-300 bg-surface px-2.5 py-1.5 text-xs"
              >
                <option value="day">รายวัน</option>
                <option value="month">รายเดือน</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                ดูข้อมูล
              </button>
            </form>
          }
        >
          <Suspense fallback={<ChartsSkeleton />}>
            <ChartsSection from={from} toExclusive={toExclusive} granularity={granularity} />
          </Suspense>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================================
 * A. ต้องดำเนินการ
 * ============================================================================ */
async function PendingReviewCallout() {
  const stats = await getDashboardStats();
  return (
    <StatCard
      icon={Clock}
      label="งานวิจัยรอตรวจสอบ — กดเพื่อไปหน้าอนุมัติ"
      value={stats.pendingReview}
      tone="action"
      href="/dashboard/approvals"
    />
  );
}

/** ลิงก์ด่วนไปยังหน้าที่มีข้อมูล "ต้องดำเนินการ" ของตัวเอง (DLQ, Cron/Worker,
 * ความปลอดภัย) — ไม่ได้ดึงข้อมูลจำนวนมาแสดงซ้ำที่นี่ เพราะหน้านี้ไม่เคยดึง
 * ข้อมูลเหล่านั้นมาก่อน (ไม่เพิ่ม query ใหม่) แต่ละหน้าปลายทางมีสรุปสถานะ
 * ของตัวเองอยู่แล้ว */
function QuickLinksPanel() {
  const links = [
    { href: "/superadmin/jobs", label: "งานล้มเหลวถาวร (DLQ)" },
    { href: "/superadmin/cron-monitoring", label: "ตรวจสอบ Cron/Worker" },
    { href: "/superadmin/security", label: "ความปลอดภัย" },
    { href: "/dashboard/access-requests", label: "คำขอเข้าถึงเอกสาร" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-brand-200 hover:text-accent"
        >
          {link.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

async function SystemAlertsSection() {
  const result = await getSystemAlerts();
  const hasAlerts = result.available && result.data.length > 0;

  return (
    <Panel icon={ShieldAlert} title="การแจ้งเตือนและปัญหาสำคัญของระบบ" tone={hasAlerts ? "alert" : "default"}>
      {!result.available ? (
        <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" description="ไม่สามารถดึงข้อมูลนี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง" compact />
      ) : result.data.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ไม่พบปัญหาสำคัญในขณะนี้
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.data.map((alert, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {alert.message}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ============================================================================
 * B. ติดตามการทำงานของระบบ
 * ============================================================================ */
async function StorageUsageSection() {
  const result = await getStorageUsage();

  return (
    <Panel icon={HardDrive} title="พื้นที่ Storage ที่ใช้งาน">
      {!result.available ? (
        <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" description="ไม่สามารถดึงข้อมูลพื้นที่ Storage ได้ในขณะนี้" compact />
      ) : result.data.length === 0 ? (
        <EmptyState title="ยังไม่มี Bucket ในระบบ" description="เมื่อมีการตั้งค่า Storage bucket แล้ว จะแสดงพื้นที่ใช้งานที่นี่" compact />
      ) : (
        <div className="flex flex-col gap-2">
          {result.data.map((bucket) => (
            <div
              key={bucket.bucketId}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{bucket.bucketId}</p>
                <p className="text-xs text-gray-500">
                  {bucket.objectCount.toLocaleString("th-TH")} ไฟล์
                </p>
              </div>
              <p className={`text-sm font-semibold ${bucket.totalBytes === 0 ? "text-gray-500" : "text-gray-700"}`}>
                {formatBytes(bucket.totalBytes)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function BackupStatusSection() {
  const status = getBackupStatus();

  return (
    <Panel icon={DatabaseBackup} title="สถานะ Backup ล่าสุด">
      <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" description={status.reason} action={status.guidance && <p className="text-xs text-gray-500">{status.guidance}</p>} compact />
    </Panel>
  );
}

async function RecentAuditLogSection() {
  const result = await getAuditLogs({ page: 1, pageSize: 10 });

  return (
    <Panel icon={ScrollText} title="รายการ Audit Log ล่าสุด">
      {!result.available ? (
        <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
      ) : result.rows.length === 0 ? (
        <EmptyState title="ยังไม่มีรายการ Audit Log" description="เมื่อมีการดำเนินการสำคัญในระบบ จะบันทึกไว้ที่นี่" compact />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="pb-2 font-medium">ผู้กระทำ</th>
                <th className="pb-2 font-medium">การกระทำ</th>
                <th className="pb-2 font-medium">ประเภทข้อมูล</th>
                <th className="pb-2 font-medium">วันที่/เวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.rows.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 pr-4 text-gray-700">{log.actorName}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{log.action}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{log.entityType}</td>
                  <td className="py-2.5 text-gray-500">
                    {new Date(log.createdAt).toLocaleString("th-TH")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link
        href="/superadmin/audit-logs"
        className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
      >
        ดูประวัติทั้งหมด →
      </Link>
    </Panel>
  );
}

/* ============================================================================
 * C. ข้อมูลอ้างอิง
 * ============================================================================ */
async function ReferenceStatsSection() {
  const today = new Date();
  const from = isoDate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
  const toExclusive = isoDate(new Date(today.getTime() + 24 * 60 * 60 * 1000));

  const [dashboardStats, rangeStats, usersByRole, researchByStatus] = await Promise.all([
    getDashboardStats(),
    getDateRangeStats(from, toExclusive),
    getUsersByRole(),
    getResearchByStatus(),
  ]);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard
        icon={Users}
        label="ผู้ใช้ทั้งหมด"
        value={usersByRole.available ? usersByRole.data.total : "ไม่พร้อมใช้งาน"}
      />
      <StatCard
        icon={UserPlus}
        label="สมาชิกใหม่ (30 วันล่าสุด)"
        value={rangeStats.newMembersInRange}
      />
      <StatCard
        icon={FileText}
        label="งานวิจัยทั้งหมด"
        value={researchByStatus.available ? researchByStatus.data.total : "ไม่พร้อมใช้งาน"}
      />
      <StatCard icon={Eye} label="ยอดเข้าชมสะสม" value={dashboardStats.totalViews} />
      <StatCard icon={Download} label="ยอดดาวน์โหลดสะสม" value={dashboardStats.totalDownloads} />
      <StatCard icon={Eye} label="อ่านออนไลน์ (30 วันล่าสุด)" value={rangeStats.readsInRange} />
    </div>
  );
}

async function UsersByRoleSection() {
  const result = await getUsersByRole();

  return (
    <Panel icon={Users} title="ผู้ใช้ทั้งหมด แยกตามบทบาท">
      {!result.available ? (
        <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
      ) : result.data.total === 0 ? (
        <EmptyState title="ยังไม่มีผู้ใช้งานในระบบ" compact />
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="rounded-lg bg-gray-50 p-3">
              <dt className="text-xs text-gray-500">{roleLabels[role]}</dt>
              <dd className="mt-0.5 text-lg font-bold text-gray-900">
                {result.data.byRole[role].toLocaleString("th-TH")}
              </dd>
            </div>
          ))}
          {result.data.unassigned > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <dt className="text-xs text-amber-700">ยังไม่มีบทบาท</dt>
              <dd className="mt-0.5 text-lg font-bold text-amber-800">
                {result.data.unassigned.toLocaleString("th-TH")}
              </dd>
            </div>
          )}
        </dl>
      )}
    </Panel>
  );
}

async function ResearchByStatusSection() {
  const result = await getResearchByStatus();

  return (
    <Panel icon={FileText} title="งานวิจัยทั้งหมด แยกตามสถานะ">
      {!result.available ? (
        <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
      ) : result.data.total === 0 ? (
        <EmptyState title="ยังไม่มีงานวิจัยในระบบ" compact />
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="rounded-lg bg-gray-50 p-3">
              <dt className="text-xs text-gray-500">{statusLabels[status]}</dt>
              <dd className="mt-0.5 text-lg font-bold text-gray-900">
                {result.data.byStatus[status].toLocaleString("th-TH")}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

async function PopularResearchSection() {
  const stats = await getDashboardStats();

  return (
    <Panel icon={TrendingUp} title="งานวิจัยยอดนิยม">
      {stats.popularResearch.length === 0 ? (
        <EmptyState title="ยังไม่มีข้อมูล" compact />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="pb-2 font-medium">ชื่อเรื่อง</th>
                <th className="pb-2 font-medium">เข้าชม</th>
                <th className="pb-2 font-medium">ดาวน์โหลด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.popularResearch.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-xs truncate py-2.5 pr-4">
                    <Link href={`/research/${r.id}`} className="text-accent hover:underline">
                      {r.titleTh}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">
                    {r.views.toLocaleString("th-TH")}
                  </td>
                  <td className="py-2.5 text-gray-600">{r.downloads.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

async function ChartsSection({
  from,
  toExclusive,
  granularity,
}: {
  from: string;
  toExclusive: string;
  granularity: ChartGranularity;
}) {
  const [membersResult, viewsDownloadsResult, categoryResult, statusResult] = await Promise.all([
    getNewMembersTimeSeries(from, toExclusive, granularity),
    getViewsDownloadsTimeSeries(from, toExclusive, granularity),
    getResearchCountByCategory(),
    getResearchByStatus(),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold text-gray-500">สมาชิกใหม่</h3>
        {!membersResult.available ? (
          <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
        ) : membersResult.data.every((d) => d.count === 0) ? (
          <EmptyState title="ไม่มีสมาชิกใหม่ในช่วงเวลาที่เลือก" compact />
        ) : (
          <MembersLineChart data={membersResult.data} />
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold text-gray-500">ยอดเข้าชมและดาวน์โหลด</h3>
        {!viewsDownloadsResult.available ? (
          <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
        ) : viewsDownloadsResult.data.every((d) => d.views === 0 && d.downloads === 0) ? (
          <EmptyState title="ไม่มีข้อมูลในช่วงเวลาที่เลือก" compact />
        ) : (
          <ViewsDownloadsLineChart data={viewsDownloadsResult.data} />
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold text-gray-500">งานวิจัยตามหมวดหมู่</h3>
        {!categoryResult.available ? (
          <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
        ) : categoryResult.data.length === 0 ? (
          <EmptyState title="ยังไม่มีข้อมูล" compact />
        ) : (
          <CategoryBarChart data={categoryResult.data} />
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold text-gray-500">สัดส่วนงานวิจัยตามสถานะ</h3>
        {!statusResult.available ? (
          <EmptyState tone="unavailable" title="ไม่พร้อมใช้งาน" compact />
        ) : (
          <StatusPieChart
            data={STATUS_ORDER.map((status) => ({
              status,
              count: statusResult.data.byStatus[status],
            }))}
          />
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * Skeletons
 * ============================================================================ */
function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-gray-100" />;
}
