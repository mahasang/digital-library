"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, UserCircle, Upload } from "lucide-react";
import { updateAvatarAction } from "@/app/[locale]/account/actions";
import { idleActionResult } from "@/lib/actions/types";

export default function AvatarUpload({
  currentAvatarUrl,
}: {
  currentAvatarUrl: string | null;
}) {
  const t = useTranslations("account");
  const [state, formAction, isPending] = useActionState(
    updateAvatarAction,
    idleActionResult
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileSelected, setFileSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileSelected(false);
      setPreviewUrl(null);
      return;
    }
    setFileSelected(true);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const displayUrl = previewUrl ?? currentAvatarUrl;

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview ใช้ blob: URL ก่อน upload จริง, next/image ไม่รองรับ blob: โดยตรง
        <img
          src={displayUrl}
          alt=""
          className="h-20 w-20 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-accent-soft text-accent-ink">
          <UserCircle className="h-10 w-10" />
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {t("changeAvatar")}
      </button>

      {fileSelected && (
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? t("uploadingAvatar") : t("saveAvatar")}
        </button>
      )}

      {state.status === "error" && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}
