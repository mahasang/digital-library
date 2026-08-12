"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, ShieldOff, X } from "lucide-react";
import { resetUserMfaAction } from "@/app/superadmin/users/actions";
import { idleActionResult } from "@/lib/actions/types";
import { useDialogA11y } from "@/lib/hooks/useDialogA11y";

/**
 * Dialog ยืนยันก่อนรีเซ็ต MFA ของผู้ใช้อื่น — บังคับ 2 ขั้นแยกจากกันจริง
 * (ไม่ใช่แค่ฟอร์มเดียวรวมกัน) เพราะเป็นการกระทำที่ย้อนกลับไม่ได้และกระทบความ
 * ปลอดภัยบัญชีอื่นโดยตรง:
 *   ขั้น 1 ยืนยันตัวตนผู้ใช้เป้าหมาย — ต้องพิมพ์อีเมลผู้ใช้เป้าหมายให้ตรงกัน
 *   ขั้น 2 ยืนยันการกระทำ — ต้องระบุเหตุผล + พิมพ์ "RESET MFA" ให้ตรงกัน
 * Server Action (resetUserMfaAction) ตรวจสอบทั้งสิทธิ์ (super_admin เท่านั้น,
 * ห้ามรีเซ็ตของตัวเอง) และข้อความยืนยันซ้ำอีกชั้นเสมอ — dialog นี้เป็นแค่ UX
 * กันคลิกพลาด ไม่ใช่ด่านความปลอดภัยจริง
 */
export default function MfaResetConfirmDialog({
  userId,
  userName,
  userEmail,
  onClose,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(resetUserMfaAction, idleActionResult);
  const [step, setStep] = useState<"identity" | "confirm">("identity");
  const [identityInput, setIdentityInput] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const isIdentityValid = identityInput.trim().toLowerCase() === userEmail.trim().toLowerCase();
  const isConfirmValid = confirmText.trim().toUpperCase() === "RESET MFA" && reason.trim().length > 0;

  const dialogRef = useDialogA11y(true, onClose, pending);

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [state.status, router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={pending ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-reset-dialog-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 shrink-0 text-red-500" />
            <h3 id="mfa-reset-dialog-title" className="text-base font-semibold text-gray-900">
              รีเซ็ต MFA ({step === "identity" ? "ขั้นที่ 1 จาก 2" : "ขั้นที่ 2 จาก 2"})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="ปิด"
            className="text-gray-500 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "identity" ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{userName}</p>
              <p className="text-gray-500">{userEmail}</p>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">
              การรีเซ็ต MFA จะลบอุปกรณ์ยืนยันตัวตนทั้งหมดของผู้ใช้นี้ทันที และไม่สามารถย้อนกลับได้
              กรุณาตรวจสอบให้แน่ใจว่านี่คือผู้ใช้ที่ถูกต้องก่อนดำเนินการต่อ
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="identityInput" className="text-xs font-medium text-gray-700">
                พิมพ์อีเมลของผู้ใช้เป้าหมาย ({userEmail}) เพื่อยืนยันตัวตนก่อนดำเนินการต่อ
              </label>
              <input
                id="identityInput"
                value={identityInput}
                onChange={(e) => setIdentityInput(e.target.value)}
                autoFocus
                autoComplete="off"
                placeholder={userEmail}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                disabled={!isIdentityValid}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="confirmText" value={confirmText} />

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{userName}</p>
              <p className="text-gray-500">{userEmail}</p>
            </div>

            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              ผู้ใช้นี้จะออกจากระบบทันทีในทุกอุปกรณ์ (หากมีอุปกรณ์ MFA ที่ยืนยันแล้ว) และต้องตั้งค่า
              MFA ใหม่ทั้งหมดหากต้องการใช้งานต่อ
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reason" className="text-xs font-medium text-gray-700">
                เหตุผลในการรีเซ็ต MFA (จำเป็น)
              </label>
              <textarea
                id="reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                required
                rows={2}
                placeholder="เช่น ผู้ใช้แจ้งว่าทำโทรศัพท์ที่ติดตั้งแอปยืนยันตัวตนหาย"
                className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmText" className="text-xs font-medium text-gray-700">
                พิมพ์ <span className="font-mono font-semibold">RESET MFA</span> เพื่อยืนยัน
              </label>
              <input
                id="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={pending}
                autoFocus
                autoComplete="off"
                placeholder="RESET MFA"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {state.status === "error" && (
              <p className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {state.message}
              </p>
            )}
            {state.status === "success" && (
              <p className="flex items-start gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {state.message}
              </p>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("identity")}
                disabled={pending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={pending || !isConfirmValid}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                ยืนยันรีเซ็ต MFA
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
