import Link from "next/link";
import type { Metadata } from "next";
import {
  getActiveDuplicateDetectionRule,
  getDuplicateDetectionRuleHistory,
  DEFAULT_DUPLICATE_DETECTION_WEIGHTS,
} from "@/lib/data/duplicate-detection-rules.server";
import { getRecentDuplicateScanBatches } from "@/lib/data/job-batches.server";
import { createClient } from "@/lib/supabase/server";
import DuplicateDetectionRulesForm from "@/components/superadmin/DuplicateDetectionRulesForm";

export const metadata: Metadata = { title: "ตั้งค่าเกณฑ์ตรวจข้อมูลซ้ำ — Super Admin" };
export const dynamic = "force-dynamic";

const DEFAULT_ACTIVE_RULE = {
  id: "",
  version: 0,
  ...DEFAULT_DUPLICATE_DETECTION_WEIGHTS,
  isActive: true,
  createdBy: null,
  createdAt: new Date(0).toISOString(),
};

export default async function DuplicateDetectionSettingsPage() {
  const supabase = await createClient();
  const [activeRule, history, recentScanBatches] = await Promise.all([
    getActiveDuplicateDetectionRule(supabase),
    getDuplicateDetectionRuleHistory(20),
    getRecentDuplicateScanBatches(10),
  ]);

  const currentRule = activeRule ?? DEFAULT_ACTIVE_RULE;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ตั้งค่าเกณฑ์ตรวจข้อมูลซ้ำ</h1>
        <p className="mt-1 text-sm text-gray-500">
          ปรับน้ำหนักที่ใช้คำนวณคะแนนความคล้ายของงานวิจัย — การแก้ไขแต่ละครั้งสร้างเป็นเวอร์ชันใหม่
          เสมอ (ไม่ทับของเดิม) เพื่อให้ตรวจสอบย้อนหลังได้ว่าผลลัพธ์แต่ละคู่เกิดจากเกณฑ์เวอร์ชันใด
        </p>
      </div>

      <DuplicateDetectionRulesForm activeRule={currentRule} />

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">ประวัติเกณฑ์ทั้งหมด</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีประวัติ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 pr-3">เวอร์ชัน</th>
                  <th className="py-2 pr-3">ชื่อเรื่อง</th>
                  <th className="py-2 pr-3">ผู้วิจัย</th>
                  <th className="py-2 pr-3">ปี</th>
                  <th className="py-2 pr-3">DOI/ISBN</th>
                  <th className="py-2 pr-3">ไฟล์ hash</th>
                  <th className="py-2 pr-3">เกณฑ์ต่ำ/กลาง/สูง</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2">วันที่</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rule) => (
                  <tr key={rule.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-900">{rule.version}</td>
                    <td className="py-2 pr-3">{rule.weightTitle}</td>
                    <td className="py-2 pr-3">{rule.weightAuthor}</td>
                    <td className="py-2 pr-3">{rule.weightYear}</td>
                    <td className="py-2 pr-3">{rule.weightIdentifier}</td>
                    <td className="py-2 pr-3">{rule.weightFileHash}</td>
                    <td className="py-2 pr-3">
                      {rule.thresholdLow}/{rule.thresholdMedium}/{rule.thresholdHigh}
                    </td>
                    <td className="py-2 pr-3">
                      {rule.isActive ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700 ring-1 ring-inset ring-green-600/20">
                          ใช้งานอยู่
                        </span>
                      ) : (
                        <span className="text-gray-500">ปิดใช้งานแล้ว</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500">
                      {new Date(rule.createdAt).toLocaleString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">การสแกนซ้ำล่าสุด</h2>
        {recentScanBatches.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีการสแกนซ้ำ</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentScanBatches.map((b) => (
              <div
                key={b.batchId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3 text-xs"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {b.ruleVersion ? `เกณฑ์เวอร์ชัน ${b.ruleVersion}` : "สแกนตามตัวกรองที่เลือกเอง"}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {b.enqueuedItems}
                    {b.totalItems !== null ? `/${b.totalItems}` : ""} รายการ · สำเร็จ {b.completed} · ล้มเหลว{" "}
                    {b.failed}
                  </span>
                  <p className="mt-1 text-gray-500">
                    เริ่ม {b.startedAt ? new Date(b.startedAt).toLocaleString("th-TH") : "-"} · อัปเดตล่าสุด{" "}
                    {new Date(b.updatedAt).toLocaleString("th-TH")}
                  </p>
                </div>
                <Link
                  href={
                    b.ruleVersion
                      ? `/dashboard/duplicate-reviews?ruleVersion=${b.ruleVersion}`
                      : "/dashboard/duplicate-reviews"
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                >
                  ดูผลลัพธ์
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
