"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Download, Lock } from "lucide-react";
import { canDownload } from "@/lib/labels";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requestDownloadUrlAction } from "@/app/[locale]/research/[id]/actions";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AccessLevel } from "@/types/research";

export default function DownloadButton({
  accessLevel,
  pdfFile,
  fileName,
  researchSlug,
  hasDownloadGrant = false,
}: {
  accessLevel: AccessLevel;
  pdfFile: string;
  fileName: string;
  researchSlug: string;
  hasDownloadGrant?: boolean;
}) {
  const t = useTranslations("download");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const allowed = canDownload(accessLevel) || hasDownloadGrant;

  async function handleDownloadClick() {
    setError(null);

    if (!isSupabaseConfigured()) {
      // โหมด Mock Data: ดาวน์โหลดไฟล์ตัวอย่างจำลองโดยตรง (ไม่มีระบบไฟล์จริง)
      const link = document.createElement("a");
      link.href = pdfFile;
      link.download = fileName;
      link.click();
      setStatus("done");
      return;
    }

    setStatus("loading");
    const result = await requestDownloadUrlAction(researchSlug);

    if (result.error || !result.url) {
      setError(result.error ?? "ไม่สามารถดาวน์โหลดไฟล์ได้");
      setStatus("idle");
      return;
    }

    const link = document.createElement("a");
    link.href = result.url;
    link.click();
    setStatus("done");
  }

  if (!allowed) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-500 sm:w-auto"
      >
        <Lock className="h-4 w-4" />
        ไม่สามารถดาวน์โหลดได้ (
        {accessLevel === "read_only" ? "อ่านออนไลน์เท่านั้น" : "แสดงข้อมูลเบื้องต้นเท่านั้น"}
        )
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={handleDownloadClick}
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-soft px-6 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "done" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {status === "loading"
          ? "กำลังเตรียมไฟล์..."
          : status === "done"
            ? "ดาวน์โหลดแล้ว"
            : "ดาวน์โหลดไฟล์"}
      </button>
      {/* status === "loading" คือช่วงรอ signed URL จาก Server Action เท่านั้น —
          หลังจากนั้น browser เป็นผู้โหลดไฟล์เองผ่าน native download (ไม่ใช่
          fetch/blob ฝั่งแอป) จึงไม่มีทางรู้ % ความคืบหน้าการดาวน์โหลดไฟล์จริง
          ได้เลย แสดงได้แค่แถบ indeterminate ระหว่างรอ signed URL เท่านั้น */}
      {status === "loading" && (
        <ProgressBar value={0} indeterminate label={t("preparing")} className="w-full sm:w-64" />
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
