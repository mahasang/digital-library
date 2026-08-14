import Link from "next/link";
import type { Metadata } from "next";
import { Settings } from "lucide-react";
import {
  getDuplicateScanCandidates,
  getDuplicateScanCandidatesCount,
  getDistinctResearchYears,
  type DuplicateScanFilters,
} from "@/lib/data/duplicate-scan-candidates.server";
import { getCategories } from "@/lib/data/categories.server";
import { getRecentJobBatches, getFailedJobs } from "@/lib/data/job-batches.server";
import { getDefaultBatchSize } from "@/lib/data/job-type-settings.server";
import BulkJobSelector, { type BulkSelectItem } from "@/components/superadmin/BulkJobSelector";
import ProcessQueueNowButton from "@/components/superadmin/ProcessQueueNowButton";
import { FailedJobList } from "@/components/superadmin/JobBatchList";
import JobProgressPoller from "@/components/superadmin/JobProgressPoller";
import BulkAllMatchingFilterDialog from "@/components/superadmin/BulkAllMatchingFilterDialog";
import { statusLabels } from "@/lib/labels";
import type { DocumentStatus } from "@/types/research";
import {
  bulkEnqueueDuplicateScanAction,
  retryFailedDuplicateScanJobAction,
  bulkEnqueueAllMatchingFilterAction,
  pauseBatchAction,
  resumeBatchAction,
  cancelBatchAction,
  retryFailedInBatchAction,
} from "./actions";

export const metadata: Metadata = { title: "คุณภาพข้อมูล — Super Admin" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS: DocumentStatus[] = [
  "draft",
  "pending_review",
  "revision_requested",
  "approved",
  "published",
  "rejected",
  "archived",
];

export default async function SuperAdminDataQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; categoryId?: string; status?: string; recent?: string; neverScanned?: string }>;
}) {
  const params = await searchParams;
  const filters: DuplicateScanFilters & { neverScannedOnly?: boolean } = {
    year: params.year ? Number(params.year) : undefined,
    categoryId: params.categoryId || undefined,
    status: STATUS_OPTIONS.includes(params.status as DocumentStatus)
      ? (params.status as DocumentStatus)
      : undefined,
    recentlyEditedOnly: params.recent === "1",
    neverScannedOnly: params.neverScanned === "1",
  };

  const [candidates, years, categories, batches, failedJobs, estimatedCount, defaultBatchSize] = await Promise.all([
    getDuplicateScanCandidates(filters),
    getDistinctResearchYears(),
    getCategories(),
    getRecentJobBatches("duplicate_scan"),
    getFailedJobs("duplicate_scan", 50),
    getDuplicateScanCandidatesCount(filters),
    getDefaultBatchSize("duplicate_scan"),
  ]);

  const items: BulkSelectItem[] = candidates.map((c) => ({
    id: c.id,
    title: c.titleTh,
    meta: `ปี ${c.year} · แก้ไขล่าสุด ${new Date(c.updatedAt).toLocaleDateString("th-TH")}`,
    badge: { label: statusLabels[c.status], tone: c.status === "published" ? "green" : "gray" },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">คุณภาพข้อมูล — ตรวจงานวิจัยซ้ำย้อนหลัง</h1>
          <p className="mt-1 text-sm text-gray-500">
            สั่งตรวจสอบงานวิจัยที่อาจซ้ำกันย้อนหลังทั้งระบบแบบ background job — ไม่มีการรวมข้อมูล
            (merge) อัตโนมัติเลย เป็นแค่การตรวจสอบและบันทึกคู่ที่น่าสงสัยไว้ให้เจ้าหน้าที่ตรวจสอบที่{" "}
            <Link href="/dashboard/duplicate-reviews" className="text-accent hover:underline">
              /dashboard/duplicate-reviews
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/superadmin/data-quality/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-3.5 w-3.5" />
            ตั้งค่าเกณฑ์ตรวจข้อมูลซ้ำ
          </Link>
          <ProcessQueueNowButton />
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-surface p-4" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-xs font-medium text-gray-600">
            ปี
          </label>
          <select
            id="year"
            name="year"
            defaultValue={params.year ?? ""}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoryId" className="text-xs font-medium text-gray-600">
            หมวดหมู่
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={params.categoryId ?? ""}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameTh}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium text-gray-600">
            สถานะเผยแพร่
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-gray-600">
          <input type="checkbox" name="recent" value="1" defaultChecked={params.recent === "1"} />
          เฉพาะที่แก้ไขล่าสุด (30 วัน)
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-gray-600">
          <input type="checkbox" name="neverScanned" value="1" defaultChecked={params.neverScanned === "1"} />
          เฉพาะที่ยังไม่เคยตรวจสอบซ้ำเลย
        </label>
        <button
          type="submit"
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          กรอง
        </button>
      </form>

      <BulkJobSelector
        items={items}
        action={bulkEnqueueDuplicateScanAction}
        submitLabel="ตรวจสอบที่เลือก"
        emptyMessage="ไม่พบรายการตามเงื่อนไขที่เลือก"
      />

      <BulkAllMatchingFilterDialog
        action={bulkEnqueueAllMatchingFilterAction}
        hiddenFields={{
          ...(filters.year ? { year: String(filters.year) } : {}),
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          recentlyEditedOnly: filters.recentlyEditedOnly ? "true" : "false",
          neverScannedOnly: filters.neverScannedOnly ? "true" : "false",
        }}
        label="ตรวจสอบทั้งหมดตามตัวกรอง (ไม่จำกัด 500 รายการ)"
        jobTypeLabel="ตรวจสอบงานวิจัยซ้ำ"
        filterSummary={[
          ...(filters.year ? [`ปี: ${filters.year}`] : []),
          ...(filters.categoryId ? [`หมวดหมู่: ${categories.find((c) => c.id === filters.categoryId)?.nameTh ?? filters.categoryId}`] : []),
          ...(filters.status ? [`สถานะเผยแพร่: ${statusLabels[filters.status]}`] : []),
          ...(filters.recentlyEditedOnly ? ["เฉพาะที่แก้ไขล่าสุด (30 วัน)"] : []),
          ...(filters.neverScannedOnly ? ["เฉพาะที่ยังไม่เคยตรวจสอบซ้ำเลย"] : []),
        ]}
        defaultBatchSize={defaultBatchSize}
        estimatedCount={estimatedCount}
      />

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">ชุดงานล่าสุด</h2>
        <JobProgressPoller
          jobType="duplicate_scan"
          initialBatches={batches}
          batchActions={{ pause: pauseBatchAction, resume: resumeBatchAction, cancel: cancelBatchAction, retryFailed: retryFailedInBatchAction }}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">งานที่ล้มเหลวถาวร (ครบจำนวนครั้งลองใหม่แล้ว)</h2>
        <FailedJobList
          jobs={failedJobs}
          retryAction={retryFailedDuplicateScanJobAction}
          emptyMessage="ไม่มีงานที่ล้มเหลวถาวรในขณะนี้"
        />
      </section>
    </div>
  );
}
