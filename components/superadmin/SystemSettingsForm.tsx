"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Save, UploadCloud } from "lucide-react";
import { updateSystemSettingsAction } from "@/app/superadmin/system-settings/actions";
import { idleActionResult } from "@/lib/actions/types";
import { createDraftKey } from "@/lib/storage/paths";
import { uploadResearchFile } from "@/lib/storage/upload.client";
import { formatFileSize, validateFile } from "@/lib/storage/limits";
import type { AppSettings } from "@/types/research";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const ICON_TYPES = [...IMAGE_TYPES, "image/x-icon", "image/vnd.microsoft.icon"];
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export default function SystemSettingsForm({
  settings,
  userId,
}: {
  settings: AppSettings;
  userId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateSystemSettingsAction,
    idleActionResult
  );

  const [logoPreview, setLogoPreview] = useState(settings.logoUrl);
  const [logoPath, setLogoPath] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [faviconPreview, setFaviconPreview] = useState(settings.faviconUrl);
  const [faviconPath, setFaviconPath] = useState("");
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconError, setFaviconError] = useState<string | null>(null);

  const draftKeyRef = useRef(createDraftKey());

  async function handleUpload(
    file: File,
    kind: "logo" | "favicon"
  ) {
    const allowedTypes = kind === "logo" ? IMAGE_TYPES : ICON_TYPES;
    const setUploading = kind === "logo" ? setLogoUploading : setFaviconUploading;
    const setError = kind === "logo" ? setLogoError : setFaviconError;
    const setPreview = kind === "logo" ? setLogoPreview : setFaviconPreview;
    const setPath = kind === "logo" ? setLogoPath : setFaviconPath;

    const validationError = validateFile(file, allowedTypes, IMAGE_MAX_BYTES);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    const result = await uploadResearchFile("site-assets", userId, draftKeyRef.current, file);
    setUploading(false);

    if (result.error || !result.path) {
      setError(result.error ?? "อัปโหลดไฟล์ไม่สำเร็จ");
      return;
    }

    setPath(result.path);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}
      {state.status === "success" && (
        <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}

      <input type="hidden" name="logoPath" value={logoPath} />
      <input type="hidden" name="faviconPath" value={faviconPath} />

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ข้อมูลระบบและองค์กร</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">ชื่อระบบ/ชื่อองค์กร</label>
            <input
              name="siteName"
              required
              defaultValue={settings.siteName}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageUploadField
              id="logo-upload"
              label="โลโก้"
              preview={logoPreview}
              uploading={logoUploading}
              error={logoError}
              onFileSelected={(f) => handleUpload(f, "logo")}
              accept={IMAGE_TYPES.join(",")}
              maxBytes={IMAGE_MAX_BYTES}
            />
            <ImageUploadField
              id="favicon-upload"
              label="Favicon"
              preview={faviconPreview}
              uploading={faviconUploading}
              error={faviconError}
              onFileSelected={(f) => handleUpload(f, "favicon")}
              accept={ICON_TYPES.join(",")}
              maxBytes={IMAGE_MAX_BYTES}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ข้อมูลติดต่อและ Social Media</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="อีเมล" name="contactEmail" type="email" defaultValue={settings.contactEmail} />
          <TextField label="เบอร์โทรศัพท์" name="contactPhone" defaultValue={settings.contactPhone} />
          <TextField
            label="ที่อยู่"
            name="contactAddress"
            defaultValue={settings.contactAddress}
            className="sm:col-span-2"
          />
          <TextField label="Facebook" name="socialFacebook" defaultValue={settings.socialFacebook} placeholder="https://facebook.com/..." />
          <TextField label="Twitter / X" name="socialTwitter" defaultValue={settings.socialTwitter} placeholder="https://x.com/..." />
          <TextField label="LINE Official" name="socialLine" defaultValue={settings.socialLine} placeholder="https://line.me/..." />
          <TextField
            label="ข้อความลิขสิทธิ์"
            name="copyrightText"
            defaultValue={settings.copyrightText}
            className="sm:col-span-2"
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">การเปิดใช้งานฟีเจอร์</h2>
        <div className="flex flex-col gap-3">
          <ToggleField
            label="เปิดรับสมัครสมาชิกใหม่"
            name="registrationEnabled"
            defaultChecked={settings.registrationEnabled}
          />
          <ToggleField
            label="เปิดรับส่งงานวิจัยใหม่"
            name="submissionEnabled"
            defaultChecked={settings.submissionEnabled}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              สถานะเริ่มต้นของงานวิจัยใหม่ (เมื่อไม่ได้ระบุชัดเจน)
            </label>
            <select
              name="defaultResearchStatus"
              defaultValue={settings.defaultResearchStatus}
              className="w-fit rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
            >
              <option value="draft">ฉบับร่าง</option>
              <option value="pending_review">รอตรวจสอบ</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          ขนาดไฟล์สูงสุด (มีผลจริงกับ Storage bucket ทันทีที่บันทึก)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField label="PDF ฉบับเต็ม (MB)" name="maxPdfSizeMb" defaultValue={settings.maxPdfSizeMb} min={1} max={200} />
          <NumberField label="ภาพหน้าปก (MB)" name="maxCoverSizeMb" defaultValue={settings.maxCoverSizeMb} min={1} max={20} />
          <NumberField label="เอกสารแนบ (MB)" name="maxAttachmentSizeMb" defaultValue={settings.maxAttachmentSizeMb} min={1} max={100} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">การแสดงผลหน้าแรก</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="จำนวนงานวิจัยล่าสุดที่แสดง"
            name="homepageLatestCount"
            defaultValue={settings.homepageLatestCount}
            min={1}
            max={24}
          />
          <NumberField
            label="จำนวนงานวิจัยยอดนิยมที่แสดง"
            name="homepagePopularCount"
            defaultValue={settings.homepagePopularCount}
            min={1}
            max={24}
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending || logoUploading || faviconUploading}
        className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        บันทึกการตั้งค่า
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function ToggleField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="peer sr-only"
        />
        <input type="hidden" name={name} value={checked ? "true" : "false"} />
        <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-600" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-surface transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function ImageUploadField({
  id,
  label,
  preview,
  uploading,
  error,
  onFileSelected,
  accept,
  maxBytes,
}: {
  id: string;
  label: string;
  preview: string;
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
  accept: string;
  maxBytes: number;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    onFileSelected(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      {/*
        กรอบนี้คือ drag-and-drop dropzone — ลากไฟล์มาวาง หรือกด/Tab แล้ว
        Enter บน input ที่ซ่อนไว้ (sr-only แต่ยัง focus/keyboard ได้ปกติ) ก็เปิด
        ตัวเลือกไฟล์ได้เหมือนเดิม ทั้งสองทางเรียก handleFiles() เดียวกัน แล้วส่ง
        ต่อไปยัง onFileSelected() เดิมทุกประการ — ไม่เปลี่ยน validation/อัปโหลด/
        storage logic ใดๆ
      */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className={`flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors ${
          isDragging ? "border-brand-400 bg-accent-soft" : "border-gray-200 bg-gray-50"
        }`}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-surface">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-gray-300" aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            id={id}
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="peer sr-only"
          />
          <label
            htmlFor={id}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-soft-hover peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600"
          >
            <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            เลือกไฟล์ หรือวางไฟล์ที่นี่
          </label>
          <p className="truncate text-xs text-gray-500">
            {fileName ?? `สูงสุด ${formatFileSize(maxBytes)}`}
          </p>
          {uploading && (
            <p className="flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              กำลังอัปโหลด...
            </p>
          )}
          {!uploading && fileName && !error && (
            <p className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              อัปโหลดสำเร็จ
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
