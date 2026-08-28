"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  ATTACHMENT_ALLOWED_TYPES,
  COVER_ALLOWED_TYPES,
  DEFAULT_ATTACHMENT_MAX_SIZE_MB,
  DEFAULT_COVER_MAX_SIZE_MB,
  DEFAULT_PDF_MAX_SIZE_MB,
  PDF_ALLOWED_TYPES,
  formatFileSize,
  mbToBytes,
  validateFile,
} from "@/lib/storage/limits";
import { createDraftKey } from "@/lib/storage/paths";
import { uploadResearchFile } from "@/lib/storage/upload.client";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { ActionResult } from "@/lib/actions/types";
import type {
  AccessLevel,
  Category,
  DocumentStatus,
  Organization,
  SubmissionItem,
} from "@/types/research";

const currentBuddhistYear = new Date().getFullYear() + 543;

/**
 * จำลองความคืบหน้า (0→90%) ระหว่างรอ upload จริง แล้ว caller เป็นผู้ตั้งเป็น
 * 100% เองตอนเสร็จ — @supabase/storage-js เวอร์ชันที่ใช้อยู่ (v2.111) ไม่มี
 * onUploadProgress หรือ callback ความคืบหน้าจริงใดๆ ใน .upload() เลย (ใช้
 * fetch() ภายใน ไม่ใช่ XHR ซึ่งเป็นข้อจำกัดของ Fetch API เองที่ไม่รองรับ upload
 * progress event) จึงทำได้แค่แสดงว่า "กำลังทำงานอยู่" แบบประมาณเวลา ไม่ใช่ %
 * ไบต์จริงที่โอนไปแล้ว
 */
function startFakeUploadProgress(onProgress: (percent: number) => void): () => void {
  let percent = 0;
  onProgress(0);
  const interval = setInterval(() => {
    percent = Math.min(percent + 8, 90);
    onProgress(percent);
  }, 200);
  return () => clearInterval(interval);
}

interface ResearcherRow {
  name: string;
  organization: string;
}

interface ExtraIntent {
  value: DocumentStatus;
  label: string;
}

interface FileLimits {
  maxPdfSizeMb: number;
  maxCoverSizeMb: number;
  maxAttachmentSizeMb: number;
}

interface SubmitResearchFormProps {
  userId: string;
  organizations: Organization[];
  categories: Category[];
  submitAction: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  initialData?: SubmissionItem;
  researchId?: string;
  /** ปุ่มเพิ่มเติมสำหรับ Librarian/Admin เช่น "เผยแพร่ทันที" (dashboard/research) */
  extraIntents?: ExtraIntent[];
  /** ขนาดไฟล์สูงสุดจาก System Settings — ไม่ระบุจะใช้ค่าเริ่มต้นปลอดภัย */
  fileLimits?: FileLimits;
  /** ใส่เฉพาะหน้า /submit-research (ส่งงานวิจัยใหม่) เมื่อเปิด CAPTCHA และตั้งค่าคีย์ครบ */
  captchaSiteKey?: string;
}

export default function SubmitResearchForm({
  userId,
  organizations,
  categories,
  submitAction,
  initialData,
  researchId,
  extraIntents = [],
  fileLimits,
  captchaSiteKey,
}: SubmitResearchFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(initialData);

  const pdfMaxBytes = mbToBytes(fileLimits?.maxPdfSizeMb ?? DEFAULT_PDF_MAX_SIZE_MB);
  const coverMaxBytes = mbToBytes(fileLimits?.maxCoverSizeMb ?? DEFAULT_COVER_MAX_SIZE_MB);
  const attachmentMaxBytes = mbToBytes(
    fileLimits?.maxAttachmentSizeMb ?? DEFAULT_ATTACHMENT_MAX_SIZE_MB
  );

  const [captchaToken, setCaptchaToken] = useState("");

  const tAccessLevels = useTranslations("accessLevels");
  const tUpload = useTranslations("upload");
  const [titleTh, setTitleTh] = useState(initialData?.titleTh ?? "");
  const [titleEn, setTitleEn] = useState(initialData?.titleEn ?? "");
  const [abstract, setAbstract] = useState(initialData?.abstract ?? "");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [year, setYear] = useState(initialData?.year ?? currentBuddhistYear);
  const [categoryId, setCategoryId] = useState(
    initialData?.categoryId || categories[0]?.id || ""
  );
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(
    initialData?.accessLevel ?? "public"
  );
  const [copyrightNote, setCopyrightNote] = useState(initialData?.copyrightNote ?? "");
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(
    initialData?.copyrightConfirmed ?? false
  );

  const [researchers, setResearchers] = useState<ResearcherRow[]>(
    initialData?.researchers.length ? initialData.researchers : [{ name: "", organization: "" }]
  );

  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords ?? []);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [fileErrors, setFileErrors] = useState<{
    pdf?: string;
    cover?: string;
    attachment?: string;
  }>({});

  const [status, setStatus] = useState<"idle" | "uploading" | "submitting">("idle");
  const [uploadingKind, setUploadingKind] = useState<"pdf" | "cover" | "attachment" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  function addResearcher() {
    setResearchers((prev) => [...prev, { name: "", organization: "" }]);
  }

  function removeResearcher(index: number) {
    setResearchers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateResearcher(index: number, field: keyof ResearcherRow, value: string) {
    setResearchers((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function addKeyword() {
    const value = keywordInput.trim();
    if (!value || keywords.includes(value)) {
      setKeywordInput("");
      return;
    }
    setKeywords((prev) => [...prev, value]);
    setKeywordInput("");
  }

  function removeKeyword(keyword: string) {
    setKeywords((prev) => prev.filter((k) => k !== keyword));
  }

  function handleFileChange(
    file: File | null,
    kind: "pdf" | "cover" | "attachment"
  ) {
    if (!file) return;
    const [allowedTypes, maxSize] =
      kind === "pdf"
        ? [PDF_ALLOWED_TYPES, pdfMaxBytes]
        : kind === "cover"
          ? [COVER_ALLOWED_TYPES, coverMaxBytes]
          : [ATTACHMENT_ALLOWED_TYPES, attachmentMaxBytes];

    const validationError = validateFile(file, allowedTypes, maxSize);
    setFileErrors((prev) => ({ ...prev, [kind]: validationError ?? undefined }));

    if (validationError) return;

    if (kind === "pdf") setPdfFile(file);
    if (kind === "cover") setCoverFile(file);
    if (kind === "attachment") setAttachmentFile(file);
  }

  function validateBeforeSubmit(): boolean {
    const errors: Record<string, string[]> = {};
    if (!titleTh.trim()) errors.titleTh = ["กรุณากรอกชื่อเรื่องภาษาไทย"];
    if (abstract.trim().length < 50) errors.abstract = ["บทคัดย่อควรมีความยาวอย่างน้อย 50 ตัวอักษร"];
    if (researchers.every((r) => !r.name.trim())) {
      errors.researchers = ["กรุณาระบุผู้วิจัยอย่างน้อย 1 คน"];
    }
    if (keywords.length === 0) errors.keywords = ["กรุณาระบุคำสำคัญอย่างน้อย 1 คำ"];
    if (!copyrightNote.trim()) errors.copyrightNote = ["กรุณากรอกข้อมูลลิขสิทธิ์"];
    if (!copyrightConfirmed) {
      errors.copyrightConfirmed = ["กรุณายืนยันว่าเป็นเจ้าของลิขสิทธิ์และยินยอมให้เผยแพร่"];
    }
    if (!isEditMode && !pdfFile) {
      errors.pdfPath = ["กรุณาอัปโหลดไฟล์ PDF"];
    }
    if (captchaSiteKey && !captchaToken) {
      errors.turnstileToken = ["กรุณายืนยันตัวตน (CAPTCHA) ก่อนดำเนินการ"];
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(intent: DocumentStatus) {
    setError(null);
    setFieldErrors({});

    if (!validateBeforeSubmit()) {
      setError("กรุณาตรวจสอบข้อมูลในฟอร์มให้ครบถ้วน");
      return;
    }

    setStatus("uploading");
    const draftKey = createDraftKey();

    let pdfPath = initialData?.pdfFile ?? "";
    if (pdfFile) {
      setUploadingKind("pdf");
      const stopProgress = startFakeUploadProgress(setUploadProgress);
      const result = await uploadResearchFile("research-documents", userId, draftKey, pdfFile);
      stopProgress();
      if (result.error || !result.path) {
        setError(result.error ?? "อัปโหลดไฟล์ PDF ไม่สำเร็จ");
        setStatus("idle");
        setUploadingKind(null);
        return;
      }
      setUploadProgress(100);
      pdfPath = result.path;
    }

    let coverPath = "";
    if (coverFile) {
      setUploadingKind("cover");
      const stopProgress = startFakeUploadProgress(setUploadProgress);
      const result = await uploadResearchFile("research-covers", userId, draftKey, coverFile);
      stopProgress();
      if (result.error || !result.path) {
        setError(result.error ?? "อัปโหลดภาพปกไม่สำเร็จ");
        setStatus("idle");
        setUploadingKind(null);
        return;
      }
      setUploadProgress(100);
      coverPath = result.path;
    }

    let attachmentPath = "";
    if (attachmentFile) {
      setUploadingKind("attachment");
      const stopProgress = startFakeUploadProgress(setUploadProgress);
      const result = await uploadResearchFile(
        "submission-attachments",
        userId,
        draftKey,
        attachmentFile
      );
      stopProgress();
      if (result.error || !result.path) {
        setError(result.error ?? "อัปโหลดไฟล์แนบไม่สำเร็จ");
        setStatus("idle");
        setUploadingKind(null);
        return;
      }
      setUploadProgress(100);
      attachmentPath = result.path;
    }

    setUploadingKind(null);
    setStatus("submitting");

    const formData = new FormData();
    if (researchId) formData.set("researchId", researchId);
    formData.set("titleTh", titleTh);
    formData.set("titleEn", titleEn);
    formData.set("abstract", abstract);
    formData.set("organizationId", organizationId);
    formData.set("year", String(year));
    formData.set("categoryId", categoryId);
    formData.set(
      "keywords",
      JSON.stringify(keywords.length > 0 ? keywords : [])
    );
    formData.set(
      "researchers",
      JSON.stringify(researchers.filter((r) => r.name.trim()))
    );
    formData.set("accessLevel", accessLevel);
    formData.set("copyrightNote", copyrightNote);
    formData.set("copyrightConfirmed", copyrightConfirmed ? "true" : "false");
    formData.set("pdfPath", pdfPath);
    if (coverPath) formData.set("coverPath", coverPath);
    if (attachmentPath) formData.set("attachmentPath", attachmentPath);
    formData.set("intent", intent);
    if (captchaSiteKey) formData.set("turnstileToken", captchaToken);

    const result = await submitAction({ status: "idle" }, formData);

    if (result.status === "error") {
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      setStatus("idle");
      return;
    }

    // สำเร็จ (ปกติ action จะ redirect เองผ่าน redirect() แต่กันไว้เผื่อไม่ redirect)
    router.refresh();
  }

  const isBusy = status !== "idle";

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ข้อมูลพื้นฐาน */}
      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ข้อมูลงานวิจัย</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              ชื่อเรื่อง (ภาษาไทย) <span className="text-red-500">*</span>
            </label>
            <input
              value={titleTh}
              onChange={(e) => setTitleTh(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="ชื่อเรื่องงานวิจัยภาษาไทย"
            />
            {fieldErrors.titleTh && (
              <p className="text-xs text-red-600">{fieldErrors.titleTh[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">ชื่อเรื่อง (ภาษาอังกฤษ)</label>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Research title in English"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              บทคัดย่อ <span className="text-red-500">*</span>
            </label>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={6}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="สรุปเนื้อหาสาระสำคัญของงานวิจัย (อย่างน้อย 50 ตัวอักษร)"
            />
            {fieldErrors.abstract && (
              <p className="text-xs text-red-600">{fieldErrors.abstract[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">หน่วยงาน</label>
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.nameTh}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">ปีที่เผยแพร่ (พ.ศ.)</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">หมวดหมู่</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameTh}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">สิทธิ์การเข้าถึง</label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {(["public", "member_only", "staff_only", "read_only", "metadata_only"] as AccessLevel[]).map((value) => (
                  <option key={value} value={value}>
                    {tAccessLevels(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ผู้วิจัย */}
      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            ผู้วิจัย <span className="text-red-500">*</span>
          </h2>
          <button
            type="button"
            onClick={addResearcher}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มผู้วิจัย
          </button>
        </div>
        {fieldErrors.researchers && (
          <p className="mb-2 text-xs text-red-600">{fieldErrors.researchers[0]}</p>
        )}
        <div className="flex flex-col gap-3">
          {researchers.map((researcher, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={researcher.name}
                onChange={(e) => updateResearcher(index, "name", e.target.value)}
                placeholder="ชื่อ-นามสกุลผู้วิจัย"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <input
                value={researcher.organization}
                onChange={(e) => updateResearcher(index, "organization", e.target.value)}
                placeholder="หน่วยงาน (ถ้ามี)"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {researchers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeResearcher(index)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-red-600"
                  aria-label="ลบผู้วิจัยรายนี้"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* คำสำคัญ */}
      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          คำสำคัญ <span className="text-red-500">*</span>
        </h2>
        <div className="flex gap-2">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="พิมพ์คำสำคัญแล้วกด Enter หรือปุ่มเพิ่ม"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            เพิ่ม
          </button>
        </div>
        {fieldErrors.keywords && (
          <p className="mt-2 text-xs text-red-600">{fieldErrors.keywords[0]}</p>
        )}
        {keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
              >
                #{keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  aria-label={`ลบคำสำคัญ ${keyword}`}
                  className="text-gray-500 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ไฟล์แนบ */}
      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ไฟล์เอกสาร</h2>
        <div className="flex flex-col gap-4">
          <FileInputRow
            icon={FileText}
            label={`ไฟล์ PDF ฉบับเต็ม ${isEditMode ? "" : "*"}`}
            helper={`รองรับ PDF เท่านั้น ขนาดไม่เกิน ${formatFileSize(pdfMaxBytes)}`}
            file={pdfFile}
            currentFileLabel={isEditMode && initialData?.pdfFile ? "มีไฟล์ปัจจุบันอยู่แล้ว" : undefined}
            inputRef={pdfInputRef}
            accept="application/pdf"
            onChange={(file) => handleFileChange(file, "pdf")}
            error={fileErrors.pdf || fieldErrors.pdfPath?.[0]}
          />
          <FileInputRow
            icon={ImageIcon}
            label="ภาพปก (แนะนำ)"
            helper={`PNG, JPEG, WEBP หรือ SVG ขนาดไม่เกิน ${formatFileSize(coverMaxBytes)}`}
            file={coverFile}
            currentFileLabel={isEditMode && initialData?.coverImage ? "มีภาพปกปัจจุบันอยู่แล้ว" : undefined}
            inputRef={coverInputRef}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(file) => handleFileChange(file, "cover")}
            error={fileErrors.cover}
          />
          <FileInputRow
            icon={Paperclip}
            label="เอกสารประกอบ (ถ้ามี)"
            helper={`เช่น หนังสือรับรองลิขสิทธิ์ — PDF/รูปภาพ/Word ขนาดไม่เกิน ${formatFileSize(attachmentMaxBytes)}`}
            file={attachmentFile}
            currentFileLabel={isEditMode && initialData?.attachmentFile ? "มีไฟล์แนบปัจจุบันอยู่แล้ว" : undefined}
            inputRef={attachmentInputRef}
            accept=".pdf,.doc,.docx,image/png,image/jpeg"
            onChange={(file) => handleFileChange(file, "attachment")}
            error={fileErrors.attachment}
          />
        </div>
      </section>

      {/* ลิขสิทธิ์ */}
      <section className="rounded-xl border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">ข้อมูลลิขสิทธิ์</h2>
        <div className="flex flex-col gap-3">
          <textarea
            value={copyrightNote}
            onChange={(e) => setCopyrightNote(e.target.value)}
            rows={3}
            placeholder="เช่น ข้าพเจ้าเป็นเจ้าของลิขสิทธิ์งานวิจัยนี้แต่เพียงผู้เดียว และยินยอมให้ห้องสมุดดิจิทัลเผยแพร่ภายใต้เงื่อนไขที่กำหนด"
            className="resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {fieldErrors.copyrightNote && (
            <p className="text-xs text-red-600">{fieldErrors.copyrightNote[0]}</p>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={copyrightConfirmed}
              onChange={(e) => setCopyrightConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            ข้าพเจ้ายืนยันว่าเป็นเจ้าของลิขสิทธิ์งานวิจัยนี้ และยินยอมให้เผยแพร่บนห้องสมุดดิจิทัล
          </label>
          {fieldErrors.copyrightConfirmed && (
            <p className="text-xs text-red-600">{fieldErrors.copyrightConfirmed[0]}</p>
          )}
        </div>
      </section>

      {captchaSiteKey && (
        <section className="rounded-xl border border-gray-200 bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">ยืนยันตัวตน</h2>
          <TurnstileWidget siteKey={captchaSiteKey} onToken={setCaptchaToken} />
          {fieldErrors.turnstileToken && (
            <p className="mt-2 text-xs text-red-600">{fieldErrors.turnstileToken[0]}</p>
          )}
        </section>
      )}

      {status === "uploading" && uploadingKind && (
        <ProgressBar
          value={uploadProgress}
          label={
            uploadingKind === "pdf"
              ? tUpload("uploadPdf")
              : uploadingKind === "cover"
                ? tUpload("uploadCover")
                : tUpload("uploadAttachment")
          }
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleSubmit("draft")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกฉบับร่าง
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleSubmit("pending_review")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {status === "uploading"
            ? "กำลังอัปโหลดไฟล์..."
            : status === "submitting"
              ? "กำลังบันทึก..."
              : "ส่งตรวจสอบ"}
        </button>
        {extraIntents.map((intent) => (
          <button
            key={intent.value}
            type="button"
            disabled={isBusy}
            onClick={() => handleSubmit(intent.value)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {intent.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FileInputRow({
  icon: Icon,
  label,
  helper,
  file,
  currentFileLabel,
  inputRef,
  accept,
  onChange,
  error,
}: {
  icon: typeof FileText;
  label: string;
  helper: string;
  file: File | null;
  currentFileLabel?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Icon className="h-4 w-4" />
          เลือกไฟล์
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <span className="truncate text-xs text-gray-500">
          {file ? `${file.name} (${formatFileSize(file.size)})` : currentFileLabel || "ยังไม่ได้เลือกไฟล์"}
        </span>
      </div>
      <p className="text-xs text-gray-500">{helper}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
