import type { Metadata } from "next";
import { getSettings } from "@/lib/data/settings.server";
import { isEmailProviderConfigured } from "@/lib/notifications/email.server";
import NotificationSettingsForm from "@/components/superadmin/NotificationSettingsForm";
import AccessExpirationWarningSettingsForm from "@/components/superadmin/AccessExpirationWarningSettingsForm";
import ProcessAccessExpirationNowButton from "@/components/superadmin/ProcessAccessExpirationNowButton";
import { RecentJobsList, FailedJobList } from "@/components/superadmin/JobBatchList";
import { getRecentJobs, getFailedJobs } from "@/lib/data/job-batches.server";
import { retryFailedNotificationJobAction } from "./actions";

export const metadata: Metadata = { title: "การแจ้งเตือน — Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminNotificationsPage() {
  const [settings, recentExpirationJobs, recentNotificationJobs, failedNotificationJobs] =
    await Promise.all([
      getSettings(),
      getRecentJobs("access_expiration", 10),
      getRecentJobs("category_notification", 10),
      getFailedJobs("category_notification", 50),
    ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">การแจ้งเตือน</h1>
        <p className="mt-1 text-sm text-gray-500">
          เปิด/ปิดการแจ้งเตือนในระบบและทางอีเมลเมื่อสถานะงานวิจัยเปลี่ยนแปลง
        </p>
      </div>

      <NotificationSettingsForm
        settings={settings}
        emailProviderConfigured={isEmailProviderConfigured()}
      />

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">งานหมดอายุสิทธิ์เข้าถึง</h2>
            <p className="mt-1 text-xs text-gray-500">
              ตรวจ document_access_grants/access_requests ที่หมดอายุ เปลี่ยนสถานะและปิดการเข้าถึงอัตโนมัติ
              ตามรอบ Cron ที่ตั้งไว้ (ดูรายละเอียดที่ docs/background-jobs.md)
            </p>
          </div>
          <ProcessAccessExpirationNowButton />
        </div>
        <AccessExpirationWarningSettingsForm
          settings={settings}
          emailProviderConfigured={isEmailProviderConfigured()}
        />
        <div className="mt-4">
          <RecentJobsList jobs={recentExpirationJobs} emptyMessage="ยังไม่มีการประมวลผลสิทธิ์ที่หมดอายุ" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          งานแจ้งผู้ติดตามหมวดหมู่ล่าสุด (อีเมล)
        </h2>
        <RecentJobsList
          jobs={recentNotificationJobs}
          emptyMessage="ยังไม่มีการแจ้งเตือนผู้ติดตามหมวดหมู่"
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          งานแจ้งเตือนที่ล้มเหลวถาวร (ครบจำนวนครั้งลองใหม่แล้ว)
        </h2>
        <FailedJobList
          jobs={failedNotificationJobs}
          retryAction={retryFailedNotificationJobAction}
          emptyMessage="ไม่มีงานแจ้งเตือนที่ล้มเหลวถาวรในขณะนี้"
        />
      </section>
    </div>
  );
}
