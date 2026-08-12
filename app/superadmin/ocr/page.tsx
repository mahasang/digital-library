import Link from "next/link";
import type { Metadata } from "next";
import { ScanText, FileCog, ShieldCheck, FlaskConical } from "lucide-react";
import { getSettings } from "@/lib/data/settings.server";
import { getOcrConfigSummary } from "@/lib/ocr/ocr-provider.server";
import { getRecentJobs, getDeadLetterJobs } from "@/lib/data/job-batches.server";
import { listOcrTestFixtures } from "@/lib/ocr/test-fixtures.server";
import { getRecentOcrTestRuns } from "@/lib/data/ocr-test-runs.server";
import OcrSettingsForm from "@/components/superadmin/OcrSettingsForm";
import RecentJobsPoller from "@/components/superadmin/RecentJobsPoller";
import OcrConnectivityCheckButton from "@/components/superadmin/OcrConnectivityCheckButton";
import OcrTestRunsPanel from "@/components/superadmin/OcrTestRunsPanel";
import { checkOcrConnectivityAction, triggerOcrTestRunAction } from "./actions";

export const metadata: Metadata = { title: "ตั้งค่า OCR — Super Admin" };
export const dynamic = "force-dynamic";

const PROVIDER_KIND_LABEL: Record<string, string> = {
  self_hosted: "Self-hosted (synchronous)",
  external_api: "External API (async submit + poll)",
};

function StatusIndicator({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
      <div>
        <span className="text-gray-700">{label}</span>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {ok ? "พร้อมใช้งาน" : "ยังไม่พร้อม"}
      </span>
    </div>
  );
}

export default async function SuperAdminOcrPage() {
  const [settings, recentJobs, deadLetterJobs, fixtures, recentTestRuns] = await Promise.all([
    getSettings(),
    getRecentJobs("ocr_processing", 20),
    getDeadLetterJobs(50),
    listOcrTestFixtures(),
    getRecentOcrTestRuns(20),
  ]);

  const config = getOcrConfigSummary();
  const lastOcrJob = recentJobs[0] ?? null;
  const lastOcrDlqEntry = deadLetterJobs.find((j) => j.jobType === "ocr_processing") ?? null;

  const fullyReady = config.enabled && config.configured && settings.ocrProviderEnabled;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <ScanText className="h-6 w-6 text-accent" />
          ตั้งค่า OCR
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          ควบคุมขนาดไฟล์ จำนวนหน้า โควตาต่อผู้ใช้ และระดับการเข้าถึงเอกสารที่อนุญาตให้ส่ง OCR — ไม่มีการแสดง API key หรือข้อมูลค่าใช้จ่ายในหน้านี้
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ShieldCheck className="h-4 w-4 text-accent" />
          OCR Readiness Check
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          สถานะความพร้อมของระบบ OCR ทั้งหมด — ต้อง &quot;พร้อมใช้งาน&quot; ครบทุกรายการจึงจะสร้างงาน OCR จริงได้
          {!fullyReady && " (ปัจจุบันยังไม่ครบ — ระบบจะปฏิเสธการสร้างงาน OCR จริงเสมอโดยไม่มี error ต่อผู้ใช้)"}
        </p>
        <div className="flex flex-col gap-2">
          <StatusIndicator
            label="ตั้งค่าผู้ให้บริการ OCR แล้ว"
            ok={config.configured}
            detail={`OCR_PROVIDER=${config.providerKind ?? "none"} · OCR_PROVIDER_BASE_URL: ${
              config.baseUrlSet ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"
            } · OCR_PROVIDER_API_KEY: ${config.apiKeySet ? "ตั้งค่าแล้ว" : "ไม่ได้ตั้งค่า (ไม่บังคับ)"}`}
          />
          <StatusIndicator label="เปิดใช้งาน OCR (OCR_ENABLED)" ok={config.enabled} />
          <StatusIndicator label="เปิดใช้งาน OCR (ตั้งค่าด้านล่าง)" ok={settings.ocrProviderEnabled} />
          <StatusIndicator
            label="โหมดทดสอบ (OCR_TEST_MODE)"
            ok={config.testModeEnabled}
            detail={config.testModeEnabled ? "Controlled OCR Test เปิดใช้งานอยู่" : "ปิดอยู่ — ไม่แสดงส่วนทดสอบด้านล่าง"}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-2">
          <p>Provider: {config.providerKind ? (PROVIDER_KIND_LABEL[config.providerKind] ?? config.providerKind) : "ยังไม่ได้ตั้งค่า"}</p>
          <p>Timeout ต่อคำขอ: {(config.timeoutMs / 1000).toFixed(0)} วินาที</p>
          <p>
            ขนาดไฟล์สูงสุด: {settings.ocrMaxFileSizeMb} MB
            {config.envLimits.maxFileSizeMb !== null && ` (เพดาน env: ${config.envLimits.maxFileSizeMb} MB)`}
          </p>
          <p>
            จำนวนหน้าสูงสุด: {settings.ocrMaxPages} หน้า
            {config.envLimits.maxPages !== null && ` (เพดาน env: ${config.envLimits.maxPages} หน้า)`}
          </p>
          <p>
            โควตาต่อผู้ใช้ต่อวัน: {settings.ocrDailyQuotaEnabled ? `${settings.ocrMaxJobsPerUserPerDay} งาน` : "ไม่จำกัด"}
            {config.envLimits.maxJobsPerDay !== null && ` (เพดาน env: ${config.envLimits.maxJobsPerDay} งาน)`}
          </p>
          <p>
            นโยบายเอกสาร private กับ external provider:{" "}
            {config.privateDocumentsAllowed ? "อนุญาต (OCR_ALLOW_PRIVATE_DOCUMENTS=true)" : "ไม่อนุญาต (ค่าเริ่มต้น)"}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <p>
            งาน OCR ล่าสุด:{" "}
            {lastOcrJob
              ? `${lastOcrJob.status} — เริ่ม ${
                  lastOcrJob.startedAt ? new Date(lastOcrJob.startedAt).toLocaleString("th-TH") : "-"
                }`
              : "ยังไม่มีงาน OCR"}
          </p>
          <p>
            DLQ ที่เกี่ยวกับ OCR ล่าสุด:{" "}
            {lastOcrDlqEntry
              ? `ล้มเหลวถาวรเมื่อ ${new Date(lastOcrDlqEntry.createdAt).toLocaleString("th-TH")}`
              : "ไม่มีรายการ"}
          </p>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <OcrConnectivityCheckButton action={checkOcrConnectivityAction} />
          <p className="mt-2 text-xs text-gray-500">
            ตรวจสอบแค่ว่าเชื่อมต่อ endpoint ที่ตั้งค่าไว้ได้หรือไม่ — ไม่ส่งไฟล์ ไม่สร้างงาน OCR ระหว่างตรวจสอบ บันทึก Audit Log ทุกครั้ง
          </p>
        </div>
      </section>

      <OcrSettingsForm settings={settings} />

      {config.testModeEnabled && (
        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <FlaskConical className="h-4 w-4 text-accent" />
            Controlled OCR Test
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            ทดสอบ provider ด้วยไฟล์ fixture ที่ไม่เป็นความลับเท่านั้น (ไม่ใช่เอกสารงานวิจัยจริง) ใช้ตรวจสอบว่า provider
            ทำงานได้จริงก่อนเปิดใช้งานกับผู้ใช้ทั่วไป — ผลทดสอบไม่ปรากฏในคลังงานวิจัยสาธารณะหรือผลค้นหาใดๆ
          </p>
          <OcrTestRunsPanel fixtures={fixtures} initialRuns={recentTestRuns} triggerAction={triggerOcrTestRunAction} />
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <FileCog className="h-4 w-4 text-accent" />
          ติดตามงาน OCR
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          สถานะ, ความคืบหน้าระดับหน้า (เมื่อ provider รายงานได้), เวลาเริ่ม และเวลาที่อัปเดตล่าสุดของแต่ละงาน — สั่งประมวลผลเป็นชุด/ลองใหม่/ดู Dead-letter Queue ได้ที่หน้าประมวลผล PDF
        </p>
        <RecentJobsPoller jobType="ocr_processing" initialJobs={recentJobs} emptyMessage="ยังไม่มีงาน OCR" />
        <Link
          href="/superadmin/pdf-processing?mode=ocr"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          ไปที่หน้าประมวลผล PDF →
        </Link>
      </section>
    </div>
  );
}
