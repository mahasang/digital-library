"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import {
  grantSuperAdminAction,
  revokeSuperAdminAction,
} from "@/app/superadmin/users/actions";
import { idleActionResult } from "@/lib/actions/types";
import { useDialogA11y } from "@/lib/hooks/useDialogA11y";

/**
 * Dialog ยืนยันก่อนมอบ/ถอดถอนสิทธิ์ Super Admin — บังคับให้พิมพ์ "CONFIRM"
 * หรืออีเมลของผู้ใช้เป้าหมายให้ตรงกันก่อนปุ่มยืนยันจะกดได้ (ฝั่ง client เพื่อ
 * กันการคลิกพลาด) และ Server Action ตรวจสอบข้อความยืนยันซ้ำอีกชั้นเสมอ —
 * การจำกัดสิทธิ์จริง (ใครทำได้บ้าง) มาจาก requireMinRank(50) + RLS ไม่ใช่ dialog นี้
 */
export default function SuperAdminRoleConfirmDialog({
  mode,
  userId,
  userName,
  userEmail,
  isSelf,
  onClose,
}: {
  mode: "grant" | "revoke";
  userId: string;
  userName: string;
  userEmail: string;
  isSelf: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = mode === "grant" ? grantSuperAdminAction : revokeSuperAdminAction;
  const [state, formAction, pending] = useActionState(action, idleActionResult);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const normalized = confirmText.trim().toLowerCase();
  const isConfirmValid =
    normalized.length > 0 &&
    (normalized === "confirm" || normalized === userEmail.trim().toLowerCase());

  const dialogRef = useDialogA11y(true, onClose, pending);

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
    const timer = setTimeout(onClose, 1200);
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
        aria-labelledby="role-confirm-dialog-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-5 w-5 shrink-0 ${mode === "revoke" ? "text-red-500" : "text-amber-500"}`}
            />
            <h3 id="role-confirm-dialog-title" className="text-base font-semibold text-gray-900">
              {mode === "grant"
                ? "ยืนยันการมอบสิทธิ์ Super Admin"
                : "ยืนยันการถอดถอนสิทธิ์ Super Admin"}
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

        <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-900">{userName}</p>
          <p className="text-gray-500">{userEmail}</p>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {mode === "grant"
            ? "Super Admin มีสิทธิ์เข้าถึงและควบคุมข้อมูล/การตั้งค่าทั้งหมดของระบบ กรุณายืนยันว่าต้องการมอบสิทธิ์นี้จริง"
            : "การถอดถอนจะทำให้ผู้ใช้นี้เสียสิทธิ์เข้าถึง /superadmin ทั้งหมดทันที กรุณายืนยันว่าต้องการถอดถอนสิทธิ์นี้จริง"}
        </p>
        {isSelf && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            คุณกำลังดำเนินการกับบัญชีของตัวเอง
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="confirmText" value={confirmText} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmText" className="text-xs font-medium text-gray-700">
              พิมพ์ <span className="font-mono font-semibold">CONFIRM</span> หรืออีเมลของผู้ใช้ (
              {userEmail}) เพื่อยืนยัน
            </label>
            <input
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={pending}
              autoFocus
              autoComplete="off"
              placeholder="CONFIRM"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-xs font-medium text-gray-700">
              เหตุผล (ถ้ามี)
            </label>
            <textarea
              id="reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              rows={2}
              placeholder="เช่น มอบหมายให้ดูแลระบบเพิ่มเติม"
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending || !isConfirmValid}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                mode === "revoke"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "grant" ? "ยืนยันมอบสิทธิ์" : "ยืนยันถอดถอนสิทธิ์"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
