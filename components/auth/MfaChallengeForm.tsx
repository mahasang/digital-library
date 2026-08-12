"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * ฟอร์มยืนยันตัวตนขั้นที่สอง (MFA step-up) — แสดงเมื่อ middleware ตรวจพบว่า
 * ผู้ใช้มี verified TOTP factor แล้วแต่เซสชันปัจจุบันยังเป็น aal1 (ยังไม่ได้
 * ยืนยันขั้นที่สองในเซสชันนี้) ก่อนเข้าหน้า /superadmin/* ได้
 */
export default function MfaChallengeForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadFactor() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError("ไม่สามารถโหลดข้อมูลการยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง");
        setLoading(false);
        return;
      }
      const verified = data.totp[0];
      if (!verified) {
        setError("ไม่พบอุปกรณ์ยืนยันตัวตนที่ใช้งานได้ — กรุณาติดต่อผู้ดูแลระบบ");
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    }
    loadFactor();
  }, []);

  async function handleVerify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        กำลังตรวจสอบ...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-accent">
        <ShieldCheck className="h-5 w-5" />
        <p className="text-sm font-medium">กรอกรหัสจากแอปยืนยันตัวตนของคุณ</p>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {factorId && (
        <>
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
            ยืนยัน
          </button>
          <p className="text-center text-xs text-gray-500">
            ทำอุปกรณ์เดิมหาย? ต้องให้ Super Admin ท่านอื่นช่วยรีเซ็ต MFA ให้คุณก่อน
            จึงจะตั้งค่าอุปกรณ์ใหม่ได้
          </p>
        </>
      )}
    </div>
  );
}
