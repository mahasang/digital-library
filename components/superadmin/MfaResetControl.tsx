"use client";

import { useState } from "react";
import { CheckCircle2, Clock, KeyRound, ShieldOff } from "lucide-react";
import MfaResetConfirmDialog from "@/components/superadmin/MfaResetConfirmDialog";
import type { MfaFactorSummary } from "@/types/research";

/**
 * แสดงสถานะ MFA ของผู้ใช้ (จำนวนอุปกรณ์/สถานะยืนยันแล้วหรือไม่/วันที่ตั้งค่า
 * เท่านั้น — ไม่มี secret/QR/recovery code ให้แสดงอยู่แล้วตั้งแต่ระดับ API)
 * พร้อมปุ่ม "รีเซ็ต MFA" — ซ่อนปุ่มเมื่อดูโปรไฟล์ตัวเอง (ต้องให้ Super Admin
 * คนอื่นดำเนินการ บังคับซ้ำฝั่งเซิร์ฟเวอร์ใน resetUserMfaAction เสมอ)
 */
export default function MfaResetControl({
  userId,
  userName,
  userEmail,
  isSelf,
  available,
  factors,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  isSelf: boolean;
  available: boolean;
  factors: MfaFactorSummary[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasFactors = factors.length > 0;

  if (!available) {
    return <p className="text-sm text-gray-500">ไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY)</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasFactors ? (
        <div className="flex flex-col gap-2">
          {factors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <KeyRound className="h-3.5 w-3.5 text-gray-500" />
                {factor.friendlyName || "แอปยืนยันตัวตน (TOTP)"}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  factor.status === "verified" ? "text-green-600" : "text-amber-600"
                }`}
              >
                {factor.status === "verified" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                {factor.status === "verified" ? "ยืนยันแล้ว" : "ยังไม่ได้ยืนยัน"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">ผู้ใช้นี้ยังไม่ได้ตั้งค่า MFA</p>
      )}

      {isSelf ? (
        <p className="text-xs text-gray-500">
          ไม่สามารถรีเซ็ต MFA ของตัวเองผ่านหน้านี้ได้ — จัดการอุปกรณ์ของตัวเองที่{" "}
          <a href="/account" className="text-accent hover:underline">
            หน้าบัญชีของฉัน
          </a>
        </p>
      ) : hasFactors ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <ShieldOff className="h-4 w-4" />
          รีเซ็ต MFA
        </button>
      ) : null}

      {dialogOpen && (
        <MfaResetConfirmDialog
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
