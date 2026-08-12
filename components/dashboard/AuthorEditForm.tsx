"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { updateAuthorAction } from "@/app/dashboard/authors/actions";
import { checkSimilarAuthorsAction } from "@/app/dashboard/authors/check-similar-actions";
import { idleActionResult } from "@/lib/actions/types";
import type { Organization } from "@/types/research";
import type { AdminAuthorDetail } from "@/lib/data/authors-admin.server";

export default function AuthorEditForm({
  author,
  organizations,
}: {
  author: AdminAuthorDetail;
  organizations: Organization[];
}) {
  const [state, formAction, pending] = useActionState(updateAuthorAction, idleActionResult);
  const [name, setName] = useState(author.name);
  const [similar, setSimilar] = useState<{ id: string; name: string; similarity: number }[]>([]);
  const [checking, startCheck] = useTransition();

  function handleCheckSimilar() {
    startCheck(async () => {
      const results = await checkSimilarAuthorsAction(name, author.id);
      setSimilar(results);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-surface p-5">
      <input type="hidden" name="authorId" value={author.id} />
      <h2 className="text-sm font-semibold text-gray-900">แก้ไขข้อมูลผู้วิจัย</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-name" className="text-xs font-medium text-gray-700">
            ชื่อ (ภาษาไทย) *
          </label>
          <input
            id="edit-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-displayNameEn" className="text-xs font-medium text-gray-700">
            ชื่อ (ภาษาอังกฤษ)
          </label>
          <input
            id="edit-displayNameEn"
            name="displayNameEn"
            defaultValue={author.displayNameEn}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-titlePrefixTh" className="text-xs font-medium text-gray-700">
            คำนำหน้า (ไทย)
          </label>
          <input
            id="edit-titlePrefixTh"
            name="titlePrefixTh"
            defaultValue={author.titlePrefixTh}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-titlePrefixEn" className="text-xs font-medium text-gray-700">
            คำนำหน้า (อังกฤษ)
          </label>
          <input
            id="edit-titlePrefixEn"
            name="titlePrefixEn"
            defaultValue={author.titlePrefixEn}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-organizationId" className="text-xs font-medium text-gray-700">
            หน่วยงาน
          </label>
          <select
            id="edit-organizationId"
            name="organizationId"
            defaultValue={author.organizationId ?? ""}
            className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">-- ไม่ระบุ --</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.nameTh}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-orcid" className="text-xs font-medium text-gray-700">
            ORCID
          </label>
          <input
            id="edit-orcid"
            name="orcid"
            defaultValue={author.orcid ?? ""}
            placeholder="0000-0000-0000-0000"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {state.status === "error" && state.fieldErrors?.orcid && (
            <p className="text-xs text-red-600">{state.fieldErrors.orcid[0]}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-biography" className="text-xs font-medium text-gray-700">
          ประวัติโดยย่อ (ไม่บังคับ)
        </label>
        <textarea
          id="edit-biography"
          name="biography"
          rows={3}
          defaultValue={author.biography}
          className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <button
        type="button"
        onClick={handleCheckSimilar}
        disabled={checking || name.trim().length < 2}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checking && <Loader2 className="h-3 w-3 animate-spin" />}
        ตรวจสอบชื่อซ้ำ
      </button>

      {similar.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            พบผู้วิจัยที่ชื่อคล้ายกัน — พิจารณารวมข้อมูลแทนการเก็บแยกกันหากเป็นคนเดียวกันจริง
          </p>
          {similar.map((s) => (
            <p key={s.id} className="text-xs text-amber-700">
              {s.name} (คล้ายกัน {Math.round(s.similarity * 100)}%)
            </p>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        บันทึกการแก้ไข
      </button>
    </form>
  );
}
