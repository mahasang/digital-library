"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { idleActionResult } from "@/lib/actions/types";
import { publishWithoutScanAction } from "@/app/[locale]/dashboard/approvals/[id]/actions";
import {
  SCAN_OVERRIDE_MIN_STUCK_MINUTES,
  SCAN_OVERRIDE_REASON_MAX_LENGTH,
  SCAN_OVERRIDE_REASON_MIN_LENGTH,
  getOverrideFormMissing,
} from "@/lib/submission/scan-override";

/**
 * ปุ่ม "เผยแพร่โดยยืนยันเอง" สำหรับผู้ดูแลระบบ (admin ขึ้นไป) — แสดงเฉพาะเมื่อ
 * ฝั่งเซิร์ฟเวอร์ตัดสินแล้วว่าทำได้ (ดู getScanOverrideDecision) และ server action
 * ตัดสินซ้ำอีกครั้งเสมอ
 */
export default function ScanOverrideForm({
  researchId,
  scanStatus,
}: {
  researchId: string;
  scanStatus: "pending" | "error";
}) {
  const [state, formAction, pending] = useActionState(
    publishWithoutScanAction,
    idleActionResult
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const missing = getOverrideFormMissing({ reason, confirmed });
  const canSubmit = missing.reasonShortBy === 0 && !missing.needsConfirm && !pending;

  // ข้อความใต้ปุ่มบอกว่ายังขาดอะไร — ปุ่มที่เป็นสีเทากดไม่ได้เฉยๆ ทำให้ผู้ใช้งงว่าเสีย
  const missingHints: string[] = [];
  if (missing.reasonShortBy > 0) {
    missingHints.push(
      reason.trim().length === 0
        ? `พิมพ์เหตุผลอย่างน้อย ${SCAN_OVERRIDE_REASON_MIN_LENGTH} ตัวอักษร`
        : `พิมพ์เหตุผลเพิ่มอีก ${missing.reasonShortBy} ตัวอักษร (ขั้นต่ำ ${SCAN_OVERRIDE_REASON_MIN_LENGTH})`
    );
  }
  if (missing.needsConfirm) missingHints.push("ติ๊กช่องยืนยันด้านบน");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="flex items-start gap-1.5 text-xs text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {scanStatus === "error"
            ? "ระบบตรวจสอบไฟล์ไม่สำเร็จ (ผลเป็น error) จึงเผยแพร่ตามปกติไม่ได้"
            : `ไฟล์ค้างรอตรวจสอบเกิน ${SCAN_OVERRIDE_MIN_STUCK_MINUTES} นาที จึงเผยแพร่ตามปกติไม่ได้`}
          {" "}
          หากตรวจไฟล์ด้วยตนเองแล้ว ผู้ดูแลระบบเผยแพร่โดยยืนยันเองได้ (บันทึกใน audit log)
        </span>
      </p>

      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-xs text-green-700">
          {state.message}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500 bg-white px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        <ShieldAlert className="h-4 w-4" />
        เผยแพร่โดยยืนยันเอง
      </button>

      {open && (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="researchId" value={researchId} />
          <label htmlFor="scan-override-reason" className="text-xs font-medium text-gray-700">
            เหตุผลที่เผยแพร่โดยไม่รอผลสแกน
          </label>
          <textarea
            id="scan-override-reason"
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            minLength={SCAN_OVERRIDE_REASON_MIN_LENGTH}
            maxLength={SCAN_OVERRIDE_REASON_MAX_LENGTH}
            placeholder={`เช่น ตรวจไฟล์ด้วยตนเองแล้ว เปิดอ่านได้ปกติ ไม่มีเนื้อหาน่าสงสัย (อย่างน้อย ${SCAN_OVERRIDE_REASON_MIN_LENGTH} ตัวอักษร)`}
            className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              ฉันตรวจไฟล์นี้ด้วยตนเองแล้ว และรับผิดชอบการเผยแพร่โดยไม่รอผลสแกน
            </span>
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            aria-describedby={missingHints.length > 0 ? "scan-override-hint" : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันเผยแพร่
          </button>
          {missingHints.length > 0 && (
            <p id="scan-override-hint" className="text-xs text-gray-700">
              ปุ่มจะกดได้เมื่อ: {missingHints.join(" และ ")}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
