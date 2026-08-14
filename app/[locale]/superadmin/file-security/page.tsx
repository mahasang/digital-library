import Link from "next/link";
import type { Metadata } from "next";
import {
  getFileSecurityCandidates,
  getFileSecurityCandidatesCount,
  type FileSecurityFilter,
} from "@/lib/data/file-security-candidates.server";
import { getRecentJobBatches, getFailedJobs } from "@/lib/data/job-batches.server";
import { getDefaultBatchSize } from "@/lib/data/job-type-settings.server";
import BulkJobSelector, { type BulkSelectItem } from "@/components/superadmin/BulkJobSelector";
import ProcessQueueNowButton from "@/components/superadmin/ProcessQueueNowButton";
import { FailedJobList } from "@/components/superadmin/JobBatchList";
import JobProgressPoller from "@/components/superadmin/JobProgressPoller";
import BulkAllMatchingFilterDialog from "@/components/superadmin/BulkAllMatchingFilterDialog";
import type { FileSecurityBulkFilter } from "@/lib/validation/bulk-filters";
import {
  bulkEnqueueFileRescanAction,
  retryFailedRescanJobAction,
  bulkEnqueueAllMatchingFilterAction,
  pauseBatchAction,
  resumeBatchAction,
  cancelBatchAction,
  retryFailedInBatchAction,
} from "./actions";

export const metadata: Metadata = { title: "ความปลอดภัยไฟล์ — Super Admin" };
export const dynamic = "force-dynamic";

const FILTERS: { value: FileSecurityFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รอสแกน" },
  { value: "error", label: "สแกนไม่สำเร็จ" },
  { value: "infected", label: "ตรวจพบภัยคุกคาม" },
  { value: "clean", label: "ปลอดภัย" },
  { value: "skipped", label: "ข้ามการสแกน (โหมดจำลอง/ข้อมูลเก่า)" },
];

const FILE_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "ทุกประเภทไฟล์" },
  { value: "pdf", label: "มีไฟล์ PDF" },
  { value: "attachment", label: "มีไฟล์แนบ" },
  { value: "either", label: "มีไฟล์ PDF หรือไฟล์แนบ" },
];

const BADGE_BY_SCAN_STATUS: Record<
  string,
  { label: string; tone: "brand" | "green" | "amber" | "red" | "gray" | "purple" }
> = {
  pending: { label: "รอสแกน", tone: "amber" },
  clean: { label: "ปลอดภัย", tone: "green" },
  infected: { label: "พบภัยคุกคาม", tone: "red" },
  error: { label: "สแกนไม่สำเร็จ", tone: "red" },
  skipped: { label: "ข้าม", tone: "gray" },
};

export default async function FileSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    fileKind?: string;
    createdAfter?: string;
    createdBefore?: string;
    neverScanned?: string;
  }>;
}) {
  const params = await searchParams;
  const filter: FileSecurityFilter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as FileSecurityFilter)
    : "all";
  const fileKind = params.fileKind || undefined;
  const createdAfter = params.createdAfter || undefined;
  const createdBefore = params.createdBefore || undefined;
  const neverScannedOnly = params.neverScanned === "1";

  const bulkAllFilter: FileSecurityBulkFilter = {
    scanStatus: filter === "all" ? undefined : filter,
    fileKind: fileKind as FileSecurityBulkFilter["fileKind"],
    createdAfter: createdAfter ? new Date(createdAfter).toISOString() : undefined,
    createdBefore: createdBefore ? new Date(createdBefore).toISOString() : undefined,
    neverScannedOnly,
  };

  const [candidates, batches, failedJobs, estimatedCount, defaultBatchSize] = await Promise.all([
    getFileSecurityCandidates(filter),
    getRecentJobBatches("file_security_rescan"),
    getFailedJobs("file_security_rescan"),
    getFileSecurityCandidatesCount(bulkAllFilter),
    getDefaultBatchSize("file_security_rescan"),
  ]);

  const items: BulkSelectItem[] = candidates.map((c) => ({
    id: c.id,
    title: c.titleTh,
    meta: `${c.pdfFile}${c.scanReason ? ` · ${c.scanReason}` : ""}`,
    badge: BADGE_BY_SCAN_STATUS[c.scanStatus],
  }));

  const filterSummary: string[] = [];
  if (filter !== "all") filterSummary.push(`สถานะสแกน: ${FILTERS.find((f) => f.value === filter)?.label ?? filter}`);
  if (fileKind) filterSummary.push(`ประเภทไฟล์: ${FILE_KIND_OPTIONS.find((f) => f.value === fileKind)?.label ?? fileKind}`);
  if (createdAfter) filterSummary.push(`อัปโหลดตั้งแต่: ${createdAfter}`);
  if (createdBefore) filterSummary.push(`อัปโหลดก่อน: ${createdBefore}`);
  if (neverScannedOnly) filterSummary.push("เฉพาะที่ยังไม่เคยสแกนเลย");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">สแกนความปลอดภัยไฟล์เป็นชุด</h1>
          <p className="mt-1 text-sm text-gray-500">
            สั่งสแกนมัลแวร์ไฟล์ PDF เดิมซ้ำหลายรายการพร้อมกันแบบ background job —
            ไฟล์ที่เผยแพร่อยู่ยังใช้งานได้ปกติระหว่างรอคิว หากพบว่าไม่ปลอดภัยจะปิด
            การเข้าถึงอัตโนมัติทันทีที่สแกนเสร็จ พร้อมแจ้งเตือนผู้ดูแลระบบ
          </p>
        </div>
        <ProcessQueueNowButton />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/superadmin/file-security?filter=${f.value}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === f.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* ตัวกรองเพิ่มเติม (ช่วงที่ 28) — มีผลเฉพาะกับปุ่ม "สแกนทั้งหมดตามตัวกรอง"
          ด้านล่างเท่านั้น */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-xs">
        <input type="hidden" name="filter" value={filter} />
        <div className="flex flex-col gap-1">
          <label className="text-gray-500">ประเภทไฟล์</label>
          <select name="fileKind" defaultValue={params.fileKind ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5">
            {FILE_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="file-security-created-after" className="text-gray-600">อัปโหลดตั้งแต่</label>
          <input id="file-security-created-after" type="date" name="createdAfter" defaultValue={params.createdAfter ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-900" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="file-security-created-before" className="text-gray-600">อัปโหลดก่อน</label>
          <input id="file-security-created-before" type="date" name="createdBefore" defaultValue={params.createdBefore ?? ""} className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-900" />
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-gray-600">
          <input type="checkbox" name="neverScanned" value="1" defaultChecked={neverScannedOnly} />
          เฉพาะที่ยังไม่เคยสแกนเลย
        </label>
        <button type="submit" className="rounded-lg bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-800">
          ใช้ตัวกรอง
        </button>
      </form>

      <BulkJobSelector
        items={items}
        action={bulkEnqueueFileRescanAction}
        submitLabel="สแกนซ้ำที่เลือก"
        emptyMessage="ไม่พบรายการตามเงื่อนไขที่เลือก"
      />

      <BulkAllMatchingFilterDialog
        action={bulkEnqueueAllMatchingFilterAction}
        hiddenFields={{
          ...(filter !== "all" ? { scanStatus: filter } : {}),
          ...(fileKind ? { fileKind } : {}),
          ...(createdAfter ? { createdAfter } : {}),
          ...(createdBefore ? { createdBefore } : {}),
          neverScannedOnly: neverScannedOnly ? "true" : "false",
        }}
        label="สแกนทั้งหมดตามตัวกรอง (ไม่จำกัด 500 รายการ)"
        jobTypeLabel="ตรวจสอบความปลอดภัยไฟล์"
        filterSummary={filterSummary}
        defaultBatchSize={defaultBatchSize}
        estimatedCount={estimatedCount}
      />

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">ชุดงานล่าสุด</h2>
        <JobProgressPoller
          jobType="file_security_rescan"
          initialBatches={batches}
          batchActions={{ pause: pauseBatchAction, resume: resumeBatchAction, cancel: cancelBatchAction, retryFailed: retryFailedInBatchAction }}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">งานที่ล้มเหลวถาวร (ครบจำนวนครั้งลองใหม่แล้ว)</h2>
        <FailedJobList
          jobs={failedJobs}
          retryAction={retryFailedRescanJobAction}
          emptyMessage="ไม่มีงานที่ล้มเหลวถาวรในขณะนี้"
        />
      </section>
    </div>
  );
}
