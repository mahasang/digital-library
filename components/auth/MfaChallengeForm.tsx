"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/**
 * ฟอร์มยืนยันตัวตนขั้นที่สอง (MFA step-up) — แสดงเมื่อ middleware ตรวจพบว่า
 * ผู้ใช้มี verified TOTP factor แล้วแต่เซสชันปัจจุบันยังเป็น aal1 (ยังไม่ได้
 * ยืนยันขั้นที่สองในเซสชันนี้) ก่อนเข้าหน้า /superadmin/* ได้
 */
export default function MfaChallengeForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const t = useTranslations("mfaChallenge");
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
        setError(t("loadError"));
        setLoading(false);
        return;
      }
      const verified = data.totp[0];
      if (!verified) {
        setError(t("noFactorError"));
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    }
    loadFactor();
  }, [t]);

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
      setError(t("invalidCode"));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("checking")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-accent">
        <ShieldCheck className="h-5 w-5" />
        <p className="text-sm font-medium">{t("enterCodePrompt")}</p>
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
            placeholder={t("codePlaceholder")}
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
            {t("verifyButton")}
          </button>
          <p className="text-center text-xs text-gray-500">
            {t("lostDeviceNote")}
          </p>
        </>
      )}
    </div>
  );
}
