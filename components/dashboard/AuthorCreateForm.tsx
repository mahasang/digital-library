"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Loader2, UserPlus } from "lucide-react";
import { createAuthorAction } from "@/app/dashboard/authors/actions";
import { checkSimilarAuthorsAction } from "@/app/dashboard/authors/check-similar-actions";
import { idleActionResult } from "@/lib/actions/types";
import type { Organization } from "@/types/research";

export default function AuthorCreateForm({ organizations }: { organizations: Organization[] }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState(createAuthorAction, idleActionResult);
  const [name, setName] = useState("");
  const [similar, setSimilar] = useState<{ id: string; name: string; similarity: number }[]>([]);
  const [checking, startCheck] = useTransition();

  function handleCheckSimilar() {
    startCheck(async () => {
      const results = await checkSimilarAuthorsAction(name);
      setSimilar(results);
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <UserPlus className="h-4 w-4" />
        เพิ่มผู้วิจัย
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">เพิ่มผู้วิจัยใหม่</h2>
        <button type="button" onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-600">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-gray-700">
            ชื่อ (ภาษาไทย) *
          </label>
          <input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="displayNameEn" className="text-xs font-medium text-gray-700">
            ชื่อ (ภาษาอังกฤษ)
          </label>
          <input
            id="displayNameEn"
            name="displayNameEn"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titlePrefixTh" className="text-xs font-medium text-gray-700">
            คำนำหน้า (ไทย)
          </label>
          <input
            id="titlePrefixTh"
            name="titlePrefixTh"
            placeholder="เช่น ดร., ผศ.ดร."
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titlePrefixEn" className="text-xs font-medium text-gray-700">
            คำนำหน้า (อังกฤษ)
          </label>
          <input
            id="titlePrefixEn"
            name="titlePrefixEn"
            placeholder="เช่น Dr., Prof."
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="organizationId" className="text-xs font-medium text-gray-700">
            หน่วยงาน
          </label>
          <select
            id="organizationId"
            name="organizationId"
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
          <label htmlFor="orcid" className="text-xs font-medium text-gray-700">
            ORCID (ถ้ามี)
          </label>
          <input
            id="orcid"
            name="orcid"
            placeholder="0000-0000-0000-0000"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {state.status === "error" && state.fieldErrors?.orcid && (
            <p className="text-xs text-red-600">{state.fieldErrors.orcid[0]}</p>
          )}
        </div>
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
            พบผู้วิจัยที่ชื่อคล้ายกัน — โปรดตรวจสอบก่อนเพิ่มรายการใหม่
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
        บันทึกผู้วิจัย
      </button>
    </form>
  );
}
