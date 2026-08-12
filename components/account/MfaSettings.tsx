"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Factor } from "@supabase/supabase-js";

type Step = "loading" | "idle" | "enrolling";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * จัดการ MFA (TOTP) ของบัญชีตัวเอง — ทำงานผ่าน `supabase.auth.mfa.*` โดยตรง
 * (รองรับในตัวโดย Supabase Auth ไม่ต้องเพิ่มตารางหรือ backend เอง) แต่ต้องเปิด
 * ใช้งาน TOTP MFA ที่ฝั่ง Supabase ก่อนเสมอ (local: supabase/config.toml
 * `[auth.mfa.totp]`, cloud: Supabase Dashboard > Authentication > Providers)
 * มิฉะนั้น enroll จะล้มเหลวด้วย error จาก GoTrue
 */
export default function MfaSettings({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadFactors() {
    setError(null);
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError("ไม่สามารถโหลดสถานะ MFA ได้ในขณะนี้ — Supabase Auth อาจยังไม่ได้เปิดใช้งาน MFA");
      setFactors([]);
      setStep("idle");
      return;
    }
    setFactors(data.all);
    setStep("idle");
  }

  useEffect(() => {
    loadFactors();
  }, []);

  const verifiedFactors = (factors ?? []).filter((f) => f.status === "verified");
  const hasVerifiedMfa = verifiedFactors.length > 0;

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (enrollError || !data) {
      setError(
        "ไม่สามารถเริ่มตั้งค่า MFA ได้ — ตรวจสอบว่า Supabase เปิดใช้งาน TOTP MFA แล้วหรือยัง (ดู docs/superadmin-guide.md)"
      );
      return;
    }
    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setStep("enrolling");
  }

  function cancelEnroll() {
    setEnrollData(null);
    setCode("");
    setError(null);
    setStep("idle");
  }

  async function verifyEnroll() {
    if (!enrollData) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollData.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง");
      return;
    }
    setEnrollData(null);
    setCode("");
    setStep("idle");
    await loadFactors();
  }

  async function removeFactor(factorId: string) {
    if (
      !confirm(
        "ยืนยันลบอุปกรณ์ยืนยันตัวตนนี้? คุณจะไม่สามารถใช้รหัสจากอุปกรณ์นี้ยืนยันตัวตนขั้นที่สองได้อีก"
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (unenrollError) {
      setError("ไม่สามารถลบอุปกรณ์นี้ได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }
    await loadFactors();
  }

  if (step === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        กำลังโหลดสถานะ...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isSuperAdmin && !hasVerifiedMfa && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">บัญชีนี้ต้องตั้งค่า MFA จึงจะเข้าถึง /superadmin ได้</p>
            <p className="mt-0.5 text-xs text-amber-700">
              บัญชีนี้มีสิทธิ์ Super Admin ซึ่งเข้าถึง/ควบคุมข้อมูลทั้งระบบได้ — ระบบบังคับให้
              ตั้งค่ายืนยันตัวตนสองขั้นตอน (MFA) ก่อนเข้าหน้าจัดการระบบเสมอ (ตั้งค่าได้ที่นี่
              หรือจะถูกพาไปตั้งค่าอัตโนมัติเมื่อพยายามเข้า /superadmin ก็ได้)
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {verifiedFactors.length > 0 && (
        <div className="flex flex-col gap-2">
          {verifiedFactors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-green-800">
                <ShieldCheck className="h-4 w-4" />
                {factor.friendly_name || "แอปยืนยันตัวตน (TOTP)"}
              </span>
              <button
                type="button"
                onClick={() => removeFactor(factor.id)}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      {step === "enrolling" && enrollData ? (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-700">
            สแกน QR โค้ดนี้ด้วยแอปยืนยันตัวตน (เช่น Google Authenticator, Authy) แล้วกรอกรหัส 6
            หลักที่แสดง
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrollData.qrCode)}`}
            alt="QR Code สำหรับตั้งค่า MFA"
            className="h-40 w-40 self-center"
          />
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">สแกนไม่ได้? กรอกรหัสด้วยตนเอง</summary>
            <p className="mt-1 break-all rounded bg-gray-50 p-2 font-mono">{enrollData.secret}</p>
          </details>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="รหัส 6 หลัก"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEnroll}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={verifyEnroll}
              disabled={busy || code.trim().length !== 6}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              ยืนยันและเปิดใช้งาน
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          เพิ่มอุปกรณ์ยืนยันตัวตน (TOTP)
        </button>
      )}

      {hasVerifiedMfa && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
          {isSuperAdmin
            ? "ตั้งค่า MFA แล้ว — ระบบจะขอให้ยืนยันรหัสอีกครั้งทุกครั้งที่เข้าเซสชันใหม่ก่อนเข้าหน้า Super Admin"
            : "ตั้งค่า MFA แล้ว"}
        </p>
      )}
    </div>
  );
}
