"use client";

import { useActionState, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { idleActionResult } from "@/lib/actions/types";
import {
  updateDuplicateDetectionRulesAction,
  resetDuplicateDetectionRulesToDefaultAction,
} from "@/app/[locale]/superadmin/data-quality/settings/actions";
import type { DuplicateDetectionRule } from "@/lib/data/duplicate-detection-rules.server";

type WeightKey = "weightTitle" | "weightAuthor" | "weightYear" | "weightIdentifier" | "weightFileHash";

const WEIGHT_FIELDS: Array<{ key: WeightKey; label: string }> = [
  { key: "weightTitle", label: "ความคล้ายชื่อเรื่อง" },
  { key: "weightAuthor", label: "ผู้วิจัยหลัก" },
  { key: "weightYear", label: "ปีเผยแพร่" },
  { key: "weightIdentifier", label: "DOI/ISBN/เลขอ้างอิง" },
  { key: "weightFileHash", label: "hash ของไฟล์" },
];

export default function DuplicateDetectionRulesForm({
  activeRule,
}: {
  activeRule: DuplicateDetectionRule;
}) {
  const [state, formAction, pending] = useActionState(updateDuplicateDetectionRulesAction, idleActionResult);
  const [resetState, resetFormAction, resetPending] = useActionState(
    resetDuplicateDetectionRulesToDefaultAction,
    idleActionResult
  );

  const [weights, setWeights] = useState({
    weightTitle: activeRule.weightTitle,
    weightAuthor: activeRule.weightAuthor,
    weightYear: activeRule.weightYear,
    weightIdentifier: activeRule.weightIdentifier,
    weightFileHash: activeRule.weightFileHash,
  });

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const sumOk = Math.round(sum) === 100;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">น้ำหนักเกณฑ์การตรวจสอบ</h2>
        <p className="mb-4 text-xs text-gray-500">ผลรวมของน้ำหนักทั้งห้าต้องเท่ากับ 100 พอดี</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {WEIGHT_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">{label}</span>
              <input
                type="number"
                name={key}
                min={0}
                max={100}
                step={1}
                required
                value={weights[key]}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>

        <p className={`mt-3 text-sm font-medium ${sumOk ? "text-green-600" : "text-red-600"}`}>
          ผลรวมน้ำหนักปัจจุบัน: {sum} / 100 {sumOk ? "✓" : "— ต้องปรับให้เท่ากับ 100"}
        </p>

        <h2 className="mb-1 mt-6 text-sm font-semibold text-gray-900">เกณฑ์ระดับความเชื่อมั่น</h2>
        <p className="mb-4 text-xs text-gray-500">
          ต่ำ = คะแนนขั้นต่ำที่จะบันทึกเป็นคู่น่าสงสัย · ปานกลาง/สูง = ใช้แบ่งระดับความเชื่อมั่นตอนแสดงผล
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">ความเชื่อมั่นต่ำ (คะแนนขั้นต่ำ)</span>
            <input
              type="number"
              name="thresholdLow"
              min={0}
              max={100}
              step={1}
              required
              defaultValue={activeRule.thresholdLow}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">ความเชื่อมั่นปานกลาง</span>
            <input
              type="number"
              name="thresholdMedium"
              min={0}
              max={100}
              step={1}
              required
              defaultValue={activeRule.thresholdMedium}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">ความเชื่อมั่นสูง</span>
            <input
              type="number"
              name="thresholdHigh"
              min={0}
              max={100}
              step={1}
              required
              defaultValue={activeRule.thresholdHigh}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
        </div>

        <p className="mt-5 text-xs text-gray-500">
          การเปลี่ยนเกณฑ์นี้จะไม่ตรวจสอบข้อมูลเก่าซ้ำโดยอัตโนมัติ — เลือก
          &quot;บันทึกและสแกนใหม่ทั้งระบบ&quot; หากต้องการให้ตรวจสอบย้อนหลังด้วยเกณฑ์ใหม่
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="save_only"
            disabled={pending || !sumOk}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            บันทึกอย่างเดียว
          </button>
          <button
            type="submit"
            name="intent"
            value="save_and_rescan"
            disabled={pending || !sumOk}
            onClick={(e) => {
              if (
                !window.confirm(
                  "จะบันทึกเกณฑ์เวอร์ชันใหม่และสั่งตรวจสอบซ้ำงานวิจัยทั้งหมดในระบบทันที อาจใช้เวลาสักครู่ ดำเนินการต่อหรือไม่?"
                )
              ) {
                e.preventDefault();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            บันทึกและสแกนใหม่ทั้งระบบ
          </button>
          <span className="text-xs text-gray-500">เวอร์ชันปัจจุบัน: {activeRule.version}</span>
        </div>

        {state.status === "error" && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {state.message}
          </p>
        )}
      </form>

      <form action={resetFormAction} className="flex flex-col items-start gap-2">
        <button
          type="submit"
          disabled={resetPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          คืนค่าเริ่มต้น
        </button>
        {resetState.status === "success" && (
          <p className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {resetState.message}
          </p>
        )}
        {resetState.status === "error" && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {resetState.message}
          </p>
        )}
      </form>
    </div>
  );
}
