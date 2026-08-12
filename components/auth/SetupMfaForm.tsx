"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "loading" | "enrolling" | "already-verified" | "success";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * ฟอร์มบังคับตั้งค่า MFA (TOTP) — แสดงเมื่อ middleware/layout ตรวจพบว่าบัญชี
 * Super Admin ยังไม่มี verified factor เลยสักตัว ก่อนเข้า /superadmin ได้
 *
 * จัดการ factor ที่ค้างจากการตั้งค่าครั้งก่อนที่ทำไม่เสร็จอย่างปลอดภัย —
 * `enroll()` สร้าง factor สถานะ "unverified" ทันที ถ้าผู้ใช้ปิดหน้าไปกลางคัน
 * factor เก่านั้นจะค้างอยู่และทำให้ enroll ใหม่ชนกัน (ชื่อ/ตัวจำกัดจำนวนของ
 * Supabase) จึงต้อง unenroll ของเก่าทิ้งก่อนเริ่มรอบใหม่เสมอ — factor ที่ยัง
 * ไม่ verified ไม่มีผลต่อ hasVerifiedMfa/aal2 อยู่แล้ว จึงลบทิ้งได้อย่างปลอดภัย
 * โดยไม่กระทบสิทธิ์ใดๆ
 */
export default function SetupMfaForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(
          "ไม่สามารถตรวจสอบสถานะ MFA ได้ในขณะนี้ — Supabase Auth อาจยังไม่ได้เปิดใช้งาน MFA กรุณาติดต่อผู้ดูแลระบบ"
        );
        setStep("enrolling");
        return;
      }

      const verified = data.all.find((f) => f.status === "verified");
      if (verified) {
        setStep("already-verified");
        return;
      }

      // ลบ factor ที่ค้างจากการตั้งค่าครั้งก่อนที่ยังไม่เสร็จทั้งหมดก่อนเริ่มใหม่
      const unverified = data.all.filter((f) => f.status === "unverified");
      if (unverified.length > 0) {
        await Promise.all(
          unverified.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }))
        );
      }

      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (enrollError || !enrolled) {
        setError(
          "ไม่สามารถเริ่มตั้งค่า MFA ได้ — ตรวจสอบว่า Supabase เปิดใช้งาน TOTP MFA แล้วหรือยัง (ดู docs/superadmin-guide.md หัวข้อ 14)"
        );
        setStep("enrolling");
        return;
      }

      setEnrollData({
        factorId: enrolled.id,
        qrCode: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
      setStep("enrolling");
    }

    init();
  }, []);

  async function handleVerify() {
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
    setStep("success");
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 1500);
  }

  if (step === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        กำลังเตรียมการตั้งค่า...
      </div>
    );
  }

  if (step === "already-verified") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-medium text-gray-900">บัญชีนี้ตั้งค่า MFA ไว้แล้ว</p>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ดำเนินการต่อ
        </button>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-medium text-gray-900">ตั้งค่า MFA สำเร็จแล้ว</p>
        <p className="text-xs text-gray-500">กำลังพาไปยังหน้าที่ต้องการ...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {enrollData && (
        <>
          <div className="flex items-center gap-2 text-accent">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm font-medium">
              สแกน QR โค้ดนี้ด้วยแอปยืนยันตัวตน แล้วกรอกรหัส 6 หลักที่แสดง
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              enrollData.qrCode.startsWith("data:")
                ? enrollData.qrCode
                : `data:image/svg+xml;utf-8,${encodeURIComponent(enrollData.qrCode)}`
            }
            alt="QR Code สำหรับตั้งค่า MFA"
            className="h-44 w-44 self-center"
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
            autoFocus
            autoComplete="one-time-code"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-center text-lg tracking-widest focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={busy || code.trim().length !== 6}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันและเปิดใช้งาน
          </button>
        </>
      )}
    </div>
  );
}
