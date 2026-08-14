"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitMerge,
  Link2,
  Loader2,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import {
  toggleAuthorActiveAction,
  verifyOrcidAction,
  mergeAuthorsAction,
  linkAuthorProfileAction,
  unlinkAuthorProfileAction,
  checkOrcidPublicApiAction,
} from "@/app/[locale]/dashboard/authors/actions";
import { idleActionResult } from "@/lib/actions/types";
import { orcidProfileUrl } from "@/lib/validation/orcid";
import { useDialogA11y } from "@/lib/hooks/useDialogA11y";

export function OrcidPanel({
  authorId,
  orcid,
  orcidVerifiedAt,
  orcidOauthVerifiedAt,
}: {
  authorId: string;
  orcid: string | null;
  orcidVerifiedAt: string | null;
  orcidOauthVerifiedAt?: string | null;
}) {
  const [state, formAction, pending] = useActionState(verifyOrcidAction, idleActionResult);

  if (!orcid) {
    return <p className="text-sm text-gray-500">ยังไม่มี ORCID</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={orcidProfileUrl(orcid)}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-1.5 font-mono text-sm text-accent hover:underline"
      >
        {orcid}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {orcidOauthVerifiedAt && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          ยืนยันผ่าน ORCID OAuth จริงเมื่อ {new Date(orcidOauthVerifiedAt).toLocaleDateString("th-TH")}
        </p>
      )}
      {orcidVerifiedAt ? (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          เจ้าหน้าที่ตรวจสอบด้วยตนเองเมื่อ {new Date(orcidVerifiedAt).toLocaleDateString("th-TH")}
        </p>
      ) : orcidOauthVerifiedAt ? null : (
        <form action={formAction}>
          <input type="hidden" name="authorId" value={authorId} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" />}
            ยืนยันว่าตรวจสอบแล้ว
          </button>
          <p className="mt-1 text-[11px] text-gray-500">
            เป็นการยืนยันด้วยเจ้าหน้าที่เอง ไม่ใช่การยืนยันจาก ORCID โดยตรง
          </p>
        </form>
      )}
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </div>
  );
}

/**
 * ตรวจสอบ ORCID iD กับ ORCID Public API (อ่านอย่างเดียว) — แสดงเป็น "ข้อมูล
 * แนะนำสำหรับตรวจสอบ" เท่านั้น ไม่มีปุ่ม "ใช้ข้อมูลนี้" ที่เขียนทับข้อมูลผู้วิจัย
 * โดยอัตโนมัติ — เจ้าหน้าที่ที่เห็นว่าชื่อตรงกันไปกดปุ่ม "ยืนยันว่าตรวจสอบแล้ว"
 * ใน OrcidPanel ด้านบน หรือแก้ไขชื่อในฟอร์มผู้วิจัยเองตามปกติ
 */
export function OrcidApiCheckPanel({
  authorId,
  orcid,
  displayNameEn,
  orcidApiCheckedAt,
  orcidApiPublicName,
  isConfigured,
}: {
  authorId: string;
  orcid: string | null;
  displayNameEn: string;
  orcidApiCheckedAt: string | null;
  orcidApiPublicName: string | null;
  isConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(checkOrcidPublicApiAction, idleActionResult);

  if (!orcid) return null;

  if (!isConfigured) {
    return (
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">ยังไม่ได้ตั้งค่า ORCID Public API</p>
      </div>
    );
  }

  const nameMatch =
    orcidApiPublicName && displayNameEn
      ? orcidApiPublicName.trim().toLowerCase() === displayNameEn.trim().toLowerCase()
      : null;

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-700">ตรวจสอบข้อมูล ORCID สาธารณะ</p>
      {orcidApiCheckedAt && (
        <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          <p>ตรวจสอบล่าสุด {new Date(orcidApiCheckedAt).toLocaleString("th-TH")}</p>
          {orcidApiPublicName ? (
            <>
              <p className="mt-1">
                ชื่อสาธารณะจาก ORCID: <span className="font-medium">{orcidApiPublicName}</span>
              </p>
              {nameMatch !== null && (
                <p className={`mt-1 ${nameMatch ? "text-green-700" : "text-amber-700"}`}>
                  {nameMatch ? "ตรงกับชื่อในระบบ" : "ชื่อในระบบอาจไม่ตรงกัน — โปรดตรวจสอบ"}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-gray-500">ไม่พบข้อมูลชื่อสาธารณะ</p>
          )}
        </div>
      )}
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="authorId" value={authorId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          ตรวจสอบ ORCID
        </button>
        {orcidApiCheckedAt && (
          <button
            type="submit"
            name="forceRefresh"
            value="true"
            disabled={pending}
            className="text-xs text-gray-500 hover:text-gray-600 hover:underline disabled:opacity-50"
          >
            บังคับตรวจสอบใหม่
          </button>
        )}
      </form>
      <p className="text-[11px] text-gray-500">
        ข้อมูลนี้เป็นข้อเสนอแนะสำหรับเปรียบเทียบเท่านั้น ระบบจะไม่บันทึกทับข้อมูลผู้วิจัยโดยอัตโนมัติ
      </p>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      {state.status === "success" && <p className="text-xs text-green-700">{state.message}</p>}
    </div>
  );
}

export function AuthorActiveToggle({ authorId, isActive }: { authorId: string; isActive: boolean }) {
  const [state, formAction, pending] = useActionState(toggleAuthorActiveAction, idleActionResult);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="authorId" value={authorId} />
      <input type="hidden" name="nextActive" value={(!isActive).toString()} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
          isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"
        }`}
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        {isActive ? "ปิดใช้งานผู้วิจัย" : "เปิดใช้งานผู้วิจัย"}
      </button>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}

export function MergeAuthorDialog({
  authorId,
  authorName,
  candidates,
}: {
  authorId: string;
  authorName: string;
  candidates: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState(mergeAuthorsAction, idleActionResult);

  const isConfirmValid = confirmText.trim() === authorName.trim() && targetId !== "";
  const dialogRef = useDialogA11y(open, () => setOpen(false), pending);

  // ดู BulkAllMatchingFilterDialog — ปุ่มเปิด/dialog เป็นคนละสาขา render กัน
  // ปุ่มเดิม unmount เมื่อเปิด dialog จึงต้องคืน focus เองด้วย ref ของปุ่มใหม่
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <GitMerge className="h-3.5 w-3.5" />
        รวมเข้ากับผู้วิจัยอื่น
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={pending ? undefined : () => setOpen(false)} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-author-dialog-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 shrink-0 text-accent" />
            <h3 id="merge-author-dialog-title" className="text-base font-semibold text-gray-900">รวมข้อมูลผู้วิจัย</h3>
          </div>
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-gray-500 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-600">
          &quot;{authorName}&quot; จะถูกรวมเข้ากับผู้วิจัยที่เลือก งานวิจัยทั้งหมดของ &quot;{authorName}&quot; จะย้ายไปอยู่ภายใต้ผู้วิจัยหลักแทน
          และ &quot;{authorName}&quot; จะถูกปิดใช้งาน (ไม่ถูกลบ)
        </p>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="sourceId" value={authorId} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="targetId" className="text-xs font-medium text-gray-700">
              รวมเข้ากับผู้วิจัยหลัก (จำเป็น)
            </label>
            <select
              id="targetId"
              name="targetId"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={pending}
              className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">-- เลือกผู้วิจัยหลัก --</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-xs font-medium text-gray-700">
              เหตุผลในการรวม (ไม่บังคับ)
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={2}
              disabled={pending}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmText" className="text-xs font-medium text-gray-700">
              พิมพ์ <span className="font-semibold">{authorName}</span> เพื่อยืนยัน
            </label>
            <input
              id="confirmText"
              name="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={pending}
              autoComplete="off"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {state.status === "error" && (
            <p className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {state.message}
            </p>
          )}
          {state.status === "success" && (
            <p className="flex items-start gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {state.message}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending || !isConfirmValid}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              ยืนยันรวมข้อมูล
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * เชื่อม/ยกเลิกเชื่อมบัญชีผู้ใช้ (profiles) เข้ากับผู้วิจัยคนนี้ — เมื่อเชื่อม
 * แล้วผู้วิจัยจะเห็นปุ่ม "เชื่อม ORCID" ที่หน้า /account ของตัวเอง เจ้าหน้าที่
 * เป็นผู้เชื่อมเท่านั้น (ค้นหาด้วยอีเมลที่ลงทะเบียนไว้แล้ว ไม่สร้างบัญชีใหม่)
 */
export function LinkProfilePanel({
  authorId,
  linkedProfileEmail,
  linkedProfileName,
}: {
  authorId: string;
  linkedProfileEmail: string | null;
  linkedProfileName: string | null;
}) {
  const [linkState, linkFormAction, linkPending] = useActionState(linkAuthorProfileAction, idleActionResult);
  const [unlinkState, unlinkFormAction, unlinkPending] = useActionState(
    unlinkAuthorProfileAction,
    idleActionResult
  );

  if (linkedProfileEmail) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-sm text-gray-700">
          <Link2 className="h-3.5 w-3.5 text-green-600" />
          เชื่อมกับบัญชี {linkedProfileName || linkedProfileEmail} ({linkedProfileEmail})
        </p>
        <form action={unlinkFormAction}>
          <input type="hidden" name="authorId" value={authorId} />
          <button
            type="submit"
            disabled={unlinkPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {unlinkPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            ยกเลิกการเชื่อม
          </button>
        </form>
        {unlinkState.status === "error" && <p className="text-xs text-red-600">{unlinkState.message}</p>}
      </div>
    );
  }

  return (
    <form action={linkFormAction} className="flex flex-col gap-2">
      <input type="hidden" name="authorId" value={authorId} />
      <p className="text-xs text-gray-500">
        เชื่อมบัญชีผู้ใช้ที่ลงทะเบียนไว้แล้วในระบบให้กับผู้วิจัยคนนี้ เพื่อให้เจ้าตัวเชื่อม ORCID เองได้ที่หน้าโปรไฟล์
      </p>
      <input
        type="email"
        name="email"
        placeholder="อีเมลบัญชีผู้ใช้"
        required
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button
        type="submit"
        disabled={linkPending}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {linkPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        เชื่อมบัญชี
      </button>
      {linkState.status === "error" && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {linkState.message}
        </p>
      )}
      {linkState.status === "success" && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {linkState.message}
        </p>
      )}
    </form>
  );
}
